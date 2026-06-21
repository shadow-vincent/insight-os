/**
 * POST /api/output/review
 *
 * AI partner 对话改稿（V1.2 阶段 D2）
 *
 * 输入：选中的文本片段 + 用户改稿指令
 * 输出：AI 改写建议（保留原文风格，可对比）
 *
 * Request: {
 *   selectedText: string,           // 用户选中的段落（10-500 字）
 *   instruction: string,            // 改稿指令（"更口语化" / "更短" / "加金句"等）
 *   presetName?: string,            // 用某个 preset 的 5 维度风格
 *   fullContext?: string,           // 文章全文（帮助 AI 理解上下文）
 * }
 *
 * Response: { ok, suggestion: string, reasoning: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLLM, serializeDimensions } from '@insight-os/llm';
import { isLLMConfigured, readPreset } from '@insight-os/core';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json({ ok: false, error: 'LLM 未配置' }, { status: 400 });
    }

    const body = await req.json();
    const { selectedText, instruction, presetName, fullContext } = body;

    if (!selectedText || selectedText.trim().length < 10) {
      return NextResponse.json({ ok: false, error: 'selectedText 太短（至少 10 字）' }, { status: 400 });
    }
    if (!instruction || instruction.trim().length < 3) {
      return NextResponse.json({ ok: false, error: 'instruction 太短' }, { status: 400 });
    }

    const config = presetName ? readPreset(presetName) : null;
    const dimensionsBlock = config ? serializeDimensions(config.dimensions) : '';

    const systemPrompt = `你是 Vincent 的写作改稿 partner。

**任务**：根据用户指令，改写用户选中的文本片段。

**原则**：
1. **保留 Vincent 风格** —— 口语化、有判断、不说教、有温度
2. **只改用户要求的部分** —— 其他维度（语气/节奏/结构）保持原文
3. **提供 1 个改写版本 + 30 字 reasoning** —— 让 Vincent 看到为什么这样改
4. **不改数据** —— 如果原文有具体数字，按原文保留（除非用户明确要求改）
5. **输出严格 JSON**，不要 markdown 代码块

**输出**：
{
  "suggestion": "<改写后的文本>",
  "reasoning": "<为什么这样改（30 字以内）>"
}`;

    const userPrompt = `## 用户指令
${instruction}

## 选中的文本
"""
${selectedText}
"""

${fullContext ? `## 文章上下文（帮助理解）\n${fullContext.slice(0, 1500)}\n` : ''}
${dimensionsBlock ? `${dimensionsBlock}\n` : ''}

请按 JSON 格式输出改写建议。`;

    const result = await callLLM<{
      suggestion: string;
      reasoning: string;
    }>(systemPrompt, userPrompt, {
      temperature: 0.6,
      maxTokens: 1500,
      jsonMode: true,
    });

    if (!result.ok || !result.data) {
      return NextResponse.json({ ok: false, error: result.error ?? '改稿失败' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      suggestion: result.data.suggestion,
      reasoning: result.data.reasoning,
      usage: result.usage,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}