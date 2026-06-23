/**
 * LLM 统一调用接口
 *
 * - 支持任意 OpenAI 兼容接口（OpenAI / Anthropic via proxy / OpenClaw / 本地 LLM）
 * - 配置优先读 storage/config.json，fallback 到环境变量
 * - 修改配置后**不需重启**，下次调用自动用新配置
 * - 所有 prompt 调用强制 JSON 模式
 * - 健壮容错：API 错 / 非法 JSON / 非法字段都返回 null，不影响主流程
 */

import OpenAI from 'openai';
import { readConfig } from '@insight-os/core';
import { prependKernel, type KernelEntry } from './kernel-injector.ts';

let _client: OpenAI | null = null;
let _clientConfigHash: string | null = null;

export interface LLMOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  jsonMode?: boolean; // 强制 JSON 输出
  /** v1.4 Insight Kernel：用户的判断协议，自动注入到 system prompt 前面 */
  kernel?: KernelEntry[];
}

export interface LLMResult<T> {
  ok: boolean;
  data: T | null;
  raw: string | null;
  error: string | null;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 读当前配置（每次都重新读，文件改了立即生效）
 */
function readCurrentConfig() {
  try {
    return readConfig().llm;
  } catch {
    // 配置文件读不到时 fallback 到环境变量
    return {
      baseUrl: process.env.LLM_BASE_URL ?? 'https://api.deepseek.com/v1',
      apiKey: process.env.LLM_API_KEY ?? 'sk-placeholder',
      model: process.env.LLM_MODEL ?? 'deepseek-v4-flash',
      enabled: false,
    };
  }
}

function getClient(): OpenAI {
  const cfg = readCurrentConfig();
  const hash = `${cfg.baseUrl}::${cfg.apiKey}`;

  // 配置变了就重建 client
  if (!_client || _clientConfigHash !== hash) {
    _client = new OpenAI({ baseURL: cfg.baseUrl, apiKey: cfg.apiKey });
    _clientConfigHash = hash;
  }
  return _client;
}

/**
 * 调用 LLM，返回结构化结果
 *
 * - 自动 jsonMode 时用 response_format: { type: 'json_object' }
 * - 解析失败返回 { ok: false, data: null }
 * - 不抛异常（不污染主流程）
 */
export async function callLLM<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  options: LLMOptions = {}
): Promise<LLMResult<T>> {
  // 优先用 options 传的 model，其次 config.json，最后环境变量
  const cfg = readCurrentConfig();
  const model = options.model ?? cfg.model ?? process.env.LLM_MODEL ?? 'deepseek-v4-flash';
  const temperature = options.temperature ?? 0.3;
  const topP = options.topP;
  const maxTokens = options.maxTokens ?? 2000;
  const jsonMode = options.jsonMode ?? true;

  // v1.4 Insight Kernel：把用户判断协议自动拼接到 system prompt 前面
  const effectiveSystemPrompt = prependKernel(systemPrompt, options.kernel);

  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model,
      temperature,
      ...(topP !== undefined ? { top_p: topP } : {}),
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      messages: [
        { role: 'system', content: effectiveSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? null;
    if (!content) {
      return { ok: false, data: null, raw: null, error: '空响应' };
    }

    let data: T | null = null;
    if (jsonMode) {
      // 尝试直接解析；如果失败，尝试从 markdown code block 里提取
      const cleaned = content.trim();
      const tryParse = (s: string): T | null => {
        try { return JSON.parse(s); } catch { return null; }
      };
      data = tryParse(cleaned);
      if (!data) {
        // 尝试去掉 ```json ... ``` 包裹
        const m = cleaned.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
        if (m) data = tryParse(m[1]);
      }
      if (!data) {
        // 尝试从第一个 { 到最后一个 } 之间提取
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start >= 0 && end > start) data = tryParse(cleaned.slice(start, end + 1));
      }
      if (!data) {
        return { ok: false, data: null, raw: content, error: `JSON 解析失败: 无法从 LLM 输出中提取有效 JSON` };
      }
      // 调试：把 raw 输出到 console（仅在 parse 失败时）
      // console.log('[callLLM] raw output (parse failed):', content.slice(-500));
    } else {
      data = content as unknown as T;
    }

    return {
      ok: true,
      data,
      raw: content,
      error: null,
      model: response.model ?? model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  } catch (e: any) {
    return { ok: false, data: null, raw: null, error: e.message ?? String(e) };
  }
}

/**
 * 简易文本补全（不强 JSON）
 */
export async function completeText(
  systemPrompt: string,
  userPrompt: string,
  options: Omit<LLMOptions, 'jsonMode'> = {}
): Promise<string | null> {
  const result = await callLLM<string>(systemPrompt, userPrompt, { ...options, jsonMode: false });
  return result.ok ? result.data : null;
}

/**
 * 流式 LLM 调用（v0.7.4 SSE 打字机效果用）
 *
 * 返回 AsyncIterable<string>，每次 yield 一个 delta 文本片段。
 * 不支持 jsonMode（流式天然不适合 JSON 解析）。
 *
 * 出错时 yield 一次 [ERROR] 标记 + 错误信息，调用方应 catch 处理。
 */
export async function* streamLLM(
  systemPrompt: string,
  userPrompt: string,
  options: Omit<LLMOptions, 'jsonMode'> = {}
): AsyncGenerator<string, void, void> {
  const cfg = readCurrentConfig();
  const model = options.model ?? cfg.model ?? process.env.LLM_MODEL ?? 'deepseek-v4-flash';
  const temperature = options.temperature ?? 0.5;
  const topP = options.topP;
  const maxTokens = options.maxTokens ?? 1500;

  // v1.4 Insight Kernel：同样的拼接逻辑
  const effectiveSystemPrompt = prependKernel(systemPrompt, options.kernel);

  try {
    const client = getClient();
    const stream = await client.chat.completions.create({
      model,
      temperature,
      ...(topP !== undefined ? { top_p: topP } : {}),
      max_tokens: maxTokens,
      stream: true,
      messages: [
        { role: 'system', content: effectiveSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  } catch (e: any) {
    yield `[ERROR] ${e.message ?? String(e)}`;
  }
}
