/**
 * /api/sources/[id]
 *
 * PATCH  - 更新源（启停 / 改 title / 改 fetchIntervalMin）
 * DELETE - 删除源 + 关联 source_items
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, sources, sourceItems } from '@insight-os/db';
import { eq, sql } from 'drizzle-orm';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();

    if (!db) return NextResponse.json({ ok: false, code: 'NO_SQLITE', error: 'Vercel 部署版不支持此操作，请用浏览器 IndexedDB' });

    const existing = db.select().from(sources).where(eq(sources.id, id)).get();
    if (!existing) {
      return NextResponse.json({ ok: false, error: '源不存在' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (typeof body.enabled === 'boolean') updates.enabled = body.enabled ? 1 : 0;
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim();
    if (typeof body.fetchIntervalMin === 'number' && body.fetchIntervalMin > 0) {
      updates.fetchIntervalMin = Math.floor(body.fetchIntervalMin);
    }

    db.update(sources).set(updates).where(eq(sources.id, id)).run();

    const updated = db.select().from(sources).where(eq(sources.id, id)).get();
    return NextResponse.json({ ok: true, source: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: false, code: 'NO_SQLITE', error: 'Vercel 部署版不支持此操作，请用浏览器 IndexedDB' });

    const existing = db.select().from(sources).where(eq(sources.id, id)).get();
    if (!existing) {
      return NextResponse.json({ ok: false, error: '源不存在' }, { status: 404 });
    }

    // 删除关联 items（cascade 也要走一遍）
    db.delete(sourceItems).where(eq(sourceItems.sourceId, id)).run();
    db.delete(sources).where(eq(sources.id, id)).run();

    return NextResponse.json({ ok: true, deleted: id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}