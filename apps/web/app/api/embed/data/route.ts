/**
 * GET /api/embed/data?userId=xxx&topic=xxx&limit=xxx
 *
 * 拿用户的公开图谱数据（用于 embed widget）
 * 返回简化版（不包含 LLM API key / 私有 feedback / 草稿）
 *
 * query: userId (默认 'vincent'), topic (可选，限制主题), limit (默认 30)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, assetTopics, topics } from '@insight-os/db';
import { eq, desc, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId') ?? 'vincent';
    const topicId = url.searchParams.get('topic');
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30', 10) || 30, 100);

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });

    let assetIds: string[] | null = null;
    if (topicId) {
      const links = db.select().from(assetTopics).where(eq(assetTopics.topicId, topicId)).all();
      assetIds = links.map(l => l.assetId);
      if (assetIds.length === 0) {
        return NextResponse.json({
          ok: true,
          userId,
          topic: topicId,
          nodes: [],
          links: [],
          meta: { count: 0, source: 'insight-os' },
        });
      }
    }

    const conditions = topicId && assetIds
      ? [inArray(assets.id, assetIds), eq(assets.status, 'in_use')]
      : [eq(assets.status, 'in_use')];

    const list = db.select().from(assets)
      .where(conditions.length > 0 ? conditions.length === 1 ? conditions[0] : undefined as any : undefined as any)
      .orderBy(desc(assets.updatedAt))
      .limit(limit)
      .all();

    // 一次性拿所有 assetTopics 关联（按 assetId 索引）
    const allAssetTopics = db.select().from(assetTopics).all();
    const allTopicsList = db.select().from(topics).all();
    const topicNameById = new Map(allTopicsList.map(t => [t.id, t.name]));
    const topicsByAsset = new Map<string, string[]>();
    for (const at of allAssetTopics) {
      if (!topicsByAsset.has(at.assetId)) topicsByAsset.set(at.assetId, []);
      const name = topicNameById.get(at.topicId);
      if (name) topicsByAsset.get(at.assetId)!.push(name);
    }

    // 简化节点数据（只保留 embed 需要的字段）
    const nodes = list.map(a => ({
      id: a.id,
      title: a.title,
      insight: a.oneSentenceInsight,
      evidenceLevel: a.evidenceLevel,
      priority: a.priority,
      tags: (() => { try { return JSON.parse(a.tagsJson); } catch { return []; } })(),
      topicNames: topicsByAsset.get(a.id) ?? [],
    }));

    // 简化边（asset 之间的引用关系 — V1.5 简化版：先返回空，后续可从 refAssetIds 提取）
    const links: Array<{ source: string; target: string }> = [];

    // 主题列表（用于图例）
    const allTopics = db.select().from(topics).all();

    return NextResponse.json({
      ok: true,
      userId,
      topic: topicId,
      nodes,
      links,
      topics: allTopics.map(t => ({ id: t.id, name: t.name, slug: t.slug })),
      meta: {
        count: nodes.length,
        source: 'insight-os',
        embedVersion: 1,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
