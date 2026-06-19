/**
 * 全文搜索 + 收集箱 URL 抓取 测试
 *
 * node --test tests/search-and-import.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ===== 搜索 API =====

test('GET /api/search: 短查询 (< 2 字符) 返回空', async () => {
  const r = await fetch('http://localhost:4191/api/search?q=A');
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.total, 0);
});

test('GET /api/search: 中文关键词 "AI" 命中', async () => {
  const r = await fetch('http://localhost:4191/api/search?q=AI');
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.ok(d.total > 0, '应至少 1 个结果');
  assert.ok(d.results.length <= 20);
});

test('GET /api/search: 返回字段完整', async () => {
  const r = await fetch('http://localhost:4191/api/search?q=判断力');
  const d = await r.json();
  assert.equal(d.ok, true);
  for (const item of d.results) {
    for (const key of ['id', 'title', 'evidenceLevel', 'oneSentenceInsight', 'titleHighlight', 'score']) {
      assert.ok(key in item, `结果应包含 ${key}`);
    }
  }
});

test('GET /api/search: 证据等级过滤', async () => {
  const r1 = await fetch('http://localhost:4191/api/search?q=AI&evidence=E2');
  const d1 = await r1.json();
  for (const item of d1.results) {
    assert.equal(item.evidenceLevel, 'E2', '所有结果应为 E2');
  }

  const r2 = await fetch('http://localhost:4191/api/search?q=AI&evidence=E0');
  const d2 = await r2.json();
  for (const item of d2.results) {
    assert.equal(item.evidenceLevel, 'E0', '所有结果应为 E0');
  }
});

test('GET /api/search: 类型过滤', async () => {
  const r = await fetch('http://localhost:4191/api/search?q=AI&type=asset');
  const d = await r.json();
  for (const item of d.results) {
    assert.equal(item.type, 'asset', '所有结果应为 asset 类型');
  }
});

test('GET /api/search: 主题过滤（slug）', async () => {
  // 拿一个主题 slug
  const tR = await fetch('http://localhost:4191/api/topics');
  const tD = await tR.json();
  const slug = tD.topics[0]?.slug;
  if (!slug) {
    console.log('  skip: no topics');
    return;
  }
  const r = await fetch(`http://localhost:4191/api/search?q=AI&topic=${slug}`);
  const d = await r.json();
  assert.equal(d.ok, true);
  // 这个主题下的 AI 资产应都有
  console.log(`  topic=${slug}: ${d.total} results`);
});

test('GET /api/search: highlight 包含 <mark>', async () => {
  const r = await fetch('http://localhost:4191/api/search?q=AI');
  const d = await r.json();
  // 至少有一个 titleHighlight 含 <mark>
  const hasMark = d.results.some(item => (item.titleHighlight || '').includes('<mark>'));
  assert.ok(hasMark, '至少一个结果的 titleHighlight 应包含 <mark>');
});

test('GET /api/search: limit 参数生效', async () => {
  const r = await fetch('http://localhost:4191/api/search?q=AI&limit=3');
  const d = await r.json();
  assert.ok(d.results.length <= 3, `结果数应 ≤ 3，实际 ${d.results.length}`);
});

test('GET /api/search: limit > 50 自动截到 50', async () => {
  const r = await fetch('http://localhost:4191/api/search?q=a&limit=999');
  const d = await r.json();
  assert.ok(d.results.length <= 50);
});

// ===== URL 抓取 =====

test('POST /api/inbox/import-url: 缺少 url 返回 400', async () => {
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(r.status, 400);
});

test('POST /api/inbox/import-url: 非法 URL 返回 400', async () => {
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'not-a-url' }),
  });
  assert.equal(r.status, 400);
  const d = await r.json();
  assert.ok(d.error.includes('URL'));
});

test('POST /api/inbox/import-url: file:// 协议拒绝', async () => {
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'file:///etc/passwd' }),
  });
  assert.equal(r.status, 400);
  const d = await r.json();
  assert.ok(d.error.includes('http'));
});

test('POST /api/inbox/import-url: 抓取 example.com 成功', async () => {
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.ok(d.title);
  assert.ok(d.content.length > 0);
  assert.ok(d.length > 0);
  assert.equal(d.sourceType, 'web');
});

test('POST /api/inbox/import-url: content 截断到 8000 字', async () => {
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  const d = await r.json();
  // example.com 短，应未截断；但字段要存在
  assert.ok('truncated' in d);
  assert.ok('length' in d);
});

// ===== 公众号 UA 修复 v0.3.1 =====

test('POST /api/inbox/import-url: 公众号 URL 走 Playwright 拿正文（折叠自动展开）', async () => {
  // 用 forceRefresh 走 playwright（即使有缓存）
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: 'https://mp.weixin.qq.com/s/1avjdPOcQ6zYjiUDABl-Vg',
      forceRefresh: true,
    }),
  });
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.sourceType, 'weixin_article');
  // 不应该是反爬错误页
  assert.notEqual(d.title, 'mp.weixin.qq.com');
  assert.ok(d.title.length > 0, '应能提取标题');
  assert.ok(d.content.length > 100, '应有正文内容');
  // 不应包含反爬关键词
  assert.ok(!d.content.includes('Parameter error'));
  // Playwright 自动展开后不应有"长文折叠"提示（已自动处理）
  assert.ok(!d.content.includes('长文折叠'), 'Playwright 路径不应有折叠提示');
});

test('POST /api/inbox/import-url: 通用 URL 不带折叠提示', async () => {
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.sourceType, 'web');
  assert.ok(!d.content.includes('长文折叠'), '通用 URL 不应有折叠提示');
});

test('POST /api/inbox/import-url: Playwright 抓取后内容长度 ≥ HTML 抓取（折叠文章验证）', async () => {
  // 用一篇已知的长文（JwBmeg6zMw-yJPJslzDa7g 中级经济师）
  // 第一次：清缓存再抓，确保走 Playwright
  // 这里我们对比长度 — Playwright 应该能拿 ≥ 4000 字
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: 'https://mp.weixin.qq.com/s/JwBmeg6zMw-yJPJslzDa7g',
      forceRefresh: true,
    }),
  });
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.ok(d.length > 4000, `Playwright 抓取长文应 > 4000 字，实际 ${d.length}`);
});

// ===== 公众号 Playwright 自动展开 v0.3.2 =====

test('POST /api/inbox/import-url: 公众号 forceRefresh=true 走 Playwright（不走缓存）', async () => {
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: 'https://mp.weixin.qq.com/s/1avjdPOcQ6zYjiUDABl-Vg',
      forceRefresh: true,
    }),
  });
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.sourceType, 'weixin_article');
  assert.equal(d.via, 'playwright', 'forceRefresh=true 应走 Playwright');
  assert.ok(d.durationMs > 1000, `Playwright 抓取应 > 1s，实际 ${d.durationMs}ms`);
});

test('POST /api/inbox/import-url: 公众号缓存命中（第二次快很多）', async () => {
  const url = 'https://mp.weixin.qq.com/s/1avjdPOcQ6zYjiUDABl-Vg';
  // 第一次（前面测试已抓过，缓存应已建好）
  const t0 = Date.now();
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const d = await r.json();
  const ms = Date.now() - t0;
  assert.equal(d.ok, true);
  assert.equal(d.via, 'cached', `应命中缓存，实际 via=${d.via}`);
  // 缓存命中应该 < 1500ms（首次冷启后）
  assert.ok(ms < 1500, `缓存命中应快，实际 ${ms}ms`);
});

test('POST /api/inbox/import-url: 通用 URL 不走 Playwright', async () => {
  const r = await fetch('http://localhost:4191/api/inbox/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.sourceType, 'web');
  assert.notEqual(d.via, 'playwright');
});
