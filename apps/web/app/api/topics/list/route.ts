/**
 * GET /api/topics/list
 * 简单列出所有主题（用于详情页"添加主题"下拉框）
 */

import { NextResponse } from 'next/server';
import { getDb, topics } from '@insight-os/db';
import { asc } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    const list = db.select().from(topics).orderBy(asc(topics.sortOrder)).all();
    return NextResponse.json({
      ok: true,
      topics: list.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
