/**
 * GET  /api/writing/[id]/draft   — 读最新草稿（用于页面打开时恢复）
 * POST /api/writing/[id]/draft   — debounce 自动保存（覆盖式，writing 维度唯一 1 行）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, writingDrafts } from '@insight-os/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.select().from(writingDrafts).where(eq(writingDrafts.writingId, id)).get();
    if (!row) {
      return NextResponse.json({ ok: true, draft: null });
    }
    return NextResponse.json({ ok: true, draft: row });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: writingId } = await params;
    const { content, title } = await req.json() as { content: string; title?: string };
    if (typeof content !== 'string') {
      return NextResponse.json({ ok: false, error: 'content 必须为字符串' }, { status: 400 });
    }

    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const existing = db.select().from(writingDrafts).where(eq(writingDrafts.writingId, writingId)).get();

    if (existing) {
      db.update(writingDrafts)
        .set({ content, title: title ?? null, updatedAt: now })
        .where(eq(writingDrafts.writingId, writingId))
        .run();
      return NextResponse.json({ ok: true, draftId: existing.id, updatedAt: now });
    }

    const draftId = `draft_${writingId}_${now}`;
    db.insert(writingDrafts)
      .values({ id: draftId, writingId, content, title: title ?? null, updatedAt: now })
      .run();
    return NextResponse.json({ ok: true, draftId, updatedAt: now });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
