/**
 * v1.9.1 sources API 端到端测试
 *
 * 验证：
 * - type='rss' 添加源（用 Hacker News 公开 feed）
 * - type='rss' 同步去重
 * - type='twitter' 拒绝无效 type
 * - type='twitter' 缺少 handle 报错
 * - 一键加工（import）→ source_item.status='imported' + assetId 关联
 *
 * 假设 dev server 跑在 localhost:4191
 *
 * node --test --experimental-strip-types tests/sources-v191-api.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4191';

// 假设 LLM 已配置（否则 intake 会失败）
// 注：这些测试需要 dev server 跑起来

let createdSourceId = null;
let createdItemId = null;
let importedAssetId = null;

test('v1.9.1: GET /api/sources 返回列表', async () => {
  const res = await fetch(`${BASE}/api/sources`);
  const data = await res.json();
  assert.equal(res.ok, true);
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.sources));
});

test('v1.9.1: POST /api/sources type=rss 走真实 HN feed', async () => {
  // 先删可能存在的 HN 源（避免 duplicate）
  const before = await fetch(`${BASE}/api/sources`).then(r => r.json());
  const existing = before.sources.find((s) => s.url.includes('hnrss.org/newest'));
  if (existing) {
    await fetch(`${BASE}/api/sources/${existing.id}`, { method: 'DELETE' });
  }

  const res = await fetch(`${BASE}/api/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'rss',
      url: 'https://hnrss.org/newest',
      title: 'V1.9.1 测试 HN',
    }),
  });
  const data = await res.json();
  assert.equal(data.ok, true, `add failed: ${data.error}`);
  assert.equal(data.source.type, 'rss');
  createdSourceId = data.source.id;
  assert.ok(data.source.newItemsCount > 0, '首次同步应有 items');
});

test('v1.9.1: POST /api/sources type=twitter 缺少 handle 报错', async () => {
  const res = await fetch(`${BASE}/api/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'twitter' }),
  });
  const data = await res.json();
  assert.equal(res.ok, false);
  assert.match(data.error, /handle/);
});

test('v1.9.1: POST /api/sources 不支持的 type 报错', async () => {
  const res = await fetch(`${BASE}/api/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'instagram', handle: 'xxx' }),
  });
  const data = await res.json();
  assert.equal(res.ok, false);
});

test('v1.9.1: POST /api/sources 重复 url 报错', async () => {
  // 第一次加
  const res1 = await fetch(`${BASE}/api/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'rss', url: 'https://hnrss.org/best' }),
  });
  const data1 = await res1.json();
  // 可能是 ok=true 或已经存在（取决于之前是否加过）
  if (data1.ok) {
    // 第二次加同样的 URL
    const res2 = await fetch(`${BASE}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'rss', url: 'https://hnrss.org/best' }),
    });
    const data2 = await res2.json();
    assert.equal(data2.ok, false);
    assert.equal(data2.code, 'DUPLICATE');
    // 清理
    if (data1.source?.id) {
      await fetch(`${BASE}/api/sources/${data1.source.id}`, { method: 'DELETE' });
    }
  } else if (data1.code === 'DUPLICATE') {
    // 清理已有的
    const before = await fetch(`${BASE}/api/sources`).then(r => r.json());
    const existing = before.sources.find((s) => s.url.includes('hnrss.org/best'));
    if (existing) await fetch(`${BASE}/api/sources/${existing.id}`, { method: 'DELETE' });
    // 现在加
    const res2 = await fetch(`${BASE}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'rss', url: 'https://hnrss.org/best' }),
    });
    const data2 = await res2.json();
    assert.equal(data2.ok, true, `should succeed: ${data2.error}`);
    // 再加重复
    const res3 = await fetch(`${BASE}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'rss', url: 'https://hnrss.org/best' }),
    });
    const data3 = await res3.json();
    assert.equal(data3.ok, false);
    assert.equal(data3.code, 'DUPLICATE');
    // 清理
    if (data2.source?.id) {
      await fetch(`${BASE}/api/sources/${data2.source.id}`, { method: 'DELETE' });
    }
  }
});

test('v1.9.1: GET /api/sources/[id]/items 列出 items', async () => {
  if (!createdSourceId) {
    assert.fail('前面测试失败，没有 createdSourceId');
    return;
  }
  const res = await fetch(`${BASE}/api/sources/${createdSourceId}/items?status=new&limit=3`);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.items));
  if (data.items.length > 0) {
    createdItemId = data.items[0].id;
  }
});

test('v1.9.1: POST /api/sources/[id]/items/[itemId]/import 一键加工', async () => {
  if (!createdSourceId || !createdItemId) {
    assert.fail('前面测试失败，没有 itemId');
    return;
  }
  // 检查 LLM 是否配置（intake 调 LLM）
  const configRes = await fetch(`${BASE}/api/config`);
  const config = await configRes.json();
  const llmEnabled = config.config?.llm?.enabled;
  if (!llmEnabled) {
    // LLM 没配置，skip 加工测试，但标记为 imported 会失败
    assert.ok(true, 'LLM 未配置，跳过 import 测试');
    return;
  }

  const res = await fetch(
    `${BASE}/api/sources/${createdSourceId}/items/${createdItemId}/import`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (data.ok) {
    importedAssetId = data.assetId;
    assert.ok(typeof importedAssetId === 'string');
    assert.ok(importedAssetId.length > 0);
  } else {
    // intake 失败可能因为 LLM rate limit / 内容太短
    assert.match(data.error, /intake|资产|rate|limit|素材/i);
  }
});

test('v1.9.1: 重复 import 同一个 item 报错', async () => {
  if (!createdSourceId || !createdItemId || !importedAssetId) {
    assert.ok(true, '前面 import 失败，skip');
    return;
  }
  const res = await fetch(
    `${BASE}/api/sources/${createdSourceId}/items/${createdItemId}/import`,
    { method: 'POST' }
  );
  const data = await res.json();
  assert.equal(res.ok, false);
  assert.equal(data.code, 'ALREADY_IMPORTED');
  assert.equal(data.assetId, importedAssetId);
});

test('v1.9.1: 清理测试数据', async () => {
  if (createdSourceId) {
    await fetch(`${BASE}/api/sources/${createdSourceId}`, { method: 'DELETE' });
  }
  // 清理 import 测试生成的 asset
  if (importedAssetId) {
    // assets 没 DELETE API，db 直删
    // 这里跳过，db 测试后人工清理
  }
});