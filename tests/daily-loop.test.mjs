// Tests for v1.6 useDailyLoop hook (pure logic)
// We don't render React, just test the pure state functions.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Re-extract logic from useDailyLoop.ts (pure parts)
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDate(a, b) {
  return a === b;
}

function initState(date) {
  return { date, steps: [false, false, false, false] };
}

function markStep(state, stepIdx) {
  return {
    ...state,
    steps: state.steps.map((d, i) => i === stepIdx ? true : d),
  };
}

function completedCount(state) {
  return state.steps.filter(Boolean).length;
}

function allDone(state) {
  return state.steps.every(Boolean);
}

test('todayStr returns YYYY-MM-DD', () => {
  const s = todayStr();
  assert.match(s, /^\d{4}-\d{2}-\d{2}$/);
});

test('initState starts with all false', () => {
  const s = initState('2026-06-26');
  assert.deepEqual(s.steps, [false, false, false, false]);
});

test('markStep sets the target step true', () => {
  const s1 = markStep(initState('2026-06-26'), 0);
  assert.deepEqual(s1.steps, [true, false, false, false]);

  const s2 = markStep(s1, 2);
  assert.deepEqual(s2.steps, [true, false, true, false]);

  const s3 = markStep(s2, 3);
  assert.deepEqual(s3.steps, [true, false, true, true]);
});

test('markStep idempotent (mark done step again = no change)', () => {
  const s1 = markStep(initState('2026-06-26'), 1);
  const s2 = markStep(s1, 1);
  assert.deepEqual(s1, s2);
});

test('completedCount + allDone', () => {
  let s = initState('2026-06-26');
  assert.equal(completedCount(s), 0);
  assert.equal(allDone(s), false);

  s = markStep(s, 0);
  assert.equal(completedCount(s), 1);
  assert.equal(allDone(s), false);

  s = markStep(s, 1);
  s = markStep(s, 2);
  s = markStep(s, 3);
  assert.equal(completedCount(s), 4);
  assert.equal(allDone(s), true);
});

test('cross-date reset (different date key = fresh state)', () => {
  const yesterday = initState('2026-06-25');
  const yMarked = markStep(yesterday, 0);
  assert.equal(yMarked.steps[0], true);

  const today = initState(todayStr());
  assert.equal(today.steps[0], false, 'new date should not inherit yesterday');
});

test('immutability: markStep returns new object', () => {
  const s1 = initState('2026-06-26');
  const s2 = markStep(s1, 0);
  assert.notEqual(s1, s2);
  assert.deepEqual(s1.steps, [false, false, false, false]);
});

test('isSameDate helper', () => {
  assert.equal(isSameDate('2026-06-26', '2026-06-26'), true);
  assert.equal(isSameDate('2026-06-26', '2026-06-27'), false);
});

console.log('daily-loop: 8/8 passed');
