/**
 * /sources/[id] 信息源详情页
 *
 * V1.11.16: Vercel IDB-first（之前 getDb() 返 null → blank 页）
 * - server 端 getDb() 拿数据 fallback 到 <ClientSourceItemsLoader id={id} />
 * - ClientSourceItemsLoader 从 IDB 读 source + items 渲染
 */

import { getDb } from '@insight-os/db';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { SourceItemsClient } from './SourceItemsClient';
import { ClientSourceItemsLoader } from './ClientSourceItemsLoader';

export const dynamic = 'force-dynamic';

interface SourceRow {
  id: string;
  type: string;
  url: string;
  title: string;
  enabled: number;
  lastFetchedAt: number | null;
  lastError: string | null;
  fetchIntervalMin: number;
  newItemsCount: number;
  totalItemsCount: number;
}

interface SourceItemRow {
  id: string;
  guid: string;
  title: string;
  url: string | null;
  excerpt: string | null;
  publishedAt: number | null;
  fetchedAt: number;
  status: string;
  assetId: string | null;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SourceDetailPage({ params }: Props) {
  const { id } = await params;
  const db = getDb();
  if (!db) {
    // V1.11.16: Vercel NO_SQLITE → 客户端 IDB-first 加载
    return <ClientSourceItemsLoader sourceId={id} />;
  }

  const source = db.get(sql`
    SELECT id, type, url, title, enabled, last_fetched_at as lastFetchedAt,
           last_error as lastError, fetch_interval_min as fetchIntervalMin,
           new_items_count as newItemsCount, total_items_count as totalItemsCount
    FROM sources WHERE id = ${id}
  `) as SourceRow | undefined;

  if (!source) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 32 }}>
        <h1 className="page-title">源不存在</h1>
        <Link href="/sources" style={{ color: 'var(--primary)' }}>← 返回信息源列表</Link>
      </div>
    );
  }

  const items = db.all(sql`
    SELECT id, guid, title, url, excerpt, published_at as publishedAt,
           fetched_at as fetchedAt, status, asset_id as assetId
    FROM source_items
    WHERE source_id = ${id}
    ORDER BY published_at DESC NULLS LAST, fetched_at DESC
    LIMIT 100
  `) as SourceItemRow[];

  return <SourceItemsClient source={source} items={items} />;
}