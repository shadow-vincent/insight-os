/**
 * GET /api/sources/[id]/items
 *
 * 列出某源的所有 source_items（status 可选过滤）
 *
 * Query:
 *   - status: 'new' | 'imported' | 'skipped' | undefined（默认全显示）
 *   - limit: 数字（默认 50）
 *
 * 返回：{ ok, items: [{ id, guid, title, url, excerpt, publishedAt, fetchedAt, status, assetId }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@insight-os/db';
import { sql } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as string | null;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });

    const statusFilter = status ? sql`AND status = ${status}` : sql``;
    const items = db.all(sql`
      SELECT id, guid, title, url, excerpt, published_at as publishedAt,
             fetched_at as fetchedAt, status, asset_id as assetId
      FROM source_items
      WHERE source_id = ${id} ${statusFilter}
      ORDER BY published_at DESC NULLS LAST, fetched_at DESC
      LIMIT ${limit}
    `);

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}