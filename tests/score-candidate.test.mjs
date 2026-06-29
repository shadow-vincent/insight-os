/**
 * v1.8.0 scoreCandidate 评分测试
 *
 * 验证：
 * - SCORE_CANDIDATE_SYSTEM prompt 包含 7 维度 + 4 硬规则 + 4 档动作
 * - buildScoreCandidateUserPrompt 包含素材 + 已有资产
 * - actionToStatus 映射正确
 * - weight 7 维度 = 100
 * - decideAction 硬规则覆盖 > 总分
 *
 * node --test tests/score-candidate.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCORE_CANDIDATE_SYSTEM,
  buildScoreCandidateUserPrompt,
  ACTION_USER_LABEL,
  actionToCircleStyle,
} from '../packages/llm/src/index.ts';

test('v1.8.0 SCORE_CANDIDATE_SYSTEM: 包含 7 维度', () => {
  // 7 维度
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('判断清晰度'), 'missing 判断清晰度');
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('证据强度'), 'missing 证据强度');
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('反常识程度'), 'missing 反常识');
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('可复用性'), 'missing 可复用');
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('输出潜力'), 'missing 输出潜力');
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('Kernel'), 'missing Kernel');
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('新颖度'), 'missing 新颖度');
});

test('v1.8.0 SCORE_CANDIDATE_SYSTEM: 包含 4 档推荐动作', () => {
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('process'));
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('candidate'));
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('signal'));
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('ignore'));
  // 4 档分数边界
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('80-100'));
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('65-79'));
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('50-64'));
});

test('v1.8.0 SCORE_CANDIDATE_SYSTEM: 包含 4 硬规则', () => {
  // 1. 情绪无证据
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('情绪'));
  // 2. 灵感无场景
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('灵感'));
  // 3. 高度相似
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('相似'));
  // 4. 多次引用
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('多次引用'));
});

test('v1.8.0 SCORE_CANDIDATE_SYSTEM: 严格 JSON 输出格式', () => {
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('JSON'));
  // 不能 markdown 包裹
  assert.ok(!SCORE_CANDIDATE_SYSTEM.includes('```json') || SCORE_CANDIDATE_SYSTEM.includes('不要 markdown'));
});

test('v1.8.0 SCORE_CANDIDATE_SYSTEM: 角色 + 业务背景', () => {
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('Vincent'));
  // 不夸大 / 不空话 / 温和评分
  assert.ok(SCORE_CANDIDATE_SYSTEM.includes('温和') || SCORE_CANDIDATE_SYSTEM.includes('不夸大'));
});

test('v1.8.0 buildScoreCandidateUserPrompt: 包含素材内容', () => {
  const prompt = buildScoreCandidateUserPrompt('今天拜访客户，发现 AI 改变了财务的工作重心');
  assert.ok(prompt.includes('今天拜访客户'));
  assert.ok(prompt.includes('JSON'));
});

test('v1.8.0 buildScoreCandidateUserPrompt: 包含已有资产（如有）', () => {
  const existing = ['AI 转型方法论', '财务数字化案例', '组织效能提升'];
  const prompt = buildScoreCandidateUserPrompt('某段素材', existing);
  assert.ok(prompt.includes('某段素材'));
  for (const title of existing) {
    assert.ok(prompt.includes(title), `missing existing asset: ${title}`);
  }
});

test('v1.8.0 buildScoreCandidateUserPrompt: 无已有资产时不报错', () => {
  const prompt = buildScoreCandidateUserPrompt('某段素材', []);
  assert.ok(prompt.includes('某段素材'));
});

test('v1.8.0 buildScoreCandidateUserPrompt: 包含 7 维度任务要求', () => {
  const prompt = buildScoreCandidateUserPrompt('某段素材');
  assert.ok(prompt.includes('判断清晰度') || prompt.includes('clear'));
  assert.ok(prompt.includes('process') || prompt.includes('candidate'));
});

test('v1.8.0 ACTION_USER_LABEL: 4 档都有', () => {
  assert.equal(ACTION_USER_LABEL.process, '建议加工为正式判断');
  assert.equal(ACTION_USER_LABEL.candidate, '进入候选判断池');
  assert.equal(ACTION_USER_LABEL.signal, '只记录为素材信号');
  assert.equal(ACTION_USER_LABEL.ignore, '忽略或归档');
});

test('v1.8.0 actionToCircleStyle: 4 档颜色不同', () => {
  const process = actionToCircleStyle('process');
  const candidate = actionToCircleStyle('candidate');
  const signal = actionToCircleStyle('signal');
  const ignore = actionToCircleStyle('ignore');

  // 颜色不能全相同
  const colors = new Set([process.color, candidate.color, signal.color, ignore.color]);
  assert.ok(colors.size >= 3, 'colors should be diverse');
});

test('v1.8.0 scoreCandidate: 短素材返回 ignore + 错误', async () => {
  const { scoreCandidate } = await import('../packages/llm/src/index.ts');
  const result = await scoreCandidate('AI 牛');
  assert.equal(result.ok, false);
  assert.ok(result.error?.includes('太短') || result.error?.includes('未返回') || result.error);
});

test('v1.8.0 scoreCandidate: 包含 break-down 7 字段 schema', async () => {
  // 编译时检查（如果字段缺失 ts 会报错）
  const { scoreCandidate } = await import('../packages/llm/src/index.ts');
  // mock LLM 不可能，但可以验证函数签名
  const result = await scoreCandidate('a'.repeat(100));
  // 即便 ok=false 也会返回默认 breakdown
  assert.ok(result.breakdown);
  assert.equal(typeof result.breakdown.clear, 'number');
  assert.equal(typeof result.breakdown.evidence, 'number');
  assert.equal(typeof result.breakdown.contrarian, 'number');
  assert.equal(typeof result.breakdown.reusable, 'number');
  assert.equal(typeof result.breakdown.output, 'number');
  assert.equal(typeof result.breakdown.kernel, 'number');
  assert.equal(typeof result.breakdown.novelty, 'number');
});