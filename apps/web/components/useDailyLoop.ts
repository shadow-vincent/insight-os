'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * v1.6: Daily Loop（最小日常动作）
 *
 * 设计：
 * - 每天 4 步：扔进 / 校准 / 输出 / 记录
 * - localStorage 存进度，key 含日期 → 0 点自动重置
 * - 点 CTA → 立即 mark done（"承诺机制"）
 *
 * 用户路径：
 * 1. Dashboard 顶部 "🎯 今日 10 分钟 4 步"
 * 2. 点 CTA（如 "📥 扔进 1 条观察"）→ 跳 /inbox + step 1 mark done
 * 3. 完成 4 步 → 显示 🎉 庆祝
 * 4. 第二天 0 点 → 进度自动重置
 */

export interface DailyLoopState {
  date: string;        // YYYY-MM-DD
  steps: [boolean, boolean, boolean, boolean];
}

const STORAGE_KEY_PREFIX = 'insight-os:daily-loop:';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function storageKey(date: string): string {
  return `${STORAGE_KEY_PREFIX}${date}`;
}

function readTodayState(): DailyLoopState {
  if (typeof window === 'undefined') {
    return { date: todayStr(), steps: [false, false, false, false] };
  }
  const date = todayStr();
  try {
    const raw = localStorage.getItem(storageKey(date));
    if (!raw) return { date, steps: [false, false, false, false] };
    const parsed = JSON.parse(raw);
    if (parsed.date !== date) return { date, steps: [false, false, false, false] };
    return parsed;
  } catch {
    return { date, steps: [false, false, false, false] };
  }
}

function writeTodayState(state: DailyLoopState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(state.date), JSON.stringify(state));
  } catch {
    /* noop */
  }
}

export function useDailyLoop() {
  const [state, setState] = useState<DailyLoopState>({
    date: todayStr(),
    steps: [false, false, false, false],
  });
  const [hydrated, setHydrated] = useState(false);

  // client-side hydration：从 localStorage 读
  useEffect(() => {
    setState(readTodayState());
    setHydrated(true);
  }, []);

  // 跨日期检查（每分钟看一次，避免 0 点不刷新）
  useEffect(() => {
    if (!hydrated) return;
    const interval = setInterval(() => {
      const cur = todayStr();
      if (cur !== state.date) {
        setState({ date: cur, steps: [false, false, false, false] });
        writeTodayState({ date: cur, steps: [false, false, false, false] });
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [hydrated, state.date]);

  const markDone = useCallback(
    (stepIdx: 0 | 1 | 2 | 3) => {
      setState((prev) => {
        const next: DailyLoopState = {
          date: prev.date,
          steps: prev.steps.map((d, i) => (i === stepIdx ? true : d)) as [boolean, boolean, boolean, boolean],
        };
        writeTodayState(next);
        return next;
      });
    },
    []
  );

  const reset = useCallback(() => {
    setState({ date: todayStr(), steps: [false, false, false, false] });
    writeTodayState({ date: todayStr(), steps: [false, false, false, false] });
  }, []);

  const completedCount = state.steps.filter(Boolean).length;
  const allDone = completedCount === 4;

  return { state, markDone, reset, completedCount, allDone, hydrated };
}