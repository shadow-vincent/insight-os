'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'blue' | 'green';

const STORAGE_KEY = 'insight-os:theme';
const DEFAULT_THEME: Theme = 'blue';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * ThemeProvider · 在 <html data-theme="..."> 上切主题
 *
 * 防 FOUC：在 hydration 前从 localStorage 读主题写到 <html>
 * 切换时：setState + 改 <html data-theme> + 写 localStorage
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [hydrated, setHydrated] = useState(false);

  // 初始化：从 localStorage 读，写到 <html>
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === 'blue' || stored === 'green') {
        setThemeState(stored);
        document.documentElement.setAttribute('data-theme', stored);
      } else {
        document.documentElement.setAttribute('data-theme', DEFAULT_THEME);
      }
    } catch {
      document.documentElement.setAttribute('data-theme', DEFAULT_THEME);
    }
    setHydrated(true);
  }, []);

  // 监听系统主题（仅在用户没手动选过时跟随）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    // 不接 dark mode（两套都是浅色），但保留 hook 占位
    return () => {};
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* localStorage 不可用就静默 */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'blue' ? 'green' : 'blue');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // 没用 Provider 时给 fallback（避免 SSR/edge case 崩溃）
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}

/**
 * 在 <head> 注入的 inline script · 防 FOUC
 * 在 hydration 之前先把主题写到 <html>，避免白闪
 */
export const ThemeScript = () => {
  const code = `
    (function() {
      try {
        var t = localStorage.getItem('${STORAGE_KEY}');
        if (t === 'blue' || t === 'green') {
          document.documentElement.setAttribute('data-theme', t);
        } else {
          document.documentElement.setAttribute('data-theme', '${DEFAULT_THEME}');
        }
      } catch (e) {
        document.documentElement.setAttribute('data-theme', '${DEFAULT_THEME}');
      }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
};
