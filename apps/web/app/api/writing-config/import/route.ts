/**
 * POST /api/writing-config/import
 * 从 YAML 字符串导入 preset
 *
 * Request: { yaml: string, desiredName?: string }
 * Response: { ok, name, warnings? } | { ok: false, error }
 */

import { NextRequest, NextResponse } from 'next/server';
import { importPreset } from '@insight-os/core';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.yaml || typeof body.yaml !== 'string') {
      return NextResponse.json({ ok: false, error: '缺少 yaml 字段' }, { status: 400 });
    }
    const result = importPreset(body.yaml, body.desiredName);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, name: result.name, warnings: result.warnings });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
