/**
 * GET    /api/writing-config/[name]    - 读单个 preset 全文
 * PUT    /api/writing-config/[name]    - 更新 preset
 * DELETE /api/writing-config/[name]    - 删除 preset（不能删 active）
 */

import { NextRequest, NextResponse } from 'next/server';
import { readPreset, writePreset, writePresetWithHistory, deletePreset, validateConfig, ensureShippedPresets } from '@insight-os/core';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    // 首次访问时确保 ship-ready 预设存在
    ensureShippedPresets();
    const config = readPreset(name);
    if (!config) {
      return NextResponse.json({ ok: false, error: `preset 不存在: ${name}` }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...config });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const body = await req.json();
    const config = { ...body, name, updatedAt: Date.now() };
    const warnings = validateConfig(config);
    const result = writePresetWithHistory(name, config);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: '写入失败', warnings }, { status: 500 });
    }
    return NextResponse.json({ ok: true, warnings: result.warnings ?? warnings });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const result = deletePreset(name);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
