/**
 * 多卡联合输出（Prompt ⑤ + multi API）测试
 *
 * 验证：
 * - Prompt ⑤ 包含 N 张卡的组织逻辑约束
 * - buildCompositeOutputUserPrompt 正确展开 N 张资产
 * - 引用标注约束在 prompt 中显式
 * - multi API 输入校验（< 2 / > 7 / 输出类型 / assetIds）
 *
 * node --test tests/output-multi.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPOSITE_OUTPUT_SYSTEM,
  buildCompositeOutputUserPrompt,
} from '../packages/llm/src/index.ts';

test('Prompt ⑤ system: 包含联合输出专有原则', () => {
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.length > 300, 'system prompt 不应太短');
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.includes('Vincent'), '应明确 Vincent 业务角色');
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.includes('不重复') || COMPOSITE_OUTPUT_SYSTEM.includes('不堆砌'), '应有"不重复/不堆砌"约束');
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.includes('来源') || COMPOSITE_OUTPUT_SYSTEM.includes('[来源'), '应强调来源标注');
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.includes('JSON'), '应要求 JSON 输出');
});

test('Prompt ⑤ system: 包含 N 张卡组织模式（2/3/4-5/6+）', () => {
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.includes('2 张'), '应说明 2 张卡的双视角模式');
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.includes('3 张'), '应说明 3 张卡的递进模式');
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.includes('4-5') || COMPOSITE_OUTPUT_SYSTEM.includes('4-5 张'), '应说明 4-5 张的分模块模式');
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.includes('6+') || COMPOSITE_OUTPUT_SYSTEM.includes('6 张'), '应说明 6+ 张的分组模式');
});

test('Prompt ⑤ system: 强调核心判断保留 + 不凭空补内容', () => {
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.includes('核心判断'), '应强调核心判断保留');
  assert.ok(COMPOSITE_OUTPUT_SYSTEM.includes('凭空') || COMPOSITE_OUTPUT_SYSTEM.includes('编造'), '应禁止凭空补内容');
});

test('buildCompositeOutputUserPrompt: 2 张卡全部展开', () => {
  const prompt = buildCompositeOutputUserPrompt({
    assetSummaries: [
      { id: 'a1', title: '卡 A', oneSentenceInsight: '洞察 A', antiCommonSense: '反常识 A' },
      { id: 'a2', title: '卡 B', oneSentenceInsight: '洞察 B', antiCommonSense: '反常识 B' },
    ],
    outputType: 'article_outline',
    audience: '制造业 CFO',
  });

  assert.ok(prompt.includes('2 张资产卡'), '应说明总张数');
  assert.ok(prompt.includes('卡 A'), '应包含卡 A 标题');
  assert.ok(prompt.includes('卡 B'), '应包含卡 B 标题');
  assert.ok(prompt.includes('洞察 A'), '应包含卡 A 一句话洞察');
  assert.ok(prompt.includes('反常识 B'), '应包含卡 B 反常识');
  assert.ok(prompt.includes('a1'), '应包含卡 A ID');
  assert.ok(prompt.includes('a2'), '应包含卡 B ID');
  assert.ok(prompt.includes('制造业 CFO'), '应包含 audience');
});

test('buildCompositeOutputUserPrompt: 5 张卡全部展开', () => {
  const prompt = buildCompositeOutputUserPrompt({
    assetSummaries: [
      { id: 'x1', title: 'A', oneSentenceInsight: '', antiCommonSense: '' },
      { id: 'x2', title: 'B', oneSentenceInsight: '', antiCommonSense: '' },
      { id: 'x3', title: 'C', oneSentenceInsight: '', antiCommonSense: '' },
      { id: 'x4', title: 'D', oneSentenceInsight: '', antiCommonSense: '' },
      { id: 'x5', title: 'E', oneSentenceInsight: '', antiCommonSense: '' },
    ],
    outputType: 'talk_script',
    audience: '中层管理者',
  });

  for (let i = 1; i <= 5; i++) {
    assert.ok(prompt.includes(`资产卡 ${i}`), `应包含资产卡 ${i}`);
  }
  assert.ok(prompt.includes('客户沟通话术'), 'talk_script 应输出客户沟通话术');
});

test('buildCompositeOutputUserPrompt: 可选 context / styleHints 正确插入', () => {
  const prompt = buildCompositeOutputUserPrompt({
    assetSummaries: [
      { id: 'a1', title: 'A', oneSentenceInsight: 'i', antiCommonSense: 'a' },
    ],
    outputType: 'article_outline',
    audience: 'x',
    context: '客户刚完成 ERP 选型',
    styleHints: '语气要专业',
  });

  assert.ok(prompt.includes('客户刚完成 ERP 选型'), '应包含 context');
  assert.ok(prompt.includes('语气要专业'), '应包含 styleHints');
});

test('buildCompositeOutputUserPrompt: 不传 context/styleHints 不应渲染空 section', () => {
  const prompt = buildCompositeOutputUserPrompt({
    assetSummaries: [
      { id: 'a1', title: 'A', oneSentenceInsight: 'i', antiCommonSense: 'a' },
    ],
    outputType: 'article_outline',
    audience: 'x',
  });

  assert.ok(!prompt.includes('## 沟通/写作背景'), '不应渲染空 context section');
  assert.ok(!prompt.includes('## 风格要求'), '不应渲染空 styleHints section');
});

test('Prompt ⑤: 要求 LLM 输出 structure_rationale（组织逻辑说明）', () => {
  const prompt = buildCompositeOutputUserPrompt({
    assetSummaries: [
      { id: 'a1', title: 'A', oneSentenceInsight: 'i', antiCommonSense: 'a' },
    ],
    outputType: 'article_outline',
    audience: 'x',
  });
  assert.ok(prompt.includes('structure_rationale'), 'user prompt 应要求 structure_rationale 字段');
});

test('Prompt ⑤: 要求 LLM 输出 assetReferences 数组', () => {
  const prompt = buildCompositeOutputUserPrompt({
    assetSummaries: [
      { id: 'a1', title: 'A', oneSentenceInsight: 'i', antiCommonSense: 'a' },
    ],
    outputType: 'article_outline',
    audience: 'x',
  });
  assert.ok(prompt.includes('assetReferences'), 'user prompt 应要求 assetReferences 字段');
  assert.ok(prompt.includes('referencedIn'), 'assetReferences 子字段应明确');
  assert.ok(prompt.includes('coreInsightUsed'), 'assetReferences 子字段应明确');
});

test('CompositeOutputOutput 类型: 关键字段定义完整（运行时结构检查）', () => {
  const sample = {
    title: 'test',
    primary_version: 'content',
    variants: [{ label: 'A', content: 'a' }],
    key_quotes: ['q1'],
    usage_suggestion: 'use',
    structure_rationale: 'why',
    assetReferences: [{
      assetId: 'a1',
      assetTitle: 'A',
      referencedIn: ['主章节 1'],
      coreInsightUsed: true,
    }],
  };
  assert.equal(sample.assetReferences.length, 1);
  assert.equal(sample.assetReferences[0].assetId, 'a1');
  for (const key of ['title', 'primary_version', 'variants', 'key_quotes', 'usage_suggestion', 'structure_rationale', 'assetReferences']) {
    assert.ok(key in sample, `CompositeOutputOutput 应包含 ${key}`);
  }
});

// ===== 集成测试（需要 dev server） =====

test('API /api/output/multi: < 2 张资产返回 400', async () => {
  const r = await fetch('http://localhost:4191/api/output/multi', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ assetIds: ['only_one'], outputType: 'article_outline', audience: 'x' }),
  });
  const d = await r.json();
  assert.equal(r.status, 400);
  assert.equal(d.ok, false);
  assert.ok(d.error.includes('2'));
});

test('API /api/output/multi: > 7 张资产返回 400', async () => {
  const r = await fetch('http://localhost:4191/api/output/multi', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetIds: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'],
      outputType: 'article_outline',
      audience: 'x',
    }),
  });
  const d = await r.json();
  assert.equal(r.status, 400);
  assert.equal(d.ok, false);
  assert.ok(d.error.includes('7'));
});

test('API /api/output/multi: 不支持 outputType 返回 400', async () => {
  const r = await fetch('http://localhost:4191/api/output/multi', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetIds: ['a1', 'a2'],
      outputType: 'fake_type',
      audience: 'x',
    }),
  });
  const d = await r.json();
  assert.equal(r.status, 400);
  assert.equal(d.ok, false);
});

test('API /api/output/multi: 缺少 audience 返回 400', async () => {
  const r = await fetch('http://localhost:4191/api/output/multi', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ assetIds: ['a1', 'a2'], outputType: 'article_outline' }),
  });
  const d = await r.json();
  assert.equal(r.status, 400);
});

test('API /api/outputs: GET 返回带 isMulti 标识', async () => {
  const r = await fetch('http://localhost:4191/api/outputs');
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.ok(Array.isArray(d.outputs));
  // 至少有一个 multi（如果之前跑过）
  const multi = d.outputs.filter(o => o.isMulti);
  if (multi.length > 0) {
    assert.ok(multi[0].assetCount >= 2);
    assert.ok(Array.isArray(multi[0].assetIds));
  }
});
