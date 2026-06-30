/**
 * V1.11 客户端 RSS 抓取 + 解析
 *
 * 之前 /api/sources/[id]/sync 调 server 端 fetch RSS + 写 SQLite
 * V1.11 改为 client 端 fetch + 写 IndexedDB（Vercel demo 必备）
 *
 * 支持：
 * - RSS 2.0 (channel/item)
 * - Atom (feed/entry)
 * - Reddit JSON (.rss → https://www.reddit.com/r/xxx.json)
 */

import { addSourceItem, getSourceItems, updateSource } from './operations';
import type { SourceItemRow, SourceRow } from './db';

interface ParsedItem {
  guid: string;
  title: string;
  url: string;
  author?: string;
  summary?: string;
  publishedAt: number;
  rawJson?: string;
}

/**
 * 解析 RSS XML → item 列表
 */
function parseRSSXML(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const itemMatches = [...xml.matchAll(/<item[\s\S]*?<\/item>/g)];
  for (const m of itemMatches) {
    const item = m[0];
    const get = (tag: string): string => {
      const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return match ? match[1].trim() : '';
    };
    const title = get('title').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
    const link = get('link').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    const description = get('description').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim().slice(0, 500);
    const author = get('author') || get('dc:creator') || '';
    const pubDate = get('pubDate') || get('dc:date') || '';
    const guid = get('guid') || link;

    if (!title || !link) continue;
    const publishedAt = pubDate ? new Date(pubDate).getTime() || Date.now() : Date.now();

    items.push({ guid, title, url: link, author, summary: description, publishedAt });
  }
  return items;
}

/**
 * 解析 Atom XML → entry 列表
 */
function parseAtomXML(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const entryMatches = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/g)];
  for (const m of entryMatches) {
    const entry = m[0];
    const get = (tag: string): string => {
      const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return match ? match[1].trim() : '';
    };
    const title = get('title').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
    // Atom link 是 <link href="..."/>
    const linkMatch = entry.match(/<link[^>]*href=["']([^"']+)["']/);
    const link = linkMatch ? linkMatch[1] : '';
    const summary = (get('summary') || get('content')).replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim().slice(0, 500);
    const authorMatch = entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/);
    const author = authorMatch ? authorMatch[1].trim() : '';
    const published = get('published') || get('updated');
    const id = get('id') || link;

    if (!title || !link) continue;
    const publishedAt = published ? new Date(published).getTime() || Date.now() : Date.now();

    items.push({ guid: id, title, url: link, author, summary, publishedAt });
  }
  return items;
}

/**
 * 解析 Reddit JSON
 */
interface RedditPost {
  data: {
    id: string;
    name: string;
    title: string;
    url: string;
    permalink: string;
    author: string;
    subreddit_name_prefixed: string;
    score: number;
    num_comments: number;
    created_utc: number;
    selftext: string;
    thumbnail: string;
  };
}

function parseRedditJSON(json: any): ParsedItem[] {
  const data = json?.data?.children || [];
  return data.map((post: RedditPost) => ({
    guid: post.data.name,
    title: post.data.title,
    url: `https://www.reddit.com${post.data.permalink}`,
    author: post.data.author,
    summary: post.data.selftext?.slice(0, 500) || '',
    publishedAt: post.data.created_utc * 1000,
  }));
}

/**
 * 主入口：sync 一个 source（fetch + 解析 + 写 IDB）
 *
 * @param source SourceRow
 * @returns { newCount, totalCount, error? }
 */
export async function syncSource(source: SourceRow): Promise<{ newCount: number; totalCount: number; error?: string }> {
  try {
    if (source.type === 'reddit') {
      // Reddit: url 形如 https://www.reddit.com/r/xxx/.rss
      // 改成 .json
      const jsonUrl = source.url.replace(/\.rss$/, '.json');
      const res = await fetch(jsonUrl, { headers: { 'User-Agent': 'insight-os/1.11' } });
      if (!res.ok) {
        const err = `Reddit fetch failed: ${res.status}`;
        await updateSource(source.id, { lastError: err, lastFetchedAt: Date.now() } as any);
        return { newCount: 0, totalCount: 0, error: err };
      }
      const json = await res.json();
      const items = parseRedditJSON(json);
      const existing = await getSourceItems(source.id);
      const existingGuids = new Set(existing.map(e => e.guid));
      const newItems: SourceItemRow[] = [];
      const now = Date.now();
      for (const item of items) {
        if (existingGuids.has(item.guid)) continue;
        newItems.push({
          id: `si_${item.guid}`,
          sourceId: source.id,
          guid: item.guid,
          title: item.title,
          url: item.url,
          author: item.author,
          summary: item.summary,
          publishedAt: item.publishedAt,
          fetchedAt: now,
          status: 'new',
        });
      }
      if (newItems.length > 0) {
        await addSourceItemBulk(newItems);
      }
      const totalCount = existing.length + newItems.length;
      const newCount = newItems.length;
      await updateSource(source.id, {
        lastFetchedAt: now,
        newItemsCount: newCount,
        totalItemsCount: totalCount,
        lastError: null,
      } as any);
      return { newCount, totalCount };
    } else {
      // RSS / Atom
      const res = await fetch(source.url);
      if (!res.ok) {
        const err = `Fetch failed: ${res.status}`;
        await updateSource(source.id, { lastError: err, lastFetchedAt: Date.now() } as any);
        return { newCount: 0, totalCount: 0, error: err };
      }
      const xml = await res.text();
      const items = xml.includes('<feed') ? parseAtomXML(xml) : parseRSSXML(xml);
      const existing = await getSourceItems(source.id);
      const existingGuids = new Set(existing.map(e => e.guid));
      const newItems: SourceItemRow[] = [];
      const now = Date.now();
      for (const item of items) {
        if (existingGuids.has(item.guid)) continue;
        newItems.push({
          id: `si_${item.guid}`,
          sourceId: source.id,
          guid: item.guid,
          title: item.title,
          url: item.url,
          author: item.author,
          summary: item.summary,
          publishedAt: item.publishedAt,
          fetchedAt: now,
          status: 'new',
        });
      }
      if (newItems.length > 0) {
        await addSourceItemBulk(newItems);
      }
      const totalCount = existing.length + newItems.length;
      const newCount = newItems.length;
      await updateSource(source.id, {
        lastFetchedAt: now,
        newItemsCount: newCount,
        totalItemsCount: totalCount,
        lastError: null,
      } as any);
      return { newCount, totalCount };
    }
  } catch (e: any) {
    const err = e.message || String(e);
    await updateSource(source.id, { lastError: err, lastFetchedAt: Date.now() } as any);
    return { newCount: 0, totalCount: 0, error: err };
  }
}

// ===== internal helper =====
async function addSourceItemBulk(items: SourceItemRow[]) {
  const DexieModule = await import('dexie');

  const db = await getSharedDexie();
await db.sourceItems.bulkPut(items);
}