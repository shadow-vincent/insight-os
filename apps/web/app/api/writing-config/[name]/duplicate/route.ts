/**
 * POST /api/writing-config/[name]/duplicate
 * 复制 preset 为新名字
 *
 * Request: { newName: string }
 * Response: { ok, ...WritingConfig } | { ok: false, error }
 */

import { NextRequest, NextResponse } from 'next/server';
import { duplicatePreset } from '@insight-os/core';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const body = await req.json();
    const newName = body.newName?.trim();
    if (!newName) {
      return NextResponse.json({ ok: false, error: '缺少 newName' }, { status: 400 });
    }
    if (!/^[a-z0-9-]+$/.test(newName)) {
      return NextResponse.json({ ok: false, error: 'newName 必须是 a-z0-9- 字符' }, { status: 400 });
    }
    const dup = duplicatePreset(name, newName);
    if (!dup) {
      return NextResponse.json({ ok: false, error: '复制失败（源不存在或目标名冲突）' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...dup });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
