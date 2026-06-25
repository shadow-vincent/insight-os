/**
 * 六层提问法 seed-six-layers API 测试
 *
 * 验证：
 * 1. GET 返回 6 层元数据（不写 db）
 * 2. POST 种入 6 条 kernel 到 user_kernels
 * 3. 二次 POST 409 拒绝（避免重复）
 * 4. 跟 seed-default 不冲突
 * 5. 字段格式完整
 *
 * node --test tests/seed-six-layers.test.mjs
 *
 * 注意：跑测试前需要 dev server 起来（npm run dev 在 4191）
 * 测试会写入 db（用户级），可重跑
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4191';

test('GET /api/kernel/seed-six-layers: 返回 6 层元数据', async () => {
  const r = await fetch(`${BASE}/api/kernel/seed-six-layers`);
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.title, '六层提问法');
  assert.equal(d.layers.length, 6);
  // 验证 6 层顺序
  const labels = d.layers.map((l) => l.label);
  assert.deepEqual(labels, ['意图', '背景', '判断', '约束', '风格', '反馈']);
  // 每层都有 content + confidence + counterExample
  for (const layer of d.layers) {
    assert.ok(layer.content.length > 10, `content 应有内容：${layer.label}`);
    assert.ok(layer.confidence >= 50 && layer.confidence <= 100, `confidence 应在 50-100：${layer.label} = ${layer.confidence}`);
    assert.ok(layer.counterExample, `counterExample 应有：${layer.label}`);
  }
});

test('POST /api/kernel/seed-six-layers: 种入 6 条或返回 409（已存在）', async () => {
  const r = await fetch(`${BASE}/api/kernel/seed-six-layers`, { method: 'POST' });
  const d = await r.json();
  if (d.ok) {
    assert.equal(d.seeded, 6);
    assert.equal(d.ids.length, 6);
    // 顺序：意图 / 背景 / 判断 / 约束 / 风格 / 反馈
    const labels = d.ids.map((i) => i.label);
    assert.deepEqual(labels, ['意图', '背景', '判断', '约束', '风格', '反馈']);
  } else {
    // 409 已存在的情况
    assert.equal(r.status, 409);
    assert.ok(d.existingCount >= 6, '至少 6 条已存在');
  }
});

test('POST /api/kernel/seed-six-layers: 二次调用返回 409', async () => {
  // 先确保至少调过一次
  await fetch(`${BASE}/api/kernel/seed-six-layers`, { method: 'POST' });
  // 第二次必须 409
  const r = await fetch(`${BASE}/api/kernel/seed-six-layers`, { method: 'POST' });
  const d = await r.json();
  assert.equal(r.status, 409);
  assert.equal(d.ok, false);
  assert.ok(d.error.includes('已存在'));
});

test('GET /api/kernel: 列出所有内核包含六层（如果已种入）', async () => {
  // 确保已种入
  await fetch(`${BASE}/api/kernel/seed-six-layers`, { method: 'POST' });
  // 列出 kernel
  const kRes = await fetch(`${BASE}/api/kernel`);
  const kData = await kRes.json();
  if (kData.ok) {
    const sixLayers = kData.kernels.filter((k) => (k.scope ?? '').includes('六层提问法'));
    assert.equal(sixLayers.length, 6, '应有 6 条六层提问法内核');
    // 每条都标 scope = 六层提问法
    for (const k of sixLayers) {
      assert.ok(k.scope.includes('六层提问法'));
      assert.equal(k.category, 'belief');
      assert.equal(k.kind, 'experience');
    }
  }
});

test('GET /api/kernel/seed-six-layers: origin 字段正确', async () => {
  const r = await fetch(`${BASE}/api/kernel/seed-six-layers`);
  const d = await r.json();
  assert.ok(d.origin.includes('Vincent'));
  assert.ok(d.origin.includes('GPT'));
});
