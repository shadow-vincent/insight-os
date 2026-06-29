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
 * 挂载位置：apps/web/app/layout.tsx
 */

import { useEffect, useState } from 'react';
import { migrateFromSqlite, maybeAutoBackup, type MigrationResult, type BackupResult } from './migrate';

interface IndexedDBProviderProps {
  children: React.ReactNode;
}

export function IndexedDBProvider({ children }: IndexedDBProviderProps) {
  const [migrationStatus, setMigrationStatus] = useState<'pending' | 'migrating' | 'done' | 'error'>('pending');
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // 1. 跑迁移
      setMigrationStatus('migrating');
      const mResult = await migrateFromSqlite();
      if (cancelled) return;
      setMigrationResult(mResult);
      setMigrationStatus(mResult.success ? 'done' : 'error');

      if (!mResult.success) {
        console.error('[IndexedDBProvider] migration failed:', mResult.error);
        // 不阻塞 UI —— 用户可以用 IndexedDB 创建新数据
      } else if (mResult.source !== 'skip' && mResult.source !== 'empty') {
        console.log('[IndexedDBProvider] migration done:', mResult.migrated);
      }

      // 2. 自动备份（如果今天还没备份）
      const bResult = await maybeAutoBackup();
      if (cancelled) return;
      setBackupResult(bResult);
      if (!bResult.success && bResult.error !== 'already-backed-up-today') {
        console.warn('[IndexedDBProvider] auto backup failed:', bResult.error);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  // 不管 migration 状态如何，都渲染 children（不阻塞 UI）
  return <>{children}</>;
}

/**
 * Hook: 让组件拿到 migration / backup 状态（用于 UI 提示）
 */
export function useIndexedDBStatus() {
  const [status, setStatus] = useState<{
    migration: 'pending' | 'migrating' | 'done' | 'error';
    backup: BackupResult | null;
    migrationResult: MigrationResult | null;
  }>({
    migration: 'pending',
    backup: null,
    migrationResult: null,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const migrated = localStorage.getItem('migrated-v1.10');
      setStatus({
        migration: migrated === 'true' ? 'done' : 'pending',
        backup: null,
        migrationResult: null,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return status;
}