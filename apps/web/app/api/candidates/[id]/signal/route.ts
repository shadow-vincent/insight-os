/**
 * POST /api/candidates/[id]/signal
 *
 * v1.8.0 状态机 · 稍后（人工确认闸门）
 *
 * 候选状态流转：
 *   candidate (待你确认) → sorting (素材信号，暂存)
 *
 * 适用场景：用户看了候选后决定"现在不加工，但保留"
 *
 * V1.8.0 设计原则：
 * - "稍后" = 把候选降级为"素材信号"（不是删除）
 * - 用户下次还能在候选池里看到（默认 status=sorting 不显示在主页"推荐加工"里）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function validateTransition(from: string): { ok: boolean; reason?: string } {
  if (from === 'candidate') return { ok: true };
  return {
    ok: false,
    reason: `候选卡当前状态为 "${from}"，不能标记为稍后（只有 candidate 状态可标记）`,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: false, code: 'NO_SQLITE', error: 'Vercel 部署版不支持此操作，请用浏览器 IndexedDB' });
    const now = Math.floor(Date.now() / 1000);

    const row = db.select().from(assets).where(eq(assets.id, id)).get();
    if (!row) {
      return NextResponse.json({ ok: false, error: '候选卡不存在' }, { status: 404 });
    }

    const check = validateTransition(row.status);
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.reason }, { status: 400 });
    }

    // 状态机流转：candidate → sorting
    db.update(assets)
      .set({
        status: 'sorting',
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(assets.id, id))
      .run();

    return NextResponse.json({
      ok: true,
      id,
      fromStatus: 'candidate',
      toStatus: 'sorting',
      message: '已标记为稍后，可在候选判断页查看',
    });
  } catch (e: any) {
    console.error('[api/candidates/[id]/signal] error:', e);
    return NextResponse.json(
      { ok: false, error: e.message ?? String(e) },
      { status: 500 }
    );
  }
}