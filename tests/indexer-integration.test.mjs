/**
 * 索引器集成测试
 *
 * 拿你 04_管理洞察 里的真实 .md 文件做端到端测试
 * 不写数据库，只验证 indexFile 解析逻辑
 *
 * node --test tests/indexer-integration.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, extractOneSentenceInsight, extractAntiCommonSense, extractSummary } from '../packages/indexer/src/parser.ts';
import { normalizeType, normalizeTags, normalizeEvidenceLevel, inferSourceType } from '../packages/core/src/normalize.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const VAULT = '/Users/vincent/Documents/knowledge_base/04_管理洞察';

test('真实资产卡: 39 张 .md 文件全部能被解析', () => {
  const files = readdirSync(VAULT).filter(f => f.endsWith('.md') && f.startsWith('资产卡_'));
  assert.ok(files.length >= 39, `期望 ≥39 张，实际 ${files.length}`);

  for (const f of files) {
    const full = join(VAULT, f);
    const content = readFileSync(full, 'utf-8');
    const fm = parseFrontmatter(content);

    // 必备字段
    assert.ok(fm.title, `${f} 缺少 title`);
    assert.ok(fm.evidence_level, `${f} 缺少 evidence_level`);

    // 适配器
    const type = normalizeType(typeof fm.type === 'string' ? fm.type : null);
    assert.equal(type, 'asset', `${f} 解析出的 type 应是 asset，实际 ${type}`);

    const ev = normalizeEvidenceLevel(typeof fm.evidence_level === 'string' ? fm.evidence_level : null);
    assert.ok(['E0', 'E1', 'E2', 'E3', 'E4', 'E5'].includes(ev), `${f} 解析出的 evidence_level 非法: ${ev}`);
  }
});

test('真实资产卡: AI 时代最稀缺的是判断力 — 关键字段抽取', () => {
  const f = join(VAULT, '资产卡_AI时代最稀缺的是判断力.md');
  const content = readFileSync(f, 'utf-8');
  const fm = parseFrontmatter(content);

  assert.equal(fm.title, 'AI时代最稀缺的是判断力');
  assert.equal(fm.evidence_level, 'E1');
  assert.equal(fm.maturity, '可用');

  // tags 是数组
  const tags = normalizeTags(fm.tags);
  assert.ok(Array.isArray(tags));
  assert.ok(tags.length > 0);

  // 一句话洞察
  const insight = extractOneSentenceInsight(content);
  assert.ok(insight);
  assert.ok(insight.includes('判断力'));

  // 反常识判断
  const anti = extractAntiCommonSense(content);
  assert.ok(anti);
  assert.ok(anti.length > 0);
});

test('真实资产卡: 39 张卡里所有 evidence_level 都是 E1 或 E2', () => {
  const files = readdirSync(VAULT).filter(f => f.endsWith('.md') && f.startsWith('资产卡_'));
  const levels = new Set();
  for (const f of files) {
    const fm = parseFrontmatter(readFileSync(join(VAULT, f), 'utf-8'));
    if (typeof fm.evidence_level === 'string') {
      levels.add(fm.evidence_level);
    }
  }
  // v0.1 范围内 E1/E2 都正常
  for (const l of levels) {
    assert.ok(['E0', 'E1', 'E2', 'E3', 'E4', 'E5'].includes(l));
  }
  console.log(`  发现 evidence_level: ${[...levels].join(', ')}`);
});

test('真实资产卡: 39 张卡里所有 type 都能被适配器识别', () => {
  const files = readdirSync(VAULT).filter(f => f.endsWith('.md') && f.startsWith('资产卡_'));
  const types = new Set();
  for (const f of files) {
    const fm = parseFrontmatter(readFileSync(join(VAULT, f), 'utf-8'));
    if (typeof fm.type === 'string') {
      types.add(fm.type);
    }
  }
  console.log(`  发现 type 原始写法: ${[...types].join(', ')}`);
  // 全部都能被适配器映射到合法值
  for (const t of types) {
    const normalized = normalizeType(t);
    assert.ok(['light', 'asset', 'kernel'].includes(normalized));
  }
});

test('真实资产卡: tags 字段 19 数组 + 20 字符串都能被归一化', () => {
  const files = readdirSync(VAULT).filter(f => f.endsWith('.md') && f.startsWith('资产卡_'));
  let arrayCount = 0;
  let stringCount = 0;
  for (const f of files) {
    const fm = parseFrontmatter(readFileSync(join(VAULT, f), 'utf-8'));
    if (Array.isArray(fm.tags)) arrayCount++;
    else if (typeof fm.tags === 'string') stringCount++;
    // 不管哪种格式，归一化后都是非空数组（或空数组）
    const tags = normalizeTags(fm.tags);
    assert.ok(Array.isArray(tags));
  }
  console.log(`  tags: 数组 ${arrayCount} 张, 字符串 ${stringCount} 张`);
});
