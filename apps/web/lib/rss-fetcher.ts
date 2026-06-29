/**
 * RSS 抓取器（v1.9.0）
 *
 * 功能：
 * - GET RSS URL → 解析 XML → 提取 items（title / url / guid / publishedAt / excerpt）
 * - 5 秒超时（HTTP fetch）
 * - 去重：(source_id, guid) UNIQUE 约束在 db 层处理
 * - excerpt = contentSnippet 或 content 前 500 字
 *
 * 错误处理：
 * - HTTP 失败 / XML 解析失败 → throw Error 让 API 端捕获
 * - item 缺 guid → 用 url 作为 fallback（确保能去重）
 * - item 缺 publishedAt → 用 fetchedAt 兜底
 *
 * V1.9.0 只支持 RSS，Twitter 留 V1.9.1
 */

import Parser from 'rss-parser';

const TIMEOUT_MS = 8000;
const EXCERPT_MAX_LENGTH = 500;

export interface ParsedFeedItem {
  guid: string;
  title: string;
  url: string | null;
  publishedAt: number | null;
  excerpt: string;
}

export interface ParsedFeed {
  title: string;           // feed 标题（如 "36氪"）
  description: string;     // feed 描述
  items: ParsedFeedItem[];
}

const parser = new Parser({
  timeout: TIMEOUT_MS,
  headers: {
    'User-Agent': 'InsightOS/1.9.0 (+https://github.com/shadow-vincent/insight-os)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
});

/**
 * 抓取并解析一个 RSS feed
 *
 * @param feedUrl - RSS XML URL
 * @returns ParsedFeed { title, description, items[] }
 * @throws Error 网络错误 / XML 解析失败 / feed 为空
 */
export async function fetchAndParseFeed(feedUrl: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(feedUrl);

  const items: ParsedFeedItem[] = (feed.items ?? []).map(item => {
    const guid = (item.guid || item.link || item.title || '').toString().trim();
    const url = item.link ?? null;
    const title = (item.title ?? '(无标题)').toString().trim();
    const publishedAt = item.isoDate
      ? new Date(item.isoDate).getTime()
      : item.pubDate
      ? new Date(item.pubDate).getTime()
      : null;

    // excerpt: 优先用 feed 提供的 contentSnippet，否则从 content 截前 500 字
    let excerpt = '';
    if (item.contentSnippet) {
      excerpt = item.contentSnippet.trim().slice(0, EXCERPT_MAX_LENGTH);
    } else if (item.content) {
      // strip HTML 标签
      excerpt = item.content
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, EXCERPT_MAX_LENGTH);
    } else if (item.summary) {
      excerpt = item.summary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, EXCERPT_MAX_LENGTH);
    }

    return { guid, title, url, publishedAt, excerpt };
  }).filter(item => item.guid && item.title); // 过滤掉 guid/title 都缺失的脏数据

  return {
    title: (feed.title ?? '').toString().trim(),
    description: (feed.description ?? '').toString().trim(),
    items,
  };
}

/**
 * 工具函数：从 excerpt 中过滤掉明显的垃圾前缀（公众号水印、广告）
 */
export function cleanExcerpt(raw: string): string {
  return raw
    .replace(/^扫码关注.*$/gm, '')
    .replace(/^点击阅读原文.*$/gm, '')
    .replace(/^\s*广告\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}