# 🎉 Insight Asset OS v1.0.0 — First Public Release

> 把零散经验转化为**可调用、可输出、可验证、可进化的管理思想资产**。

11 个版本迭代、3 个月、80+ 个 commits、20+ 个核心功能模块——Insight Asset OS 终于来到 v1.0.0，第一个**公开可发布**的稳定版本。

---

## 🌟 为什么值得下载

| 你是不是 | 试试 Insight Asset OS |
|---|---|
| 独立咨询顾问 / 自由职业者 | 在客户现场打开 Insight OS，3 步调出 1 张反常识卡，30 分钟内建立专业信任 |
| 公众号作者 / 自媒体 | 从 1 句核心判断 + 3 张卡 → 自动生成写作骨架 + 陪练反方 + 发布反哺 |
| 知识工作者 / 管理者 | 把零散笔记沉淀成"判断力资产"，用主题 + 内核 + 图谱，看见自己的思想演化 |
| 读书 / 学习者 | 每本书一个主题，每章一张卡，3 个月后回看：每本书我吸收的 1 个核心 |

---

## ✨ 5 大核心特性

### 🧠 思想内核（Topic Kernel）
每个主题 1 句核心判断 + 3-5 条反常识。
- LLM 从主题下所有卡总结
- 每条判断**引用具体源卡**（不是凭空生成）
- 主题页自动展示 + 洞察助手可查询
- 例子：组织治理 → "AI 暴露组织深层矛盾，治理需重构权力与激励" + 5 条判断

### ✍️ 写作工作流
1 句核心 + 3-5 张卡 = 写作骨架 + 陪练 + 反哺。
- **3 模板**：公众号长文 / 演讲稿 / 读书笔记
- **写作陪练 3 动作**：
  - 反方观点（3 个不同角度的读者质疑）
  - 推荐能引用的卡（同主题资产）
  - 重复论点检测（过去 6 个月输出）
- **反哺**：发布时自动给支撑卡 `feedback_count + 1`，沉淀闭环

### 📊 资产图谱 + 血脉图
- **资产图谱**：力导向可视化，1 度邻居聚焦 + 证据等级过滤
- **血脉图（Pedigree）**：上=来源 / 中=中心 / 下=派生 / 环=同主题
- **5 维视觉编码**：E 等级 / 优先级 / 大小 / 角色 / 中心位置
- 浅色 palette，跟"咨询专业感"调性匹配

### 💬 洞察助手
自然语言问任何问题：
- "我有几张高等级卡" → meta_query
- "对比组织设计和激励错位" → multi_step ReAct
- "组织治理核心思想是什么" → 读 kernel

### 📋 今日待办 + 进化时间线 + 写作复盘
- **今日待办 3 栏**：待校准 / 可输出（30 天没用的 E2+）/ 待反馈
- **进化时间线**：每张卡的"成长史"（feedback + output 按时间排列）
- **写作复盘**：本月 N 篇 + 引用 X 张卡 + 反复引用的"真核心"

---

## 📦 安装

### macOS（推荐）
1. 下载 **`Insight OS-1.0.0-arm64.dmg`**（下方 Assets，334 MB Apple Silicon）
2. 双击 .dmg，把 `Insight OS.app` 拖入 Applications
3. 在 Applications 双击 `Insight OS.app` 启动
4. 进 3 步 onboarding → 1 分钟上手

### Web 版（dev / 试用）
```bash
git clone https://github.com/shadow-vincent/insight-os.git
cd insight-os
npm install
npm run dev
# 浏览器打开 http://localhost:4191
```

**系统要求**：
- macOS 11+（Big Sur 或更新）
- Node.js 20+（dev 模式）
- SQLite 3（内置）

---

## 🚀 3 分钟上手

启动后自动进 `/onboarding`：
1. **配 LLM Key**（可选）— **任何兼容 OpenAI API 协议的服务**（本地 Ollama / 自部署 vLLM / MiniMax / DeepSeek / Qwen / GLM / OpenAI / Claude / 自定义）
2. **选 Vault 路径** — 指向你的知识库根目录
3. **装入示例数据** — 8 张示例卡 + 2 个主题 + 1 个内核 + 1 个示例写作

完成后跳到仪表盘，开始用。

**没配 LLM Key 也能用基础功能**（资产库 / 主题 / 写作 / 图谱）。LLM 用于：思想内核提炼 / 写作骨架 / 资产升级 / 洞察助手。

---

## 📊 v1.0.0 完整 Changelog

### 🆕 v1.0 — 发布准备
- **Onboarding 引导**：4 步（欢迎 → LLM → Vault → Seed → 完成）
- **Seed 示例数据**：8 张卡 + 2 主题 + 1 内核 + 1 写作，幂等
- **README + LICENSE + CHANGELOG**
- **Electron 32 桌面 app 集成**：macOS arm64 .dmg（包含 Next.js 全栈 + SQLite + LLM 集成）
- **隐私隔离**：macOS 走 `~/Library/Application Support/insight-os-desktop/`
- **3 处 API route 硬编码** → 改用 `config.paths.vaultPath`（修复别人用会写错文件的关键 bug）
- 10 个生产 build blocker 修复

### v0.10 — 日活引擎
- 仪表盘"今日待办"3 栏
- 资产详情页"进化时间线"
- 写作复盘仪表盘
- CTA 颜色统一（`var(--accent)` → `var(--primary)`）
- emoji 第一波换 SVG（写作模板 / inbox tab）

### v0.9 — 写作工作流
- 写作 4 步向导
- 3 模板写作骨架生成
- 内嵌 markdown 编辑器
- 写作陪练 3 动作
- 写作反哺（feedback_count + 1）

### v0.8 — 思想内核
- `topic_kernels` 表
- 主题思想内核 LLM prompt
- `/api/topics/[id]/kernel` 端点
- 主题页 kernel 展示
- 洞察助手读 kernel

### v0.7 — 洞察助手
- SSE 流式 6 事件协议
- 浮动按钮 + 抽屉式聊天
- 多步 ReAct（multi_step）
- 写作场景集成

### v0.6 — 血脉图
- 双 tab 图谱（血脉图 + 全景图）
- Pedigree 布局
- 5 维视觉编码
- 浅色 palette

### v0.5 — 资产图谱
- `/api/graph` 端点
- react-force-graph-2d
- `related_ids_json` schema

### v0.4 — 仪表盘 + 主题切换
- 双主题（blue / green）
- GLM 风格仪表盘
- Toast 系统
- 字号提档

### v0.3 — 搜索 + ⌘K
- FTS5 全文搜索
- GlobalSearchModal
- 候选池 promote

### v0.2 — 资产地图
- 主题分类
- 资产地图页
- LLM 自动归类
- 多卡联合输出

### v0.1 — 全闭环 MVP
- 资产库 / 收集箱 / 候选池 / 输出历史
- SQLite + Drizzle ORM
- LLM 12 章节资产升级
- Markdown indexer

---

## 🛠️ 技术栈

- **前端**：Next.js 15 + React 19 + TypeScript
- **UI**：自建设计系统（CSS variables + 双主题）
- **数据**：SQLite + Drizzle ORM
- **LLM**：**任何兼容 OpenAI API 协议的服务**（本地 Ollama / 自部署 vLLM / MiniMax / DeepSeek / Qwen / GLM / OpenAI / Claude …）
- **图谱**：react-force-graph-2d
- **桌面 app**：Electron 32（包含 Next.js 全栈 + SQLite）

---

## 🐛 已知问题

- **首次 npm run build:desktop 慢**（5-10 分钟编译 Next.js 全栈 + Electron 打包），之后增量打包快
- **macOS Gatekeeper 必做 3 步**（未签名 Electron .app 在 macOS 11+ 会被拦）：
```bash
xattr -cr '/Applications/Insight OS.app'
codesign --force --deep --sign - '/Applications/Insight OS.app'
codesign --verify --verbose '/Applications/Insight OS.app'
```
  不跑会报"Insight OS 已损坏，无法打开"。一行搞定：`xattr -cr '/Applications/Insight OS.app' && codesign --force --deep --sign - '/Applications/Insight OS.app' && open '/Applications/Insight OS.app'`。
- **Windows / Linux**：v1.1 计划
- **自动更新**：v1.2 计划（已配好 electron-updater + GitHub Releases 端点）
- **多用户**：单用户 SQLite，v2.0 才考虑多用户/同步

---

## 📚 文档

- [README](./README.md) — 完整上手指南
- [CHANGELOG](./CHANGELOG.md) — 全部历史
- [桌面 app 构建说明](./apps/desktop/README.md) — Electron 编译 / 调试 / 签名
- [路线图](./README.md#路线图) — v1.1 / v1.2 计划

---

## 🤝 反馈

- **Bug / Feature Request** → [GitHub Issues](https://github.com/shadow-vincent/insight-os/issues)
- **讨论 / 想法** → 在 Issue 里加 `💡 idea` 标签
- **邮件** — vincent4895856@gmail.com

---

## 📝 License

[MIT](./LICENSE) © 2024-2026 Vincent

---

**⭐ 如果 Insight Asset OS 对你有帮助，欢迎给个 Star！**

**Made with 🧠 by Vincent**
