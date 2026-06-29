/**
 * RSSHub 抓取器（v1.9.1）
 *
 * 功能：
 * - 把 Twitter handle / 公众号 id 转成 RSSHub feed URL
 * - 调用 fetchAndParseFeed 复用 RSS 解析（RSSHub 输出标准 RSS XML）
 *
 * 限制：
 * - X 公开 API 2023 年已死，必须依赖 RSSHub
 * - 默认用公共实例 https://rsshub.app（限流严、不稳定）
 * - 用户可自部署后到 /settings 改 RSSHub Base URL
 *
 * V1.9.1 只支持 type='twitter'，wechat-account 留 V1.9.2
 */

import { fetchAndParseFeed, type ParsedFeed } from './rss-fetcher.ts';

const DEFAULT_RSSHUB_BASE = 'https://rsshub.app';

export type RSSHubSourceType = 'twitter';

export interface RSSHubConfig {
  baseUrl: string;
}

/**
 * 从 config 读 RSSHub base URL（fallback 默认）
 * 注意：config 是同步读，调用前确保 readConfig 不阻塞
 */
export function getRSSHubConfig(rsshubBaseOverride?: string): RSSHubConfig {
  if (rsshubBaseOverride) {
    return { baseUrl: rsshubBaseOverride.replace(/\/+$/, '') };
  }
  try {
    // dynamic import 避免循环依赖（rss-fetcher 不依赖 core）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readConfig } = require('@insight-os/core');
    const cfg = readConfig();
    return { baseUrl: (cfg.preferences?.rsshubBase || DEFAULT_RSSHUB_BASE).replace(/\/+$/, '') };
  } catch {
    return { baseUrl: DEFAULT_RSSHUB_BASE };
  }
}

/**
 * 把 source 标识符转成 RSSHub feed URL
 * twitter handle → https://rsshub.app/twitter/user/elonmusk
 */
export function buildRSSHubFeedUrl(type: RSSHubSourceType, handle: string, rsshubBaseOverride?: string): string {
  const cleanHandle = handle.replace(/^@/, '').trim();
  const { baseUrl } = getRSSHubConfig(rsshubBaseOverride);
  switch (type) {
    case 'twitter':
      return `${baseUrl}/twitter/user/${encodeURIComponent(cleanHandle)}`;
    default:
      throw new Error(`RSSHub type "${type}" 暂未支持（V1.9.1 只支持 twitter）`);
  }
}

/**
 * 抓取并解析 RSSHub feed
 *
 * @param type - 'twitter'
 * @param handle - 用户 handle（不带 @）
 * @param rsshubBaseOverride - 可选，覆盖 config 里的 base URL
 */
export async function fetchFromRSSHub(
  type: RSSHubSourceType,
  handle: string,
  rsshubBaseOverride?: string
): Promise<ParsedFeed> {
  const feedUrl = buildRSSHubFeedUrl(type, handle, rsshubBaseOverride);
  return fetchAndParseFeed(feedUrl);
}

/**
 * 测试 RSSHub 是否可用（用 elonmusk 作样例）
 */
export async function testRSSHubConnection(rsshubBase: string): Promise<{ ok: boolean; itemCount?: number; error?: string }> {
  try {
    const feed = await fetchFromRSSHub('twitter', 'elonmusk', rsshubBase);
    return { ok: true, itemCount: feed.items.length };
  } catch (e: any) {
    return { ok: false, error: e.message || String(e) };
  }
}