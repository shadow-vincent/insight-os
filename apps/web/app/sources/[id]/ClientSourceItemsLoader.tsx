'use client';

/**
 * V1.11.16: /sources/[id] 客户端 IDB 加载器
 *
 * Vercel 部署版 server getDb() 返 null → 用此 loader 从 IDB 读 source + items
 * 跟 SourceItemsClient 复用相同的渲染 UI（包一层）
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SourceItemsClient } from './SourceItemsClient';

export function ClientSourceItemsLoader({ sourceId }: { sourceId: string }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { getSource, getSourceItems } = await import('@/lib/idb/operations');
        const source = await getSource(sourceId);
        if (!source) {
          setNotFound(true);
          return;
        }
        const items = await getSourceItems(sourceId);
        setData({
          source: {
            id: source.id,
            type: source.type,
            url: source.url,
            title: source.title,
            enabled: source.enabled,
            lastFetchedAt: source.lastFetchedAt,
            lastError: source.lastError,
            fetchIntervalMin: source.fetchIntervalMin,
            newItemsCount: items.filter((i: any) => i.status === 'new').length,
            totalItemsCount: items.length,
          },
          items: items
            .sort((a: any, b: any) => (b.publishedAt ?? b.fetchedAt) - (a.publishedAt ?? a.fetchedAt))
            .slice(0, 100),
        });
      } catch (e) {
        console.error('[ClientSourceItemsLoader]', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [sourceId]);

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-3)' }}>加载中…</div>;
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 32 }}>
        <h1 className="page-title">源不存在</h1>
        <Link href="/sources" style={{ color: 'var(--primary)' }}>← 返回信息源列表</Link>
      </div>
    );
  }

  return <SourceItemsClient source={data.source} items={data.items} />;
}