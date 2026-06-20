/**
 * DELETE /api/assets/[id]
 *
 * 删正式资产卡（type=asset）
 * 同时删关联的 .md 文件
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { eq } from 'drizzle-orm';
import { rmSync, existsSync } from 'node:fs';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

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