/**
 * POST /api/sources/[id]/sync
 *
 * 立即同步一个 RSS 源：
 * - type='rss': 直接抓 url
 * - type='twitter' (V1.9.1): 走 RSSHub
 * - 去重（UNIQUE 约束）
 * - 更新 lastFetchedAt / newItemsCount / totalItemsCount
 * - 失败 → 写 lastError
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, sources, sourceItems } from '@insight-os/db';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { fetchAndParseFeed, cleanExcerpt } from '@/lib/rss-fetcher';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });

    const src = db.select().from(sources).where(eq(sources.id, id)).get();
    if (!src) {
      return NextResponse.json({ ok: false, error: '源不存在' }, { status: 404 });
    }

    // V1.9.2: reddit / rss / twitter 走对应 fetcher
    if (!['rss', 'twitter', 'reddit'].includes(src.type)) {
      return NextResponse.json({ ok: false, error: `源类型 ${src.type} 暂未支持`, code: 'TYPE_NOT_SUPPORTED' }, { status: 400 });
    }

    const now = Date.now();
    let feed;
    try {
      if (src.type === 'reddit') {
        // Reddit: 从 src.url 提取 subreddit/user 名
        const match = src.url.match(/\/(?:r\/|user\/)([A-Za-z0-9_-]+)\/\.rss/);
        const name = match?.[1];
        if (!name) throw new Error('Reddit URL 格式异常，无法提取名称');
        const { fetchRedditFeed } = await import('@/lib/reddit-fetcher');
        feed = await fetchRedditFeed(name);
      } else {
        // rss / twitter：直接抓 src.url（Twitter 已是 RSSHub 转好的 URL）
        feed = await fetchAndParseFeed(src.url);
      }
    } catch (e: any) {
      db.update(sources)
        .set({ lastError: e.message || String(e), lastFetchedAt: now, updatedAt: now })
        .where(eq(sources.id, id))
        .run();
      return NextResponse.json({ ok: false, error: e.message, code: 'FETCH_FAILED' }, { status: 502 });
    }

    let added = 0;
    let skipped = 0;
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
        added++;
      } catch (e: any) {
        if (String(e.message).includes('UNIQUE')) {
          skipped++;
        } else {
          console.warn('[sources/[id]/sync] insert failed:', e.message);
        }
      }
    }

    const counts = db.get(sql`
      SELECT
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as newCount,
        count(*) as totalCount
      FROM source_items WHERE source_id = ${id}
    `) as { newCount: number; totalCount: number } | undefined;

    db.update(sources)
      .set({
        lastFetchedAt: now,
        lastError: null,
        newItemsCount: counts?.newCount ?? 0,
        totalItemsCount: counts?.totalCount ?? 0,
        updatedAt: now,
      })
      .where(eq(sources.id, id))
      .run();

    return NextResponse.json({
      ok: true,
      syncResult: {
        added,
        skipped,
        totalInFeed: feed.items.length,
        newItemsCount: counts?.newCount ?? 0,
        totalItemsCount: counts?.totalCount ?? 0,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}