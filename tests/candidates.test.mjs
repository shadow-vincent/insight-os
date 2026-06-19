/**
 * 候选池 API 测试
 *
 * node --test tests/candidates.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('GET /api/candidates: 返回 ok + 数组', async () => {
  const r = await fetch('http://localhost:4191/api/candidates');
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.ok(Array.isArray(d.candidates));
  assert.equal(typeof d.count, 'number');
  assert.equal(d.count, d.candidates.length);
});

test('GET /api/candidates: 字段定义完整', async () => {
  const r = await fetch('http://localhost:4191/api/candidates');
  const d = await r.json();
  if (d.candidates.length > 0) {
    const c = d.candidates[0];
    for (const key of ['id', 'title', 'status', 'type', 'evidenceLevel', 'createdAt']) {
      assert.ok(key in c, `应包含 ${key}`);
    }
  }
});

test('GET /api/candidates: status filter candidate 只返回待确认', async () => {
  const r = await fetch('http://localhost:4191/api/candidates?status=candidate');
  const d = await r.json();
  for (const c of d.candidates) {
    assert.equal(c.status, 'candidate');
  }
});

test('GET /api/candidates: status filter in_use 只返回已入库', async () => {
  const r = await fetch('http://localhost:4191/api/candidates?status=in_use');
  const d = await r.json();
  for (const c of d.candidates) {
    assert.equal(c.status, 'in_use');
  }
});

test('GET /api/candidates: 默认只返回 candidate（已入库的应该在资产库看）', async () => {
  const r = await fetch('http://localhost:4191/api/candidates');
  const d = await r.json();
  for (const c of d.candidates) {
    assert.equal(c.status, 'candidate', `默认应只含 candidate，实际 ${c.status}`);
  }
});

test('POST /api/candidates/[id]/promote: 不存在 ID 返回 404', async () => {
  const r = await fetch('http://localhost:4191/api/candidates/asset_不存在/promote', { method: 'POST' });
  const d = await r.json();
  assert.equal(r.status, 404);
  assert.equal(d.ok, false);
});

test('POST /api/candidates/[id]/promote: 重复 promote 已 in_use 资产返回 ok', async () => {
  // 用一个已知 in_use 资产测
  const listR = await fetch('http://localhost:4191/api/candidates?status=in_use');
  const listD = await listR.json();
  if (listD.candidates.length === 0) return;
  const id = listD.candidates[0].id;
  const r = await fetch(`http://localhost:4191/api/candidates/${id}/promote`, { method: 'POST' });
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.alreadyInUse, true);
});

test('POST /api/candidates/[id]/promote: 提升 candidate → in_use', async () => {
  // 找一个 candidate
  const listR = await fetch('http://localhost:4191/api/candidates?status=candidate');
  const listD = await listR.json();
  if (listD.candidates.length === 0) {
    console.log('  skip: no candidate to promote');
    return;
  }
  const id = listD.candidates[0].id;
  let newAssetId = null;
  try {
    const r = await fetch(`http://localhost:4191/api/candidates/${id}/promote`, { method: 'POST' });
    const d = await r.json();
    assert.equal(d.ok, true);
    newAssetId = d.assetId;
    assert.ok(newAssetId, '应返回新 asset id');
    // 验证：再次 list candidates，in_use filter 包含新 id
    const verifyR = await fetch(`http://localhost:4191/api/candidates?status=in_use`);
    const verifyD = await verifyR.json();
    const found = verifyD.candidates.find(c => c.id === newAssetId);
    assert.ok(found, 'promote 后新 asset 应该在 in_use 列表中');
    assert.equal(found.status, 'in_use');
  } finally {
    // 测试结束恢复状态（避免污染用户数据）
    const Database = (await import('/Users/vincent/Documents/insight-os/node_modules/better-sqlite3/lib/index.js')).default;
    const db = new Database('/Users/vincent/Documents/insight-os/apps/web/storage/insight.db');
    if (newAssetId) db.prepare("DELETE FROM assets WHERE id=?").run(newAssetId);
    db.prepare("UPDATE assets SET type='light', status='candidate' WHERE id=?").run(id);
    db.close();
  }
});

// ===== 资产库 vs 候选池分离 v0.3.4 =====

test('GET /api/assets: 默认只返 type=asset（候选池 light 卡不混入）', async () => {
  const r = await fetch('http://localhost:4191/api/assets');
  const d = await r.json();
  assert.equal(d.ok, true);
  for (const item of d.items) {
    assert.notEqual(item.type, 'light', `资产库不应含 light 卡，实际 ${item.id} type=${item.type}`);
  }
});

test('GET /api/assets?all=1: 包含 light 卡', async () => {
  // 临时插入一张 light 卡
  const Database = (await import('/Users/vincent/Documents/insight-os/node_modules/better-sqlite3/lib/index.js')).default;
  const db = new Database('/Users/vincent/Documents/insight-os/apps/web/storage/insight.db');
  const now = Math.floor(Date.now() / 1000);
  const tmpId = 'lc_tmp_test_' + Math.random().toString(36).slice(2, 6);
  db.prepare(`INSERT INTO assets(id, type, status, title, evidence_level, priority, tags_json, source, source_type, file_path, file_mtime, file_hash, feedback_count, created_at, updated_at) VALUES (?, 'light', 'candidate', 'test', 'E0', 'A', '[]', 'test', 'knowledge_card', '/tmp/x.md', ?, 'h', 0, ?, ?)`).run(
    tmpId, now, now, now
  );
  db.close();

  try {
    const r = await fetch('http://localhost:4191/api/assets?all=1');
    const d = await r.json();
    assert.equal(d.ok, true);
    const lightItems = d.items.filter(i => i.type === 'light');
    assert.ok(lightItems.length > 0, `?all=1 应包含 light 卡，实际 ${lightItems.length}`);
  } finally {
    const db2 = new Database('/Users/vincent/Documents/insight-os/apps/web/storage/insight.db');
    db2.prepare("DELETE FROM assets WHERE id=?").run(tmpId);
    db2.close();
  }
});

test('GET /api/assets?type=light: 只返 light 卡', async () => {
  const r = await fetch('http://localhost:4191/api/assets?type=light');
  const d = await r.json();
  for (const item of d.items) {
    assert.equal(item.type, 'light');
  }
});
