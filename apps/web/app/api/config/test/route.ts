/**
 * POST /api/config/test
 * 测试当前 LLM 配置是否能联通
 */

import { NextResponse } from 'next/server';
import { callLLM } from '@insight-os/llm';
import { isLLMConfigured } from '@insight-os/core';

export async function POST() {
  if (!isLLMConfigured()) {
    return NextResponse.json({
      ok: false,
      error: 'LLM 未配置（请在设置页填入 API Key）',
    }, { status: 400 });
  }

  try {
    const result = await callLLM(
      'You are a connectivity test endpoint.',
      'Reply with JSON: {"pong": true}',
      { jsonMode: true, maxTokens: 50 }
    );

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        model: process.env.LLM_MODEL ?? 'unknown',
        response: result.data,
      });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
