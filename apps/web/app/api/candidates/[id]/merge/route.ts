/**
 * POST /api/candidates/[id]/merge
 *
 * v1.8.0 状态机 · 合并（人工确认闸门）
 *
 * 候选状态流转：
 *   候选 A (candidate) → archived
 *   合并到目标资产 B（in_use / candidate）
 *
 * 输入：{ targetId: string }
 *
 * V1.8.0 设计原则：
 * - 合并不是删除，是把 A 的核心判断并入 B 的 anti_common_sense
 * - source_material_id 标记 A 来自 B 的同一素材族
 * - related_ids_json 双向记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface MergeRequest {
  targetId: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as MergeRequest;
    const targetId = body.targetId;

    if (!targetId) {
      return NextResponse.json({ ok: false, error: '缺少 targetId' }, { status: 400 });
    }
    if (targetId === id) {
      return NextResponse.json({ ok: false, error: '不能合并到自己' }, { status: 400 });
    }

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });
    const now = Math.floor(Date.now() / 1000);

    const source = db.select().from(assets).where(eq(assets.id, id)).get();
    if (!source) {
      return NextResponse.json({ ok: false, error: '源候选卡不存在' }, { status: 404 });
    }
    if (source.status !== 'candidate') {
      return NextResponse.json(
        { ok: false, error: `源候选卡状态为 "${source.status}"，不能合并` },
        { status: 400 }
      );
    }

    const target = db.select().from(assets).where(eq(assets.id, targetId)).get();
    if (!target) {
      return NextResponse.json({ ok: false, error: '目标资产不存在' }, { status: 404 });
    }
    if (target.status !== 'in_use' && target.status !== 'candidate') {
      return NextResponse.json(
        { ok: false, error: `目标资产状态为 "${target.status}"，不能作为合并目标` },
        { status: 400 }
      );
    }

    // 1. 把源的 one_sentence_insight 并入 target 的 anti_common_sense
    const targetAnti = target.antiCommonSense ?? '';
    const mergedAnti = targetAnti
      ? `${targetAnti}\n\n[合并自 ${source.title}] ${source.oneSentenceInsight ?? ''}`
      : (source.oneSentenceInsight ?? '');

    // 2. 双向加 related
    let targetRelated: string[] = [];
    try { targetRelated = JSON.parse(target.relatedIdsJson || '[]'); } catch { /* noop */ }
    if (!targetRelated.includes(id)) targetRelated.push(id);

    let sourceRelated: string[] = [];
    try { sourceRelated = JSON.parse(source.relatedIdsJson || '[]'); } catch { /* noop */ }
    if (!sourceRelated.includes(targetId)) sourceRelated.push(targetId);

    // 3. 更新 target：合并 anti + 加 related + 升级 feedback_count（合并算 1 次反馈）
    db.update(assets)
      .set({
        antiCommonSense: mergedAnti,
        relatedIdsJson: JSON.stringify(targetRelated),
        feedbackCount: target.feedbackCount + 1,
        updatedAt: now,
      })
      .where(eq(assets.id, targetId))
      .run();

    // 4. source 归档
    db.update(assets)
      .set({
        status: 'archived',
        relatedIdsJson: JSON.stringify(sourceRelated),
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(assets.id, id))
      .run();

    return NextResponse.json({
      ok: true,
      merged: {
        fromId: id,
        fromTitle: source.title,
        toId: targetId,
        toTitle: target.title,
        toStatus: target.status,
      },
      message: `已将「${source.title}」合并到「${target.title}」`,
    });
  } catch (e: any) {
    console.error('[api/candidates/[id]/merge] error:', e);
    return NextResponse.json(
      { ok: false, error: e.message ?? String(e) },
      { status: 500 }
    );
  }
}