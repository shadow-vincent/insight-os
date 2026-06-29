/**
 * Insight OS · IndexedDB Schema (V1.10 IndexedDB-only 重构)
 *
 * 镜像 packages/db/src/schema.ts 的 11 张 SQLite 表到 IndexedDB。
 * FTS5 全文搜索 → MiniSearch（在 lib/idb/search.ts 实现），不建 IDB table。
 *
 * V1.10: Dexie 改成 lazy dynamic import（避免 Vercel Lambda server load 时 Dexie 模块顶层报错）
 */

import type { Table } from 'dexie'; // type-only import：编译时删，不影响 runtime

// ===== 类型定义（镜像 SQLite schema） =====

export type AssetType = 'light' | 'asset' | 'kernel';
export type AssetStatus = 'inbox' | 'sorting' | 'calibrating' | 'candidate' | 'in_use' | 'archived';
export type EvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5';
export type Priority = 'A' | 'B' | 'C';
export type SourceType = 'book' | 'knowledge_card' | 'project' | 'article' | 'original' | 'unknown';
export type OutputType = 'talk_script' | 'article_outline' | 'article_full' | 'writing' | 'speech' | 'book_note' | 'email';
export type OutputStatus = 'draft' | 'used' | 'feedback_done';
export type WritingStatus = 'scaffold' | 'draft' | 'published';
export type FeedbackScene = 'client_talk' | 'article' | 'course' | 'colleague' | 'archive' | 'other';
export type AssignedBy = 'human' | 'llm' | 'rule';
export type SourceType2 = 'rss' | 'twitter' | 'wechat-account' | 'reddit';
export type SourceItemStatus = 'new' | 'imported' | 'skipped';
export type UserKernelCategory = 'belief' | 'contrarian' | 'expertise' | 'challenge' | 'principle';
export type UserKernelKind = 'belief' | 'hypothesis' | 'experience' | 'contrarian' | 'principle';
export type UserKernelStatus = 'active' | 'archived';

// ===== Row 类型 =====

export interface AssetRow {
  id: string;
  type: AssetType;
  status: AssetStatus;
  title: string;
  evidenceLevel: EvidenceLevel;
  priority?: Priority;
  tagsJson: string; // JSON array
  source?: string;
  sourceType: SourceType;
  oneSentenceInsight?: string;
  antiCommonSense?: string;
  filePath: string;
  fileMtime: number;
  fileHash: string;
  feedbackCount: number;
  lastUsedAt?: number;
  sourceMaterialId?: string;
  scoreTotal: number;
  scoreBreakdownJson: string;
  outputCount: number;
  processedAt?: number;
  isKernelCandidate: number;
  isKernelApproved: number;
  relatedIdsJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface OutputRow {
  id: string;
  assetIdsJson: string;
  outputType: OutputType;
  title: string;
  content: string;
  audience?: string;
  status: OutputStatus;
  scaffoldJson?: string;
  templateType?: string;
  sourceUrl?: string;
  topicId?: string;
  writingStatus: WritingStatus;
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackRow {
  id: string;
  outputId?: string;
  assetId: string;
  scene: FeedbackScene;
  reaction?: string;
  mostTouchedPoint?: string;
  followUpQuestions?: string;
  evidenceLevelBefore?: EvidenceLevel;
  evidenceLevelAfter?: EvidenceLevel;
  createdAt: number;
}

export interface TopicRow {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coreBeliefsJson: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface AssetTopicRow {
  id: string;
  assetId: string;
  topicId: string;
  confidence: number;
  assignedBy: AssignedBy;
  createdAt: number;
}

export interface SourceRow {
  id: string;
  type: SourceType2;
  url: string;
  title: string;
  enabled: number;
  lastFetchedAt?: number;
  lastError?: string;
  fetchIntervalMin: number;
  newItemsCount: number;
  totalItemsCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface SourceItemRow {
  id: string;
  sourceId: string;
  guid: string;
  title: string;
  url?: string;
  excerpt?: string;
  content?: string;
  publishedAt?: number;
  fetchedAt: number;
  status: SourceItemStatus;
  assetId?: string;
}

export interface TopicKernelRow {
  id: string;
  topicId: string;
  headline: string;
  summary: string;
  coreBeliefsJson: string;
  sourceAssetIdsJson: string;
  generatedAt: number;
  generationModel?: string;
}

export interface UserKernelRow {
  id: string;
  category: UserKernelCategory;
  kind: UserKernelKind;
  content: string;
  confidence: number;
  counterExample?: string;
  scope?: string;
  evidenceAssetIdsJson: string;
  referencedCount: number;
  lastVerifiedAt?: number;
  status: UserKernelStatus;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface WritingDraftRow {
  id: string;
  writingId: string;
  content: string;
  title?: string;
  updatedAt: number;
}

export interface WritingVersionRow {
  id: string;
  writingId: string;
  content: string;
  title?: string;
  note?: string;
  createdBy: 'auto' | 'manual' | 'system';
  createdAt: number;
}

// ===== Dexie 实例 =====

export class InsightDB extends Dexie {
  assets!: Table<AssetRow, string>;
  outputs!: Table<OutputRow, string>;
  feedback!: Table<FeedbackRow, string>;
  topics!: Table<TopicRow, string>;
  assetTopics!: Table<AssetTopicRow, string>;
  sources!: Table<SourceRow, string>;
  sourceItems!: Table<SourceItemRow, string>;
  topicKernels!: Table<TopicKernelRow, string>;
  userKernels!: Table<UserKernelRow, string>;
  writingDrafts!: Table<WritingDraftRow, string>;
  writingVersions!: Table<WritingVersionRow, string>;

  constructor() {
    super('insight-os');

    // V1.10: 11 张表的 schema 定义
    // 索引设计参考 packages/db/src/schema.ts 的 SQL 索引
    this.version(1).stores({
      // assets —— 全文搜索靠 MiniSearch（不建 IDB index）
      assets: 'id, type, status, evidenceLevel, updatedAt, scoreTotal, isKernelCandidate, isKernelApproved, sourceMaterialId, createdAt',

      // outputs —— 按创建时间倒序、状态过滤、写作状态过滤
      outputs: 'id, status, writingStatus, topicId, createdAt, updatedAt',

      // feedback —— 按资产 ID 查反馈 + 时间排序
      feedback: 'id, assetId, scene, outputId, createdAt',

      // topics —— slug 唯一
      topics: 'id, slug, sortOrder, updatedAt',

      // asset_topics —— 多对多关联，按 asset/topic 查
      assetTopics: 'id, assetId, topicId, [assetId+topicId]',

      // sources —— URL 唯一，按 enabled 过滤、按 fetch 时间排序
      sources: 'id, url, enabled, lastFetchedAt, type, createdAt',

      // source_items —— 按 source 过滤 + 状态过滤 + (sourceId+guid) 唯一
      sourceItems: 'id, sourceId, status, fetchedAt, publishedAt, [sourceId+guid]',

      // topic_kernels —— topicId 唯一
      topicKernels: 'id, topicId, generatedAt',

      // user_kernels —— 按 category/status/sortOrder 过滤
      userKernels: 'id, category, status, sortOrder, updatedAt',

      // writing_drafts —— writingId 唯一
      writingDrafts: 'id, writingId, updatedAt',

      // writing_versions —— 按 (writingId+createdAt) 排序
      writingVersions: 'id, writingId, createdAt, [writingId+createdAt]',
    });
  }
}

// 单例（每个浏览器 tab 一个实例）
let _dbInstance: InsightDB | null = null;

export function getDb(): InsightDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB only available in browser context');
  }
  if (!_dbInstance) {
    _dbInstance = new InsightDB();
  }
  return _dbInstance;
}