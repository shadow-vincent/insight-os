/**
 * GET  /api/config  获取脱敏后的配置
 * POST /api/config  更新配置（部分字段）
 */

import { NextRequest, NextResponse } from 'next/server';
import { readConfig, updateConfig, sanitize } from '@insight-os/core';

export async function GET() {
  try {
    const config = readConfig();
    return NextResponse.json({ ok: true, config: sanitize(config) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const partial: any = {};

    // LLM 配置
    if (body.llm) {
      partial.llm = {};
      if (typeof body.llm.baseUrl === 'string') {
        partial.llm.baseUrl = body.llm.baseUrl.trim();
      }
      // apiKey 可以是空字符串（清除）或者新值
      if (typeof body.llm.apiKey === 'string') {
        partial.llm.apiKey = body.llm.apiKey.trim();
      }
      if (typeof body.llm.model === 'string') {
        partial.llm.model = body.llm.model.trim();
      }
      if (typeof body.llm.enabled === 'boolean') {
        partial.llm.enabled = body.llm.enabled;
      } else {
        // 如果 baseUrl 和 apiKey 都配了，自动 enabled
        const current = readConfig();
        const merged = { ...current.llm, ...partial.llm };
        partial.llm.enabled = !!merged.apiKey && merged.apiKey !== 'sk-placeholder';
      }
    }

    // 路径配置
    if (body.paths?.vaultPath) {
      partial.paths = { vaultPath: body.paths.vaultPath.trim() };
    }

    const updated = updateConfig(partial);
    return NextResponse.json({ ok: true, config: sanitize(updated) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
