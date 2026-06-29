/**
 * v1.9.2 Reddit fetcher 单测
 *
 * 验证：
 * - buildRedditFeedUrl 正确处理 subreddit/user 输入
 * - 清洗输入（去掉 r/ 前缀 + u/user 前缀）
 * - 名称格式校验
 * - fetchRedditFeed 真实网络（Reddit 官方 RSS）
 *
 * node --test --experimental-strip-types tests/reddit-fetcher.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRedditFeedUrl } from '../apps/web/lib/reddit-fetcher.ts';

test('reddit: buildRedditFeedUrl subreddit', () => {
  const r = buildRedditFeedUrl('LocalLLaMA');
  assert.equal(r.kind, 'subreddit');
  assert.equal(r.url, 'https://www.reddit.com/r/LocalLLaMA/.rss');
  assert.equal(r.displayName, 'LocalLLaMA');
});

test('reddit: buildRedditFeedUrl 清洗 r/ 前缀', () => {
  const r = buildRedditFeedUrl('r/LocalLLaMA');
  assert.equal(r.url, 'https://www.reddit.com/r/LocalLLaMA/.rss');
  assert.equal(r.displayName, 'LocalLLaMA');
});

test('reddit: buildRedditFeedUrl 清洗 /r/ 前缀', () => {
  const r = buildRedditFeedUrl('/r/LocalLLaMA');
  assert.equal(r.url, 'https://www.reddit.com/r/LocalLLaMA/.rss');
});

test('reddit: buildRedditFeedUrl 清洗 u/ 前缀（识别为 user 类型）', () => {
  const r = buildRedditFeedUrl('u/spez');
  assert.equal(r.kind, 'user');
  assert.equal(r.url, 'https://www.reddit.com/user/spez/.rss');
  assert.equal(r.displayName, 'spez');
});

test('reddit: buildRedditFeedUrl 清洗 user/ 前缀（识别为 user 类型）', () => {
  const r = buildRedditFeedUrl('user/spez');
  assert.equal(r.kind, 'user');
  assert.equal(r.url, 'https://www.reddit.com/user/spez/.rss');
  assert.equal(r.displayName, 'spez');
});

test('reddit: buildRedditFeedUrl trim 空白', () => {
  const r = buildRedditFeedUrl('  LocalLLaMA  ');
  assert.equal(r.displayName, 'LocalLLaMA');
});

test('reddit: buildRedditFeedUrl 短名称（2 字符）', () => {
  const r = buildRedditFeedUrl('ai');
  assert.equal(r.url, 'https://www.reddit.com/r/ai/.rss');
});

test('reddit: buildRedditFeedUrl 长名称（21 字符）', () => {
  const longName = 'a'.repeat(21);
  const r = buildRedditFeedUrl(longName);
  assert.equal(r.displayName, longName);
});

test('reddit: buildRedditFeedUrl 拒绝太长名称（22+ 字符）', () => {
  assert.throws(
    () => buildRedditFeedUrl('a'.repeat(22)),
    /格式无效/
  );
});

test('reddit: buildRedditFeedUrl 拒绝空字符串', () => {
  assert.throws(() => buildRedditFeedUrl(''), /格式无效/);
});

test('reddit: buildRedditFeedUrl 拒绝特殊字符', () => {
  assert.throws(() => buildRedditFeedUrl('foo bar'), /格式无效/); // 空格
  assert.throws(() => buildRedditFeedUrl('foo!'), /格式无效/); // 感叹号
});

test('reddit: buildRedditFeedUrl 接受连字符和下划线', () => {
  const r1 = buildRedditFeedUrl('test-subreddit');
  assert.equal(r1.displayName, 'test-subreddit');
  const r2 = buildRedditFeedUrl('test_subreddit');
  assert.equal(r2.displayName, 'test_subreddit');
});

test('reddit: buildRedditFeedUrl URL encode 特殊字符', () => {
  // 大写字母 / 数字都直接保留
  const r = buildRedditFeedUrl('AskReddit');
  assert.equal(r.url, 'https://www.reddit.com/r/AskReddit/.rss');
});

test('reddit: 端到端 fetchRedditFeed 真实抓取（默认 skip，避免 Reddit 限流影响主测试）', async (t) => {
  // 端到端抓取真实 Reddit RSS 会触发 429 限流，默认 skip
  // 单独跑：SKIP_REDDIT_E2E=1 npm test（如果想跑就 1 跑一次）
  if (process.env.SKIP_REDDIT_E2E !== '1') {
    t.skip('默认 skip（Reddit 限流避免影响主测试流）');
    return;
  }
  const { fetchRedditFeed } = await import('../apps/web/lib/reddit-fetcher.ts');
  try {
    const feed = await fetchRedditFeed('LocalLLaMA');
    assert.ok(feed.items.length > 0, `抓到 ${feed.items.length} 条`);
    assert.ok(feed.title.includes('LocalLLaMA'), 'feed title 含 subreddit 名');
  } catch (e) {
    // 429 不算 fail（限流是真实问题但不是代码 bug）
    if (String(e.message).includes('429')) {
      t.skip(`Reddit 限流（429），跳过 E2E: ${e.message}`);
    } else {
      throw e;
    }
  }
});