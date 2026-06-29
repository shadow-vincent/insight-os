/**
 * /api/candidates/[id]
 *
 * v1.8.0 候选详情：
 *   - GET    拿单条候选（用于 /candidates/[id] 详情页）
 *   - DELETE 删 light card（候选/归档轻量卡）+ 删关联 .md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { eq, inArray } from 'drizzle-orm';
import { rmSync, existsSync } from 'node:fs';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const row = db.select().from(assets).where(eq(assets.id, id)).get();
    if (!row) {
      return NextResponse.json({ ok: false, error: '候选卡不存在' }, { status: 404 });
    }

    // 安全解析 scoreBreakdownJson + tagsJson
    let breakdown = {};
    try { breakdown = JSON.parse(row.scoreBreakdownJson || '{}'); } catch { /* noop */ }
    let tags: string[] = [];
    try { tags = JSON.parse(row.tagsJson || '[]'); } catch { /* noop */ }
    let relatedIds: string[] = [];
    try { relatedIds = JSON.parse(row.relatedIdsJson || '[]'); } catch { /* noop */ }

    // 拿到 related 资产标题（用于显示"与已加工资产相似"）
    let relatedAssets: Array<{ id: string; title: string; evidenceLevel: string }> = [];
    if (relatedIds.length > 0) {
      relatedAssets = db.select({
        id: assets.id,
        title: assets.title,
        evidenceLevel: assets.evidenceLevel,
      })
        .from(assets)
        .where(inArray(assets.id, relatedIds))
        .all();
    }

    return NextResponse.json({
      ok: true,
      candidate: {
        id: row.id,
        title: row.title,
        type: row.type,
        status: row.status,
        source: row.source,
        sourceType: row.sourceType,
        oneSentenceInsight: row.oneSentenceInsight,
        antiCommonSense: row.antiCommonSense,
        evidenceLevel: row.evidenceLevel,
        priority: row.priority,
        tags,
        relatedIds,
        relatedAssets,
        // v1.8.0
        scoreTotal: row.scoreTotal,
        scoreBreakdown: breakdown,
        outputCount: row.outputCount,
        feedbackCount: row.feedbackCount,
        processedAt: row.processedAt,
        isKernelCandidate: row.isKernelCandidate,
        isKernelApproved: row.isKernelApproved,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (e: any) {
    console.error('[api/candidates/[id] GET] error:', e);
    return NextResponse.json(
      { ok: false, error: e.message ?? String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const row = db.select().from(assets).where(eq(assets.id, id)).get();
    if (!row) {
      return NextResponse.json({ ok: false, error: '候选卡不存在' }, { status: 404 });
    }

    // 删 .md 文件（轻量卡的 md 在 _light_cards/ 子目录）
    if (row.filePath && existsSync(row.filePath)) {
      try {
        rmSync(row.filePath);
      } catch (e) {
        console.warn(`[delete candidate] failed to remove file ${row.filePath}:`, e);
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