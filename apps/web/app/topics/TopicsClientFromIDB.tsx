'use client';

/**
 * V1.10 TopicsClientFromIDB
 *
 * /topics 页面从 IndexedDB 读主题 + 关联资产 + 输出 + kernel
 * 简化版：用于 demo 模式
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function TopicsClientFromIDB() {
  const [topics, setTopics] = useState<any[]>([]);
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
          topics: 'id, slug, sortOrder, updatedAt',
          assetTopics: 'id, assetId, topicId, [assetId+topicId]',
          topicKernels: 'id, topicId, generatedAt',
        });

        const [allTopics, allAssets, allAssetTopics, allOutputs, allKernels] = await Promise.all([
          db.topics.toArray(),
          db.assets.toArray(),
          db.assetTopics.toArray(),
          db.outputs.toArray(),
          db.topicKernels.toArray(),
        ]);

        const enriched = allTopics.sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((t: any) => {
          const tAssetTopics = allAssetTopics.filter((at: any) => at.topicId === t.id);
          const assetIds = new Set(tAssetTopics.map((at: any) => at.assetId));
          const assets = allAssets.filter((a: any) => assetIds.has(a.id));
          const outputs = allOutputs.filter((o: any) => o.topicId === t.id);
          const kernel = allKernels.find((k: any) => k.topicId === t.id);

          return {
            topic: {
              id: t.id,
              name: t.name,
              slug: t.slug,
              description: t.description,
            },
            assets: assets.map((a: any) => ({
              id: a.id,
              title: a.title,
              evidenceLevel: a.evidenceLevel,
              outputCount: a.outputCount,
            })),
            outputs: outputs.map((o: any) => ({
              id: o.id,
              title: o.title,
              outputType: o.outputType,
              createdAt: o.createdAt,
            })),
            kernel: kernel ? {
              headline: kernel.headline,
              summary: kernel.summary,
              coreBeliefs: (() => {
                try {
                  const cb = JSON.parse(kernel.coreBeliefsJson || '[]');
                  return Array.isArray(cb) ? cb : [];
                } catch { return []; }
              })(),
            } : null,
          };
        });

        setTopics(enriched);
      } catch (e) {
        console.error('[TopicsClientFromIDB] failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div style={{ padding: 64, textAlign: 'center', color: 'var(--text-3)' }}>加载中...</div>;
  }

  if (topics.length === 0) {
    return (
      <div style={{ padding: 32 }}>
        <h1 className="page-title">主题资产包</h1>
        <p className="page-subtitle">围绕一个主题聚合所有判断资产，告诉你「这个主题能输出什么、还差什么、商业用途是什么」。</p>
        <div className="card" style={{ padding: 40, textAlign: 'center', marginTop: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>还没有主题</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            访问 <code>/?demo=1</code> 加载示例主题，或在「判断资产」里把资产归到主题。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 className="page-title">主题资产包</h1>
      <p className="page-subtitle">围绕一个主题聚合所有判断资产 · demo 模式（IDB）</p>

      {topics.map((t) => (
        <div key={t.topic.id} className="card" style={{ padding: 24, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t.topic.name}</h2>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.assets.length} 个资产</span>
          </div>

          {t.topic.description && (
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 12 }}>{t.topic.description}</p>
          )}

          {t.kernel && (
            <div style={{ padding: 16, background: 'rgba(124, 58, 237, 0.05)', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#7c3aed', marginBottom: 6, fontWeight: 600 }}>🧠 KERNEL</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t.kernel.headline}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{t.kernel.summary}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>支撑资产</h3>
              {t.assets.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>还没有资产</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {t.assets.slice(0, 5).map((a: any) => (
                    <Link key={a.id} href={`/assets/${a.id}`} style={{ fontSize: 13, color: 'var(--text)', textDecoration: 'none', padding: 8, background: 'var(--canvas)', borderRadius: 4, display: 'block' }}>
                      <span style={{ marginRight: 8, color: 'var(--primary)', fontWeight: 600 }}>{a.evidenceLevel}</span>
                      {a.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>输出</h3>
              {t.outputs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>还没有输出</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {t.outputs.slice(0, 5).map((o: any) => (
                    <div key={o.id} style={{ fontSize: 13, color: 'var(--text)', padding: 8, background: 'var(--canvas)', borderRadius: 4 }}>
                      {o.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}