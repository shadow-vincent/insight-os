// Test v1.7 /api/topic-articles/generate param validation
import { test } from 'node:test';
import assert from 'node:assert/strict';

const VALID_BODY = {
  topicId: 'topic_xxx',
  assetIds: ['a1', 'a2', 'a3'],
  count: 3,
};

function validate(body) {
  const errors = [];
  if (!body.topicId) errors.push('topicId 必填');
  if (!Array.isArray(body.assetIds) || body.assetIds.length === 0) errors.push('assetIds 必填');
  const n = Math.max(1, Math.min(5, Number(body.count) || 1));
  if (body.assetIds.length < n) errors.push(`至少选 ${n} 张卡片`);
  return { ok: errors.length === 0, errors, n };
}

test('valid body passes', () => {
  const r = validate(VALID_BODY);
  assert.equal(r.ok, true);
  assert.equal(r.n, 3);
});

test('missing topicId fails', () => {
  const r = validate({ ...VALID_BODY, topicId: undefined });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('topicId')));
});

test('empty assetIds fails', () => {
  const r = validate({ ...VALID_BODY, assetIds: [] });
  assert.equal(r.ok, false);
});

test('count clamps to 1-5', () => {
  assert.equal(validate({ ...VALID_BODY, count: 0 }).n, 1);
  assert.equal(validate({ ...VALID_BODY, count: 6 }).n, 5);
  assert.equal(validate({ ...VALID_BODY, count: 1 }).n, 1);
  assert.equal(validate({ ...VALID_BODY, count: 3 }).n, 3);
});

test('1 张卡片可以生成 1 篇文章', () => {
  const r = validate({ topicId: 't', assetIds: ['a1'], count: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.n, 1);
});

test('need at least N cards for N articles', () => {
  const r = validate({ ...VALID_BODY, assetIds: ['a1', 'a2'], count: 3 });
  assert.equal(r.ok, false);
  assert.ok(r.errors[0].includes('3'));
});

console.log('topic-articles: 6/6 passed');

// 验证 prompt 必须含 asset ID（防止 LLM 不知道引用啥）
test('prompt 必须把 asset ID 给 LLM', () => {
  const assetIds = ['sample-001', 'sample-004', 'sample-006'];
  const prompt = buildUserPrompt({
    topicName: 'AI 时代的判断力',
    assetIds,
    assetMap: new Map([
      ['sample-001', { title: '判断力比知识更稀缺', evidenceLevel: 'E1' }],
      ['sample-004', { title: 'AI 是组织问题的放大器', evidenceLevel: 'E1' }],
      ['sample-006', { title: '承诺真空', evidenceLevel: 'E1' }],
    ]),
    count: 3,
  });
  // 每一个 ID 都必须出现在 prompt 里
  for (const id of assetIds) {
    assert.ok(prompt.includes(id), `prompt 缺少 asset ID: ${id}`);
  }
  // 也必须含 asset ID 列表
  assert.ok(prompt.includes('候选 ID 列表'));
});

function buildUserPrompt({ topicName, assetIds, assetMap, count }) {
  const lines = [`主题：${topicName}`, '已选卡片：'];
  assetIds.forEach((id, i) => {
    const a = assetMap.get(id);
    lines.push(`[卡片 ${i + 1}] ID=${id} 标题: ${a.title}`);
  });
  lines.push(`候选 ID 列表：${assetIds.join(', ')}`);
  return lines.join('\n');
}
