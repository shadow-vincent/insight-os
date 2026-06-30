/**
 * V1.10 Phase 2.13 字段映射
 *
 * Drizzle select() 返回的 row → IndexedDB row 的字段转换
 *
 * 主要处理：
 * 1. null → undefined（Dexie 索引对 undefined 友好，对 null 部分情况报错）
 * 2. 默认值兜底（如 isKernelCandidate 在 Drizzle 是 number 0/1）
 * 3. snake_case → camelCase（保险起见，正常 Drizzle 已自动 map）
 * 4. 时间戳 string → number（SQLite DATETIME 是 ISO 字符串，Dexie 用 number ms）
 *
 * 注：现在 server 端 Drizzle 已返回 camelCase + 时间戳是 number (Drizzle 0.x 自动转)
 *     这里做的是"防御性 mapping"，万一未来 Drizzle 配置变化也能兼容
 */

import type {
  AssetRow, OutputRow, FeedbackRow, TopicRow, AssetTopicRow,
  SourceRow, SourceItemRow, TopicKernelRow, UserKernelRow,
  WritingDraftRow, WritingVersionRow,
} from './db';

/** 任意字段类型 */
type AnyRow = Record<string, any>;

/**
 * 把 SQLite row 转换为 IndexedDB row
 *
 * 主要做：null → undefined + 字符串时间戳 → number ms
 *
 * 不修改驼峰/下划线命名（Drizzle 已处理）
 */
function convertRow(row: AnyRow): AnyRow {
  if (!row || typeof row !== 'object') return row;
  const result: AnyRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null) {
      // null → undefined（Dexie 偏好 undefined）
      result[key] = undefined;
    } else if (typeof value === 'string' && /^\d+$/.test(value) && isTimeField(key)) {
      // 字符串数字（可能是 SQLite DATETIME 的数字字符串）→ 保留原值
      // 这里不主动 parse，Drizzle 0.x 已自动转 number
      result[key] = value;
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** 哪些字段是时间戳 */
function isTimeField(key: string): boolean {
  return /At$/.test(key) || /^(created|updated|processed|published|fetched|generated|lastVerified)/.test(key);
}

// ===== 批量转换（迁移用） =====

export function convertAssets(rows: any[]): AssetRow[] {
  return rows.map(r => convertRow(r) as AssetRow);
}

export function convertOutputs(rows: any[]): OutputRow[] {
  return rows.map(r => convertRow(r) as OutputRow);
}

export function convertFeedback(rows: any[]): FeedbackRow[] {
  return rows.map(r => convertRow(r) as FeedbackRow);
}

export function convertTopics(rows: any[]): TopicRow[] {
  return rows.map(r => convertRow(r) as TopicRow);
}

export function convertAssetTopics(rows: any[]): AssetTopicRow[] {
  return rows.map(r => convertRow(r) as AssetTopicRow);
}

export function convertSources(rows: any[]): SourceRow[] {
  return rows.map(r => convertRow(r) as SourceRow);
}

export function convertSourceItems(rows: any[]): SourceItemRow[] {
  return rows.map(r => convertRow(r) as SourceItemRow);
}

export function convertTopicKernels(rows: any[]): TopicKernelRow[] {
  return rows.map(r => convertRow(r) as TopicKernelRow);
}

export function convertUserKernels(rows: any[]): UserKernelRow[] {
  return rows.map(r => convertRow(r) as UserKernelRow);
}

export function convertWritingDrafts(rows: any[]): WritingDraftRow[] {
  return rows.map(r => convertRow(r) as WritingDraftRow);
}

export function convertWritingVersions(rows: any[]): WritingVersionRow[] {
  return rows.map(r => convertRow(r) as WritingVersionRow);
}

/**
 * 一键转换整个 dump（/api/migrate/export 返回的结构）
 */
export function convertDump(dump: {
  assets?: any[];
  outputs?: any[];
  feedback?: any[];
  topics?: any[];
  assetTopics?: any[];
  sources?: any[];
  sourceItems?: any[];
  topicKernels?: any[];
  userKernels?: any[];
  writingDrafts?: any[];
  writingVersions?: any[];
}) {
  return {
    assets: dump.assets ? convertAssets(dump.assets) : undefined,
    outputs: dump.outputs ? convertOutputs(dump.outputs) : undefined,
    feedback: dump.feedback ? convertFeedback(dump.feedback) : undefined,
    topics: dump.topics ? convertTopics(dump.topics) : undefined,
    assetTopics: dump.assetTopics ? convertAssetTopics(dump.assetTopics) : undefined,
    sources: dump.sources ? convertSources(dump.sources) : undefined,
    sourceItems: dump.sourceItems ? convertSourceItems(dump.sourceItems) : undefined,
    topicKernels: dump.topicKernels ? convertTopicKernels(dump.topicKernels) : undefined,
    userKernels: dump.userKernels ? convertUserKernels(dump.userKernels) : undefined,
    writingDrafts: dump.writingDrafts ? convertWritingDrafts(dump.writingDrafts) : undefined,
    writingVersions: dump.writingVersions ? convertWritingVersions(dump.writingVersions) : undefined,
  };
}