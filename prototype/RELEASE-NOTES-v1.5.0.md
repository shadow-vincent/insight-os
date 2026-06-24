# Insight Asset OS · V1.5.0

V1.5 是一个**大版本**——把 V1.0 以来所有"半成品"打磨成"可独立使用"的功能。

主要交付：
- **写作工作台重写**（textarea + 自动保存 + 版本历史 + 改写浮动工具条 + 多平台适配）
- **4 大新功能**（iCloud 同步 + 反向校准层 + Weekly Reflection + 嵌入图谱）
- **4 个 V1.6 限制改进**（diff 预览 + 反向校准 UI + Weekly 缓存 + embed 主题聚类）
- **博客文章图导出**（整篇博客 → 1080 宽竖版长图）
- **V1.4 Insight Kernel**（之前已 ship，整合进来）
- **15 个 bug 修复**（打包前全面排查）
- **109 个单测**全过

## 🎉 这版推荐升

V1.4.x 用户**必须升**——4 大新功能（iCloud 同步 / 反向校准 / Weekly Reflection / 嵌入图谱）你都没用过。
V1.3.x 用户**强烈推荐升**——写作工作台从"半成品"打磨成"日常用得起来"。

## 🆕 写作工作台重写（V1.5 round 1）

之前是基础 textarea + scaffold 展示。这版**真正可写**：

- **自动保存**：3 秒 debounce，每字都存
- **版本历史**：每次保存一个版本，保留 20 个；点历史可恢复
- **改写浮动工具条**：选中文本 → 浮动深色 popover → 6 种 style 一键改写
  - professional（专业）
  - casual（口语化）
  - concise（精简）
  - expanded（扩写）
  - english（译英）
  - chinese（译中）
- **多平台适配**：选 1 张卡 → 5 个平台一键生成
  - 公众号（2000-3000 字）
  - 知乎（1000-1500 字长答案）
  - 即刻（300-500 字）
  - 小红书（图文笔记，emoji 友好）
  - 视频脚本（短/长）
  - 改写前自动 snapshot，可回滚
- **标题可编辑** + 状态栏自动保存指示器 + 字数统计

**新表**：`writing_drafts`（每 writing 唯一 1 行覆盖式） + `writing_versions`（保留 20 个版本）

**新 API**：
- `GET/POST /api/writing/[id]/draft`
- `GET/POST /api/writing/[id]/versions`
- `GET /api/writing/[id]/versions/[vid]`
- `POST /api/writing/[id]/versions/[vid]/restore`（恢复前自动 snapshot）
- `POST /api/writing/rewrite`（6 个 style 改写）
- `POST /api/writing/adapt`（5 平台改写）

## 🆕 4 大新功能（V1.5 round 2）

### 1. iCloud 同步（MVP）

**问题**：macOS 桌面 app 默认 db 在 `~/Library/Application Support/InsightOS/` 单独机器上，无法跨设备。

**方案**：导出/导入 ZIP（透明 JSON Bundle 格式）

- `/api/sync/export` — 导出完整 db ZIP
  - `assets/` `outputs/` `topics/` `kernels/` `feedbacks/` `writing_drafts/` `writing_versions/` `config.json`（不含 LLM key）
- `/api/sync/status` — 看每表实体数 + iCloud 提示文案
- `/settings/sync` 页 — 6 卡片数据 + 导出/导入按钮

**V1.6 限制改进**：
- `?dryRun=1` 返回 diff 报告（按表的 insert/update/skip 分类）
- 弹 diff 预览 modal：用户确认后才覆盖

### 2. 反向校准层（API）

**问题**：用户给某个判断打"反对"反馈时，怎么找相关的"反例 Kernel"？手动找低效。

**方案**：`/api/kernel/feedback-suggest` 关键词匹配返回 top 5 Kernel

- 算法：sliding window 1-4 字分词 + 资产关键词 +3 / 反馈关键词 +5
- 不需要 LLM（V1.5）/ V2.0 加 LLM 智能建议

**V1.6 限制改进 UI**：
- Asset 详情页 FeedbackModal 加 "🔍 找需要加反例的 Kernel" 按钮
- 候选 modal 按 score 排序 + 一键加反例（PATCH `/api/kernel/[id]`）
- 已有反例的标 "⚠️ 已加过反例"，按钮变 "更新反例"

### 3. Weekly Reflection

**问题**：每周/每月复盘时，要手动汇总"这周我沉淀了什么、哪些 Kernel 该重新验证"。

**方案**：`/api/insights/weekly` 7 天活动 + 30 天没验证 Kernel + Top 被引用 + 本周新资产 + 本周最触动反馈

- `/insights/weekly` 页 — 4 卡片数据汇总
- 仪表盘紫底渐变入口 "📊 本周回顾"

**V1.6 限制改进**：
- localStorage 缓存 7 天
- 顶部"上次生成于 X · 距今 Y 天 · Z 天后过期" + 周一紫色提示徽章
- 缓存过期时顶部黄底警告
- 手动 "✨ 重新生成本周报告" 按钮

### 4. 嵌入图谱（Embed Widget）

**问题**：Vincent 想把"判断力图谱"嵌到博客文章里，但**没有固定 IP/域名**，iframe 嵌入 URL 不可访问。

**方案（V1.5 round 2）**：
- `/api/embed/data?userId=xxx` 公开图谱数据
- `/p/[user_id]/graph` 公开图谱页（d3-force + 主题色 + noindex + hover tooltip）
- `/settings/embed` 设置页（公开 URL + iframe 嵌入代码一键复制）

**V1.6 限制改进**：
- 主题聚类（d3 forceCluster 按 topic 分组 + forceX/Y 拉向 cluster 中心）
- 右上角图例（背景半透明，深色字）

**V1.5 round 3 改方向**：
- **本地导出 PNG / PDF**，不依赖任何网络/IP
- `/settings/embed` 改成"图谱导出工作台"而不是"iframe embed"
- V2.0 有域名时再加回 iframe 嵌入代码（保留 `/p/[user_id]/graph`）

## 🆕 博客文章图导出（V1.5 round 3 新方向）

**问题**：Vincent 给参考图：写一篇博客（标题+meta+段落+引用+嵌入 widget+CTA）→ 整篇生成一张**1080 宽竖版长图** → 发公众号/朋友圈/小红书。

**之前理解错**：Vincent 说"嵌入图谱"我以为是"导出一张图谱 PNG"，他其实是说"**写博客文里嵌入 widget，整篇生成图**"。

**方案**：
- `/settings/blog-poster` 页面
- 内置 Vincent 自己的博客模板（"独立咨询顾问的方法论沉淀：第一年"）
- 字段可改：meta / 标题 / 2 段开篇正文 / 引用块 / 2 段 H2 + 正文 / 结尾 CTA / 链接
- 实时预览
- 一键导出 PNG（1080 宽 · 竖版 · retina 2x · 高度按内容动态算）

**导出长图内容**（自上而下）：
1. 顶部 meta（日期 · 分类 · 阅读时间）
2. 大标题（Playfair Display 衬线）
3. 开篇 2 段正文
4. **紫色引用块**
5. H2 "为什么要公开这张图" + 正文
6. H2 "嵌入图谱" + 正文
7. **嵌入 widget**（force-directed 30 节点 + hover tooltip + legend + 50 张资产统计）
8. H2 "使用感受" + 正文
9. CTA 链接

## 🆕 V1.4 Insight Kernel 整合

V1.4 已经 ship 的核心内核层（事实/概念/方法/价值观）现在整合进：
- 反向校准层 API
- 4 类 × 4 字段 schema
- 6 条 ship-ready 默认来源
- `/docs/insight-kernel` 操作手册

## 🆕 统一输出口子

**之前**：资产详情页有"🎯 生成输出"按钮（重复入口）
**现在**：sidebar"开始写作"是唯一入口，资产详情页"✍️ 基于此卡创作"链接到 `/writing/new?assetId=xxx`（自动选主题 + 跳 step 2 + 紫色横幅"📌 基于此卡创作：<title> · ← 换主题"）

## 🐛 15 个 bug 修复（打包前全面排查）

- 5 个 TypeScript 编译错（runtime 真 bug）
- 1 个 sanitize 没处理 placeholder 误导用户（dev 模式 `sk-test-demo` 之前被判 true）
- 1 个 prompt 缺"不空话/不夸大"质量约束（calibrate/asset-upgrade/output-generate 3 个 prompt）
- 3 个 import 路径错（Node ESM 严格）
- 1 个 parser regex 不支持"## 标题\n内容"形式
- 5 个 stale test（TS 类型注解 / 强制 evidence_level / 强制 insight 字眼）
- 清理 stray 目录

**验证**：
- ✅ TypeScript `tsc --noEmit` — 0 error
- ✅ 单测 `node --test` — 109/109 pass · 0 fail
- ✅ 16/16 页面 HTTP 200
- ✅ 6/6 API 端点 ok

## 📦 完整功能清单

| 功能 | V1.3.1 | V1.5.0 |
|---|---|---|
| 写作工作台 | 基础 textarea | 自动保存 + 版本历史 + 改写 6 style + 多平台 5 适配 |
| 数据同步 | ❌ | iCloud 导出/导入 ZIP + diff 预览 |
| 反馈校准 | ❌ | 反向校准层 API + UI |
| 复盘 | ❌ | Weekly Reflection（4 卡片 + 缓存 7 天）|
| 嵌入图谱 | ❌ | 公开页 + 本地导出 PNG/PDF + 主题聚类 |
| 博客长图 | ❌ | 整篇博客 → 1080 宽竖版长图 |
| Insight Kernel | ❌ | 4 类 × 4 字段 + 6 默认来源 + LLM 注入 |
| 单测 | 10 个 | 10 个文件，109/109 pass |

## 🚀 使用方法

1. 打开下载的 `Insight Asset OS_1.5.0_aarch64.dmg`
2. **把 `Insight OS.app` 拖入 `/Applications/`** ⚠️ 必做，否则 .app 启动会失败
3. 双击 `Insight OS.app` 启动
4. 首次启动配置 LLM key（`/settings` → LLM 配置）
5. 写入你第一个判断卡

**Dev 模式**（自用推荐）：`npm run dev` → http://localhost:4191

## 🔧 macOS Gatekeeper

如果 .app 启动报"无法打开，因为开发者无法验证"：

```bash
xattr -cr '/Applications/Insight OS.app'
codesign --force --deep --sign - '/Applications/Insight OS.app'
open '/Applications/Insight OS.app'
```

## 📝 已知限制（V2.0 解决）

- iCloud 真同步（File System Provider 监听 Documents 目录）
- 嵌入 widget `<script>` 化（不是 iframe）
- 自建云 + 团队版（Supabase + R2）
- LLM 智能反例建议（替代关键词匹配）
- Weekly Reflection 邮件订阅
- 知识图谱 V2.0（深色背景 + 动画）

