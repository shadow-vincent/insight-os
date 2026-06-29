/**
 * GET /api/assets/[id]/related
 *
 * 返回与指定资产相关的资产（基于共同主题 + E 等级 + 反馈数）
 *
 * 排序规则：
 * 1. 共同主题数（strongest signal）—— 同主题越多越相关
 * 2. 证据等级权重：E3+ > E2 > E1 > E0（高质量优先）
 * 3. 反馈数（feedback_count）—— 实战验证优先
 *
 * 返回字段：id, title, evidenceLevel, priority, oneSentenceInsight, sharedTopics, score
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, assetTopics, topics } from '@insight-os/db';
import { eq, inArray, ne, sql } from 'drizzle-orm';

const MAX_RETURNED = 8;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });

    // 1. 找当前资产的所有主题
    const myTopicRows = db
      .select()
      .from(assetTopics)
      .where(eq(assetTopics.assetId, assetId))
      .all();
    const myTopicIds = myTopicRows.map((r: any) => r.topicId);

    if (myTopicIds.length === 0) {
      // 当前资产无主题 → 退而求其次：返回最近更新 + 高 E 等级 的资产
      const fallback = db
        .select()
        .from(assets)
        .where(ne(assets.id, assetId))
        .orderBy(sql`${assets.evidenceLevel} DESC, ${assets.updatedAt} DESC`)
        .limit(MAX_RETURNED)
        .all();

      return NextResponse.json({
        ok: true,
        reason: 'no_topics',
        count: fallback.length,
        related: fallback.map(a => ({
          id: a.id,
          title: a.title,
          evidenceLevel: a.evidenceLevel,
          priority: a.priority,
          oneSentenceInsight: a.oneSentenceInsight,
          sharedTopics: [],
          score: 0,
        })),
      });
    }

    // 2. 找所有同主题的 asset_topics 行（按 topic 分组计数）
    const coOccurrences = db
      .select({
        assetId: assetTopics.assetId,
        topicId: assetTopics.topicId,
        topicName: topics.name,
      })
      .from(assetTopics)
      .innerJoin(topics, eq(topics.id, assetTopics.topicId))
      .where(inArray(assetTopics.topicId, myTopicIds))
      .all();

    // 3. 聚合：同 asset 出现几个主题 → 共同主题
    const byAsset = new Map<string, { topicIds: Set<string>; topicNames: string[] }>();
    for (const row of coOccurrences) {
      if (row.assetId === assetId) continue; // 排除自己
      if (!byAsset.has(row.assetId)) {
        byAsset.set(row.assetId, { topicIds: new Set(), topicNames: [] });
      }
      const entry = byAsset.get(row.assetId)!;
      if (!entry.topicIds.has(row.topicId)) {
        entry.topicIds.add(row.topicId);
        if (row.topicName) entry.topicNames.push(row.topicName);
      }
    }

    if (byAsset.size === 0) {
      return NextResponse.json({ ok: true, reason: 'no_overlap', related: [] });
    }

    // 4. 拉这些资产详情 + 打分
    const candidateIds = Array.from(byAsset.keys());
    const candidates = db
      .select()
      .from(assets)
      .where(inArray(assets.id, candidateIds))
      .all();

    // E 等级权重
    const evidenceWeight: Record<string, number> = {
      E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5,
    };

    const scored = candidates.map(a => {
      const overlap = byAsset.get(a.id)!;
      const sharedCount = overlap.topicIds.size;
      const evW = evidenceWeight[a.evidenceLevel] ?? 0;
      // 公式：共同主题 * 10 + E 等级权重 + 反馈数 * 0.5
      const score = sharedCount * 10 + evW + (a.feedbackCount ?? 0) * 0.5;

      return {
        id: a.id,
        title: a.title,
        evidenceLevel: a.evidenceLevel,
        priority: a.priority,
        oneSentenceInsight: a.oneSentenceInsight,
        sharedTopics: overlap.topicNames,
        sharedCount,
        score: Math.round(score * 10) / 10,
      };
    });

    // 5. 排序 + 截断
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, MAX_RETURNED);

    return NextResponse.json({
      ok: true,
      reason: 'topic_overlap',
      count: top.length,
      related: top,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
