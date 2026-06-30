'use client';

/**
 * V1.11.13.3: 统一 Dexie 实例 helper
 *
 * V1.10 留下 12+ 个文件独立 `new Dexie('insight-os')` 声明 schema，
 * 导致：DemoLoader 用 v1，operations 用 v1+v2+v3，ClientAssetLoader 用 v1+v2，
 * 各自缓存单例 → Vincent 浏览器 IDB 永远是 v1 schema，新加表失效。
 *
 * 统一到本文件：所有 module 都调 getSharedDexie()，单例 + 完整 v1+v2+v3 schema。
 * 删除了 12 个文件里的独立 `new Dexie()` 声明。
 */

import type { Dexie } from 'dexie';

let _instance: Dexie | null = null;

export async function getSharedDexie(): Promise<Dexie> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB only available in browser context');
  }
  if (_instance) return _instance;

  const DexieModule = await import('dexie');
  const DexieCls = (DexieModule as any).default || DexieModule;
  _instance = new DexieCls('insight-os');

  // V1.10 Phase 2.x: 11 table schema
  _instance.version(1).stores({
    assets: 'id, type, status, evidenceLevel, updatedAt, scoreTotal, isKernelCandidate, isKernelApproved, sourceMaterialId, createdAt',
    outputs: 'id, status, writingStatus, topicId, createdAt, updatedAt',
    feedback: 'id, assetId, scene, outputId, createdAt',
    topics: 'id, slug, sortOrder, updatedAt',
    assetTopics: 'id, assetId, topicId, [assetId+topicId]',
    sources: 'id, url, enabled, lastFetchedAt, type, createdAt',
    sourceItems: 'id, sourceId, status, fetchedAt, publishedAt, [sourceId+guid]',
    topicKernels: 'id, topicId, generatedAt',
    userKernels: 'id, category, status, sortOrder, updatedAt',
    writingDrafts: 'id, writingId, updatedAt',
    writingVersions: 'id, writingId, createdAt, [writingId+createdAt]',
  });
  // V1.10 Phase 2.12: preferences
  _instance.version(2).stores({
    preferences: 'key',
  });
  // V1.11.13: assetBodies
  _instance.version(3).stores({
    assetBodies: 'id',
  });

  return _instance;
}

/**
 * 升级检测：调用方在写 assetBodies 之前调用，发现 v3 表缺失时返回 true
 * 升级策略：调用方应该 confirm + delete IDB + reload（避免静默丢数据）
 */
export async function checkNeedV3Upgrade(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return new Promise((resolve) => {
    const req = indexedDB.open('insight-os');
    req.onsuccess = () => {
      const db = req.result;
      const has = db.objectStoreNames.contains('assetBodies');
      db.close();
      resolve(!has);
    };
    req.onerror = () => resolve(false);
  });
}