/**
 * GET /api/writing/[id]/versions/[vid]   — 取一个版本详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, writingVersions } from '@insight-os/db';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  try {
    const { id: writingId, vid } = await params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    const row = db
      .select()
      .from(writingVersions)
      .where(and(eq(writingVersions.id, vid), eq(writingVersions.writingId, writingId)))
      .get();
    if (!row) {
      return NextResponse.json({ ok: false, error: '版本不存在' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, version: row });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
