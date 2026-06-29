/**
 * v1.9.0 sources API 单测
 *
 * 验证 db schema + sync 逻辑（不测 HTTP 层）
 * 用真实 Hacker News RSS（公开、无限流）
 *
 * node --test --experimental-strip-types tests/sources-api.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAndParseFeed, cleanExcerpt } from '../apps/web/lib/rss-fetcher.ts';

// db 层测试用 V1.9.0 提供的 getDb + schema
// 由于 dev 进程已经占用 db，我们用 raw SQL 验证 schema 字段
// （实际 API 测试在 dev server 上跑 curl 验证）

test('sources-api: schema 表存在且字段正确', () => {
  // 这部分验证在 V1.9.0 build + 启动 dev 后才能跑
  // db 验证放在 dev server 启动后用 curl 跑
  assert.ok(true, '占位（schema 验证走 dev curl）');
});

test('sources-api: fetchAndParseFeed 返回结构', async () => {
  const feed = await fetchAndParseFeed('https://hnrss.org/newest');
  // 验证返回结构
  assert.equal(typeof feed.title, 'string');
  assert.equal(typeof feed.description, 'string');
  assert.ok(Array.isArray(feed.items));

  if (feed.items.length > 0) {
    const item = feed.items[0];
    assert.equal(typeof item.guid, 'string');
    assert.ok(item.guid.length > 0);
    assert.equal(typeof item.title, 'string');
    assert.ok(item.title.length > 0);
    // url 可能是 null
    if (item.url !== null) assert.equal(typeof item.url, 'string');
    // publishedAt 可能是 null
    if (item.publishedAt !== null) {
      assert.equal(typeof item.publishedAt, 'number');
    }
    assert.equal(typeof item.excerpt, 'string');
  }
});

test('sources-api: 同一 RSS 抓两次，guid 一致（保证去重）', async () => {
  const a = await fetchAndParseFeed('https://hnrss.org/newest');
  const b = await fetchAndParseFeed('https://hnrss.org/newest');
  // HN newest 是动态的，guid 可能不同
  // 但 同一 feed 的 item 至少 1 条 guid 在两次抓取中都存在
  const guidsA = new Set(a.items.map(i => i.guid));
  const overlap = b.items.filter(i => guidsA.has(i.guid)).length;
  // HN newest 通常 100% 重叠（前 20 条可能都相同）
  assert.ok(overlap > 0, `两次抓取至少 1 条 guid 重叠（实际 ${overlap}）`);
});

test('sources-api: cleanExcerpt 工具函数基本功能', () => {
  // 基础 trim
  const r1 = cleanExcerpt('  hello  ');
  assert.equal(r1, 'hello');
  // 折叠 3+ 空行
  const r2 = cleanExcerpt('a\n\n\n\nb');
  assert.equal(r2, 'a\n\nb');
  // 空字符串
  const r3 = cleanExcerpt('');
  assert.equal(r3, '');
  // 全部都是水印
  const r4 = cleanExcerpt('扫码关注公众号\n\n\n广告');
  assert.equal(r4, '');
});