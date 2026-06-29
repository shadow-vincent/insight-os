// packages/db/src/schema.ts
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
export {
  assetTopics,
  assetTopicsAssetIdx,
  assetTopicsTopicIdx,
  assets,
  assetsEvidenceIdx,
  assetsStatusIdx,
  assetsTypeIdx,
  assetsUpdatedIdx,
  feedback,
  feedbackAssetIdx,
  feedbackCreatedIdx,
  outputs,
  outputsAssetIdsIdx,
  outputsCreatedIdx,
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
  userKernels,
  userKernelsCategoryIdx,
  userKernelsStatusIdx,
  writingDrafts,
  writingDraftsWritingIdx,
  writingVersions,
  writingVersionsWritingIdx
};
