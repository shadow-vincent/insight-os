/**
 * /insights
 *
 * v1.8.4 仪表盘 · 看板收纳页
 *
 * 按 Vincent 2026-06-29 反馈：今日加工只放对话框，看板都收到这里
 *
 * 看板（精简版）：
 * - 4 统计卡（资产 / 在用 / 候选 / E2+）
 * - 写作复盘（30 天）
 * - 证据等级分布
 * - 主题分布
 * - 最近更新（资产）
 * - 最近活动（输出 / 反馈）
 *
 * 设计原则：
 * - 看板不在今日加工页（避免分心）
 * - 但保持可见（sidebar 系统区"📊 仪表盘" → /insights）
 * - 精简：每个 section 8-10 行内，不堆
 */

import { getDb, getRawSqlite, assets, outputs, feedback } from '@insight-os/db';
import { sql, desc, ne, eq, and } from 'drizzle-orm';
import Link from 'next/link';
import { isLLMConfigured } from '@insight-os/core';
import { InsightsClient } from './InsightsClient';
import { InsightsClientFromIDB } from './InsightsClientFromIDB';

export const dynamic = 'force-dynamic';

export default function InsightsPage() {
  const db = getDb();
  // V1.10: server 没 SQLite → 让 client 从 IndexedDB 读
  if (!db) return <InsightsClientFromIDB />;
  const sqlite = getRawSqlite();
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;

  // 1. 4 统计
  const totalAssets = db.select({ count: sql<number>`count(*)` })
    .from(assets).where(ne(assets.type, 'light')).get()?.count ?? 0;
  const inUseCount = db.select({ count: sql<number>`count(*)` })
    .from(assets).where(and(ne(assets.type, 'light'), eq(assets.status, 'in_use'))).get()?.count ?? 0;
  const candidateCount = db.select({ count: sql<number>`count(*)` })
    .from(assets).where(and(eq(assets.type, 'light'), eq(assets.status, 'candidate'))).get()?.count ?? 0;
  const e2Count = db.select({ count: sql<number>`count(*)` })
    .from(assets).where(and(ne(assets.type, 'light'), sql`${assets.evidenceLevel} IN ('E2', 'E3', 'E4', 'E5')`)).get()?.count ?? 0;

  // 2. 证据等级分布
  const evidenceDist = db.select({
    level: assets.evidenceLevel,
    count: sql<number>`count(*)`,
  }).from(assets).where(ne(assets.type, 'light'))
    .groupBy(assets.evidenceLevel).all();

  // 3. 主题分布
  const topicDist = db.select({
    topicName: sql<string>`t.name`,
    topicSlug: sql<string>`t.slug`,
    count: sql<number>`count(*)`,
  }).from(sql`asset_topics at`)
    .innerJoin(sql`topics t`, sql`t.id = at.topic_id`)
    .groupBy(sql`t.name`, sql`t.slug`)
    .orderBy(sql`count(*) DESC`)
    .all();

  // 4. 写作复盘（30 天）
  const monthAgo = now - 30 * DAY;
  const monthWritings = sqlite.prepare(`
    SELECT id, title, asset_ids_json, created_at
    FROM outputs
    WHERE output_type = 'writing' AND created_at >= ?
    ORDER BY created_at DESC
  `).all(monthAgo) as any[];

  const monthAssetIds = new Set<string>();
  const assetRefCount = new Map<string, number>();
  for (const w of monthWritings) {
    try {
      const ids = JSON.parse(w.asset_ids_json || '[]') as string[];
      for (const aid of ids) {
        monthAssetIds.add(aid);
        assetRefCount.set(aid, (assetRefCount.get(aid) ?? 0) + 1);
      }
    } catch { /* noop */ }
  }

  // top 反复引用的真核心（ref_count >= 2）
  const topCores = Array.from(assetRefCount.entries())
    .filter(([_, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  let topCoreRows: Array<{ id: string; title: string; refCount: number; evidenceLevel: string }> = [];
  if (topCores.length > 0) {
    const ids = topCores.map(([id]) => id);
    const placeholders = ids.map(() => '?').join(',');
    const assetRows = sqlite.prepare(`
      SELECT id, title, evidence_level as evidenceLevel
      FROM assets WHERE id IN (${placeholders})
    `).all(...ids) as any[];
    const idToAsset = new Map(assetRows.map(a => [a.id, a]));
    topCoreRows = topCores
      .map(([id, c]) => {
        const a = idToAsset.get(id);
        return a ? { id, title: a.title, refCount: c, evidenceLevel: a.evidenceLevel } : null;
      })
      .filter((x): x is { id: string; title: string; refCount: number; evidenceLevel: string } => x !== null);
  }

  // 5. 最近活动
  const recentAssets = db.select().from(assets)
    .where(ne(assets.type, 'light'))
    .orderBy(desc(assets.updatedAt)).limit(6).all();

  const recentOutputs = db.select().from(outputs)
    .orderBy(desc(outputs.createdAt)).limit(6).all();

  return (
    <InsightsClient
      llmEnabled={isLLMConfigured()}
      stats={{
        totalAssets,
        inUseCount,
        candidateCount,
        e2Count,
      }}
      evidenceDist={evidenceDist.map(d => ({ level: d.level, count: d.count }))}
      topicDist={topicDist.map(d => ({ name: d.topicName, slug: d.topicSlug, count: d.count }))}
      writingRecap={{
        monthWritingCount: monthWritings.length,
        monthAssetCount: monthAssetIds.size,
        topCores: topCoreRows,
      }}
      recentAssets={recentAssets.map(a => ({
        id: a.id,
        title: a.title,
        evidenceLevel: a.evidenceLevel,
        priority: a.priority,
        oneSentenceInsight: a.oneSentenceInsight,
        updatedAt: a.updatedAt,
      }))}
      recentOutputs={recentOutputs.map(o => ({
        id: o.id,
        title: o.title,
        outputType: o.outputType,
        createdAt: o.createdAt,
        assetIdsJson: o.assetIdsJson,
      }))}
    />
  );
}