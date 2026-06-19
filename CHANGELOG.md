# Changelog

All notable changes to Insight Asset OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-19 — "发布准备"

### Added
- **Onboarding 引导**：首次启动 3 步配置（LLM Key → Vault 路径 → 示例数据）
- **示例数据 seed**：8 张示例资产 + 2 个示例主题 + 1 个内核 + 1 个示例写作
- **/api/system/status**：检测系统状态（用于引导）
- **README + LICENSE + CHANGELOG**（GitHub 发布准备）
- **隐私隔离**：vault 路径 OS-aware 默认值（`${HOME}/Documents/knowledge_base`）
- **bug fix**：3 处 API route 硬编码 `/Users/vincent/Documents/knowledge_base/` → 改用 `config.paths.vaultPath`

### Changed
- **CTA 颜色统一**：`var(--accent, #1d4ed8)` → `var(--primary)`（42 → 21 处，0 fallback 蓝色）
- **emoji 第一波换 SVG**：写作模板（📝🎤📖）/ inbox tab（✏️🔗📎）→ SVG 图标

### Fixed
- 10 个生产 build blocker：TS implicit any / LLMResult model 字段 / templateType 类型断言 / toast 子组件 prop 透传 / Sidebar JSX 命名空间 / tsconfig allowImportingTsExtensions / MATURITY_MAP 重复 key / inbox useSearchParams Suspense / normalize-upgrade return type / Candidates 组件 toast 注入

## [0.10.0] - 2026-06-19 — "今日待办 + 进化时间线 + 写作复盘"

### Added
- **仪表盘"今日待办" 3 栏**：待校准（候选池）/ 可输出（30 天没用的 E2+ 资产）/ 待反馈（已发布但没记反馈的输出）
- **资产详情页"进化时间线"**：feedback + output 按时间排列，每张卡能"看见自己怎么变"
- **写作复盘仪表盘**：本月写作 N 篇 + 引用 X 张卡 + 反复引用的真核心（≥2 次）
- **写作场景 UI 侧边栏入口**：仪表盘 hero + 主题页 kernel 旁

## [0.9.0] - 2026-06-19 — "写作工作流"

### Added
- **写作 4 步向导**：选主题 → 选判断 → 选卡 → 选模板（公众号长文 / 演讲稿 / 读书笔记）
- **写作骨架生成**：`/api/writing/scaffold` — LLM 提炼 4-6 节结构化大纲
- **内嵌 markdown 编辑器**：textarea + 衬线字体 + 自动保存
- **写作陪练 3 动作**：`/api/writing/companion`
  - 反方观点（3 个不同角度问题）
  - 推荐能引用的卡（同主题资产）
  - 重复论点检测（过去 6 个月输出）
- **写作反哺**：发布时自动给支撑卡 `feedback_count` + 1 + `last_used_at` 更新

### Schema
- `outputs` 加 5 字段：`scaffold_json` / `template_type` / `source_url` / `topic_id` / `writing_status`

## [0.8.0] - 2026-06-19 — "思想内核"

### Added
- **topic_kernels 表**：每主题 1 个内核
- **`/api/topics/[id]/kernel`** 端点：GET / POST（生成）/ DELETE
- **主题思想内核 prompt**：从主题下所有卡总结 3-5 条反常识判断，每条引用源卡
- **主题页 kernel 展示**：浅蓝渐变 card + headline + summary + 5 条核心判断
- **洞察助手读 kernel**：`meta_query` 路径识别"X 主题核心思想"

## [0.7.0] - 2026-06-18 — "洞察助手"

### Added
- **/api/assistant/chat** SSE 端点：6 事件协议（meta/cards/data/delta/followUp/done）
- **AssistantButton** + **AssistantDrawer**：浮动按钮 + 抽屉式聊天
- **多步 ReAct（multi_step）**：LLM 路由器可返回 1-3 步计划，串行执行 + 综合总结
- **写作场景集成**：洞察助手可调用 search / meta_query / multi_output / writing_scaffold

## [0.6.0] - 2026-06-18 — "血脉图（Page Graph）"

### Added
- **双 tab 图谱**：血脉图（Pedigree 布局）+ 全景图（react-force-graph-2d 力导向）
- **血脉图 5 维视觉编码**：E 等级 / 优先级 / 大小 / 角色 / 中心位置
- **浅色 palette** + 不跟系统深色模式

## [0.5.0] - 2026-06-17 — "资产图谱"

### Added
- **/api/graph** 端点：nodes（带 relatedIds）+ links
- **react-force-graph-2d** 全景图：1 度邻居聚焦 + 证据等级过滤
- **assets.related_ids_json** schema 字段

## [0.4.0] - 2026-06-17 — "仪表盘 + 主题切换"

### Added
- **双主题切换**：`theme-blue`（深蓝冷白）/ `theme-green`（深墨绿暖米白）
- **GLM 风格仪表盘**：Hero / 统计卡 / 证据分布 / 主题热力气泡 / 活动 feed
- **Toast 系统**：v0.4 末替代 alert
- **字号提档 v0.4.5**：body 15px / 行高 1.6

## [0.3.0] - 2026-06-16 — "全文搜索 + ⌘K"

### Added
- **FTS5 全文搜索**：assets_fts 虚表 + 同步 trigger
- **GlobalSearchModal**：⌘K 调出
- **Sidebar 资产库** 入口
- **候选池 promote** 走 LLM upgrade 12 章节

## [0.2.0] - 2026-06-15 — "资产地图"

### Added
- **主题分类**：topics + asset_topics 多对多关联
- **资产地图页** /map：主题列表 + 统计 + top 资产
- **LLM 自动归类**：`/api/topics/classify` + `/api/topics/reclassify`
- **多卡联合输出**：`/api/output/multi` + Prompt ⑤

## [0.1.0] - 2026-06-14 — "全闭环 MVP"

### Added
- 资产库 / 收集箱 / 候选池 / 输出历史
- SQLite + Drizzle ORM schema
- LLM 12 章节资产升级
- Markdown indexer 同步
- 配置管理（LLM Key + 路径）

---

[1.0.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v1.0.0
[0.10.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v0.10.0
[0.9.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v0.9.0
[0.8.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v0.8.0
[0.7.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v0.7.0
[0.6.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v0.6.0
[0.5.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v0.5.0
[0.4.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v0.4.0
[0.3.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v0.3.0
[0.2.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v0.2.0
[0.1.0]: https://github.com/yourusername/insight-asset-os/releases/tag/v0.1.0
