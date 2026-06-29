/**
 * v1.9.0 RSS 抓取器单测
 *
 * 验证：
 * - 抓真实 RSS feed（用 Hacker News 公开 feed，无 auth 无限流）
 * - 解析 title / items / guid
 * - 错误 URL 抛错
 * - cleanExcerpt 工具函数
 *
 * 依赖：apps/web/lib/rss-fetcher.ts 已 build 进 dist
 *
 * node --test tests/rss-fetcher.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAndParseFeed, cleanExcerpt } from '../apps/web/lib/rss-fetcher.ts';

test('rss-fetcher: 抓 Hacker News newest 真实 feed', async () => {
  const feed = await fetchAndParseFeed('https://hnrss.org/newest');
  assert.ok(feed.title, 'feed title 不为空');
  assert.ok(Array.isArray(feed.items), 'items 是数组');
  assert.ok(feed.items.length > 0, 'items 至少 1 条');
  // 第一条
  const first = feed.items[0];
  assert.ok(first.guid, 'item.guid 不为空');
  assert.ok(first.title, 'item.title 不为空');
  assert.ok(typeof first.excerpt === 'string', 'excerpt 是 string');
  assert.ok(first.excerpt.length > 0, 'excerpt 非空');
});

test('rss-fetcher: items 的 guid 都唯一', async () => {
  const feed = await fetchAndParseFeed('https://hnrss.org/newest');
  const guids = feed.items.map(i => i.guid);
  const unique = new Set(guids);
  assert.equal(unique.size, guids.length, `${guids.length} 条 item 全部 guid 唯一`);
});

test('rss-fetcher: 错误 URL 抛错', async () => {
  await assert.rejects(
    async () => await fetchAndParseFeed('https://this-domain-does-not-exist-abcxyz.invalid/feed'),
    /ENOTFOUND|getaddrinfo|404|Failed|fetch/i,
    '无效 URL 应该抛错'
  );
});

test('rss-fetcher: HTML 页面（非 RSS）抛错或返回空', async () => {
  // 抓 google.com 首页（HTML 不是 RSS）
  await assert.rejects(
    async () => await fetchAndParseFeed('https://www.google.com/'),
    /Not a feed|Invalid|parse|XML|ENOTFOUND|404|status/i,
    '非 RSS URL 应该抛错或返回空'
  );
});

test('rss-fetcher: publishedAt 是 number 或 null', async () => {
  const feed = await fetchAndParseFeed('https://hnrss.org/newest');
  for (const item of feed.items) {
    if (item.publishedAt !== null) {
      assert.equal(typeof item.publishedAt, 'number', 'publishedAt 是 number');
      assert.ok(item.publishedAt > 0, 'publishedAt 是正数');
    }
  }
});

test('rss-fetcher: excerpt 不超过 500 字', async () => {
  const feed = await fetchAndParseFeed('https://hnrss.org/newest');
  for (const item of feed.items) {
    assert.ok(item.excerpt.length <= 500, `excerpt 不超过 500 字符（实际 ${item.excerpt.length}）`);
  }
});

test('rss-fetcher: cleanExcerpt 过滤广告水印（行首）', () => {
  // 公众号文章常见水印
  const dirty = '扫码关注公众号 获取更多\n这是一篇真正的内容。\n点击阅读原文\n第二段内容。';
  const cleaned = cleanExcerpt(dirty);
  assert.ok(!cleaned.includes('扫码关注'), '过滤"扫码关注"行');
  assert.ok(!cleaned.includes('点击阅读原文'), '过滤"点击阅读原文"行');
  assert.ok(cleaned.includes('这是一篇真正的内容'), '保留正文');
  assert.ok(cleaned.includes('第二段内容'), '保留多段');
});

test('rss-fetcher: cleanExcerpt 真实 RSS excerpt 不破坏', async () => {
  // 真实 Hacker News excerpt 通常是 URL，没水印
  const feed = await fetchAndParseFeed('https://hnrss.org/newest');
  const cleaned = cleanExcerpt(feed.items[0].excerpt);
  // 真实 excerpt 大多就是 URL，cleanExcerpt 不应该把它搞空
  assert.ok(cleaned.length > 0, '真实 excerpt clean 后非空');
});

test('rss-fetcher: cleanExcerpt 收尾 trim + 折叠空行', () => {
  const messy = '  内容  \n\n\n\n  内容2  \n\n\n\n\n';
  const cleaned = cleanExcerpt(messy);
  // 关键断言：trim 掉了首尾空白；连续 3+ 空行被折叠
  assert.ok(!cleaned.startsWith(' '), '首部 trim');
  assert.ok(!cleaned.endsWith(' '), '尾部 trim');
  assert.ok(!cleaned.includes('\n\n\n'), '没有 3+ 连续空行');
  assert.ok(cleaned.includes('内容'), '保留内容');
  assert.ok(cleaned.includes('内容2'), '保留内容2');
});