/**
 * GET    /api/assets/[id]/topics  读一张资产卡所属的所有主题
 * POST   /api/assets/[id]/topics  手动添加一个主题（人工指定）
 * PATCH  /api/assets/[id]/topics  修改一个主题关联的置信度
 * DELETE /api/assets/[id]/topics  移除一个主题关联
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, topics, assetTopics } from '@insight-os/db';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const links = db.select().from(assetTopics).where(eq(assetTopics.assetId, id)).all();
    const topicIds = links.map(l => l.topicId);
    const all = topicIds.length > 0
      ? db.select().from(topics).all().filter(t => topicIds.includes(t.id))
      : [];

    const result = links.map(link => {
      const topic = all.find(t => t.id === link.topicId);
      return {
        ...link,
        topicName: topic?.name ?? link.topicId,
        topicSlug: topic?.slug ?? '',
      };
    });

    return NextResponse.json({ ok: true, topics: result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: assetId } = await params;
    const body = await req.json();
    const { topicId, confidence } = body;

    if (!topicId) {
      return NextResponse.json({ ok: false, error: '缺少 topicId' }, { status: 400 });
    }

    const db = getDb();

    // 检查主题存在
    const topic = db.select().from(topics).where(eq(topics.id, topicId)).get();
    if (!topic) {
      return NextResponse.json({ ok: false, error: '主题不存在' }, { status: 404 });
    }

    // 检查是否已经关联
    const existing = db.select().from(assetTopics)
      .where(and(eq(assetTopics.assetId, assetId), eq(assetTopics.topicId, topicId)))
      .get();
    if (existing) {
      return NextResponse.json({ ok: false, error: '已关联该主题' }, { status: 400 });
    }

    // 人工添加：assignedBy='human', confidence 默认 100（也可指定）
    const linkId = `at_${randomUUID().slice(0, 8)}`;
    const now = Math.floor(Date.now() / 1000);
    db.insert(assetTopics)
      .values({
        id: linkId,
        assetId,
        topicId,
        confidence: typeof confidence === 'number' ? Math.round(confidence) : 100,
        assignedBy: 'human',
        createdAt: now,
      })
      .run();

    return NextResponse.json({ ok: true, linkId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: assetId } = await params;
    const body = await req.json();
    const { topicId, confidence } = body;

    if (!topicId || typeof confidence !== 'number') {
      return NextResponse.json({ ok: false, error: '缺少 topicId 或 confidence' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.select().from(assetTopics)
      .where(and(eq(assetTopics.assetId, assetId), eq(assetTopics.topicId, topicId)))
      .get();
    if (!existing) {
      return NextResponse.json({ ok: false, error: '关联不存在' }, { status: 404 });
    }

    db.update(assetTopics)
      .set({
        confidence: Math.round(confidence),
        assignedBy: 'human', // 人工修改后标记为人工
      })
      .where(and(eq(assetTopics.assetId, assetId), eq(assetTopics.topicId, topicId)))
      .run();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: assetId } = await params;
    const url = new URL(req.url);
    const topicId = url.searchParams.get('topicId');

    if (!topicId) {
      return NextResponse.json({ ok: false, error: '缺少 topicId (query param)' }, { status: 400 });
    }

    const db = getDb();
    db.delete(assetTopics)
      .where(and(eq(assetTopics.assetId, assetId), eq(assetTopics.topicId, topicId)))
      .run();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
