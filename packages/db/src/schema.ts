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

  // ===== v1.8.0 主动判断加工系统 =====
  // 来源素材 ID（如果此资产来自粘贴的素材）
  sourceMaterialId: text('source_material_id'),
  // 7 维度评分总分（0-100，仅 status='candidate' 时有效）
  scoreTotal: integer('score_total').notNull().default(0),
  // 7 维度评分明细 JSON
  scoreBreakdownJson: text('score_breakdown_json').notNull().default('{}'),
  // 被引用次数（output 引用此 asset 时 +1）
  outputCount: integer('output_count').notNull().default(0),
  // Vincent 点"加工"的时间戳（从 candidate 升级到 in_use 的时间）
  processedAt: integer('processed_at'),
  // 是否建议沉淀为方法论（output_count >= 5 + feedback_count >= 1 时自动 true）
  isKernelCandidate: integer('is_kernel_candidate').notNull().default(0),
  // 是否已沉淀为我的方法论（Vincent 手动确认）
  isKernelApproved: integer('is_kernel_approved').notNull().default(0),

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
 * sources 表 —— 信息源订阅（v1.9.0）
 *
 * V1.9.0 只支持 type='rss'，V1.9.1+ 扩展 twitter / wechat-account
 * url: RSS feed URL
 * fetchIntervalMin: 默认 60 分钟抓一次
 * lastFetchedAt / lastError: 调试用，记录最近一次同步状态
 */
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  // V1.9.2: 加 'reddit'（官方 RSS 端点，无需 RSSHub）
  // V1.9.1: 'twitter' + 'wechat-account'（需 RSSHub，公共实例被 Cloudflare 挡）
  // V1.9.0: 'rss'（直接 RSS）
  type: text('type', { enum: ['rss', 'twitter', 'wechat-account', 'reddit'] }).notNull().default('rss'),
  url: text('url').notNull().unique(),
  title: text('title').notNull(),
  enabled: integer('enabled').notNull().default(1),
  lastFetchedAt: integer('last_fetched_at'),
  lastError: text('last_error'),
  fetchIntervalMin: integer('fetch_interval_min').notNull().default(60),
  newItemsCount: integer('new_items_count').notNull().default(0), // 主页"待处理"用
  totalItemsCount: integer('total_items_count').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const sourcesUrlIdx = index('sources_url_idx').on(sources.url);
export const sourcesEnabledIdx = index('sources_enabled_idx').on(sources.enabled);

/**
 * source_items 表 —— 抓来的内容（v1.9.0）
 *
 * (source_id, guid) UNIQUE 去重（同一篇文章多次抓不会被重复入库）
 * status:
 *   - new:        新抓到的，UI 显示在主页"📡 信息源"section
 *   - imported:   已调 intake 进 assets，assetId 关联
 *   - skipped:    用户主动跳过（点击"忽略"按钮）
 */
export const sourceItems = sqliteTable('source_items', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  guid: text('guid').notNull(),
  title: text('title').notNull(),
  url: text('url'),
  excerpt: text('excerpt'),                          // 前 500 字摘要（避免 source_items 太大）
  content: text('content'),                          // 完整正文（V1.9.0 先不存，V1.9.1 优化）
  publishedAt: integer('published_at'),
  fetchedAt: integer('fetched_at').notNull(),
  status: text('status', { enum: ['new', 'imported', 'skipped'] }).notNull().default('new'),
  assetId: text('asset_id'),                         // 关联 assets.id（imported 后填）
});

export const sourceItemsSourceIdx = index('source_items_source_idx').on(sourceItems.sourceId);
export const sourceItemsStatusIdx = index('source_items_status_idx').on(sourceItems.status);
export const sourceItemsGuidIdx = index('source_items_guid_idx').on(sourceItems.sourceId, sourceItems.guid);

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

/**
 * user_kernels 表 —— Insight Kernel 用户判断协议（v1.4）
 *
 * 跟 topic_kernels（主题级 LLM 总结）不同，这是**用户级**的"判断宪法"：
 * - 每次 LLM 调用自动注入 system prompt
 * - 用户自己写 / 改 / 删 / 归档
 * - 6 条 ship-ready 默认 + onboarding 种子
 *
 * 4 类别（与 prototype insight-kernel-v2 一致）：
 *   - belief:       底层信念（长期价值主张 / 哲学立场）
 *   - contrarian:   反常识判断（反对主流叙事的判断）
 *   - expertise:    擅长问题域（被验证过能力的领域）
 *   - challenge:    想挑战的常识（想消灭 / 重塑的行业套话）
 *
 * 4 关键字段：
 *   - content:         一句话判断（最核心）
 *   - confidence:      置信度 0-100（避免教条）
 *   - counterExample:  强制反例（什么时候不成立）
 *   - scope:           适用场景（如"客户咨询 · 公众号"）
 *
 * 额外字段：
 *   - kind: 信念类型（belief/hypothesis/experience/contrarian）—— 区分确定性
 *   - evidenceAssetIdsJson: 关联证据资产（不建独立 evidence 表，复用现有 assets）
 *   - referencedCount: 被 LLM 引用次数（统计用）
 *   - lastVerifiedAt: 最后验证时间（防过期判断）
 *   - status: active / archived
 */
export const userKernels = sqliteTable('user_kernels', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  kind: text('kind').notNull().default('belief'),
  content: text('content').notNull(),
  confidence: integer('confidence').notNull().default(70),
  counterExample: text('counter_example'),
  scope: text('scope'),
  evidenceAssetIdsJson: text('evidence_asset_ids_json').notNull().default('[]'),
  referencedCount: integer('referenced_count').notNull().default(0),
  lastVerifiedAt: integer('last_verified_at'),
  status: text('status').notNull().default('active'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const userKernelsCategoryIdx = index('user_kernels_category_idx').on(userKernels.category);
export const userKernelsStatusIdx = index('user_kernels_status_idx').on(userKernels.status);

/**
 * writing_drafts 表 —— 写作草稿自动保存（v1.5）
 *
 * 每个 writing 最多 1 行 draft（覆盖式保存），区别于 writing_versions（历史版本，多行）
 * - debounce 3 秒自动保存
 * - 页面打开时优先加载 draft（比 outputs.content 新）
 * - published 状态时停止保存
 */
export const writingDrafts = sqliteTable('writing_drafts', {
  id: text('id').primaryKey(),
  writingId: text('writing_id').notNull().unique(),
  content: text('content').notNull(),
  title: text('title'),
  updatedAt: integer('updated_at').notNull(),
});

export const writingDraftsWritingIdx = index('writing_drafts_writing_idx').on(writingDrafts.writingId);

/**
 * writing_versions 表 —— 写作历史版本（v1.5）
 *
 * 每次"手动保存版本"或"重大改动前自动快照"创建一行
 * - 保留最近 20 个版本（超出自动清旧）
 * - 恢复版本 = 写入 outputs.content + writing_drafts.content
 */
export const writingVersions = sqliteTable('writing_versions', {
  id: text('id').primaryKey(),
  writingId: text('writing_id').notNull(),
  content: text('content').notNull(),
  title: text('title'),
  note: text('note'),  // "草稿自动保存" / "手动保存：完成第一稿" / "改写润色前快照"
  createdBy: text('created_by').notNull().default('manual'),  // 'auto' | 'manual' | 'system'
  createdAt: integer('created_at').notNull(),
});

export const writingVersionsWritingIdx = index('writing_versions_writing_idx').on(writingVersions.writingId, writingVersions.createdAt);

