/**
 * POST /api/sources/[id]/items/[itemId]/import
 *
 * v1.9.1 一键加工：把 source_item 转成 insight-os 候选资产
 *
 * 流程：
 * 1. 读 source_item（title + excerpt + url）
 * 2. 调 /api/inbox/intake（用 excerpt + title 做 rawContent）
 * 3. intake 自动跑 LLM 提炼，生成 candidate 资产
 * 4. 写 source_item.status='imported' + assetId 关联
 *
 * 重复加工保护：source_item.status='imported' 且 assetId 非空时拒绝
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, sources, sourceItems } from '@insight-os/db';
import { eq, and } from 'drizzle-orm';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: sourceId, itemId } = await params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });

    const item = db.select().from(sourceItems)
      .where(and(eq(sourceItems.id, itemId), eq(sourceItems.sourceId, sourceId)))
      .get();

    if (!item) {
      return NextResponse.json({ ok: false, error: '条目不存在' }, { status: 404 });
    }

    if (item.status === 'imported' && item.assetId) {
      return NextResponse.json({
        ok: false,
        error: '该条目已经加工为资产',
        code: 'ALREADY_IMPORTED',
        assetId: item.assetId,
      }, { status: 409 });
    }

    if (item.status === 'skipped') {
      return NextResponse.json({ ok: false, error: '该条目已被跳过' }, { status: 400 });
    }

    // 拼 rawContent：title + excerpt + url（让 LLM 知道来源）
    const rawContent = [
      `【${item.title}】`,
      item.url ? `来源：${item.url}` : '',
      '',
      item.excerpt || '（无摘要）',
    ].filter(Boolean).join('\n');

    // 调 intake API（在同一 Next.js 进程里直接调函数）
    // 但 intake API 是 HTTP 端点 + 走 LLM，复杂度高——直接用 fetch 调自己
    const intakeUrl = `${getBaseUrl()}/api/inbox/intake`;
    const intakeRes = await fetch(intakeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawContent,
        sourceType: 'rss',
        sourceMaterialId: item.id,
      }),
    });
    const intakeData = await intakeRes.json();

    if (!intakeRes.ok || !intakeData.ok) {
      return NextResponse.json({
        ok: false,
        error: `intake 失败: ${intakeData.error || intakeRes.statusText}`,
      }, { status: 502 });
    }

    const assetIds: string[] = intakeData.assetIds || [];
    const primaryAssetId = assetIds[0] || null;

    if (!primaryAssetId) {
      return NextResponse.json({ ok: false, error: 'intake 没生成任何资产（可能是素材太短）' }, { status: 502 });
    }

    // 更新 source_item 状态
    db.update(sourceItems)
      .set({ status: 'imported', assetId: primaryAssetId })
      .where(eq(sourceItems.id, itemId))
      .run();

    // 重新统计源的 newItemsCount
    const counts = db.select({ c: sourceItems.id }).from(sourceItems)
      .where(and(eq(sourceItems.sourceId, sourceId), eq(sourceItems.status, 'new')))
      .all();
    db.update(sources)
      .set({ newItemsCount: counts.length, updatedAt: Date.now() })
      .where(eq(sources.id, sourceId))
      .run();

    return NextResponse.json({
      ok: true,
      assetId: primaryAssetId,
      assetIds,
      intakeResult: {
        cardsCount: (intakeData.lightCards || []).length,
        assetsCount: assetIds.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function getBaseUrl(): string {
  // 同进程 fetch 自己，用环境变量或默认
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  // dev 默认 port 4191
  return `http://localhost:${process.env.PORT || 4191}`;
}