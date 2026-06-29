/**
 * GET /api/assets/[id]    → 查单个资产（用于 /writing/new?assetId=xxx 带入）
 * DELETE /api/assets/[id] → 删正式资产卡（type=asset），同时删关联 .md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { eq } from 'drizzle-orm';
import { rmSync, existsSync } from 'node:fs';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });
    const row = db.select().from(assets).where(eq(assets.id, id)).get();
    if (!row) {
      return NextResponse.json({ ok: false, error: '资产卡不存在' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, asset: row });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });

    const row = db.select().from(assets).where(eq(assets.id, id)).get();
    if (!row) {
      return NextResponse.json({ ok: false, error: '资产卡不存在' }, { status: 404 });
    }

    // 删 .md 文件
    if (row.filePath && existsSync(row.filePath)) {
      try {
        rmSync(row.filePath);
      } catch (e) {
        console.warn(`[delete asset] failed to remove file ${row.filePath}:`, e);
      }
    }

    // 删 db 记录
    db.delete(assets).where(eq(assets.id, id)).run();

    return NextResponse.json({
      ok: true,
      deletedId: id,
      title: row.title,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}