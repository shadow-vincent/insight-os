/**
 * V1.10 SQLite → IndexedDB 迁移
 *
 * 触发：V1.10 启动时（IndexedDBProvider mount 后）
 * 流程：
 *   1. 检查 localStorage 标记 'migrated-v1.10' —— 已迁移则跳过
 *   2. 检测老 SQLite 文件路径（Electron / Vercel / 本地 dev 各自不同）
 *   3. 通过 fetch /api/migrate/export 拿到 SQLite 数据（JSON 格式）
 *      （API route 在 server 端用 better-sqlite3 读老 db，返回 JSON）
 *   4. 把 JSON 写入 IndexedDB（每个表 bulkPut）
 *   5. 标记完成
 *
 * 注意：Electron 桌面版有更直接的 file 系统访问，
 *       可直接读 ~/Library/Application Support/InsightOS/insight.db
 *       但简化起见，V1.10 统一走 /api/migrate/export 端点
 *       （Electron 内嵌的 server 端会处理这个端点）
 */

import { type AssetRow, type OutputRow, type FeedbackRow, type TopicRow, type AssetTopicRow, type SourceRow, type SourceItemRow, type TopicKernelRow, type UserKernelRow, type WritingDraftRow, type WritingVersionRow } from './db';
import { convertDump } from './mapping';
import { getDb as getIDB } from './operations';

const MIGRATION_KEY = 'migrated-v1.10';
const BACKUP_KEY = 'last-backup-v1.10';

export interface MigrationResult {
  success: boolean;
  migrated: Record<string, number>;
  source: 'api' | 'skip' | 'empty' | 'error';
  error?: string;
}

export interface BackupResult {
  success: boolean;
  size: number;
  path?: string;
  error?: string;
}

/**
 * 检测是否需要迁移
 */
export function needsMigration(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MIGRATION_KEY) !== 'true';
}

/**
 * 主迁移函数：从老 SQLite 读取数据，写入 IndexedDB
 *
 * V1.10 阶段调用方：
 *   1. Vercel web 部署用户：调 /api/migrate/export（server 端读 SQLite dump 后返回）
 *   2. Electron 桌面版用户：Electron main.js 暴露 IPC，读 ~/Library/.../insight.db
 *   3. 本地 dev 用户：next dev server 调 /api/migrate/export
 *
 * V1.10 简化：所有路径都走 /api/migrate/export 端点
 * （Electron main.js 在 app ready 后确保 file 存在 + 暴露给 server）
 */
export async function migrateFromSqlite(): Promise<MigrationResult> {
  if (typeof window === 'undefined') {
    return { success: false, migrated: {}, source: 'error', error: 'browser-only' };
  }

  if (!needsMigration()) {
    return { success: true, migrated: {}, source: 'skip' };
  }

  try {
    // 1. 调 API 拿老 SQLite dump
    const res = await fetch('/api/migrate/export', { method: 'POST' });
    if (!res.ok) {
      // 没有老 SQLite 或端点不存在 → 新用户，跳过迁移
      if (res.status === 404) {
        markMigrated();
        return { success: true, migrated: {}, source: 'empty' };
      }
      throw new Error(`migration export failed: ${res.status}`);
    }

    const raw = await res.json() as {
      assets?: AssetRow[];
      outputs?: OutputRow[];
      feedback?: FeedbackRow[];
      topics?: TopicRow[];
      assetTopics?: AssetTopicRow[];
      sources?: SourceRow[];
      sourceItems?: SourceItemRow[];
      topicKernels?: TopicKernelRow[];
      userKernels?: UserKernelRow[];
      writingDrafts?: WritingDraftRow[];
      writingVersions?: WritingVersionRow[];
    };
    // V1.10 Phase 2.13: 字段映射（null → undefined + 时间戳归一）
    const dump = convertDump(raw);

    // 2. 写入 IndexedDB
    const db = await getIDB();
    const migrated: Record<string, number> = {};

    await db.transaction(
      'rw',
      [db.assets, db.outputs, db.feedback, db.topics, db.assetTopics,
       db.sources, db.sourceItems, db.topicKernels, db.userKernels,
       db.writingDrafts, db.writingVersions],
      async () => {
        if (dump.assets?.length) {
          await db.assets.bulkPut(dump.assets);
          migrated.assets = dump.assets.length;
        }
        if (dump.outputs?.length) {
          await db.outputs.bulkPut(dump.outputs);
          migrated.outputs = dump.outputs.length;
        }
        if (dump.feedback?.length) {
          await db.feedback.bulkPut(dump.feedback);
          migrated.feedback = dump.feedback.length;
        }
        if (dump.topics?.length) {
          await db.topics.bulkPut(dump.topics);
          migrated.topics = dump.topics.length;
        }
        if (dump.assetTopics?.length) {
          await db.assetTopics.bulkPut(dump.assetTopics);
          migrated.assetTopics = dump.assetTopics.length;
        }
        if (dump.sources?.length) {
          await db.sources.bulkPut(dump.sources);
          migrated.sources = dump.sources.length;
        }
        if (dump.sourceItems?.length) {
          await db.sourceItems.bulkPut(dump.sourceItems);
          migrated.sourceItems = dump.sourceItems.length;
        }
        if (dump.topicKernels?.length) {
          await db.topicKernels.bulkPut(dump.topicKernels);
          migrated.topicKernels = dump.topicKernels.length;
        }
        if (dump.userKernels?.length) {
          await db.userKernels.bulkPut(dump.userKernels);
          migrated.userKernels = dump.userKernels.length;
        }
        if (dump.writingDrafts?.length) {
          await db.writingDrafts.bulkPut(dump.writingDrafts);
          migrated.writingDrafts = dump.writingDrafts.length;
        }
        if (dump.writingVersions?.length) {
          await db.writingVersions.bulkPut(dump.writingVersions);
          migrated.writingVersions = dump.writingVersions.length;
        }
      }
    );

    markMigrated();
    return { success: true, migrated, source: 'api' };
  } catch (e: any) {
    return { success: false, migrated: {}, source: 'error', error: e?.message || String(e) };
  }
}

function markMigrated() {
  localStorage.setItem(MIGRATION_KEY, 'true');
  localStorage.setItem(`${MIGRATION_KEY}-timestamp`, String(Date.now()));
}

/**
 * 导出当前 IndexedDB 全部数据为 JSON（手动备份用）
 */
export async function exportAllAsJson(): Promise<BackupResult> {
  if (typeof window === 'undefined') {
    return { success: false, size: 0, error: 'browser-only' };
  }
  try {
    const db = await getIDB();
    const dump = {
      version: 1,
      exportedAt: Date.now(),
      assets: await db.assets.toArray(),
      outputs: await db.outputs.toArray(),
      feedback: await db.feedback.toArray(),
      topics: await db.topics.toArray(),
      assetTopics: await db.assetTopics.toArray(),
      sources: await db.sources.toArray(),
      sourceItems: await db.sourceItems.toArray(),
      topicKernels: await db.topicKernels.toArray(),
      userKernels: await db.userKernels.toArray(),
      writingDrafts: await db.writingDrafts.toArray(),
      writingVersions: await db.writingVersions.toArray(),
    };
    const json = JSON.stringify(dump, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 自动下载（浏览器会触发下载对话框）
    const a = document.createElement('a');
    a.href = url;
    a.download = `insight-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, size: blob.size, path: a.download };
  } catch (e: any) {
    return { success: false, size: 0, error: e?.message || String(e) };
  }
}

/**
 * 自动备份：每天首次打开时备份一次（如果今天还没备份）
 *
 * 触发：IndexedDBProvider mount 后
 * 行为：
 *   - 检查 localStorage 'last-backup-v1.10' 的日期
 *   - 今天已备份 → 跳过
 *   - 今天没备份 → 检查 IndexedDB 是否有数据
 *     - 没数据 → 只设标记，不下载（避免新用户被打扰）
 *     - 有数据 → 调 exportAllAsJson 触发下载
 *
 * 注意：浏览器静默下载可能被拦截，但用户主动操作是 OK 的
 *       Electron 桌面版可改为直接写本地文件（IPC）
 */
export async function maybeAutoBackup(): Promise<BackupResult> {
  if (typeof window === 'undefined') {
    return { success: false, size: 0, error: 'browser-only' };
  }
  const today = new Date().toISOString().slice(0, 10);
  const lastBackup = localStorage.getItem(BACKUP_KEY);
  if (lastBackup === today) {
    return { success: true, size: 0, error: 'already-backed-up-today' };
  }

  // 检查 IndexedDB 是否有任何数据（避免给新用户下载空 JSON 打扰）
  try {
    const db = await getIDB();
    const totalCount = await Promise.all([
      db.assets.count(),
      db.outputs.count(),
      db.feedback.count(),
      db.topics.count(),
      db.sources.count(),
      db.userKernels.count(),
    ]).then(counts => counts.reduce((sum, n) => sum + n, 0));

    if (totalCount === 0) {
      // 新用户没数据，只设标记，不下载
      localStorage.setItem(BACKUP_KEY, today);
      return { success: true, size: 0, error: 'no-data-yet' };
    }
  } catch (e) {
    // 检查失败也跳过，避免给用户报错
    return { success: false, size: 0, error: 'count-failed' };
  }

  const result = await exportAllAsJson();
  if (result.success) {
    localStorage.setItem(BACKUP_KEY, today);
  }
  return result;
}