/**
 * POST /api/sources/sync-all
 *
 * 同步所有 enabled=1 的源（主页加载时触发）
 * - 只同步到 fetchIntervalMin 间隔的源（避免短时间内重复抓）
 * - 单个源失败不影响其他源
 *
 * 不阻塞主页加载：异步触发，不 await
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, sources } from '@insight-os/db';
import { eq, sql, and, lt, or, isNull } from 'drizzle-orm';

const TYPE_NOT_SUPPORTED = new Set(['twitter', 'wechat-account']);

export async function POST() {
  try {
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    const now = Date.now();

    // 选所有 enabled + 到期（last_fetched_at + interval <= now）的源
    const candidates = db.all(sql`
      SELECT id, type, url, fetch_interval_min as fetchIntervalMin,
             last_fetched_at as lastFetchedAt
      FROM sources
      WHERE enabled = 1
        AND (last_fetched_at IS NULL OR last_fetched_at + fetch_interval_min * 60 * 1000 <= ${now})
    `) as Array<{ id: string; type: string; url: string; fetchIntervalMin: number; lastFetchedAt: number | null }>;

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, message: '没有到期的源' });
    }

    // 逐个同步（不抛错影响其他）
    const results: Array<{ id: string; url: string; ok: boolean; error?: string; type?: string }> = [];

    for (const c of candidates) {
      if (TYPE_NOT_SUPPORTED.has(c.type)) {
        results.push({ id: c.id, url: c.url, ok: false, error: `${c.type} 等 V1.9.1`, type: c.type });
        continue;
      }
      // 同步逻辑委托给单源 sync 端点（避免代码重复）
      // 直接调内部函数：fetch + parse + insert
      const result = await syncOne(c.id, c.url, c.type);
      results.push({ id: c.id, url: c.url, ok: result.ok, error: result.error });
    }

    const okCount = results.filter(r => r.ok).length;
    return NextResponse.json({ ok: true, synced: okCount, total: candidates.length, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ============== 单源同步（内联，避免 fetch 自身路由） ==============
async function syncOne(sourceId: string, url: string, type?: string): Promise<{ ok: boolean; error?: string }> {
  const { fetchAndParseFeed, cleanExcerpt } = await import('@/lib/rss-fetcher');
  const { sourceItems } = await import('@insight-os/db');
  const { randomUUID } = await import('node:crypto');
  const db = getDb();

  if (!db) return { ok: false, error: 'NO_SQLITE' };  // V1.11.15: 修 helper 内 return NextResponse 类型错
  const now = Date.now();

  let feed;
  try {
    if (type === 'reddit') {
      // Reddit: 从 url 提取 subreddit 名
      const match = url.match(/\/r\/([A-Za-z0-9_-]+)\/\.rss/);
      const name = match?.[1];
      if (!name) throw new Error('Reddit URL 格式异常');
      const { fetchRedditFeed } = await import('@/lib/reddit-fetcher');
      feed = await fetchRedditFeed(name);
    } else {
      feed = await fetchAndParseFeed(url);
    }
  } catch (e: any) {
    db.update(sources)
      .set({ lastError: e.message || String(e), lastFetchedAt: now, updatedAt: now })
      .where(eq(sources.id, sourceId))
      .run();
    return { ok: false, error: e.message };
  }

  let added = 0;
  for (const item of feed.items) {
    try {
      db.insert(sourceItems).values({
        id: `si_${randomUUID()}`,
        sourceId,
        guid: item.guid,
        title: item.title,
        url: item.url,
        excerpt: cleanExcerpt(item.excerpt),
        content: null,
        publishedAt: item.publishedAt,
        fetchedAt: now,
        status: 'new',
        assetId: null,
      }).run();
      added++;
    } catch (e: any) {
      // UNIQUE 冲突 = 跳过
    }
  }

  const counts = db.get(sql`
    SELECT
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as newCount,
      count(*) as totalCount
    FROM source_items WHERE source_id = ${sourceId}
  `) as { newCount: number; totalCount: number } | undefined;

  db.update(sources)
    .set({
      lastFetchedAt: now,
      lastError: null,
      newItemsCount: counts?.newCount ?? 0,
      totalItemsCount: counts?.totalCount ?? 0,
      updatedAt: now,
    })
    .where(eq(sources.id, sourceId))
    .run();

  return { ok: true };
}