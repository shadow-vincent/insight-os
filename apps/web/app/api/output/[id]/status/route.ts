/**
 * POST /api/output/[id]/status
 *
 * 切换 output 的写作状态（scaffold / draft / published）
 *
 * Request: { writingStatus: 'scaffold' | 'draft' | 'published' }
 * Response: { ok, output: { id, writingStatus, ... } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, outputs } from '@insight-os/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { writingStatus } = body;

    if (!['scaffold', 'draft', 'published'].includes(writingStatus)) {
      return NextResponse.json({ ok: false, error: 'writingStatus 必须是 scaffold / draft / published' }, { status: 400 });
    }

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    const existing = db.select().from(outputs).where(eq(outputs.id, id)).limit(1).all();
    if (existing.length === 0) {
      return NextResponse.json({ ok: false, error: 'output 不存在' }, { status: 404 });
    }

    const now = Math.floor(Date.now() / 1000);
    db.update(outputs)
      .set({ writingStatus, updatedAt: now } as any)
      .where(eq(outputs.id, id))
      .run();

    return NextResponse.json({
      ok: true,
      output: {
        id,
        writingStatus,
        updatedAt: now,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}