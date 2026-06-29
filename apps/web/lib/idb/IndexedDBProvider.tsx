'use client';

/**
 * V1.10 IndexedDB Provider
 *
 * 应用启动时自动跑迁移 + 自动备份：
 *   1. 检查是否需要从老 SQLite 迁移
 *   2. 如果需要，调 /api/migrate/export 拿数据，写 IndexedDB
 *   3. 检查今天是否需要自动备份
 *   4. 如果需要，静默触发 JSON export 下载
 *
 * V1.10 修复：所有 Dexie/IDB 模块都 dynamic import 在 useEffect 里跑
 * （顶层 import 会让 Vercel Lambda server load 时 Dexie 模块报错）
 *
 * 挂载位置：apps/web/app/layout.tsx
 */

import { useEffect } from 'react';

interface IndexedDBProviderProps {
  children: React.ReactNode;
}

export function IndexedDBProvider({ children }: IndexedDBProviderProps) {
  useEffect(() => {
    // 仅 client mount 时跑（typeof window 检查保证 server 不会 load Dexie）
    if (typeof window === 'undefined') return;

    (async () => {
      try {
        // dynamic import：仅 client load Dexie 相关模块
        const { migrateFromSqlite, maybeAutoBackup } = await import('./migrate');

        // 1. 跑迁移
        const mResult = await migrateFromSqlite();
        if (!mResult.success) {
          console.error('[IndexedDBProvider] migration failed:', mResult.error);
        } else if (mResult.source !== 'skip' && mResult.source !== 'empty') {
          console.log('[IndexedDBProvider] migration done:', mResult.migrated);
        }

        // 2. 自动备份（如果今天还没备份）
        const bResult = await maybeAutoBackup();
        if (!bResult.success && bResult.error !== 'already-backed-up-today' && bResult.error !== 'no-data-yet') {
          console.warn('[IndexedDBProvider] auto backup failed:', bResult.error);
        }
      } catch (e) {
        console.error('[IndexedDBProvider] bootstrap error:', e);
      }
    })();
  }, []);

  // 不管 migration 状态如何，都渲染 children（不阻塞 UI）
  return <>{children}</>;
}