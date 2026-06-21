/**
 * GET /api/writing-config
 * 列出所有 preset 元信息 + 当前 active name
 *
 * Response: { presets: WritingConfigMeta[], activeName: string }
 */

import { NextResponse } from 'next/server';
import { listPresets, getActivePresetName } from '@insight-os/core';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const presets = listPresets();
    const activeName = getActivePresetName();
    return NextResponse.json({
      ok: true,
      presets,
      activeName,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
