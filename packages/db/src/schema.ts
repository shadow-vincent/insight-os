/**
 * Insight OS · 数据库 Schema
 *
 * 核心设计：.md 文件是权威源，本表只是索引。
 * 不在数据库里存长文本（raw_content、boundary、symptoms 等），
 * 这些都存在 .md 文件里。
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * assets 表 —— 轻量卡 + 资产卡 + 内核卡（用 type 区分）
 *
 * type: 卡片类型
 *   - light: 轻量卡（LLM 整理后，未校准）
 *   - asset: 资产卡（已校准 + 人工确认）
 *   - kernel: 内核卡（v0.2 再做，v0.1 占位）
 *
 * status: 工作流状态
 *   - inbox: 在收集箱（原始输入，未整理）
 *   - sorting: 整理中
 *   - calibrating: 校准中
 *   - candidate: 候选池（待人工确认升级）
 *   - in_use: 已入库资产库
 *   - archived: 已归档
 *
 * evidence_level: E0-E5（PRD 第 7.7 节）
 *   - E0: 纯观点，暂无案例
 *   - E1: 有类比案例
 *   - E2: 有真实方案或项目观察
 *   - E3: 在客户沟通中获得共鸣
 *   - E4: 进入方案并被客户认可
 *   - E5: 形成可复用工具、课程或服务模块
 */
export const assets = sqliteTable('assets', {
  // ===== 主键 =====
  id: text('id').primaryKey(),

  // ===== 类型与状态 =====
  type: text('type', { enum: ['light', 'asset', 'kernel'] }).notNull().default('light'),
  status: text('status', {
    enum: ['inbox', 'sorting', 'calibrating', 'candidate', 'in_use', 'archived'],
  }).notNull().default('inbox'),

  // ===== 索引字段（用于筛选/搜索） =====
  title: text('title').notNull(),
  evidenceLevel: text('evidence_level', { enum: ['E0', 'E1', 'E2', 'E3', 'E4', 'E5'] })
    .notNull()
    .default('E0'),
  priority: text('priority', { enum: ['A', 'B', 'C'] }).default('C'),

  // tags 是 JSON 字符串数组（应用层做适配，可能是字符串或数组）
  tagsJson: text('tags_json').notNull().default('[]'),
  // 原始 source 字段（来源标识，不做筛选）
  source: text('source'),
  // source_type: 推断的来源类型（v0.1 只展示不筛选）
  sourceType: text('source_type', {
    enum: ['book', 'knowledge_card', 'project', 'article', 'original', 'unknown'],
  }).default('unknown'),

  // ===== 预览字段（搜索结果/列表展示用） =====
  oneSentenceInsight: text('one_sentence_insight'), // 一句话洞察
  antiCommonSense: text('anti_common_sense'), // 反常识判断

  // ===== 文件位置（关键：指向权威 .md 文件） =====
  filePath: text('file_path').notNull(), // 绝对路径
  fileMtime: integer('file_mtime').notNull(), // 文件修改时间
  fileHash: text('file_hash').notNull(), // sha256（检测外部修改）

  // ===== 工作流统计 =====
  feedbackCount: integer('feedback_count').notNull().default(0),
  lastUsedAt: integer('last_used_at'), // 时间戳

  // ===== 引用关系（v0.5 血脉图用）=====
  // 从 .md frontmatter 的 `related` 字段解析，存相关资产卡的 id 数组
  // 例：AI是分化加速器 → [asset_xxx_buffer, asset_yyy_org_formula]
  relatedIdsJson: text('related_ids_json').notNull().default('[]'),

  // ===== 时间戳 =====
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * outputs 表 —— 场景输出记录
 *
 * 一个输出可以引用多张资产卡（assetIdsJson 是数组）
 * outputType: 输出场景
 *   - talk_script: 客户沟通话术
 *   - article_outline: 公众号文章大纲
 *
 * status:
 *   - draft: 草稿（用户编辑中）
 *   - used: 已使用（销售/客户用了）
 *   - feedback_done: 已记录反馈
 */
export const outputs = sqliteTable('outputs', {
  id: text('id').primaryKey(),
  assetIdsJson: text('asset_ids_json').notNull(), // JSON 数组
  outputType: text('output_type', {
    enum: ['talk_script', 'article_outline', 'article_full', 'writing', 'speech', 'book_note', 'email'],
  }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(), // 完整内容
  audience: text('audience'), // 使用对象
  status: text('status', { enum: ['draft', 'used', 'feedback_done'] })
    .notNull()
    .default('draft'),
  // v0.9 写作场景扩展字段
  scaffoldJson: text('scaffold_json'),   // 写作骨架（结构化大纲 JSON）
  templateType: text('template_type'),    // 公众号长文 / 演讲稿 / 读书笔记 / null
  sourceUrl: text('source_url'),          // 公众号发布 URL
  topicId: text('topic_id'),              // 关联主题（写作来源主题）
  writingStatus: text('writing_status', { // 仅 writing 类型有值
    enum: ['scaffold', 'draft', 'published'],
  }).default('published'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * feedback 表 —— 反馈记录（v0.1 最小集）
 *
 * 一条反馈关联一个 output，反过来 output 关联多张 asset
 * 这里同时存 assetId 便于直接查询
 */
export const feedback = sqliteTable('feedback', {
  id: text('id').primaryKey(),
  outputId: text('output_id'), // 关联的输出（可空：直接对 asset 反馈）
  assetId: text('asset_id').notNull(), // 关联的资产
  scene: text('scene', {
    enum: ['client_talk', 'article', 'course', 'colleague', 'archive', 'other'],
  }).notNull(),
  reaction: text('reaction'), // 客户原话/反应
  mostTouchedPoint: text('most_touched_point'), // 最触动点
  followUpQuestions: text('follow_up_questions'), // 客户追问
  evidenceLevelBefore: text('evidence_level_before', { enum: ['E0', 'E1', 'E2', 'E3', 'E4', 'E5'] }),
  evidenceLevelAfter: text('evidence_level_after', { enum: ['E0', 'E1', 'E2', 'E3', 'E4', 'E5'] }),
  createdAt: integer('created_at').notNull(),
});

/**
 * 索引（搜索性能）
 */
import { index } from 'drizzle-orm/sqlite-core';

export const assetsStatusIdx = index('assets_status_idx').on(assets.status);
export const assetsTypeIdx = index('assets_type_idx').on(assets.type);
export const assetsEvidenceIdx = index('assets_evidence_idx').on(assets.evidenceLevel);
export const assetsUpdatedIdx = index('assets_updated_idx').on(assets.updatedAt);

export const outputsAssetIdsIdx = index('outputs_asset_ids_idx').on(outputs.assetIdsJson);
export const outputsCreatedIdx = index('outputs_created_idx').on(outputs.createdAt);

export const feedbackAssetIdx = index('feedback_asset_idx').on(feedback.assetId);
export const feedbackCreatedIdx = index('feedback_created_idx').on(feedback.createdAt);

/**
 * topics 表 —— 资产主题（v0.2 资产地图用）
 *
 * 一张资产卡可以属于多个主题
 * 一个主题下可以有多张资产卡
 * 通过 asset_topics 关联表维护
 */
export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),                    // "财务数字化" / "AI 落地" 等
  slug: text('slug').notNull().unique(),           // URL 友好
  description: text('description'),                // 主题描述
  // 主题下的核心判断（手动维护 / LLM 抽）
  coreBeliefsJson: text('core_beliefs_json').notNull().default('[]'),
  // 主题顺序（仪表盘排序用）
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * asset_topics 表 —— 资产和主题的多对多关联
 *
 * confidence: LLM 自动归类时的置信度（0-1）
 *   - 1.0: 人工指定
 *   - 0.5-0.9: LLM 推断
 * assignedBy: 'human' | 'llm' | 'rule'
 */
export const assetTopics = sqliteTable('asset_topics', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull(),
  topicId: text('topic_id').notNull(),
  confidence: integer('confidence').notNull().default(100), // 0-100
  assignedBy: text('assigned_by', { enum: ['human', 'llm', 'rule'] }).notNull().default('human'),
  createdAt: integer('created_at').notNull(),
});

export const topicsSlugIdx = index('topics_slug_idx').on(topics.slug);
export const assetTopicsAssetIdx = index('asset_topics_asset_idx').on(assetTopics.assetId);
export const assetTopicsTopicIdx = index('asset_topics_topic_idx').on(assetTopics.topicId);

/**
 * topic_kernels 表 —— 主题思想内核（v0.8）
 *
 * 一个主题对应 0 或 1 个 kernel（LLM 从主题下所有资产卡总结出来）
 * 包含：headline（一句话）+ summary（200-500 字综合）+ coreBeliefs（3-5 个核心判断）
 * sourceAssetIds 用于追溯 kernel 引用了哪些卡
 */
export const topicKernels = sqliteTable('topic_kernels', {
  id: text('id').primaryKey(),
  topicId: text('topic_id').notNull().unique(),
  headline: text('headline').notNull(),                              // "组织治理 5 个核心判断"
  summary: text('summary').notNull(),                                // 200-500 字综合论述
  coreBeliefsJson: text('core_beliefs_json').notNull().default('[]'), // ["判断1", "判断2", ...] 3-5 个
  sourceAssetIdsJson: text('source_asset_ids_json').notNull().default('[]'), // ["asset_xxx", ...] 引用过的卡
  generatedAt: integer('generated_at').notNull(),
  generationModel: text('generation_model'),                         // "deepseek-chat" / "manual" 等
});

export const topicKernelsTopicIdx = index('topic_kernels_topic_idx').on(topicKernels.topicId);
