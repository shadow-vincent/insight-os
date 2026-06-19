/**
 * frontmatter 解析器测试
 *
 * node --test tests/parser.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, extractOneSentenceInsight, extractAntiCommonSense, extractSummary } from '../packages/indexer/src/parser.ts';

test('parseFrontmatter: 标准键值对', () => {
  const md = `---
title: 测试标题
type: insight
evidence_level: E1
---

正文`;
  const fm = parseFrontmatter(md);
  assert.equal(fm.title, '测试标题');
  assert.equal(fm.type, 'insight');
  assert.equal(fm.evidence_level, 'E1');
});

test('parseFrontmatter: 内联数组', () => {
  const md = `---
title: 测试
tags: [AI, 判断力, 决策]
---

正文`;
  const fm = parseFrontmatter(md);
  assert.deepEqual(fm.tags, ['AI', '判断力', '决策']);
});

test('parseFrontmatter: 多行数组', () => {
  const md = `---
title: 测试
related:
  - 卡片_A_2026-05-10
  - 卡片_B_2026-03-29
---

正文`;
  const fm = parseFrontmatter(md);
  assert.deepEqual(fm.related, ['卡片_A_2026-05-10', '卡片_B_2026-03-29']);
});

test('parseFrontmatter: 没有 frontmatter 返回空对象', () => {
  const md = `直接正文`;
  assert.deepEqual(parseFrontmatter(md), {});
});

test('parseFrontmatter: 引号自动去除', () => {
  const md = `---
title: "带引号的标题"
summary: '单引号'
---

x`;
  const fm = parseFrontmatter(md);
  assert.equal(fm.title, '带引号的标题');
  assert.equal(fm.summary, '单引号');
});

test('extractOneSentenceInsight: 表格形式', () => {
  const md = `
| **一句话洞察** | AI 时代最稀缺的是判断力 |
| 其他 | x |
`;
  assert.equal(extractOneSentenceInsight(md), 'AI 时代最稀缺的是判断力');
});

test('extractOneSentenceInsight: 标题形式', () => {
  const md = `
## 一句话洞察
所有人都在学怎么用 AI，但没人教你什么不该让 AI 做
`;
  assert.equal(extractOneSentenceInsight(md), '所有人都在学怎么用 AI，但没人教你什么不该让 AI 做');
});

test('extractOneSentenceInsight: 找不到返回 undefined', () => {
  assert.equal(extractOneSentenceInsight('随便一段文本'), undefined);
});

test('extractAntiCommonSense: 表格形式', () => {
  const md = `
| **反常识判断** | 所有人都在学 PE，但真正该学的是判断力工程 |
`;
  assert.equal(extractAntiCommonSense(md), '所有人都在学 PE，但真正该学的是判断力工程');
});

test('extractSummary: 优先用 frontmatter.summary', () => {
  const md = `---
summary: frontmatter 摘要
---
# 标题
正文第一段`;
  assert.equal(extractSummary(parseFrontmatter(md), md), 'frontmatter 摘要');
});

test('extractSummary: 缺 summary 时取第一段正文', () => {
  const md = `---
title: x
---
# 标题
这是第一段正文内容`;
  assert.equal(extractSummary(parseFrontmatter(md), md), '这是第一段正文内容');
});
