/**
 * GET /api/writing
 * 列出所有写作状态的文章（writingStatus 非空）
 *
 * Response: { ok, writings: Array<{id, title, writingStatus, templateType, createdAt, updatedAt}> }
 */

import { NextResponse } from 'next/server';
import { getDb, outputs } from '@insight-os/db';
import { desc, isNotNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    const rows = db
      .select({
        id: outputs.id,
        title: outputs.title,
        writingStatus: outputs.writingStatus,
        templateType: outputs.templateType,
        assetIdsJson: outputs.assetIdsJson,
        createdAt: outputs.createdAt,
        updatedAt: outputs.updatedAt,
      })
      .from(outputs)
      .where(isNotNull(outputs.writingStatus))
      .orderBy(desc(outputs.updatedAt))
      .all();

    return NextResponse.json({ ok: true, writings: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}