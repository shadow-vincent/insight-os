/**
 * Reddit fetcher（v1.9.2）
 *
 * 走 Reddit 官方 RSS 端点，零配置、零依赖：
 * - subreddit: https://www.reddit.com/r/{name}/.rss
 * - user:      https://www.reddit.com/user/{name}/.rss
 *
 * Reddit 限流严格（HTTP 429），必须用 application-like UA（含版本 + 联系信息）
 * 否则服务端 fetch 会被识别为 bot（429）。
 *
 * 实测对比（2026-06-29）：
 * - browser UA（Mozilla/5.0...）→ 429（认为是伪装爬虫）
 * - application UA 含 `/u/` 联系信息 → 200
 *
 * 不走 RSSHub：公共实例 rsshub.app 在 Cloudflare 后面，
 * 服务端 fetch 会被 anti-bot challenge 挡住（HTTP 403）。
 * 走官方 RSS 是唯一不需要自部署 RSSHub 的路径。
 *
 * v1.9.2 调研确认（2026-06-29）：
 * - hnrss.org: 直接 RSS ✅
 * - sspai.com/feed: 直接 RSS ✅
 * - reddit.com/r/xxx/.rss（browser UA）: ✅ 200
 * - rsshub.app/*（任何路由）: ❌ 403 Cloudflare
 * - twitter.com/*: ❌ 无公开 RSS
 */

import { fetchAndParseFeed, type ParsedFeed } from './rss-fetcher.ts';

const REDDIT_BROWSER_UA = 'insight-os:1.9.2 (by /u/shadow-vincent, https://github.com/shadow-vincent/insight-os)';

/**
 * 把输入构建成 Reddit 官方 RSS URL
 *
 * @param input - subreddit 名（如 LocalLLaMA）或 user 名（如 spez）
 *               可带前缀：r/ 或 u/ 或 user/ 或 /r/ /u/（自动清洗）
 *
 * V1.9.2 只实现 subreddit 抓取，user 类型 URL 已构建但当前不被 fetch（避免歧义）
 * 后续 V1.9.3+ 可启用 user 抓取
 */
export function buildRedditFeedUrl(input: string): { kind: 'subreddit' | 'user'; url: string; displayName: string } {
  const trimmed = input.trim().replace(/^\//, '');
  // 检测前缀：u/ 或 user/ → user 类型
  const userPrefixMatch = trimmed.match(/^(?:u|user)\//);
  if (userPrefixMatch) {
    const cleaned = trimmed.slice(userPrefixMatch[0].length);
    if (!cleaned || !/^[A-Za-z0-9_-]{2,21}$/.test(cleaned)) {
      throw new Error(`Reddit user 名格式无效: "${input}"（应为 2-21 位字母/数字/下划线/连字符）`);
    }
    return {
      kind: 'user',
      url: `https://www.reddit.com/user/${encodeURIComponent(cleaned)}/.rss`,
      displayName: cleaned,
    };
  }
  // 否则默认 subreddit（去 r/ 前缀）
  const cleaned = trimmed.replace(/^r\//, '');
  if (!cleaned || !/^[A-Za-z0-9_-]{2,21}$/.test(cleaned)) {
    throw new Error(`Reddit 名称格式无效: "${input}"（应为 2-21 位字母/数字/下划线/连字符）`);
  }
  return {
    kind: 'subreddit',
    url: `https://www.reddit.com/r/${encodeURIComponent(cleaned)}/.rss`,
    displayName: cleaned,
  };
}

/**
 * 抓取 Reddit RSS（用 application UA 避免 429）
 *
 * Reddit 反爬特点：
 * - browser UA → 429（认为是伪装爬虫）
 * - application UA（含版本 + 联系信息）→ 200
 * - 单 IP 限流：短时间内多次请求会被 429
 */
export async function fetchRedditFeed(input: string): Promise<ParsedFeed & { kind: 'subreddit' | 'user' }> {
  const { kind, url, displayName } = buildRedditFeedUrl(input);

  // 直接 fetch，模拟应用请求（不是 browser 也不是 bot）
  const res = await fetch(url, {
    headers: {
      'User-Agent': REDDIT_BROWSER_UA,
      'Accept': 'application/atom+xml, application/xml;q=0.9, */*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache',
    },
    // reddit 会 302 到 old.reddit.com，redirect: 'follow' 是 default
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error(`Reddit /r/${displayName} 不存在或已私密`);
    if (res.status === 429) throw new Error('Reddit 限流（429），稍后再试');
    throw new Error(`Reddit 抓取失败: HTTP ${res.status}`);
  }

  const xml = await res.text();
  // 借用 rss-parser 解析 atom
  const Parser = (await import('rss-parser')).default;
  const parser = new Parser({ timeout: 10000 });
  const feed = await parser.parseString(xml);

  const items = (feed.items ?? []).map(item => {
    const guid = (item.guid || item.link || item.title || '').toString().trim();
    const publishedAt = item.isoDate
      ? new Date(item.isoDate).getTime()
      : item.pubDate
      ? new Date(item.pubDate).getTime()
      : null;
    let excerpt = '';
    if (item.contentSnippet) excerpt = item.contentSnippet.trim().slice(0, 500);
    else if (item.content) {
      excerpt = item.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
    }
    return {
      guid,
      title: (item.title ?? '(无标题)').toString().trim(),
      url: item.link ?? null,
      publishedAt,
      excerpt,
    };
  }).filter(item => item.guid && item.title);

  return {
    kind,
    title: (feed.title ?? `/r/${displayName}`).toString().trim(),
    description: (feed.description ?? '').toString().trim(),
    items,
  };
}

// 抑制 lint（fetchAndParseFeed 是给其他 RSS 用的，这里直接 fetch）
void fetchAndParseFeed;