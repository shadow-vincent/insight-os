'use client';

/**
 * V1.10 InsightsClientFromIDB
 *
 * 当 server-side SQLite 不可用时（Vercel serverless / demo 模式），
 * 代替 insights/page.tsx 直接从 IndexedDB 读数据并渲染。
 *
 * 简化版（聚合算法直接跑在 client）：
 * - 4 统计卡
 * - 证据等级分布
 * - 主题分布
 * - 写作复盘（30 天）
 * - 最近更新
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { InsightsClient } from './InsightsClient';

const DAY = 86400;

export function InsightsClientFromIDB() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const DexieModule = await import('dexie');
        const Dexie = (DexieModule as any).default || DexieModule;
        const db = new Dexie('insight-os');
        db.version(1).stores({
          assets: 'id, type, status, evidenceLevel, updatedAt, scoreTotal, isKernelCandidate, isKernelApproved, sourceMaterialId, createdAt',
          outputs: 'id, status, writingStatus, topicId, createdAt, updatedAt',
          feedback: 'id, assetId, scene, outputId, createdAt',
          topics: 'id, slug, sortOrder, updatedAt',
          assetTopics: 'id, assetId, topicId, [assetId+topicId]',
        });

        const [allAssets, allOutputs, allTopics, allAssetTopics] = await Promise.all([
          db.assets.toArray(),
          db.outputs.toArray(),
          db.topics.toArray(),
          db.assetTopics.toArray(),
        ]);

        // 1. 4 统计
        const formalAssets = allAssets.filter((a: any) => a.type !== 'light');
        const totalAssets = formalAssets.length;
        const inUseCount = formalAssets.filter((a: any) => a.status === 'in_use').length;
        const candidateCount = allAssets.filter((a: any) => a.type === 'light' && a.status === 'candidate').length;
        const e2Count = formalAssets.filter((a: any) => ['E2', 'E3', 'E4', 'E5'].includes(a.evidenceLevel)).length;

        const stats = {
          totalAssets,
          inUseCount,
          candidateCount,
          e2Count,
          inboxCount: allAssets.filter((a: any) => a.status === 'inbox').length,
          totalOutputs: allOutputs.length,
          totalTopics: allTopics.length,
          totalSources: 0,
        };

        // 2. 证据等级分布
        const evMap = new Map<string, number>();
        for (const a of formalAssets) {
          evMap.set(a.evidenceLevel, (evMap.get(a.evidenceLevel) ?? 0) + 1);
        }
        const evidenceDist = Array.from(evMap.entries()).map(([level, count]) => ({ level, count }));

        // 3. 主题分布
        const topicCount = new Map<string, { name: string; slug: string; count: number }>();
        for (const at of allAssetTopics) {
          const t = allTopics.find((tt: any) => tt.id === at.topicId);
          if (!t) continue;
          const existing = topicCount.get(t.id);
          if (existing) existing.count++;
          else topicCount.set(t.id, { name: t.name, slug: t.slug, count: 1 });
        }
        const topicDist = Array.from(topicCount.values())
          .sort((a, b) => b.count - a.count)
          .map(t => ({ topicName: t.name, topicSlug: t.slug, count: t.count }));

        // 4. 写作复盘（30 天）
        const nowSec = Math.floor(Date.now() / 1000);
        const monthAgo = nowSec - 30 * DAY;
        const monthWritings = allOutputs.filter((o: any) => o.outputType === 'writing' && o.createdAt >= monthAgo);

        const monthAssetIds = new Set<string>();
        for (const w of monthWritings) {
          try {
            const ids = JSON.parse(w.assetIdsJson || '[]');
            if (Array.isArray(ids)) ids.forEach((id: string) => monthAssetIds.add(id));
          } catch {}
        }

        // 4.1 topCores（被引用最多的资产，从全量 outputs 算）
        const assetRefCount = new Map<string, number>();
        for (const o of allOutputs) {
          try {
            const ids = JSON.parse(o.assetIdsJson || '[]');
            if (Array.isArray(ids)) ids.forEach((id: string) => assetRefCount.set(id, (assetRefCount.get(id) ?? 0) + 1));
          } catch {}
        }
        const topCoreRows = Array.from(assetRefCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, count]) => {
            const a = allAssets.find((aa: any) => aa.id === id);
            return {
              id,
              title: a?.title ?? '(已删除)',
              refCount: count,
              evidenceLevel: a?.evidenceLevel ?? 'E0',
            };
          });

        // 5. 最近更新（资产）
        const recentAssets = [...allAssets]
          .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
          .slice(0, 8)
          .map((a: any) => ({
            id: a.id,
            title: a.title,
            evidenceLevel: a.evidenceLevel,
            status: a.status,
            updatedAt: a.updatedAt,
          }));

        // 6. 最近活动（输出）
        const recentOutputs = [...allOutputs]
          .sort((a: any, b: any) => b.createdAt - a.createdAt)
          .slice(0, 6)
          .map((o: any) => ({
            id: o.id,
            title: o.title,
            outputType: o.outputType,
            createdAt: o.createdAt,
          }));

        setData({
          stats,
          evidenceDist,
          topicDist,
          writingRecap: {
            count: monthWritings.length,
            referencedAssetCount: monthAssetIds.size,
            topCores: topCoreRows,
            items: monthWritings.slice(0, 8).map((w: any) => ({
              id: w.id,
              title: w.title,
              assetCount: (() => {
                try {
                  const ids = JSON.parse(w.assetIdsJson || '[]');
                  return Array.isArray(ids) ? ids.length : 0;
                } catch { return 0; }
              })(),
              createdAt: w.createdAt,
            })),
          },
          recentAssets,
          recentOutputs,
        });
      } catch (e) {
        console.error('[InsightsClientFromIDB] failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div style={{padding: 64, textAlign: 'center', color: 'var(--text-3)'}}>加载中...</div>;
  }

  if (!data) {
    return (
      <div style={{padding: 64, textAlign: 'center'}}>
        <div style={{fontSize: 18, marginBottom: 12}}>仪表盘数据为空</div>
        <div style={{fontSize: 13, color: 'var(--text-3)'}}>访问 <code>/?demo=1</code> 加载示例数据后查看</div>
      </div>
    );
  }

  return (
    <InsightsClient
      llmEnabled={false}
      stats={data.stats}
      evidenceDist={data.evidenceDist}
      topicDist={data.topicDist}
      writingRecap={data.writingRecap}
      recentAssets={data.recentAssets}
      recentOutputs={data.recentOutputs}
    />
  );
}