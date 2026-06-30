/**
 * /sources 信息源管理页
 *
 * v1.9.0 · 信息源订阅管理
 *
 * 功能：
 * - 添加 RSS 源（粘贴 RSS URL）
 * - 启停 / 删除 / 立即同步
 * - 查看每个源抓到的内容（点进 /sources/[id]）
 *
 * 不做的事（V1.9.1+）：
 * - Twitter / 公众号订阅（封闭生态，需 RSSHub）
 * - 抓到的内容一键加工（V1.9.0 先看，V1.9.1 接入 intake）
 */

import { getDb } from '@insight-os/db';
import { sql } from 'drizzle-orm';
import { SourcesClient } from './SourcesClient';

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
  createdAt: number;
  updatedAt: number;
}

export default function SourcesPage() {
  const db = getDb();
  // V1.10: server 没 SQLite → 让 client 从 IndexedDB 读
  if (!db) return <SourcesClient initialSources={[]} />;
  const rows = db.all(sql`
    SELECT id, type, url, title, enabled, last_fetched_at as lastFetchedAt,
           last_error as lastError, fetch_interval_min as fetchIntervalMin,
           new_items_count as newItemsCount, total_items_count as totalItemsCount,
           created_at as createdAt, updated_at as updatedAt
    FROM sources
    ORDER BY created_at DESC
  `) as SourceRow[];

  return <SourcesClient initialSources={rows} />;
}