/**
 * GET /api/candidates
 *
 * 列出所有轻量卡（type=light, status=candidate）— 候选池
 * 包括 status=candidate（待人工确认升级）和 status=archived（已归档）
 *
 * 返回：
 *   { ok, count, candidates: [{ id, title, status, source, sourceType, suggestedTitle, assetCard, createdAt }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { desc, inArray, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    if (!db) {
      return NextResponse.json({ ok: true, count: 0, candidates: [] });
    }

    // 候选池显示：candidate（待确认）+ archived（已归档）
    // 排除 in_use（已入库）和 inbox（原始输入）
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status'); // 可选：candidate / archived / all

    let rows;
    if (statusFilter === 'candidate' || statusFilter === 'archived' || statusFilter === 'in_use') {
      rows = db.select().from(assets)
        .where(eq(assets.status, statusFilter))
        .orderBy(desc(assets.createdAt))
        .all();
    } else {
      // 默认：只显示 candidate（待确认）—— 已入库的去资产库看
      rows = db.select().from(assets)
        .where(eq(assets.status, 'candidate'))
        .orderBy(desc(assets.createdAt))
        .all();
    }

    return NextResponse.json({
      ok: true,
      count: rows.length,
      candidates: rows.map(a => {
        const tags: string[] = JSON.parse(a.tagsJson || '[]');
        return {
          id: a.id,
          title: a.title,
          status: a.status,
          type: a.type,
          evidenceLevel: a.evidenceLevel,
          priority: a.priority,
          source: a.source,
          sourceType: a.sourceType,
          oneSentenceInsight: a.oneSentenceInsight,
          antiCommonSense: a.antiCommonSense,
          tags,
          rawText: a.oneSentenceInsight || '', // 前端 fallback
          filePath: a.filePath,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        };
      }),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
