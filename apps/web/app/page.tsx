import { getDb, getRawSqlite, assets, outputs, feedback } from '@insight-os/db';
import { sql, desc, ne, eq, and } from 'drizzle-orm';
import Link from 'next/link';
import { isLLMConfigured } from '@insight-os/core';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const db = getDb();
  const sqlite = getRawSqlite();
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;

  // 只统计正式资产
  const totalAssets = db.select({ count: sql<number>`count(*)` })
    .from(assets).where(ne(assets.type, 'light')).get()?.count ?? 0;
  const inUseCount = db.select({ count: sql<number>`count(*)` })
    .from(assets).where(and(ne(assets.type, 'light'), eq(assets.status, 'in_use'))).get()?.count ?? 0;
  const candidateCount = db.select({ count: sql<number>`count(*)` })
    .from(assets).where(and(eq(assets.type, 'light'), eq(assets.status, 'candidate'))).get()?.count ?? 0;
  const e2Count = db.select({ count: sql<number>`count(*)` })
    .from(assets).where(and(ne(assets.type, 'light'), sql`${assets.evidenceLevel} IN ('E2', 'E3', 'E4', 'E5')`)).get()?.count ?? 0;

  // 证据等级分布
  const evidenceDist = db.select({
    level: assets.evidenceLevel,
    count: sql<number>`count(*)`,
  }).from(assets).where(ne(assets.type, 'light'))
    .groupBy(assets.evidenceLevel).all();

  // 主题分布
  const topicDist = db.select({
    topicName: sql<string>`t.name`,
    topicSlug: sql<string>`t.slug`,
    count: sql<number>`count(*)`,
  }).from(sql`asset_topics at`)
    .innerJoin(sql`topics t`, sql`t.id = at.topic_id`)
    .groupBy(sql`t.name`, sql`t.slug`)
    .orderBy(sql`count(*) DESC`)
    .all();

  // ===== v0.10.4 写作复盘 =====
  const now2 = Math.floor(Date.now() / 1000);
  const monthAgo = now2 - 30 * DAY;
  const monthWritings = sqlite.prepare(`
    SELECT id, title, asset_ids_json, created_at
    FROM outputs
    WHERE output_type = 'writing' AND created_at >= ?
    ORDER BY created_at DESC
  `).all(monthAgo) as any[];
  const monthWritingCount = monthWritings.length;
  // 收集所有写作引用的 asset，去重
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
  // top 反复引用的真核心：ref_count >= 2，按引用次数降序
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

  // ===== v0.10.2 今日待办 3 栏 =====
  // 1) 候选池待校准：candidate 状态 + 老的（created_at < 7 天前）
  const toCalibrateRows = sqlite.prepare(`
    SELECT id, title, evidence_level as evidenceLevel, created_at as createdAt
    FROM assets
    WHERE type='light' AND status='candidate'
    ORDER BY created_at ASC LIMIT 5
  `).all() as any[];
  // 2) 资产可输出：高 E（≥E2） + 30 天没引用（last_used_at < 30 天前 OR null）
  const staleAssetsRows = sqlite.prepare(`
    SELECT id, title, evidence_level as evidenceLevel, last_used_at as lastUsedAt
    FROM assets
    WHERE type='asset' AND status='in_use'
      AND evidence_level IN ('E2','E3','E4','E5')
      AND (last_used_at IS NULL OR last_used_at < ?)
    ORDER BY (last_used_at IS NULL) DESC, last_used_at ASC
    LIMIT 5
  `).all(now - 30 * DAY) as any[];
  // 3) 输出待反馈：status='used' 的 output 没记 feedback
  const pendingFeedbackRows = sqlite.prepare(`
    SELECT o.id, o.title, o.output_type as outputType, o.created_at as createdAt
    FROM outputs o
    LEFT JOIN feedback f ON f.output_id = o.id
    WHERE o.status = 'used' AND f.id IS NULL
    ORDER BY o.created_at DESC LIMIT 5
  `).all() as any[];

  // 最近活动
  const recentOutputs = db.select().from(outputs)
    .orderBy(desc(outputs.createdAt)).limit(5).all();
  const recentFeedback = db.select().from(feedback)
    .orderBy(desc(feedback.createdAt)).limit(5).all();

  // 最近更新的资产
  const recentAssets = db.select().from(assets)
    .where(ne(assets.type, 'light'))
    .orderBy(desc(assets.updatedAt)).limit(8).all();

  const llmEnabled = isLLMConfigured();

  return (
    <DashboardClient
      llmEnabled={llmEnabled}
      stats={{
        totalAssets,
        inUseCount,
        candidateCount,
        e2Count,
      }}
      evidenceDist={evidenceDist.map(d => ({ level: d.level, count: d.count }))}
      topicDist={topicDist.map(d => ({ name: d.topicName, slug: d.topicSlug, count: d.count }))}
      writingRecap={{
        monthWritingCount,
        monthAssetCount: monthAssetIds.size,
        topCores: topCoreRows,
      }}
      todayTodos={{
        toCalibrate: {
          count: candidateCount,
          rows: toCalibrateRows,
        },
        staleAssets: {
          count: staleAssetsRows.length,
          rows: staleAssetsRows,
        },
        pendingFeedback: {
          count: pendingFeedbackRows.length,
          rows: pendingFeedbackRows,
        },
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
      recentFeedback={recentFeedback.map(f => ({
        id: f.id,
        assetId: f.assetId,
        reaction: f.reaction,
        evidenceLevelAfter: f.evidenceLevelAfter,
        createdAt: f.createdAt,
      }))}
    />
  );
}
