'use client';

/**
 * V1.10 ClientAssetLoader
 *
 * 当 server-side SQLite 不可用时（Vercel serverless / demo 模式），
 * page.tsx 返回这个组件，从用户浏览器 IndexedDB 读取 asset。
 *
 * 显示基本信息：标题 / 洞察 / 反常识 / 标签 / 评分
 * （不显示完整 timeline / 编辑器，简化版足够 demo 用）
 */

import { useEffect, useState } from 'react';

export function ClientAssetLoader({ id }: { id: string }) {
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      try {
        const DexieModule = await import('dexie');
        const Dexie = (DexieModule as any).default || DexieModule;
        const db = new Dexie('insight-os');
        // V1.10: 必须用完整 11 table schema（和 DemoLoader 一致）
        // 否则 Dexie 检测 schema diff 会清空数据！
        db.version(1).stores({
          assets: 'id, type, status, evidenceLevel, updatedAt, scoreTotal, isKernelCandidate, isKernelApproved, sourceMaterialId, createdAt',
          outputs: 'id, status, writingStatus, topicId, createdAt, updatedAt',
          feedback: 'id, assetId, scene, outputId, createdAt',
          topics: 'id, slug, sortOrder, updatedAt',
          assetTopics: 'id, assetId, topicId, [assetId+topicId]',
          sources: 'id, url, enabled, lastFetchedAt, type, createdAt',
          sourceItems: 'id, sourceId, status, fetchedAt, publishedAt, [sourceId+guid]',
          topicKernels: 'id, topicId, generatedAt',
          userKernels: 'id, category, status, sortOrder, updatedAt',
          writingDrafts: 'id, writingId, updatedAt',
          writingVersions: 'id, writingId, createdAt, [writingId+createdAt]',
        });
        const a = await db.assets.get(id);
        setAsset(a);
      } catch (e) {
        console.error('[ClientAssetLoader] failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div style={{padding: 64, textAlign: 'center', color: 'var(--text-3)'}}>加载中...</div>;
  }

  if (!asset) {
    return (
      <div style={{padding: 64, textAlign: 'center'}}>
        <div style={{fontSize: 18, marginBottom: 12}}>资产未找到</div>
        <div style={{fontSize: 13, color: 'var(--text-3)'}}>
          访问 <code style={{padding: '2px 8px', background: 'var(--canvas)', borderRadius: 4}}>/?demo=1</code> 加载示例数据后重试
        </div>
      </div>
    );
  }

  let tags: string[] = [];
  try {
    const parsed = JSON.parse(asset.tagsJson || '[]');
    if (Array.isArray(parsed)) tags = parsed;
  } catch {}

  return (
    <div style={{padding: 32, maxWidth: 880, margin: '0 auto'}}>
      <div style={{display: 'flex', gap: 8, marginBottom: 12, fontSize: 12, color: 'var(--text-3)'}}>
        <span style={{padding: '2px 8px', background: 'var(--canvas)', borderRadius: 4}}>{asset.evidenceLevel}</span>
        <span style={{padding: '2px 8px', background: 'var(--canvas)', borderRadius: 4}}>{asset.status}</span>
        <span style={{padding: '2px 8px', background: 'var(--canvas)', borderRadius: 4}}>{asset.type}</span>
        {asset.isKernelApproved === 1 && <span style={{padding: '2px 8px', background: '#a78bfa', color: 'white', borderRadius: 4}}>🧠 Kernel</span>}
      </div>

      <h1 style={{fontSize: 32, fontWeight: 700, lineHeight: 1.3, marginBottom: 24, color: 'var(--ink)'}}>
        {asset.title}
      </h1>

      {asset.oneSentenceInsight && (
        <div style={{padding: 20, background: 'var(--panel)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16}}>
          <div style={{fontSize: 11, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1}}>一句话洞察</div>
          <div style={{fontSize: 16, lineHeight: 1.7, color: 'var(--text)'}}>{asset.oneSentenceInsight}</div>
        </div>
      )}

      {asset.antiCommonSense && (
        <div style={{padding: 20, background: 'rgba(234, 88, 12, 0.05)', borderRadius: 10, border: '1px solid rgba(234, 88, 12, 0.2)', marginBottom: 16}}>
          <div style={{fontSize: 11, color: '#ea580c', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1}}>反常识</div>
          <div style={{fontSize: 16, lineHeight: 1.7, color: 'var(--text)'}}>{asset.antiCommonSense}</div>
        </div>
      )}

      {tags.length > 0 && (
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24}}>
          {tags.map(t => (
            <span key={t} style={{padding: '4px 12px', background: 'var(--canvas)', borderRadius: 999, fontSize: 13, color: 'var(--text-2)'}}>#{t}</span>
          ))}
        </div>
      )}

      <div style={{padding: 16, background: 'var(--canvas)', borderRadius: 10, fontSize: 13, color: 'var(--text-2)'}}>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12}}>
          <div><span style={{color: 'var(--text-3)'}}>来源：</span>{asset.source ?? '未指定'}</div>
          <div><span style={{color: 'var(--text-3)'}}>评分：</span><strong>{asset.scoreTotal}</strong></div>
          <div><span style={{color: 'var(--text-3)'}}>引用：</span>{asset.outputCount} 次</div>
          <div><span style={{color: 'var(--text-3)'}}>反馈：</span>{asset.feedbackCount} 次</div>
        </div>
      </div>
    </div>
  );
}