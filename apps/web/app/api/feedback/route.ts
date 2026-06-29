/**
 * POST /api/feedback
 *
 * 记录使用反馈 + 调整 E 等级
 *
 * 输入：{ assetId, outputId?, scene, reaction, mostTouchedPoint, followUpQuestions, evidenceLevelAfter }
 *
 * 副作用：
 * 1. 写 feedback 表
 * 2. 更新 assets.evidence_level（如果用户指定了）
 * 3. 更新 assets.feedback_count
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, feedback } from '@insight-os/db';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

const VALID_SCENES = ['client_talk', 'article', 'course', 'colleague', 'archive', 'other'] as const;
const VALID_ELEVELS = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      assetId,
      outputId,
      scene,
      reaction,
      mostTouchedPoint,
      followUpQuestions,
      evidenceLevelAfter,
    } = body;

    if (!assetId) {
      return NextResponse.json({ ok: false, error: '缺少 assetId' }, { status: 400 });
    }
    if (scene && !VALID_SCENES.includes(scene)) {
      return NextResponse.json({ ok: false, error: `scene 非法: ${scene}` }, { status: 400 });
    }
    if (evidenceLevelAfter && !VALID_ELEVELS.includes(evidenceLevelAfter)) {
      return NextResponse.json({ ok: false, error: `evidenceLevelAfter 非法: ${evidenceLevelAfter}` }, { status: 400 });
    }

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });

    // 检查资产存在
    const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!asset) {
      return NextResponse.json({ ok: false, error: '资产不存在' }, { status: 404 });
    }

    const now = Math.floor(Date.now() / 1000);
    const feedbackId = `fb_${randomUUID().slice(0, 8)}`;

    // 写 feedback 表
    db.insert(feedback)
      .values({
        id: feedbackId,
        outputId: outputId ?? null,
        assetId,
        scene: scene ?? 'other',
        reaction: reaction ?? null,
        mostTouchedPoint: mostTouchedPoint ?? null,
        followUpQuestions: followUpQuestions ?? null,
        evidenceLevelBefore: asset.evidenceLevel,
        evidenceLevelAfter: evidenceLevelAfter ?? asset.evidenceLevel,
        createdAt: now,
      })
      .run();

    // 更新 assets：feedback_count + evidence_level（如果指定）+ last_used_at
    const updateFields: any = {
      feedbackCount: sql`${assets.feedbackCount} + 1`,
      lastUsedAt: now,
      updatedAt: now,
    };
    if (evidenceLevelAfter && evidenceLevelAfter !== asset.evidenceLevel) {
      updateFields.evidenceLevel = evidenceLevelAfter;
    }

    db.update(assets)
      .set(updateFields)
      .where(eq(assets.id, assetId))
      .run();

    return NextResponse.json({
      ok: true,
      feedbackId,
      newEvidenceLevel: evidenceLevelAfter ?? asset.evidenceLevel,
      feedbackCount: (asset.feedbackCount ?? 0) + 1,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const assetId = url.searchParams.get('assetId');

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    let list;
    if (assetId) {
      list = db.select().from(feedback).where(eq(feedback.assetId, assetId)).orderBy(sql`${feedback.createdAt} desc`).limit(50).all();
    } else {
      list = db.select().from(feedback).orderBy(sql`${feedback.createdAt} desc`).limit(50).all();
    }

    return NextResponse.json({ ok: true, count: list.length, items: list });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
