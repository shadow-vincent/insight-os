'use client';

/**
 * V1.10 IndexedDB Operations Layer
 *
 * 所有数据 CRUD 操作的 Dexie 包装。
 * 这是 client-only 代码（不能在 server 跑）。
 *
 * 设计原则：
 * - 每个函数返回 Promise
 * - 用 schema 行类型 (AssetRow / TopicRow 等) 作入参/出参
 * - 失败 throw Error，调用方 try/catch
 *
 * Phase 2.1: assets / topics / assetTopics / sources / sourceItems / feedback
 *           outputs / topicKernels / userKernels / writingDrafts / writingVersions
 */

import type {
  AssetRow, OutputRow, FeedbackRow, TopicRow, AssetTopicRow,
  SourceRow, SourceItemRow, TopicKernelRow, UserKernelRow,
  WritingDraftRow, WritingVersionRow,
} from './db';

// ===== 单例 db 实例（lazy 初始化） =====

let _dbInstance: any = null;

async function getDb(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB only available in browser context');
  }
  if (_dbInstance) return _dbInstance;

  const DexieModule = await import('dexie');
  const Dexie = (DexieModule as any).default || DexieModule;
  _dbInstance = new Dexie('insight-os');
  // 完整 11 table schema（和 DemoLoader / ClientAssetLoader 一致）
  _dbInstance.version(1).stores({
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
  return _dbInstance;
}

// ===== Assets =====

export async function getAssets(filter?: {
  status?: string | string[];
  type?: string;
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'scoreTotal';
  order?: 'asc' | 'desc';
}): Promise<AssetRow[]> {
  const db = await getDb();
  let collection = db.assets.toCollection();
  let results: AssetRow[] = await collection.toArray();

  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    results = results.filter(a => statuses.includes(a.status));
  }
  if (filter?.type) {
    results = results.filter(a => a.type === filter.type);
  }
  if (filter?.orderBy) {
    const dir = filter.order === 'asc' ? 1 : -1;
    results.sort((a: any, b: any) => ((a[filter.orderBy!] ?? 0) - (b[filter.orderBy!] ?? 0)) * dir);
  }
  if (filter?.limit) results = results.slice(0, filter.limit);
  return results;
}

export async function getAsset(id: string): Promise<AssetRow | undefined> {
  const db = await getDb();
  return db.assets.get(id);
}

export async function addAsset(data: Omit<AssetRow, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<AssetRow> {
  const db = await getDb();
  const now = Date.now();
  const row: AssetRow = {
    ...data,
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  } as AssetRow;
  await db.assets.put(row);
  return row;
}

export async function updateAsset(id: string, patch: Partial<AssetRow>): Promise<void> {
  const db = await getDb();
  const existing = await db.assets.get(id);
  if (!existing) throw new Error(`Asset ${id} not found`);
  await db.assets.put({ ...existing, ...patch, updatedAt: Date.now() });
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDb();
  await db.assets.delete(id);
}

export async function bulkAddAssets(rows: AssetRow[]): Promise<void> {
  const db = await getDb();
  await db.assets.bulkPut(rows);
}

// ===== Topics =====

export async function getTopics(): Promise<TopicRow[]> {
  const db = await getDb();
  const all: TopicRow[] = await db.topics.toArray();
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getTopic(id: string): Promise<TopicRow | undefined> {
  const db = await getDb();
  return db.topics.get(id);
}

export async function addTopic(data: Omit<TopicRow, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<TopicRow> {
  const db = await getDb();
  const now = Date.now();
  const row: TopicRow = {
    ...data,
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  } as TopicRow;
  await db.topics.put(row);
  return row;
}

export async function updateTopic(id: string, patch: Partial<TopicRow>): Promise<void> {
  const db = await getDb();
  const existing = await db.topics.get(id);
  if (!existing) throw new Error(`Topic ${id} not found`);
  await db.topics.put({ ...existing, ...patch, updatedAt: Date.now() });
}

export async function deleteTopic(id: string): Promise<void> {
  const db = await getDb();
  await db.topics.delete(id);
}

// ===== AssetTopics (多对多关联) =====

export async function getAssetTopicsByAsset(assetId: string): Promise<AssetTopicRow[]> {
  const db = await getDb();
  return db.assetTopics.where('assetId').equals(assetId).toArray();
}

export async function getAssetTopicsByTopic(topicId: string): Promise<AssetTopicRow[]> {
  const db = await getDb();
  return db.assetTopics.where('topicId').equals(topicId).toArray();
}

export async function addAssetTopic(data: Omit<AssetTopicRow, 'id' | 'createdAt'>): Promise<AssetTopicRow> {
  const db = await getDb();
  const row: AssetTopicRow = {
    ...data,
    id: `at_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  } as AssetTopicRow;
  await db.assetTopics.put(row);
  return row;
}

export async function deleteAssetTopicsByAsset(assetId: string): Promise<void> {
  const db = await getDb();
  await db.assetTopics.where('assetId').equals(assetId).delete();
}

// ===== Sources =====

export async function getSources(): Promise<SourceRow[]> {
  const db = await getDb();
  return db.sources.toArray();
}

export async function getSource(id: string): Promise<SourceRow | undefined> {
  const db = await getDb();
  return db.sources.get(id);
}

export async function getSourceByUrl(url: string): Promise<SourceRow | undefined> {
  const db = await getDb();
  return db.sources.where('url').equals(url).first();
}

export async function addSource(data: Omit<SourceRow, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<SourceRow> {
  const db = await getDb();
  const now = Date.now();
  const row: SourceRow = {
    ...data,
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  } as SourceRow;
  await db.sources.put(row);
  return row;
}

export async function updateSource(id: string, patch: Partial<SourceRow>): Promise<void> {
  const db = await getDb();
  const existing = await db.sources.get(id);
  if (!existing) throw new Error(`Source ${id} not found`);
  await db.sources.put({ ...existing, ...patch, updatedAt: Date.now() });
}

export async function deleteSource(id: string): Promise<void> {
  const db = await getDb();
  await db.sources.delete(id);
  // 同时删除 sourceItems
  await db.sourceItems.where('sourceId').equals(id).delete();
}

// ===== SourceItems =====

export async function getSourceItems(sourceId: string): Promise<SourceItemRow[]> {
  const db = await getDb();
  return db.sourceItems.where('sourceId').equals(sourceId).reverse().sortBy('publishedAt');
}

export async function getNewSourceItems(): Promise<SourceItemRow[]> {
  const db = await getDb();
  return db.sourceItems.where('status').equals('new').toArray();
}

export async function addSourceItem(data: SourceItemRow): Promise<void> {
  const db = await getDb();
  await db.sourceItems.put(data);
}

export async function bulkAddSourceItems(items: SourceItemRow[]): Promise<void> {
  const db = await getDb();
  await db.sourceItems.bulkPut(items);
}

export async function updateSourceItem(id: string, patch: Partial<SourceItemRow>): Promise<void> {
  const db = await getDb();
  const existing = await db.sourceItems.get(id);
  if (!existing) throw new Error(`SourceItem ${id} not found`);
  await db.sourceItems.put({ ...existing, ...patch });
}

export async function getSourceItemByGuid(sourceId: string, guid: string): Promise<SourceItemRow | undefined> {
  const db = await getDb();
  return db.sourceItems.where('[sourceId+guid]').equals([sourceId, guid]).first();
}

// ===== Feedback =====

export async function getFeedbackForAsset(assetId: string): Promise<FeedbackRow[]> {
  const db = await getDb();
  return db.feedback.where('assetId').equals(assetId).reverse().sortBy('createdAt');
}

export async function getAllFeedback(): Promise<FeedbackRow[]> {
  const db = await getDb();
  return db.feedback.toArray();
}

export async function addFeedback(data: Omit<FeedbackRow, 'id' | 'createdAt'>): Promise<FeedbackRow> {
  const db = await getDb();
  const row: FeedbackRow = {
    ...data,
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  } as FeedbackRow;
  await db.feedback.put(row);
  return row;
}

// ===== Outputs =====

export async function getOutputs(limit?: number): Promise<OutputRow[]> {
  const db = await getDb();
  let results: OutputRow[] = await db.outputs.toArray();
  results = results.sort((a, b) => b.createdAt - a.createdAt);
  if (limit) results = results.slice(0, limit);
  return results;
}

export async function getOutputsByAsset(assetId: string): Promise<OutputRow[]> {
  const db = await getDb();
  const all: OutputRow[] = await db.outputs.toArray();
  return all
    .filter(o => {
      try {
        const ids = JSON.parse(o.assetIdsJson || '[]');
        return Array.isArray(ids) && ids.includes(assetId);
      } catch { return false; }
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function addOutput(data: Omit<OutputRow, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<OutputRow> {
  const db = await getDb();
  const now = Date.now();
  const row: OutputRow = {
    ...data,
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  } as OutputRow;
  await db.outputs.put(row);
  return row;
}

export async function updateOutput(id: string, patch: Partial<OutputRow>): Promise<void> {
  const db = await getDb();
  const existing = await db.outputs.get(id);
  if (!existing) throw new Error(`Output ${id} not found`);
  await db.outputs.put({ ...existing, ...patch, updatedAt: Date.now() });
}

// ===== TopicKernels =====

export async function getTopicKernel(topicId: string): Promise<TopicKernelRow | undefined> {
  const db = await getDb();
  return db.topicKernels.where('topicId').equals(topicId).first();
}

export async function getAllTopicKernels(): Promise<TopicKernelRow[]> {
  const db = await getDb();
  return db.topicKernels.toArray();
}

export async function upsertTopicKernel(data: TopicKernelRow): Promise<void> {
  const db = await getDb();
  await db.topicKernels.put(data);
}

// ===== UserKernels =====

export async function getUserKernels(): Promise<UserKernelRow[]> {
  const db = await getDb();
  const all: UserKernelRow[] = await db.userKernels.toArray();
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getActiveUserKernels(): Promise<UserKernelRow[]> {
  const db = await getDb();
  const all: UserKernelRow[] = await db.userKernels.toArray();
  return all.filter(k => k.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function addUserKernel(data: Omit<UserKernelRow, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<UserKernelRow> {
  const db = await getDb();
  const now = Date.now();
  const row: UserKernelRow = {
    ...data,
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  } as UserKernelRow;
  await db.userKernels.put(row);
  return row;
}

export async function updateUserKernel(id: string, patch: Partial<UserKernelRow>): Promise<void> {
  const db = await getDb();
  const existing = await db.userKernels.get(id);
  if (!existing) throw new Error(`UserKernel ${id} not found`);
  await db.userKernels.put({ ...existing, ...patch, updatedAt: Date.now() });
}

export async function deleteUserKernel(id: string): Promise<void> {
  const db = await getDb();
  await db.userKernels.delete(id);
}

// ===== WritingDrafts / WritingVersions =====

export async function getWritingDraft(writingId: string): Promise<WritingDraftRow | undefined> {
  const db = await getDb();
  return db.writingDrafts.where('writingId').equals(writingId).first();
}

export async function upsertWritingDraft(data: WritingDraftRow): Promise<void> {
  const db = await getDb();
  await db.writingDrafts.put(data);
}

export async function deleteWritingDraft(writingId: string): Promise<void> {
  const db = await getDb();
  await db.writingDrafts.where('writingId').equals(writingId).delete();
}

export async function getWritingVersions(writingId: string): Promise<WritingVersionRow[]> {
  const db = await getDb();
  const all: WritingVersionRow[] = await db.writingVersions.where('writingId').equals(writingId).toArray();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addWritingVersion(data: Omit<WritingVersionRow, 'id' | 'createdAt'>): Promise<WritingVersionRow> {
  const db = await getDb();
  const row: WritingVersionRow = {
    ...data,
    id: `wv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  } as WritingVersionRow;
  await db.writingVersions.put(row);
  return row;
}

// ===== 统计 / 聚合 =====

export async function getStats(): Promise<{
  totalAssets: number;
  inUseCount: number;
  candidateCount: number;
  e2PlusCount: number;
  inboxCount: number;
  totalOutputs: number;
  totalTopics: number;
  totalSources: number;
}> {
  const db = await getDb();
  const [allAssets, allOutputs, allTopics, allSources] = await Promise.all([
    db.assets.toArray(),
    db.outputs.toArray(),
    db.topics.toArray(),
    db.sources.toArray(),
  ]);

  return {
    totalAssets: allAssets.filter(a => a.type !== 'light').length,
    inUseCount: allAssets.filter(a => a.type !== 'light' && a.status === 'in_use').length,
    candidateCount: allAssets.filter(a => a.type === 'light' && a.status === 'candidate').length,
    e2PlusCount: allAssets.filter(a => a.type !== 'light' && ['E2', 'E3', 'E4', 'E5'].includes(a.evidenceLevel)).length,
    inboxCount: allAssets.filter(a => a.status === 'inbox').length,
    totalOutputs: allOutputs.length,
    totalTopics: allTopics.length,
    totalSources: allSources.filter((s: SourceRow) => s.enabled === 1).length,
  };
}