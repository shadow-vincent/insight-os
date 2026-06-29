/**
 * /api/sources
 *
 * GET  - 列出所有信息源（含 newItemsCount + totalItemsCount + lastFetchedAt）
 * POST - 添加一个 RSS 源（输入 { url }，自动抓一次首屏确认可用 + 写入 source_items）
 *
 * v1.9.0 只支持 type='rss'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, sources, sourceItems } from '@insight-os/db';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { fetchAndParseFeed, cleanExcerpt } from '@/lib/rss-fetcher';

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

export async function GET() {
  try {
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    const rows = db.all(sql`
      SELECT id, type, url, title, enabled, last_fetched_at as lastFetchedAt,
             last_error as lastError, fetch_interval_min as fetchIntervalMin,
             new_items_count as newItemsCount, total_items_count as totalItemsCount,
             created_at as createdAt, updated_at as updatedAt
      FROM sources
      ORDER BY created_at DESC
    `) as SourceRow[];
    return NextResponse.json({ ok: true, sources: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, type, handle } = body;

    // ===== v1.9.2: 支持 reddit / twitter / rss 3 种 type =====
    const sourceType = (type as string) || 'rss';
    if (!['rss', 'twitter', 'reddit'].includes(sourceType)) {
      return NextResponse.json({ ok: false, error: `不支持的来源类型: ${sourceType}` }, { status: 400 });
    }

    let resolvedUrl: string;
    let displayTitle: string | undefined;

    if (sourceType === 'reddit') {
      // ===== v1.9.2: Reddit 官方 RSS（零配置）=====
      if (!handle || typeof handle !== 'string') {
        return NextResponse.json({ ok: false, error: '添加 Reddit 需要提供 subreddit 或 user 名（如 LocalLLaMA）' }, { status: 400 });
      }
      const { buildRedditFeedUrl } = await import('@/lib/reddit-fetcher');
      try {
        const built = buildRedditFeedUrl(handle);
        resolvedUrl = built.url;
        displayTitle = (body.title as string)?.trim() || `/r/${built.displayName}`;
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
      }
    } else if (sourceType === 'twitter') {
      // ===== v1.9.1: Twitter 走 RSSHub（默认被禁，需自部署）=====
      if (!handle || typeof handle !== 'string') {
        return NextResponse.json({ ok: false, error: '添加 Twitter 需要提供 handle（如 elonmusk）' }, { status: 400 });
      }
      const { buildRSSHubFeedUrl } = await import('@/lib/rsshub-fetcher');
      resolvedUrl = buildRSSHubFeedUrl('twitter', handle);
      displayTitle = (body.title as string)?.trim() || `@${handle.replace(/^@/, '')}`;
    } else {
      // type='rss'：直接用 url
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ ok: false, error: '缺少 url' }, { status: 400 });
      }
      let parsed: URL;
      try { parsed = new URL(url); } catch { return NextResponse.json({ ok: false, error: 'URL 格式无效' }, { status: 400 }); }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json({ ok: false, error: '只支持 http(s) 协议' }, { status: 400 });
      }
      resolvedUrl = url;
    }

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });

    // 重复检查
    const existing = db.select().from(sources).where(eq(sources.url, resolvedUrl)).get();
    if (existing) {
      return NextResponse.json({ ok: false, error: '该来源已经订阅', code: 'DUPLICATE' }, { status: 409 });
    }

    // 首次抓取确认可用 + 提取 title
    let feed;
    try {
      if (sourceType === 'reddit') {
        // Reddit 走专门 fetcher（browser UA 避免 429）
        const { fetchRedditFeed } = await import('@/lib/reddit-fetcher');
        feed = await fetchRedditFeed(handle);
      } else {
        feed = await fetchAndParseFeed(resolvedUrl);
      }
    } catch (e: any) {
      return NextResponse.json({
        ok: false,
        error: `抓取失败: ${e.message || e}`,
        code: 'FETCH_FAILED',
      }, { status: 502 });
    }

    const title = displayTitle || feed.title || new URL(resolvedUrl).hostname;
    if (!feed.items.length) {
      return NextResponse.json({ ok: false, error: 'feed 是空的，没有 items', code: 'EMPTY_FEED' }, { status: 400 });
    }

    const now = Date.now();
    const id = `src_${randomUUID()}`;

    db.insert(sources).values({
      id, type: sourceType, url: resolvedUrl, title,
      enabled: 1,
      lastFetchedAt: now,
      lastError: null,
      fetchIntervalMin: 60,
      newItemsCount: 0,
      totalItemsCount: 0,
      createdAt: now, updatedAt: now,
    }).run();

    // 首次同步：把所有 items 入库（status='new'）
    let newCount = 0;
    for (const item of feed.items) {
      try {
        db.insert(sourceItems).values({
          id: `si_${randomUUID()}`,
          sourceId: id,
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
        newCount++;
      } catch (e: any) {
        if (!String(e.message).includes('UNIQUE')) {
          console.warn('[sources POST] insert item failed:', e.message);
        }
      }
    }

    db.update(sources)
      .set({
        newItemsCount: newCount,
        totalItemsCount: newCount,
        updatedAt: now,
      })
      .where(eq(sources.id, id))
      .run();

    return NextResponse.json({
      ok: true,
      source: { id, type: sourceType, url: resolvedUrl, title, enabled: 1, newItemsCount: newCount, totalItemsCount: newCount },
      initialSync: { itemsAdded: newCount, totalInFeed: feed.items.length },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}