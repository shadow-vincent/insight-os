/**
 * 主题归一化测试（轻量级）
 *
 * node --test tests/topics.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('LLM 主题分类结果容错: 直接是数组', () => {
  const llmResp = [{ topic_id: 'topic_aaa', confidence: 80 }, { topic_id: 'topic_bbb', confidence: 50 }];
  const validTopicIds = new Set(['topic_aaa', 'topic_bbb']);
  const result = llmResp
    .filter(c => c && typeof c === 'object' && validTopicIds.has(c.topic_id))
    .filter(c => typeof c.confidence === 'number' && c.confidence >= 30)
    .slice(0, 3);
  assert.equal(result.length, 2);
  assert.equal(result[0].topic_id, 'topic_aaa');
});

test('LLM 主题分类结果容错: 包装在对象里', () => {
  const llmResp = { classifications: [{ topic_id: 'topic_aaa', confidence: 80 }] };
  let arr = llmResp.classifications ?? llmResp.topics ?? [];
  assert.equal(arr.length, 1);
});

test('LLM 主题分类: 过滤低置信度', () => {
  const llmResp = [
    { topic_id: 'a', confidence: 80 },
    { topic_id: 'b', confidence: 20 }, // 应被过滤
    { topic_id: 'c', confidence: 50 },
  ];
  const result = llmResp.filter(c => c.confidence >= 30);
  assert.equal(result.length, 2);
});

test('LLM 主题分类: 过滤非法 topic_id', () => {
  const llmResp = [
    { topic_id: 'a', confidence: 80 },
    { topic_id: 'non_existent', confidence: 90 }, // 应被过滤
  ];
  const validTopicIds = new Set(['a']);
  const result = llmResp.filter(c => validTopicIds.has(c.topic_id));
  assert.equal(result.length, 1);
});

test('LLM 主题分类: 最多 3 个主题', () => {
  const llmResp = [
    { topic_id: 'a', confidence: 95 },
    { topic_id: 'b', confidence: 85 },
    { topic_id: 'c', confidence: 75 },
    { topic_id: 'd', confidence: 65 },
    { topic_id: 'e', confidence: 55 },
  ];
  const validTopicIds = new Set(['a', 'b', 'c', 'd', 'e']);
  const result = llmResp
    .filter(c => validTopicIds.has(c.topic_id))
    .filter(c => c.confidence >= 30)
    .slice(0, 3);
  assert.equal(result.length, 3);
});

test('avgEvidence 计算', () => {
  const evMap = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };
  const assets = [
    { evidenceLevel: 'E2' },
    { evidenceLevel: 'E1' },
    { evidenceLevel: 'E3' },
  ];
  const sum = assets.reduce((s, a) => s + (evMap[a.evidenceLevel] ?? 0), 0);
  const avg = sum / assets.length;
  assert.equal(avg, 2); // (2+1+3)/3 = 2
});
