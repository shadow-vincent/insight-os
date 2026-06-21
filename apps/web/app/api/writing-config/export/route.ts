/**
 * POST /api/writing-config/export
 * 导出 preset 为 YAML 字符串
 *
 * Request: { name, includeLLMParams?, includeFewShot? }
 * Response: { ok, yaml, filename }
 */

import { NextRequest, NextResponse } from 'next/server';
import { exportPreset } from '@insight-os/core';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ ok: false, error: '缺少 name' }, { status: 400 });
    }
    const result = exportPreset(body.name, {
      includeLLMParams: body.includeLLMParams ?? false,
      includeFewShot: body.includeFewShot ?? true,
    });
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true, yaml: result.yaml, filename: result.filename });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
