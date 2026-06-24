// V1.5.0 修：ThemeProvider server component（不 'use client'）
// 之前 ThemeProvider 是 'use client' + useState/useSyncExternalStore，
// next 15.5.19 + React 19 SSR 跨 client/server boundary 时 hooks dispatcher null
// → 'Cannot read properties of null (reading useState)' → / 500
//
// 修法：
// - ThemeProvider 是 server component，不存任何 React state
// - 只 pass-through render children
// - 主题状态从 <html data-theme> DOM attribute 读（DOM 是 single source of truth）
// - setTheme 改 DOM + localStorage + 派发事件
// - useTheme 在 'use client' 文件里 + client mount 时 useState/useEffect 都有完整 React context

import type { ReactNode } from 'react';

export type Theme = 'blue' | 'green';

export const STORAGE_KEY = 'insight-os:theme';
export const DEFAULT_THEME: Theme = 'blue';
export const THEME_CHANGE_EVENT = 'insight-os:theme-changed';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
