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
import { getSharedDexie } from '@/lib/idb/shared-dexie';

// ===== 单例 db 实例（lazy 初始化） =====

let _dbInstance: any = null;

async function getDb(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB only available in browser context');
  }
  if (_dbInstance) return _dbInstance;
  _dbInstance = await getSharedDexie();
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

// ===== V1.10 Phase 2.12: Preferences (LLM config 等 key-value 配置) =====

export interface PreferenceRow {
  key: string;
  value: any;
  updatedAt: number;
}

export async function getPreference(key: string): Promise<any | undefined> {
  const db = await getDb();
  const row = await db.preferences.get(key);
  return row?.value;
}

export async function setPreference(key: string, value: any): Promise<void> {
  const db = await getDb();
  await db.preferences.put({ key, value, updatedAt: Date.now() });
}

export async function deletePreference(key: string): Promise<void> {
  const db = await getDb();
  await db.preferences.delete(key);
}

/** 取 LLM config（如未配返回 null） */
export async function getLLMConfig(): Promise<{ baseUrl: string; apiKey: string; model: string } | null> {
  const value = await getPreference('llm-config');
  if (value && value.baseUrl && value.apiKey) return value;
  return null;
}

/** 存 LLM config（用户从设置页配） */
export async function setLLMConfig(cfg: { baseUrl: string; apiKey: string; model: string }): Promise<void> {
  await setPreference('llm-config', cfg);
}

/**
 * V1.11: client 端直接调 LLM 评分 + 升级 light 卡为 candidate
 * 不依赖 server SQLite（Vercel demo 必备）
 */
export interface LLMCallResult {
  ok: boolean;
  data: any;
  error?: string;
}

export async function callLLMDirect<T = any>(
  systemPrompt: string,
  userPrompt: string,
  options: { model?: string; temperature?: number; jsonMode?: boolean } = {}
): Promise<LLMCallResult> {
  const cfg = await getLLMConfig();
  if (!cfg) {
    return { ok: false, data: null, error: 'LLM 未配置：请在设置页配 API key' };
  }
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? cfg.model ?? 'deepseek-chat',
        temperature: options.temperature ?? 0.4,
        ...(options.jsonMode !== false ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, data: null, error: `LLM ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, data: null, error: 'LLM 返回空' };
    if (options.jsonMode !== false) {
      try {
        return { ok: true, data: JSON.parse(content) as T };
      } catch {
        // 尝试从 markdown code block 提取
        const m = content.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
        if (m) {
          try { return { ok: true, data: JSON.parse(m[1]) as T }; } catch {}
        }
        return { ok: false, data: null, error: 'LLM JSON 解析失败' };
      }
    }
    return { ok: true, data: content as any };
  } catch (e: any) {
    return { ok: false, data: null, error: e.message || String(e) };
  }
}

/**
 * V1.11: client 端简化 intake
 * 给素材评分 + 抽 light 卡
 * 不依赖 server SQLite
 */
export async function clientIntakeLightCard(rawContent: string, sourceType: string = 'manual'): Promise<{
  ok: boolean;
  lightCards: any[];
  errors: string[];
}> {
  const errors: string[] = [];
  const lightCards: any[] = [];

  // 1. 简单 LLM 调用
  const system = `你是一个判断力提炼助手。给定一段素材（笔记 / 文章 / 想法），输出 1-3 张「轻量判断卡」（light card）。
每张卡 JSON 格式：
{
  "title": "10 字以内的核心判断标题",
  "oneSentenceInsight": "一句话洞察（30-80 字）",
  "evidenceLevel": "E0|E1|E2|E3|E4|E5"（E0=无证据 · E1=个人观察 · E2=有 1 个案例 · E3=多案例 · E4=实践验证 · E5=反复实践）,
  "scoreTotal": 0-100（综合价值分）,
  "tags": ["标签1", "标签2"],
  "antiCommonSense": "反常识判断（如果素材里有）或 null"
}
只输出 JSON 对象 { "cards": [...] }，不解释。`;

  const user = `素材（sourceType=${sourceType}）：\n\n${rawContent.slice(0, 6000)}\n\n请提炼轻量卡：`;

  const result = await callLLMDirect<{ cards: any[] }>(system, user, { temperature: 0.4, jsonMode: true });

  if (!result.ok) {
    return { ok: false, lightCards, errors: [result.error || 'LLM 失败'] };
  }

  const cards = result.data?.cards || [];
  const now = Date.now();
  const db = await getDb();
  for (const c of cards.slice(0, 3)) {
    const id = `lc_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const row: AssetRow = {
      id,
      type: 'light',
      status: 'candidate',
      title: c.title || rawContent.slice(0, 30),
      evidenceLevel: c.evidenceLevel || 'E1',
      tagsJson: JSON.stringify(c.tags || []),
      source: 'manual',
      sourceType: sourceType as any,
      oneSentenceInsight: c.oneSentenceInsight || null,
      antiCommonSense: c.antiCommonSense || null,
      filePath: `/inbox/${id}.md`,
      fileMtime: now,
      fileHash: id,
      feedbackCount: 0,
      scoreTotal: c.scoreTotal || 60,
      scoreBreakdownJson: JSON.stringify({ llm: c.scoreTotal || 60 }),
      outputCount: 0,
      isKernelCandidate: (c.scoreTotal || 0) >= 75 ? 1 : 0,
      isKernelApproved: 0,
      relatedIdsJson: '[]',
      createdAt: now,
      updatedAt: now,
    };
    await db.assets.put(row);
    lightCards.push(row);
  }
  return { ok: true, lightCards, errors };
}

// ===== V1.11.13: assetBodies —— 存完整 .md body =====

export interface AssetBodyRow {
  id: string;  // assetId
  body: string;
  fileName?: string;
  importedAt: number;
}

/**
 * V1.11.13.1: 检测旧 IDB schema（v2 无 assetBodies 表），自动删库重建
 * 触发场景：用户之前已 demo loaded（v2 schema），升级到 v1.11.13 后浏览器 IDB 没自动升 v3
 * 解决：Dexie 声明式 schema 升级在 class 缓存单例时不触发，需要显式重建
 */
async function ensureV3Schema(): Promise<{ db: any; needReload: boolean }> {
  const db = await getDb();
  if (!db.assetBodies) {
    // 旧 schema —— 删库重建（先关闭再删，再清单例）
    console.warn('[addAssetBody] 检测到旧 IDB schema，删除重建以升级到 v3');
    try { await db.close(); } catch (e) { /* ignore */ }
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('insight-os');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
    // 重置本地单例，让下一次 getDb() 重新 new Dexie() 走 v3 schema
    _dbInstance = null;
    return { db: null, needReload: true };
  }
  return { db, needReload: false };
}

export async function addAssetBody(id: string, body: string, fileName?: string): Promise<void> {
  const { db, needReload } = await ensureV3Schema();
  if (needReload) {
    // IDB 已删，刷新页面让 Dexie 用 v3 schema 重建库
    window.location.reload();
    return;
  }
  await db.assetBodies.put({ id, body, fileName, importedAt: Date.now() });
}

export async function getAssetBody(id: string): Promise<string | undefined> {
  const db = await getDb();
  const row = await db.assetBodies.get(id);
  return row?.body;
}

export async function deleteAssetBody(id: string): Promise<void> {
  const db = await getDb();
  await db.assetBodies.delete(id);
}