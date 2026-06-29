var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/db/src/client.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

// packages/db/src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  assetTopics: () => assetTopics,
  assetTopicsAssetIdx: () => assetTopicsAssetIdx,
  assetTopicsTopicIdx: () => assetTopicsTopicIdx,
  assets: () => assets,
  assetsEvidenceIdx: () => assetsEvidenceIdx,
  assetsStatusIdx: () => assetsStatusIdx,
  assetsTypeIdx: () => assetsTypeIdx,
  assetsUpdatedIdx: () => assetsUpdatedIdx,
  feedback: () => feedback,
  feedbackAssetIdx: () => feedbackAssetIdx,
  feedbackCreatedIdx: () => feedbackCreatedIdx,
  outputs: () => outputs,
  outputsAssetIdsIdx: () => outputsAssetIdsIdx,
  outputsCreatedIdx: () => outputsCreatedIdx,
  sourceItems: () => sourceItems,
  sourceItemsGuidIdx: () => sourceItemsGuidIdx,
  sourceItemsSourceIdx: () => sourceItemsSourceIdx,
  sourceItemsStatusIdx: () => sourceItemsStatusIdx,
  sources: () => sources,
  sourcesEnabledIdx: () => sourcesEnabledIdx,
  sourcesUrlIdx: () => sourcesUrlIdx,
  topicKernels: () => topicKernels,
  topicKernelsTopicIdx: () => topicKernelsTopicIdx,
  topics: () => topics,
  topicsSlugIdx: () => topicsSlugIdx,
  userKernels: () => userKernels,
  userKernelsCategoryIdx: () => userKernelsCategoryIdx,
  userKernelsStatusIdx: () => userKernelsStatusIdx,
  writingDrafts: () => writingDrafts,
  writingDraftsWritingIdx: () => writingDraftsWritingIdx,
  writingVersions: () => writingVersions,
  writingVersionsWritingIdx: () => writingVersionsWritingIdx
});
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { index } from "drizzle-orm/sqlite-core";
var assets = sqliteTable("assets", {
  // ===== 主键 =====
  id: text("id").primaryKey(),
  // ===== 类型与状态 =====
  type: text("type", { enum: ["light", "asset", "kernel"] }).notNull().default("light"),
  status: text("status", {
    enum: ["inbox", "sorting", "calibrating", "candidate", "in_use", "archived"]
  }).notNull().default("inbox"),
  // ===== 索引字段（用于筛选/搜索） =====
  title: text("title").notNull(),
  evidenceLevel: text("evidence_level", { enum: ["E0", "E1", "E2", "E3", "E4", "E5"] }).notNull().default("E0"),
  priority: text("priority", { enum: ["A", "B", "C"] }).default("C"),
  // tags 是 JSON 字符串数组（应用层做适配，可能是字符串或数组）
  tagsJson: text("tags_json").notNull().default("[]"),
  // 原始 source 字段（来源标识，不做筛选）
  source: text("source"),
  // source_type: 推断的来源类型（v0.1 只展示不筛选）
  sourceType: text("source_type", {
    enum: ["book", "knowledge_card", "project", "article", "original", "unknown"]
  }).default("unknown"),
  // ===== 预览字段（搜索结果/列表展示用） =====
  oneSentenceInsight: text("one_sentence_insight"),
  // 一句话洞察
  antiCommonSense: text("anti_common_sense"),
  // 反常识判断
  // ===== 文件位置（关键：指向权威 .md 文件） =====
  filePath: text("file_path").notNull(),
  // 绝对路径
  fileMtime: integer("file_mtime").notNull(),
  // 文件修改时间
  fileHash: text("file_hash").notNull(),
  // sha256（检测外部修改）
  // ===== 工作流统计 =====
  feedbackCount: integer("feedback_count").notNull().default(0),
  lastUsedAt: integer("last_used_at"),
  // 时间戳
  // ===== v1.8.0 主动判断加工系统 =====
  // 来源素材 ID（如果此资产来自粘贴的素材）
  sourceMaterialId: text("source_material_id"),
  // 7 维度评分总分（0-100，仅 status='candidate' 时有效）
  scoreTotal: integer("score_total").notNull().default(0),
  // 7 维度评分明细 JSON
  scoreBreakdownJson: text("score_breakdown_json").notNull().default("{}"),
  // 被引用次数（output 引用此 asset 时 +1）
  outputCount: integer("output_count").notNull().default(0),
  // Vincent 点"加工"的时间戳（从 candidate 升级到 in_use 的时间）
  processedAt: integer("processed_at"),
  // 是否建议沉淀为方法论（output_count >= 5 + feedback_count >= 1 时自动 true）
  isKernelCandidate: integer("is_kernel_candidate").notNull().default(0),
  // 是否已沉淀为我的方法论（Vincent 手动确认）
  isKernelApproved: integer("is_kernel_approved").notNull().default(0),
  // ===== 引用关系（v0.5 血脉图用）=====
  // 从 .md frontmatter 的 `related` 字段解析，存相关资产卡的 id 数组
  // 例：AI是分化加速器 → [asset_xxx_buffer, asset_yyy_org_formula]
  relatedIdsJson: text("related_ids_json").notNull().default("[]"),
  // ===== 时间戳 =====
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});
var outputs = sqliteTable("outputs", {
  id: text("id").primaryKey(),
  assetIdsJson: text("asset_ids_json").notNull(),
  // JSON 数组
  outputType: text("output_type", {
    enum: ["talk_script", "article_outline", "article_full", "writing", "speech", "book_note", "email"]
  }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  // 完整内容
  audience: text("audience"),
  // 使用对象
  status: text("status", { enum: ["draft", "used", "feedback_done"] }).notNull().default("draft"),
  // v0.9 写作场景扩展字段
  scaffoldJson: text("scaffold_json"),
  // 写作骨架（结构化大纲 JSON）
  templateType: text("template_type"),
  // 公众号长文 / 演讲稿 / 读书笔记 / null
  sourceUrl: text("source_url"),
  // 公众号发布 URL
  topicId: text("topic_id"),
  // 关联主题（写作来源主题）
  writingStatus: text("writing_status", {
    // 仅 writing 类型有值
    enum: ["scaffold", "draft", "published"]
  }).default("published"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});
var feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  outputId: text("output_id"),
  // 关联的输出（可空：直接对 asset 反馈）
  assetId: text("asset_id").notNull(),
  // 关联的资产
  scene: text("scene", {
    enum: ["client_talk", "article", "course", "colleague", "archive", "other"]
  }).notNull(),
  reaction: text("reaction"),
  // 客户原话/反应
  mostTouchedPoint: text("most_touched_point"),
  // 最触动点
  followUpQuestions: text("follow_up_questions"),
  // 客户追问
  evidenceLevelBefore: text("evidence_level_before", { enum: ["E0", "E1", "E2", "E3", "E4", "E5"] }),
  evidenceLevelAfter: text("evidence_level_after", { enum: ["E0", "E1", "E2", "E3", "E4", "E5"] }),
  createdAt: integer("created_at").notNull()
});
var assetsStatusIdx = index("assets_status_idx").on(assets.status);
var assetsTypeIdx = index("assets_type_idx").on(assets.type);
var assetsEvidenceIdx = index("assets_evidence_idx").on(assets.evidenceLevel);
var assetsUpdatedIdx = index("assets_updated_idx").on(assets.updatedAt);
var outputsAssetIdsIdx = index("outputs_asset_ids_idx").on(outputs.assetIdsJson);
var outputsCreatedIdx = index("outputs_created_idx").on(outputs.createdAt);
var feedbackAssetIdx = index("feedback_asset_idx").on(feedback.assetId);
var feedbackCreatedIdx = index("feedback_created_idx").on(feedback.createdAt);
var topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // "财务数字化" / "AI 落地" 等
  slug: text("slug").notNull().unique(),
  // URL 友好
  description: text("description"),
  // 主题描述
  // 主题下的核心判断（手动维护 / LLM 抽）
  coreBeliefsJson: text("core_beliefs_json").notNull().default("[]"),
  // 主题顺序（仪表盘排序用）
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});
var assetTopics = sqliteTable("asset_topics", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  topicId: text("topic_id").notNull(),
  confidence: integer("confidence").notNull().default(100),
  // 0-100
  assignedBy: text("assigned_by", { enum: ["human", "llm", "rule"] }).notNull().default("human"),
  createdAt: integer("created_at").notNull()
});
var topicsSlugIdx = index("topics_slug_idx").on(topics.slug);
var assetTopicsAssetIdx = index("asset_topics_asset_idx").on(assetTopics.assetId);
var assetTopicsTopicIdx = index("asset_topics_topic_idx").on(assetTopics.topicId);
var sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  // V1.9.2: 加 'reddit'（官方 RSS 端点，无需 RSSHub）
  // V1.9.1: 'twitter' + 'wechat-account'（需 RSSHub，公共实例被 Cloudflare 挡）
  // V1.9.0: 'rss'（直接 RSS）
  type: text("type", { enum: ["rss", "twitter", "wechat-account", "reddit"] }).notNull().default("rss"),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  enabled: integer("enabled").notNull().default(1),
  lastFetchedAt: integer("last_fetched_at"),
  lastError: text("last_error"),
  fetchIntervalMin: integer("fetch_interval_min").notNull().default(60),
  newItemsCount: integer("new_items_count").notNull().default(0),
  // 主页"待处理"用
  totalItemsCount: integer("total_items_count").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});
var sourcesUrlIdx = index("sources_url_idx").on(sources.url);
var sourcesEnabledIdx = index("sources_enabled_idx").on(sources.enabled);
var sourceItems = sqliteTable("source_items", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  guid: text("guid").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  excerpt: text("excerpt"),
  // 前 500 字摘要（避免 source_items 太大）
  content: text("content"),
  // 完整正文（V1.9.0 先不存，V1.9.1 优化）
  publishedAt: integer("published_at"),
  fetchedAt: integer("fetched_at").notNull(),
  status: text("status", { enum: ["new", "imported", "skipped"] }).notNull().default("new"),
  assetId: text("asset_id")
  // 关联 assets.id（imported 后填）
});
var sourceItemsSourceIdx = index("source_items_source_idx").on(sourceItems.sourceId);
var sourceItemsStatusIdx = index("source_items_status_idx").on(sourceItems.status);
var sourceItemsGuidIdx = index("source_items_guid_idx").on(sourceItems.sourceId, sourceItems.guid);
var topicKernels = sqliteTable("topic_kernels", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull().unique(),
  headline: text("headline").notNull(),
  // "组织治理 5 个核心判断"
  summary: text("summary").notNull(),
  // 200-500 字综合论述
  coreBeliefsJson: text("core_beliefs_json").notNull().default("[]"),
  // ["判断1", "判断2", ...] 3-5 个
  sourceAssetIdsJson: text("source_asset_ids_json").notNull().default("[]"),
  // ["asset_xxx", ...] 引用过的卡
  generatedAt: integer("generated_at").notNull(),
  generationModel: text("generation_model")
  // "deepseek-chat" / "manual" 等
});
var topicKernelsTopicIdx = index("topic_kernels_topic_idx").on(topicKernels.topicId);
var userKernels = sqliteTable("user_kernels", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  kind: text("kind").notNull().default("belief"),
  content: text("content").notNull(),
  confidence: integer("confidence").notNull().default(70),
  counterExample: text("counter_example"),
  scope: text("scope"),
  evidenceAssetIdsJson: text("evidence_asset_ids_json").notNull().default("[]"),
  referencedCount: integer("referenced_count").notNull().default(0),
  lastVerifiedAt: integer("last_verified_at"),
  status: text("status").notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});
var userKernelsCategoryIdx = index("user_kernels_category_idx").on(userKernels.category);
var userKernelsStatusIdx = index("user_kernels_status_idx").on(userKernels.status);
var writingDrafts = sqliteTable("writing_drafts", {
  id: text("id").primaryKey(),
  writingId: text("writing_id").notNull().unique(),
  content: text("content").notNull(),
  title: text("title"),
  updatedAt: integer("updated_at").notNull()
});
var writingDraftsWritingIdx = index("writing_drafts_writing_idx").on(writingDrafts.writingId);
var writingVersions = sqliteTable("writing_versions", {
  id: text("id").primaryKey(),
  writingId: text("writing_id").notNull(),
  content: text("content").notNull(),
  title: text("title"),
  note: text("note"),
  // "草稿自动保存" / "手动保存：完成第一稿" / "改写润色前快照"
  createdBy: text("created_by").notNull().default("manual"),
  // 'auto' | 'manual' | 'system'
  createdAt: integer("created_at").notNull()
});
var writingVersionsWritingIdx = index("writing_versions_writing_idx").on(writingVersions.writingId, writingVersions.createdAt);

// packages/db/src/client.ts
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
var _db = null;
var _sqlite = null;
var _initialized = false;
function resolveDbPath() {
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("file:")) {
    return resolve(url.slice(5));
  }
  if (process.env.INSIGHT_APP_DATA_DIR) {
    return resolve(process.env.INSIGHT_APP_DATA_DIR, "insight.db");
  }
  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, "apps/web/storage/insight.db"),
    // 脚本环境：cwd=根，要走 apps/web
    resolve(cwd, "storage/insight.db")
    // Next.js dev：cwd=apps/web，走 ./storage
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  if (process.env.NODE_ENV === "production" && process.resourcesPath) {
    const home = process.env.HOME || "/tmp";
    return resolve(home, "Library", "Application Support", "insight-os-desktop", "storage", "insight.db");
  }
  return candidates[0];
}
var SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'light',
  status TEXT NOT NULL DEFAULT 'inbox',
  title TEXT NOT NULL,
  evidence_level TEXT NOT NULL DEFAULT 'E0',
  priority TEXT DEFAULT 'C',
  tags_json TEXT NOT NULL DEFAULT '[]',
  source TEXT,
  source_type TEXT DEFAULT 'unknown',
  one_sentence_insight TEXT,
  anti_common_sense TEXT,
  file_path TEXT NOT NULL,
  file_mtime INTEGER NOT NULL,
  file_hash TEXT NOT NULL,
  feedback_count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  related_ids_json TEXT NOT NULL DEFAULT '[]',
  -- ===== v1.8.0 \u4E3B\u52A8\u5224\u65AD\u52A0\u5DE5\u7CFB\u7EDF =====
  source_material_id TEXT,
  score_total INTEGER NOT NULL DEFAULT 0,
  score_breakdown_json TEXT NOT NULL DEFAULT '{}',
  output_count INTEGER NOT NULL DEFAULT 0,
  processed_at INTEGER,
  is_kernel_candidate INTEGER NOT NULL DEFAULT 0,
  is_kernel_approved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS assets_status_idx ON assets(status);
CREATE INDEX IF NOT EXISTS assets_type_idx ON assets(type);
CREATE INDEX IF NOT EXISTS assets_evidence_idx ON assets(evidence_level);
CREATE INDEX IF NOT EXISTS assets_updated_idx ON assets(updated_at);
-- v1.8.0 \u7D22\u5F15\u79FB\u5230\u4E0B\u65B9\u517C\u5BB9\u65E7\u5E93\u5757\uFF08\u907F\u514D\u65E7\u5E93 CREATE INDEX \u5F15\u7528\u4E0D\u5B58\u5728\u5217\uFF09

CREATE TABLE IF NOT EXISTS outputs (
  id TEXT PRIMARY KEY,
  asset_ids_json TEXT NOT NULL,
  output_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scaffold_json TEXT,
  template_type TEXT,
  source_url TEXT,
  topic_id TEXT,
  writing_status TEXT DEFAULT 'published',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS outputs_asset_ids_idx ON outputs(asset_ids_json);
CREATE INDEX IF NOT EXISTS outputs_created_idx ON outputs(created_at);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  output_id TEXT,
  asset_id TEXT NOT NULL,
  scene TEXT NOT NULL,
  reaction TEXT,
  most_touched_point TEXT,
  follow_up_questions TEXT,
  evidence_level_before TEXT,
  evidence_level_after TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_asset_idx ON feedback(asset_id);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON feedback(created_at);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  core_beliefs_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS topics_slug_idx ON topics(slug);

CREATE TABLE IF NOT EXISTS asset_topics (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 100,
  assigned_by TEXT NOT NULL DEFAULT 'human',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS asset_topics_asset_idx ON asset_topics(asset_id);
CREATE INDEX IF NOT EXISTS asset_topics_topic_idx ON asset_topics(topic_id);

-- ===== v0.8 \u4E3B\u9898\u601D\u60F3\u5185\u6838 =====
-- \u4E00\u4E3B\u9898\u4E00 kernel\uFF1ALLM \u4ECE\u4E3B\u9898\u4E0B\u6240\u6709\u8D44\u4EA7\u5361\u603B\u7ED3 headline + summary + 3-5 \u4E2A\u6838\u5FC3\u5224\u65AD
CREATE TABLE IF NOT EXISTS topic_kernels (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL UNIQUE,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  core_beliefs_json TEXT NOT NULL DEFAULT '[]',
  source_asset_ids_json TEXT NOT NULL DEFAULT '[]',
  generated_at INTEGER NOT NULL,
  generation_model TEXT
);

CREATE INDEX IF NOT EXISTS topic_kernels_topic_idx ON topic_kernels(topic_id);

-- ===== v1.9.0 \u4FE1\u606F\u6E90\u8BA2\u9605 =====
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'rss' CHECK(type IN ('rss','twitter','wechat-account','reddit')),
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_fetched_at INTEGER,
  last_error TEXT,
  fetch_interval_min INTEGER NOT NULL DEFAULT 60,
  new_items_count INTEGER NOT NULL DEFAULT 0,
  total_items_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sources_url_idx ON sources(url);
CREATE INDEX IF NOT EXISTS sources_enabled_idx ON sources(enabled);

CREATE TABLE IF NOT EXISTS source_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  guid TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  excerpt TEXT,
  content TEXT,
  published_at INTEGER,
  fetched_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','imported','skipped')),
  asset_id TEXT,
  UNIQUE(source_id, guid)
);
CREATE INDEX IF NOT EXISTS source_items_source_idx ON source_items(source_id);
CREATE INDEX IF NOT EXISTS source_items_status_idx ON source_items(status);

-- ===== v1.4 Insight Kernel \u7528\u6237\u5224\u65AD\u534F\u8BAE =====
-- \u7528\u6237\u7EA7\u7684\u300C\u5224\u65AD\u5BAA\u6CD5\u300D\uFF1A\u6BCF\u6B21 LLM \u8C03\u7528\u81EA\u52A8\u6CE8\u5165 system prompt
-- 4 \u7C7B\u522B\uFF08belief/contrarian/expertise/challenge\uFF09+ 4 \u5B57\u6BB5\uFF08content/confidence/counterExample/scope\uFF09
-- 6 \u6761 ship-ready \u9ED8\u8BA4\u7531 /api/kernel/seed-default \u79CD\u5B50
CREATE TABLE IF NOT EXISTS user_kernels (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('belief','contrarian','expertise','challenge','principle')),
  kind TEXT NOT NULL DEFAULT 'belief' CHECK(kind IN ('belief','hypothesis','experience','contrarian','principle')),
  content TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 70,
  counter_example TEXT,
  scope TEXT,
  evidence_asset_ids_json TEXT NOT NULL DEFAULT '[]',
  referenced_count INTEGER NOT NULL DEFAULT 0,
  last_verified_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS user_kernels_category_idx ON user_kernels(category);
CREATE INDEX IF NOT EXISTS user_kernels_status_idx ON user_kernels(status);

-- ===== writing_drafts + writing_versions v1.5 \u5199\u4F5C\u8349\u7A3F\u81EA\u52A8\u6062\u590D + \u7248\u672C\u5386\u53F2 =====
CREATE TABLE IF NOT EXISTS writing_drafts (
  id TEXT PRIMARY KEY,
  writing_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  title TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS writing_drafts_writing_idx ON writing_drafts(writing_id);

CREATE TABLE IF NOT EXISTS writing_versions (
  id TEXT PRIMARY KEY,
  writing_id TEXT NOT NULL,
  content TEXT NOT NULL,
  title TEXT,
  note TEXT,
  created_by TEXT NOT NULL DEFAULT 'manual',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS writing_versions_writing_idx ON writing_versions(writing_id, created_at);

-- ===== \u5168\u6587\u641C\u7D22\uFF08FTS5\uFF09v0.3 =====
-- \u540C\u6B65 assets \u7684 title / insight / anti / tags
-- \u5BA2\u6237\u7AEF\u5199\u65F6\u4E0D\u9700\u8981\u624B\u52A8\u8C03 FTS\uFF0Ctrigger \u81EA\u52A8\u540C\u6B65
CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
  asset_id UNINDEXED,
  title,
  one_sentence_insight,
  anti_common_sense,
  tags,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- \u63D2\u5165\u540C\u6B65
CREATE TRIGGER IF NOT EXISTS assets_ai_fts AFTER INSERT ON assets BEGIN
  INSERT INTO assets_fts(asset_id, title, one_sentence_insight, anti_common_sense, tags)
  VALUES (NEW.id, COALESCE(NEW.title, ''), COALESCE(NEW.one_sentence_insight, ''), COALESCE(NEW.anti_common_sense, ''), COALESCE(NEW.tags_json, ''));
END;

-- \u66F4\u65B0\u540C\u6B65
CREATE TRIGGER IF NOT EXISTS assets_au_fts AFTER UPDATE ON assets BEGIN
  UPDATE assets_fts SET
    title = COALESCE(NEW.title, ''),
    one_sentence_insight = COALESCE(NEW.one_sentence_insight, ''),
    anti_common_sense = COALESCE(NEW.anti_common_sense, ''),
    tags = COALESCE(NEW.tags_json, '')
  WHERE asset_id = OLD.id;
END;

-- \u5220\u9664\u540C\u6B65
CREATE TRIGGER IF NOT EXISTS assets_ad_fts AFTER DELETE ON assets BEGIN
  DELETE FROM assets_fts WHERE asset_id = OLD.id;
END;
`;
function initSchema(sqlite) {
  if (_initialized) return;
  sqlite.exec(SCHEMA_SQL);
  try {
    const assetsCols = sqlite.prepare("PRAGMA table_info(assets)").all();
    if (!assetsCols.some((c) => c.name === "related_ids_json")) {
      sqlite.exec("ALTER TABLE assets ADD COLUMN related_ids_json TEXT NOT NULL DEFAULT '[]'");
    }
    const addAssetsCol = (col, def) => {
      if (!assetsCols.some((c) => c.name === col)) {
        sqlite.exec(`ALTER TABLE assets ADD COLUMN ${col} ${def}`);
      }
    };
    addAssetsCol("source_material_id", "TEXT");
    addAssetsCol("score_total", "INTEGER NOT NULL DEFAULT 0");
    addAssetsCol("score_breakdown_json", "TEXT NOT NULL DEFAULT '{}'");
    addAssetsCol("output_count", "INTEGER NOT NULL DEFAULT 0");
    addAssetsCol("processed_at", "INTEGER");
    addAssetsCol("is_kernel_candidate", "INTEGER NOT NULL DEFAULT 0");
    addAssetsCol("is_kernel_approved", "INTEGER NOT NULL DEFAULT 0");
    sqlite.exec("CREATE INDEX IF NOT EXISTS assets_score_idx ON assets(score_total)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS assets_kernel_candidate_idx ON assets(is_kernel_candidate) WHERE is_kernel_candidate = 1");
    sqlite.exec("CREATE INDEX IF NOT EXISTS assets_kernel_approved_idx ON assets(is_kernel_approved) WHERE is_kernel_approved = 1");
    const outputsCols = sqlite.prepare("PRAGMA table_info(outputs)").all();
    const addCol = (col, def) => {
      if (!outputsCols.some((c) => c.name === col)) {
        sqlite.exec(`ALTER TABLE outputs ADD COLUMN ${col} ${def}`);
      }
    };
    addCol("scaffold_json", "TEXT");
    addCol("template_type", "TEXT");
    addCol("source_url", "TEXT");
    addCol("topic_id", "TEXT");
    addCol("writing_status", "TEXT DEFAULT 'published'");
    sqlite.exec("CREATE INDEX IF NOT EXISTS outputs_topic_idx ON outputs(topic_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS outputs_writing_status_idx ON outputs(writing_status)");
  } catch (e) {
  }
  const ftsCount = sqlite.prepare("SELECT count(*) as n FROM assets_fts").get();
  const assetCount = sqlite.prepare("SELECT count(*) as n FROM assets").get();
  if (ftsCount.n === 0 && assetCount.n > 0) {
    sqlite.exec(`
      INSERT INTO assets_fts(asset_id, title, one_sentence_insight, anti_common_sense, tags)
      SELECT id, COALESCE(title, ''), COALESCE(one_sentence_insight, ''), COALESCE(anti_common_sense, ''), COALESCE(tags_json, '')
      FROM assets;
    `);
  }
  _initialized = true;
}
function getDb() {
  if (_db) return _db;
  const dbPath = resolveDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  initSchema(_sqlite);
  _db = drizzle(_sqlite, { schema: schema_exports });
  return _db;
}
function getRawSqlite() {
  if (!_sqlite) {
    getDb();
  }
  return _sqlite;
}
function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
    _initialized = false;
  }
}

// packages/db/src/kernels.ts
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
function rowToKernel(row) {
  let evidenceAssetIds = [];
  try {
    evidenceAssetIds = JSON.parse(row.evidenceAssetIdsJson ?? "[]");
    if (!Array.isArray(evidenceAssetIds)) evidenceAssetIds = [];
  } catch {
    evidenceAssetIds = [];
  }
  return {
    id: row.id,
    category: row.category,
    kind: row.kind,
    content: row.content,
    confidence: row.confidence,
    counterExample: row.counterExample,
    scope: row.scope,
    evidenceAssetIds,
    referencedCount: row.referencedCount,
    lastVerifiedAt: row.lastVerifiedAt,
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
function listUserKernels(opts = {}) {
  const db = getDb();
  const status = opts.status ?? "active";
  let q = db.select().from(userKernels);
  if (status !== "all") {
    q = q.where(eq(userKernels.status, status));
  }
  const rows = q.orderBy(userKernels.sortOrder, desc(userKernels.confidence)).all();
  let result = rows.map(rowToKernel);
  if (opts.category) {
    result = result.filter((r) => r.category === opts.category);
  }
  return result;
}
function getUserKernel(id) {
  const db = getDb();
  const row = db.select().from(userKernels).where(eq(userKernels.id, id)).get();
  return row ? rowToKernel(row) : null;
}
function addUserKernel(input) {
  const db = getDb();
  const id = `kernel_${randomUUID()}`;
  const now = Math.floor(Date.now() / 1e3);
  db.insert(userKernels).values({
    id,
    category: input.category,
    kind: input.kind ?? (input.category === "contrarian" ? "contrarian" : "belief"),
    content: input.content,
    confidence: input.confidence ?? 70,
    counterExample: input.counterExample ?? null,
    scope: input.scope ?? null,
    evidenceAssetIdsJson: JSON.stringify(input.evidenceAssetIds ?? []),
    referencedCount: 0,
    lastVerifiedAt: null,
    status: "active",
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now
  }).run();
  return id;
}
function updateUserKernel(id, patch) {
  const db = getDb();
  const existing = db.select().from(userKernels).where(eq(userKernels.id, id)).get();
  if (!existing) throw new Error(`Kernel ${id} not found`);
  const now = Math.floor(Date.now() / 1e3);
  const updates = { updatedAt: now };
  if (patch.category !== void 0) updates.category = patch.category;
  if (patch.kind !== void 0) updates.kind = patch.kind;
  if (patch.content !== void 0) updates.content = patch.content;
  if (patch.confidence !== void 0) updates.confidence = patch.confidence;
  if (patch.counterExample !== void 0) updates.counterExample = patch.counterExample;
  if (patch.scope !== void 0) updates.scope = patch.scope;
  if (patch.evidenceAssetIds !== void 0) {
    updates.evidenceAssetIdsJson = JSON.stringify(patch.evidenceAssetIds);
  }
  if (patch.sortOrder !== void 0) updates.sortOrder = patch.sortOrder;
  db.update(userKernels).set(updates).where(eq(userKernels.id, id)).run();
}
function archiveUserKernel(id) {
  const db = getDb();
  db.update(userKernels).set({ status: "archived", updatedAt: Math.floor(Date.now() / 1e3) }).where(eq(userKernels.id, id)).run();
}
function reactivateUserKernel(id) {
  const db = getDb();
  db.update(userKernels).set({ status: "active", updatedAt: Math.floor(Date.now() / 1e3) }).where(eq(userKernels.id, id)).run();
}
function bumpReferencedCount(id, delta = 1) {
  const db = getDb();
  const current = db.select({ c: userKernels.referencedCount }).from(userKernels).where(eq(userKernels.id, id)).get();
  const newCount = (current?.c ?? 0) + delta;
  db.update(userKernels).set({ referencedCount: newCount }).where(eq(userKernels.id, id)).run();
}
function verifyUserKernel(id) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1e3);
  db.update(userKernels).set({ lastVerifiedAt: now, updatedAt: now }).where(eq(userKernels.id, id)).run();
}
function getActiveKernelsForInjection() {
  return listUserKernels({ status: "active" }).map((r) => ({
    category: r.category,
    content: r.content,
    confidence: r.confidence,
    counterExample: r.counterExample,
    scope: r.scope
  }));
}
function getUserKernelStats() {
  const all = listUserKernels({ status: "all" });
  const active = all.filter((r) => r.status === "active");
  const byCategory = { belief: 0, contrarian: 0, expertise: 0, challenge: 0 };
  for (const r of active) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  const avgConfidence = active.length > 0 ? Math.round(active.reduce((s, r) => s + r.confidence, 0) / active.length) : 0;
  const totalReferenced = active.reduce((s, r) => s + r.referencedCount, 0);
  return {
    total: all.length,
    active: active.length,
    archived: all.length - active.length,
    byCategory,
    avgConfidence,
    totalReferenced
  };
}
export {
  addUserKernel,
  archiveUserKernel,
  assetTopics,
  assetTopicsAssetIdx,
  assetTopicsTopicIdx,
  assets,
  assetsEvidenceIdx,
  assetsStatusIdx,
  assetsTypeIdx,
  assetsUpdatedIdx,
  bumpReferencedCount,
  closeDb,
  feedback,
  feedbackAssetIdx,
  feedbackCreatedIdx,
  getActiveKernelsForInjection,
  getDb,
  getRawSqlite,
  getUserKernel,
  getUserKernelStats,
  listUserKernels,
  outputs,
  outputsAssetIdsIdx,
  outputsCreatedIdx,
  reactivateUserKernel,
  sourceItems,
  sourceItemsGuidIdx,
  sourceItemsSourceIdx,
  sourceItemsStatusIdx,
  sources,
  sourcesEnabledIdx,
  sourcesUrlIdx,
  topicKernels,
  topicKernelsTopicIdx,
  topics,
  topicsSlugIdx,
  updateUserKernel,
  userKernels,
  userKernelsCategoryIdx,
  userKernelsStatusIdx,
  verifyUserKernel,
  writingDrafts,
  writingDraftsWritingIdx,
  writingVersions,
  writingVersionsWritingIdx
};
