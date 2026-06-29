/**
 * v1.9.1 RSSHub fetcher 单测
 *
 * 验证：
 * - buildRSSHubFeedUrl 正确转 handle → URL
 * - getRSSHubConfig 读 config，fallback 默认
 * - handle 清洗（去掉 @ 前缀、trim）
 * - testRSSHubConnection 真实网络（公共实例 + 错误 URL）
 *
 * node --test --experimental-strip-types tests/rsshub-fetcher.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRSSHubFeedUrl, getRSSHubConfig, testRSSHubConnection } from '../apps/web/lib/rsshub-fetcher.ts';

test('rsshub: buildRSSHubFeedUrl 默认 base + handle', () => {
  const url = buildRSSHubFeedUrl('twitter', 'elonmusk');
  assert.match(url, /^https:\/\/rsshub\.app\/twitter\/user\/elonmusk$/);
});

test('rsshub: buildRSSHubFeedUrl 自动 strip @ 前缀', () => {
  const url = buildRSSHubFeedUrl('twitter', '@naval');
  assert.match(url, /\/twitter\/user\/naval$/);
  assert.ok(!url.includes('@'), 'URL 不应包含 @');
});

test('rsshub: buildRSSHubFeedUrl 自定义 base', () => {
  const url = buildRSSHubFeedUrl('twitter', 'sama', 'https://rsshub.mydomain.com');
  assert.equal(url, 'https://rsshub.mydomain.com/twitter/user/sama');
});

test('rsshub: buildRSSHubFeedUrl 自定义 base 自动去末尾 /', () => {
  const url = buildRSSHubFeedUrl('twitter', 'sama', 'https://rsshub.mydomain.com/');
  assert.equal(url, 'https://rsshub.mydomain.com/twitter/user/sama');
});

test('rsshub: buildRSSHubFeedUrl trim handle 空白', () => {
  const url = buildRSSHubFeedUrl('twitter', '  sama  ');
  assert.match(url, /\/twitter\/user\/sama$/);
});

test('rsshub: buildRSSHubFeedUrl 特殊字符 URL encode', () => {
  const url = buildRSSHubFeedUrl('twitter', 'user/with/slash');
  assert.ok(url.includes('user%2Fwith%2Fslash'), '斜杠被编码');
});

test('rsshub: getRSSHubConfig fallback 默认值', () => {
  // 没有 config 时用默认 https://rsshub.app
  const cfg = getRSSHubConfig();
  assert.match(cfg.baseUrl, /^https:\/\/rsshub\.app$/);
});

test('rsshub: getRSSHubConfig 接受 override', () => {
  const cfg = getRSSHubConfig('https://custom.example.com/');
  assert.equal(cfg.baseUrl, 'https://custom.example.com', 'override + 自动去末尾 /');
});

test('rsshub: testRSSHubConnection 公共实例（可能 404/200）', async () => {
  // 公共实例 twitter 路由已被禁，期望 ok=false
  // （如果是 200，expect itemCount > 0）
  const result = await testRSSHubConnection('https://rsshub.app');
  // 不强制 ok=false，因为有些时段公共实例可能临时可用
  // 但如果有响应，itemCount 应该 >= 0
  if (result.ok) {
    assert.ok(typeof result.itemCount === 'number');
    assert.ok(result.itemCount >= 0);
  } else {
    assert.ok(typeof result.error === 'string');
  }
});

test('rsshub: testRSSHubConnection 错误 URL', async () => {
  const result = await testRSSHubConnection('https://this-domain-does-not-exist-xyz.invalid');
  assert.equal(result.ok, false);
  assert.ok(result.error, '错误信息应非空');
});

test('rsshub: buildRSSHubFeedUrl 拒绝不支持的 type', () => {
  // @ts-ignore 故意传错
  assert.throws(() => buildRSSHubFeedUrl('wechat-account', 'xxx'), /暂未支持/);
  // @ts-ignore 故意传错
  assert.throws(() => buildRSSHubFeedUrl('instagram', 'xxx'), /暂未支持/);
});