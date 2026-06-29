/**
 * GET /api/graph
 *
 * 返回资产图谱的节点 + 边：
 * - 节点：每张资产卡 1 个节点（type=asset，排除 light/kernel）
 * - 边：基于 frontmatter `related` 字段建立的"血脉"关系
 *        （v0.5：从 .md 解析 related，写入 assets.related_ids_json）
 *
 * 用于 /graph 页面（react-force-graph-2d 渲染）
 *
 * 视觉语言（v0.5 改进）：
 * - 节点小、深色描边，按 E 等级着色
 * - 边细、有方向性
 * - 选中节点 + 1 度邻居高亮 + 其他淡出（前端处理）
 */

import { NextResponse } from 'next/server';
import { getDb, assets, topics, assetTopics } from '@insight-os/db';
import { ne, eq } from 'drizzle-orm';

// 深背景调色板：所有颜色都提亮一档，确保在 #0b1220 上可见
// 注意：节点颜色由前端根据系统主题计算（深色用 dark palette，浅色用 light palette）
// 旧代码 hardcode 了 dark palette 在这里，已删除 — 现在 GraphNode 不再带 color 字段

// 12 色主题映射（按 topic name hash 分配，确保同一主题总是同一颜色）
const TOPIC_PALETTE = [
  '#f472b6', // 粉 - AI 落地
  '#60a5fa', // 蓝 - 组织
  '#34d399', // 绿 - 管理
  '#fbbf24', // 金 - 战略
  '#a78bfa', // 紫 - 思维
  '#fb923c', // 橙 - 判断力
  '#22d3ee', // 青 - 数字化
  '#f87171', // 红 - 变革
  '#c084fc', // 浅紫 - 哲学
  '#4ade80', // 浅绿 - 决策
  '#fde047', // 黄 - 价值
  '#94a3b8', // 灰 - 通用
];

/** 主题名 -> 颜色 hex（稳定 hash，同名同色） */
function topicColor(name: string | undefined | null): string {
  if (!name) return TOPIC_PALETTE[11]; // 灰 fallback
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return TOPIC_PALETTE[Math.abs(h) % TOPIC_PALETTE.length];
}

export async function GET() {
  try {
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });

    // 1. 拿所有正式资产
    const allAssets = db
      .select()
      .from(assets)
      .where(ne(assets.type, 'light'))
      .all();

    if (allAssets.length === 0) {
      return NextResponse.json({ ok: true, nodes: [], links: [], stats: { nodeCount: 0, edgeCount: 0, topicCount: 0 } });
    }

    // 2. 拿所有主题（用于 hover 显示）
    type TopicRow = typeof topics.$inferSelect;
    type AssetTopicRow = typeof assetTopics.$inferSelect;
    const allTopics = db.select().from(topics).all() as TopicRow[];
    const topicById = new Map<string, TopicRow>(allTopics.map(t => [t.id, t]));

    // 3. 拿所有 asset_topic 关系
    const allAssetTopicLinks = db.select().from(assetTopics).all() as AssetTopicRow[];

    // 4. 组装每个节点的 topic 信息
    const assetIdToTopics = new Map<string, { topicId: string; topicName: string; confidence: number }[]>();
    for (const link of allAssetTopicLinks) {
      if (!assetIdToTopics.has(link.assetId)) assetIdToTopics.set(link.assetId, []);
      const t = topicById.get(link.topicId);
      if (!t) continue;
      assetIdToTopics.get(link.assetId)!.push({
        topicId: t.id,
        topicName: t.name,
        confidence: link.confidence,
      });
    }

    // 5. 构造节点（按 related 数量调整大小：related 越多 = 越核心 = 越大）
    // 注意：节点颜色由前端根据系统主题计算，不在 API 里 hardcode
    const nodes = allAssets.map(a => {
      const topics = assetIdToTopics.get(a.id) ?? [];
      const relatedIds: string[] = (() => {
        try { return JSON.parse(a.relatedIdsJson || '[]'); } catch { return []; }
      })();
      const relatedCount = relatedIds.length;
      // 节点大小: 基础 3 + relatedCount * 1.2 + topicCount * 0.8，最大 12
      const val = Math.min(12, 3 + relatedCount * 1.2 + topics.length * 0.8);
      return {
        id: a.id,
        title: a.title,
        evidenceLevel: a.evidenceLevel,
        priority: a.priority ?? 'C',
        feedbackCount: a.feedbackCount ?? 0,
        topicCount: topics.length,
        topicNames: topics.map(t => t.topicName),
        primaryTopic: topics[0]?.topicName ?? null,
        color: topicColor(topics[0]?.topicName),  // v2: 主主题色（深色背景上的亮色）
        relatedIds,                     // v0.6 血脉图用：直接传 ID 列表
        relatedCount,
        oneSentenceInsight: a.oneSentenceInsight ?? null,
        val,
      };
    });

    // 6. 构造边：基于 related 字段（双向去重 → 无向图）
    // 用于 Overview 全景图；Pedigree 血脉图用节点自己的 relatedIds
    const linksMap = new Map<string, { source: string; target: string }>();
    for (const a of allAssets) {
      let relatedIds: string[] = [];
      try { relatedIds = JSON.parse(a.relatedIdsJson || '[]'); } catch { continue; }
      for (const targetId of relatedIds) {
        if (targetId === a.id) continue; // 自引用
        const key = [a.id, targetId].sort().join('|');
        if (!linksMap.has(key)) {
          linksMap.set(key, { source: a.id, target: targetId });
        }
      }
    }
    const links = Array.from(linksMap.values());

    // 7. 主题列表（前端 Pedigree 可能用，但实际不用 — 简化）
    return NextResponse.json({
      ok: true,
      nodes,
      links,
      topics: allTopics.map(t => ({ id: t.id, name: t.name, slug: t.slug })),
      stats: {
        nodeCount: nodes.length,
        edgeCount: links.length,
        topicCount: allTopics.length,
        relatedPairCount: links.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
