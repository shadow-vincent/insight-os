/**
 * POST /api/writing-config/active
 * 设置当前激活的 preset
 *
 * Request: { name: string }
 * Response: { ok, activeName }
 */

import { NextRequest, NextResponse } from 'next/server';
import { setActivePreset, getActivePresetName } from '@insight-os/core';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: '缺少 name' }, { status: 400 });
    }
    const result = setActivePreset(name);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, activeName: getActivePresetName() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
