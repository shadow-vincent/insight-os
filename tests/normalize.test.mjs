/**
 * 适配器单元测试（不依赖数据库，纯函数）
 * node --test tests/normalize.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeType, normalizeTags, normalizeEvidenceLevel, inferSourceType } from '../packages/core/src/normalize.ts';

test('normalizeType: 历史 5 种 type 全部映射到 asset', () => {
  assert.equal(normalizeType('management_insight'), 'asset');
  assert.equal(normalizeType('管理洞察资产卡'), 'asset');
  assert.equal(normalizeType('insight-card'), 'asset');
  assert.equal(normalizeType('management_insight_asset'), 'asset');
  assert.equal(normalizeType('insight'), 'asset');
});

test('normalizeType: 缺失和未知 type 默认 asset', () => {
  assert.equal(normalizeType(undefined), 'asset');
  assert.equal(normalizeType(null), 'asset');
  assert.equal(normalizeType(''), 'asset');
  assert.equal(normalizeType('未知类型'), 'asset');
});

test('normalizeType: light 和 kernel 类型也支持', () => {
  assert.equal(normalizeType('light'), 'light');
  assert.equal(normalizeType('light_card'), 'light');
  assert.equal(normalizeType('kernel'), 'kernel');
  assert.equal(normalizeType('core_belief'), 'kernel');
});

test('normalizeTags: 数组直接通过', () => {
  assert.deepEqual(normalizeTags(['AI', '判断力', '决策']), ['AI', '判断力', '决策']);
  assert.deepEqual(normalizeTags([]), []);
});

test('normalizeTags: 字符串按中英文逗号/空格/顿号分割', () => {
  assert.deepEqual(normalizeTags('AI, 判断力, 决策'), ['AI', '判断力', '决策']);
  assert.deepEqual(normalizeTags('AI，判断力，决策'), ['AI', '判断力', '决策']);
  assert.deepEqual(normalizeTags('AI、判断力、决策'), ['AI', '判断力', '决策']);
  assert.deepEqual(normalizeTags('AI 判断力 决策'), ['AI', '判断力', '决策']);
});

test('normalizeTags: 字符串首尾空白被去掉', () => {
  assert.deepEqual(normalizeTags('  AI  ,  判断力  '), ['AI', '判断力']);
});

test('normalizeTags: 空值和未知类型返回空数组', () => {
  assert.deepEqual(normalizeTags(null), []);
  assert.deepEqual(normalizeTags(undefined), []);
  assert.deepEqual(normalizeTags(123), []);
});

test('normalizeEvidenceLevel: 标准 E0-E5 通过', () => {
  for (const l of ['E0', 'E1', 'E2', 'E3', 'E4', 'E5']) {
    assert.equal(normalizeEvidenceLevel(l), l);
  }
});

test('normalizeEvidenceLevel: 大小写不敏感 + 空白容错', () => {
  assert.equal(normalizeEvidenceLevel('e1'), 'E1');
  assert.equal(normalizeEvidenceLevel(' E2 '), 'E2');
});

test('normalizeEvidenceLevel: 缺失/非法回退 E0', () => {
  assert.equal(normalizeEvidenceLevel(undefined), 'E0');
  assert.equal(normalizeEvidenceLevel('E9'), 'E0');
  assert.equal(normalizeEvidenceLevel(''), 'E0');
});

test('inferSourceType: insight-pipeline 来源识别为 knowledge_card', () => {
  assert.equal(inferSourceType('知识卡片 → insight-pipeline加工'), 'knowledge_card');
  assert.equal(inferSourceType('张琨公众号 → insight-pipeline加工'), 'knowledge_card');
});

test('inferSourceType: pdf/方案/报告识别为 project', () => {
  assert.equal(inferSourceType('新华书店凭证方案.pdf'), 'project');
  assert.equal(inferSourceType('湘钢智能制造诊断报告'), 'project');
});

test('inferSourceType: 原创', () => {
  assert.equal(inferSourceType('原创（2026-04-06）'), 'original');
});

test('inferSourceType: 默认书名', () => {
  assert.equal(inferSourceType('《卓有成效的管理者》彼得·德鲁克'), 'book');
  assert.equal(inferSourceType('德鲁克每日写作'), 'book');
});
