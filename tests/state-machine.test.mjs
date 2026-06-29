/**
 * v1.8.0 状态机流转单测
 *
 * 验证 9 态状态机的合法转换：
 * - candidate → in_use (process)
 * - candidate → sorting (signal)
 * - candidate → inbox (ignore)
 * - candidate → archived (merge)
 *
 * 拒绝非法转换（防状态机漏洞）
 *
 * node --test tests/state-machine.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Re-define 状态机规则（与 route.ts 同步）
// 合法转换表
const VALID_TRANSITIONS = {
  // process: candidate → in_use（升级为正式资产）
  process: { from: 'candidate', to: 'in_use' },
  // signal: candidate → sorting（降级为素材信号）
  signal: { from: 'candidate', to: 'sorting' },
  // ignore: candidate → inbox（降级为原始素材）
  ignore: { from: 'candidate', to: 'inbox' },
  // merge: candidate → archived（合并后归档）
  merge: { from: 'candidate', to: 'archived' },
};

function validateTransition(from, action) {
  const rule = VALID_TRANSITIONS[action];
  if (!rule) {
    return { ok: false, reason: `未知动作: ${action}` };
  }
  if (from !== rule.from) {
    return {
      ok: false,
      reason: `候选卡当前状态为 "${from}"，不能执行 ${action}（只有 ${rule.from} 状态可执行）`,
    };
  }
  return { ok: true, to: rule.to };
}

test('状态机: process 合法 (candidate → in_use)', () => {
  const r = validateTransition('candidate', 'process');
  assert.equal(r.ok, true);
  assert.equal(r.to, 'in_use');
});

test('状态机: signal 合法 (candidate → sorting)', () => {
  const r = validateTransition('candidate', 'signal');
  assert.equal(r.ok, true);
  assert.equal(r.to, 'sorting');
});

test('状态机: ignore 合法 (candidate → inbox)', () => {
  const r = validateTransition('candidate', 'ignore');
  assert.equal(r.ok, true);
  assert.equal(r.to, 'inbox');
});

test('状态机: merge 合法 (candidate → archived)', () => {
  const r = validateTransition('candidate', 'merge');
  assert.equal(r.ok, true);
  assert.equal(r.to, 'archived');
});

test('状态机: 拒绝 in_use 状态执行 process', () => {
  const r = validateTransition('in_use', 'process');
  assert.equal(r.ok, false);
  assert.ok(r.reason?.includes('in_use'));
});

test('状态机: 拒绝 sorting 状态执行 signal', () => {
  const r = validateTransition('sorting', 'signal');
  assert.equal(r.ok, false);
});

test('状态机: 拒绝 archived 状态执行任何动作', () => {
  for (const action of ['process', 'signal', 'ignore', 'merge']) {
    const r = validateTransition('archived', action);
    assert.equal(r.ok, false, `${action} should be rejected from archived`);
  }
});

test('状态机: 拒绝 in_use 状态执行 ignore（已加工资产不能被忽略）', () => {
  const r = validateTransition('in_use', 'ignore');
  assert.equal(r.ok, false);
});

test('状态机: 拒绝未知动作', () => {
  const r = validateTransition('candidate', 'unknown_action');
  assert.equal(r.ok, false);
  assert.ok(r.reason?.includes('未知动作'));
});

test('状态机: 4 个动作总共覆盖 4 种去向', () => {
  const tos = new Set();
  for (const action of ['process', 'signal', 'ignore', 'merge']) {
    const r = validateTransition('candidate', action);
    if (r.ok) tos.add(r.to);
  }
  // 4 个动作应该去 4 个不同状态
  assert.equal(tos.size, 4, `4 actions should map to 4 different states, got: ${Array.from(tos).join(', ')}`);
  assert.ok(tos.has('in_use'));
  assert.ok(tos.has('sorting'));
  assert.ok(tos.has('inbox'));
  assert.ok(tos.has('archived'));
});

test('状态机: inbox 状态不能直接 process（必须先通过 scoreCandidate）', () => {
  const r = validateTransition('inbox', 'process');
  assert.equal(r.ok, false);
  // inbox 状态的卡片还没经过 AI 评分
  assert.ok(r.reason?.includes('inbox'));
});

/**
 * 评分 → 状态映射（用于 /api/materials/paste）
 *
 * 4 档推荐动作映射到 assets.status
 */
const ACTION_TO_STATUS = {
  process: 'candidate',      // 80+ → candidate（待你确认）
  candidate: 'candidate',    // 65-79 → candidate
  signal: 'sorting',         // 50-64 → sorting（仅素材信号）
  ignore: 'inbox',           // 0-49 → inbox（仅收集，不进候选）
};

function actionToStatus(action) {
  return ACTION_TO_STATUS[action] ?? 'inbox';
}

test('actionToStatus: 4 档映射正确', () => {
  assert.equal(actionToStatus('process'), 'candidate');
  assert.equal(actionToStatus('candidate'), 'candidate');
  assert.equal(actionToStatus('signal'), 'sorting');
  assert.equal(actionToStatus('ignore'), 'inbox');
});

test('actionToStatus: 未知动作 fallback 到 inbox', () => {
  assert.equal(actionToStatus('unknown'), 'inbox');
  assert.equal(actionToStatus(null), 'inbox');
  assert.equal(actionToStatus(undefined), 'inbox');
});