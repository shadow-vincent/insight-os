/**
 * POST /api/candidates/[id]/ignore
 *
 * v1.8.0 状态机 · 忽略（人工确认闸门）
 *
 * 候选状态流转：
 *   candidate (待你确认) → inbox (仅素材信号)
 *
 * 适用场景：用户看了候选后决定"不加工"
 *
 * V1.8.0 设计原则：
 * - 不暴露 status enum 给用户（"忽略"比"状态机转 inbox"更自然）
 * - 不写历史轨迹表（V1.8.1 后再做）
 * - 写 processed_at（最后被处理的时间）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * 合法状态流转：candidate → inbox（忽略）
 * 拒绝其他流转（防非法状态机）
 */
function validateTransition(from: string): { ok: boolean; reason?: string } {
  if (from === 'candidate') return { ok: true };
  return {
    ok: false,
    reason: `候选卡当前状态为 "${from}"，不能忽略（只有 candidate 状态可忽略）`,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });
    const now = Math.floor(Date.now() / 1000);

    const row = db.select().from(assets).where(eq(assets.id, id)).get();
    if (!row) {
      return NextResponse.json({ ok: false, error: '候选卡不存在' }, { status: 404 });
    }

    const check = validateTransition(row.status);
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.reason }, { status: 400 });
    }

    // 状态机流转：candidate → inbox（"忽略"是降级到原始素材）
    db.update(assets)
      .set({
        status: 'inbox',
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(assets.id, id))
      .run();

    return NextResponse.json({
      ok: true,
      id,
      fromStatus: 'candidate',
      toStatus: 'inbox',
      message: '已忽略这条候选判断',
    });
  } catch (e: any) {
    console.error('[api/candidates/[id]/ignore] error:', e);
    return NextResponse.json(
      { ok: false, error: e.message ?? String(e) },
      { status: 500 }
    );
  }
}