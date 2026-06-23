/**
 * POST /api/output/vision
 *
 * 多模态输入：图片 + 文本 → LLM 生成（基于 vision model）
 *
 * Request: {
 *   images: Array<{ base64: string, mimeType: 'image/png' | 'image/jpeg' }>,  // 1-3 张
 *   prompt: string,                  // 用户的 prompt
 *   outputType: 'article_full' | 'speech' | 'book_note' | 'email' | 'analyze',
 *   presetName?: string,             // 用某个 preset 的 5 维度
 *   audience?: string,
 * }
 * Response: { ok, content: string, data: any }
 *
 * 设计：
 *   - 把图片转 base64 → OpenAI vision API
 *   - 用户 prompt + 图片分析 → LLM 生成
 *   - outputType = 'analyze' 时只描述图片（不生成文章）
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLLM, serializeDimensions, kernelToSystemPrompt } from '@insight-os/llm';
import { isLLMConfigured, readPreset } from '@insight-os/core';
import { getActiveKernelsForInjection } from '@insight-os/db';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json({
        ok: false,
        error: 'LLM 未配置',
        code: 'LLM_NOT_CONFIGURED',
      }, { status: 400 });
    }

    const body = await req.json();
    const { images, prompt, outputType = 'analyze', presetName, audience, model: reqModel } = body;

    if (!Array.isArray(images) || images.length === 0 || images.length > 3) {
      return NextResponse.json({ ok: false, error: 'images 必须 1-3 张' }, { status: 400 });
    }

    if (!prompt || prompt.trim().length < 5) {
      return NextResponse.json({ ok: false, error: 'prompt 太短' }, { status: 400 });
    }

    if (!['article_full', 'speech', 'book_note', 'email', 'analyze'].includes(outputType)) {
      return NextResponse.json({ ok: false, error: '不支持的 outputType' }, { status: 400 });
    }

    // 读 preset 5 维度（如果指定）
    let dimensionsBlock = '';
    const config = presetName ? readPreset(presetName) : null;
    if (config) {
      dimensionsBlock = serializeDimensions(config.dimensions);
    }

    // 构造 vision message
    const baseSystemPrompt = outputType === 'analyze'
      ? `你是 Vincent 的图片分析助手。用户会给你图片和描述要求。**严格按 Vincent 写作哲学**：不追热点、不营销、不堆术语、说真话。`
      : `你是 Vincent 的资深研究助手。基于用户提供的图片 + 提示，生成指定场景的内容。

**Vincent 写作哲学**：
1. 不追热点 / 2. 不做营销 / 3. 不堆术语 / 4. 不写流水账 / 5. 引用大师非深度 / 6. 框架非专业 / 7. 字数非价值

**脱 AI 味 8 条**（必过）：不"先承认再反转" / 不"基本常识" / 不"从...可以看出" / 不用"首先其次最后" / 断句避免"的"连用 / 长短错落 / 不用"我们应该" / 结尾不道德总结

${dimensionsBlock ? `\n${dimensionsBlock}\n` : ''}`;
    // v1.4 Insight Kernel：把用户的判断协议拼接到 system prompt 前面
    const kernel = getActiveKernelsForInjection();
    const systemPrompt = kernel.length > 0
      ? `${kernelToSystemPrompt(kernel)}\n${baseSystemPrompt}`
      : baseSystemPrompt;

    const userContent: any[] = [
      { type: 'text', text: prompt + (audience ? `\n\n使用对象：${audience}` : '') },
      ...images.map((img: any) => ({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
      })),
    ];

    // 直接调 OpenAI client（因为要传 vision message）
    const cfg = (await import('@insight-os/core')).readCurrentConfig();
    const client = new OpenAI({
      baseURL: cfg.llm?.baseUrl ?? process.env.LLM_BASE_URL ?? 'https://api.deepseek.com/v1',
      apiKey: cfg.llm?.apiKey ?? process.env.LLM_API_KEY ?? '',
    });

    // 默认用 config 的 model，但允许请求里覆盖（vision 需要 gpt-4o / claude-3 / gemini-1.5）
    const model = reqModel || cfg.llm?.model || process.env.LLM_MODEL || 'deepseek-v4-flash';

    const response = await client.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: outputType === 'speech' ? 6000 : outputType === 'article_full' ? 5000 : 3500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';
    if (!content) {
      return NextResponse.json({ ok: false, error: '空响应' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      content,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}