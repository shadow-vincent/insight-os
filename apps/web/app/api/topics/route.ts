/**
 * GET  /api/topics       列出所有主题（带统计）
 * POST /api/topics       创建自定义主题
 *
 * POST body: { name, slug?, description?, coreBeliefs? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, topics, assets, assetTopics, topicKernels } from '@insight-os/db';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export async function GET() {
  try {
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    const allTopics = db.select().from(topics).orderBy(topics.sortOrder).all();
    // v0.8：一次拿所有 kernel 摘要
    type TopicKernelRow = typeof topicKernels.$inferSelect;
    const allKernels = db.select().from(topicKernels).all() as TopicKernelRow[];
    const kernelByTopic = new Map<string, TopicKernelRow>(allKernels.map(k => [k.topicId, k]));

    const result: any[] = [];
    type AssetTopicRow = typeof assetTopics.$inferSelect;
    type AssetRow = typeof assets.$inferSelect;
    for (const t of allTopics) {
      const links = db.select().from(assetTopics).where(eq(assetTopics.topicId, t.id)).all() as AssetTopicRow[];
      const assetIds = links.map((l: AssetTopicRow) => l.assetId);
      let topicAssets: AssetRow[] = [];
      let avgEvidence = 0;
      let lastUsedAt: number | null = null;
      let topAssets: any[] = [];

      if (assetIds.length > 0) {
        topicAssets = db.select().from(assets).where(inArray(assets.id, assetIds)).all() as AssetRow[];
        const evMap: Record<string, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };
        const sum = topicAssets.reduce((s: number, a: AssetRow) => s + (evMap[a.evidenceLevel] ?? 0), 0);
        avgEvidence = topicAssets.length > 0 ? sum / topicAssets.length : 0;
        const timestamps = topicAssets.map(a => a.lastUsedAt ?? a.updatedAt).filter(Boolean);
        lastUsedAt = timestamps.length > 0 ? Math.max(...timestamps) : null;
        topAssets = topicAssets
          .sort((a, b) => {
            const evA = evMap[a.evidenceLevel] ?? 0;
            const evB = evMap[b.evidenceLevel] ?? 0;
            if (evA !== evB) return evB - evA;
            return (b.feedbackCount ?? 0) - (a.feedbackCount ?? 0);
          })
          .slice(0, 3)
          .map(a => ({
            id: a.id,
            title: a.title,
            evidenceLevel: a.evidenceLevel,
            oneSentenceInsight: a.oneSentenceInsight,
            feedbackCount: a.feedbackCount ?? 0,
          }));
      }

      result.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        coreBeliefs: JSON.parse(t.coreBeliefsJson || '[]'),
        sortOrder: t.sortOrder,
        assetCount: topicAssets.length,
        avgEvidence: Number(avgEvidence.toFixed(2)),
        lastUsedAt,
        topAssets,
        // v0.8：附 kernel 摘要（如果有）
        kernel: (() => {
          const k = kernelByTopic.get(t.id);
          if (!k) return null;
          return {
            headline: k.headline,
            summary: k.summary,
            coreBeliefs: JSON.parse(k.coreBeliefsJson),
            sourceAssetIds: JSON.parse(k.sourceAssetIdsJson),
            generatedAt: k.generatedAt,
            generationModel: k.generationModel,
          };
        })(),
      });
    }

    return NextResponse.json({ ok: true, topics: result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, description, coreBeliefs } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ ok: false, error: '缺少 name' }, { status: 400 });
    }
    if (name.length > 30) {
      return NextResponse.json({ ok: false, error: 'name 太长（≤30 字）' }, { status: 400 });
    }

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });

    // 自动生成 slug（如果没传）
    // 规则：
    //   1. 全部转小写
    //   2. 空格/全角空格 → -
    //   3. 中文/字母/数字/- 保留，其他标点删除
    //   4. 多个连续 - 合并成单个
    //   5. 去首尾 -
    //   6. 中文名直接保留中文（如 "组织治理" → "组织治理"）
    const userProvidedSlug = (slug && typeof slug === 'string' && slug.trim())
      ? slug.trim()
      : null;
    const finalSlug = (userProvidedSlug ?? name.trim())
      .toLowerCase()
      .replace(/[\s\u3000]+/g, '-')           // 空格转 -
      .replace(/[^\w\u4e00-\u9fa5-]/g, '')    // 删除非单词字符（保留中文 \u4e00-\u9fa5）
      .replace(/-+/g, '-')                     // 合并多个 -
      .replace(/^-|-$/g, '');                  // 去首尾 -

    if (!finalSlug) {
      return NextResponse.json({
        ok: false,
        error: 'slug 解析失败：主题名必须包含中文字符、英文字母或数字',
      }, { status: 400 });
    }

    // 重名检测：slug 重复时自动加 -2 / -3 / ... 后缀
    let candidateSlug = finalSlug;
    let counter = 2;
    while (db.select().from(topics).where(eq(topics.slug, candidateSlug)).get()) {
      candidateSlug = `${finalSlug}-${counter}`;
      counter += 1;
      if (counter > 100) {
        return NextResponse.json({
          ok: false,
          error: `slug 重复超过 100 次: ${finalSlug}`,
        }, { status: 400 });
      }
    }
    const actualSlug = candidateSlug;

    // 名称也查重（避免同 name 不同 slug）
    const nameExists = db.select().from(topics).all().find(t => t.name === name.trim());
    if (nameExists) {
      return NextResponse.json({ ok: false, error: `名称已存在: ${name.trim()}` }, { status: 400 });
    }

    // sortOrder 自动接在最后
    const allTopics = db.select().from(topics).all();
    const maxSort = allTopics.reduce((m, t) => Math.max(m, t.sortOrder), 0);

    const now = Math.floor(Date.now() / 1000);
    const id = `topic_${randomUUID().slice(0, 8)}`;

    db.insert(topics)
      .values({
        id,
        name: name.trim(),
        slug: actualSlug,
        description: description?.trim() ?? null,
        coreBeliefsJson: JSON.stringify(Array.isArray(coreBeliefs) ? coreBeliefs : []),
        sortOrder: maxSort + 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return NextResponse.json({
      ok: true,
      topic: {
        id,
        name: name.trim(),
        slug: actualSlug,
        description: description?.trim() ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
