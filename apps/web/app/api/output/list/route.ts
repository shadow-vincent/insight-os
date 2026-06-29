/**
 * GET /api/output/list
 * 列出所有生成记录（按时间倒序）
 */

import { NextResponse } from 'next/server';
import { getDb, outputs } from '@insight-os/db';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    const list = db.select().from(outputs).orderBy(desc(outputs.createdAt)).limit(50).all();
    return NextResponse.json({ ok: true, count: list.length, items: list });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
