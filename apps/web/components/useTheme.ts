'use client';

// V1.5.0 修：useTheme 拆到 'use client' 文件
// 之前 ThemeProvider + useTheme 同文件 'use client'，导致 layout.tsx server component
// 调 ThemeProvider 时 next 15.5 SSR 跨 client/server boundary hooks dispatcher null

// 主题协调：
// - <html data-theme> DOM attribute 是 single source of truth
// - localStorage 持久化
// - useTheme hook 通过 MutationObserver + CustomEvent 订阅变化
// - setTheme 改 DOM + localStorage + 派发事件

import { useEffect, useState } from 'react';
import {
  DEFAULT_THEME,
  STORAGE_KEY,
  THEME_CHANGE_EVENT,
  type Theme,
} from './ThemeProvider';

export type { Theme } from './ThemeProvider';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    // 初始化：从 <html data-theme> 读
    const initial =
      (document.documentElement.getAttribute('data-theme') as Theme) || DEFAULT_THEME;
    setThemeState(initial);

    // 监听 DOM data-theme 变化
    const observer = new MutationObserver(() => {
      const t =
        (document.documentElement.getAttribute('data-theme') as Theme) || DEFAULT_THEME;
      setThemeState(t);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // 监听自定义事件（其他 useTheme 调用 setTheme）
    const onCustomEvent = (e: Event) => {
      const t = (e as CustomEvent<Theme>).detail;
      setThemeState(t);
    };
    window.addEventListener(THEME_CHANGE_EVENT, onCustomEvent);

    return () => {
      observer.disconnect();
      window.removeEventListener(THEME_CHANGE_EVENT, onCustomEvent);
    };
  }, []);

  const setTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* localStorage 不可用 */
    }
    window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: t }));
  };

  const toggleTheme = () => {
    setTheme(theme === 'blue' ? 'green' : 'blue');
  };

  return { theme, setTheme, toggleTheme };
}
