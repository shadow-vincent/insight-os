/**
 * LLM 统一调用接口
 *
 * - 支持任意 OpenAI 兼容接口（OpenAI / Anthropic via proxy / OpenClaw / 本地 LLM）
 * - 配置优先读 storage/config.json，fallback 到环境变量
 * - 修改配置后**不需重启**，下次调用自动用新配置
 * - 所有 prompt 调用强制 JSON 模式
 * - 健壮容错：API 错 / 非法 JSON / 非法字段都返回 null，不影响主流程
 */
import { type KernelEntry } from './kernel-injector';
export interface LLMOptions {
    model?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    jsonMode?: boolean;
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
 * 调用 LLM，返回结构化结果
 *
 * - 自动 jsonMode 时用 response_format: { type: 'json_object' }
 * - 解析失败返回 { ok: false, data: null }
 * - 不抛异常（不污染主流程）
 */
export declare function callLLM<T = unknown>(systemPrompt: string, userPrompt: string, options?: LLMOptions): Promise<LLMResult<T>>;
/**
 * 简易文本补全（不强 JSON）
 */
export declare function completeText(systemPrompt: string, userPrompt: string, options?: Omit<LLMOptions, 'jsonMode'>): Promise<string | null>;
/**
 * 流式 LLM 调用（v0.7.4 SSE 打字机效果用）
 *
 * 返回 AsyncIterable<string>，每次 yield 一个 delta 文本片段。
 * 不支持 jsonMode（流式天然不适合 JSON 解析）。
 *
 * 出错时 yield 一次 [ERROR] 标记 + 错误信息，调用方应 catch 处理。
 */
export declare function streamLLM(systemPrompt: string, userPrompt: string, options?: Omit<LLMOptions, 'jsonMode'>): AsyncGenerator<string, void, void>;
