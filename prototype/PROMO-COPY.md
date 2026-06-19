# Insight Asset OS v1.0.0 推广文案

发完 GitHub Release 后用。按平台调风格。

---

## V2EX（程序员向，post 节点）

**标题**：Insight Asset OS v1.0 发布 —— 把零散经验沉淀为可调用的判断力资产

**正文**：

做了 3 个月、80+ commits 的 Insight Asset OS v1.0.0 今天发布。
它解决的是我作为独立顾问的痛点：客户现场要快速调出"我过去对这类问题的判断"，但经验散在 Notion / 印象笔记 / 微信收藏夹 / 书本笔记里，搜索成本高，调出来还经常发现"我记得写过但找不到了"。

核心思路（不是 Notion AI 那种"帮你总结"）：

1. 一张卡 = 一个原子级判断（不是文章、不是笔记）
2. 主题思想内核 = LLM 从你的所有卡里提炼的 1 句核心判断 + 3-5 条反常识，每条引用具体源卡
3. 写作陪练 = 输入 1 句核心 + 3 张卡 → 自动生成写作骨架 + 反方观点 + 推荐能引用的卡 + 重复论点检测
4. 资产图谱 + 血脉图 = 5 维视觉编码，看清自己的判断力演化

LLM 兼容任何 OpenAI API 协议（本地 Ollama / 自部署 vLLM / MiniMax / DeepSeek / Qwen / GLM / OpenAI / Claude / 自定义 endpoint），数据不上传。

技术栈：Next.js 15 + React 19 + TypeScript + SQLite + Drizzle ORM + react-force-graph-2d。桌面 app 用 Electron 32 打包 macOS arm64 .dmg。

GitHub: https://github.com/shadow-vincent/insight-os
下载: https://github.com/shadow-vincent/insight-os/releases/latest
License: MIT

主要面向：独立咨询顾问 / 公众号作者 / 知识工作者 / 读书学习者。
欢迎 Issue 提需求 / PR / Star。

---

## 微博（短传播）

**正文**：

【Insight Asset OS v1.0 发布】

把你零散的经验笔记，沉淀成可调用、可输出、可验证、可进化的判断力资产。

一张卡 = 一个原子级判断。
一句主题思想内核 = LLM 从你的所有卡里提炼的 1 句核心判断 + 3-5 条反常识（每条引用具体源卡）。
写作陪练 = 输入 1 句核心 + 3 张卡 → 写作骨架 + 反方观点 + 推荐引用 + 重复论点检测。

LLM 兼容任何 OpenAI API 协议（本地 Ollama / 自部署 vLLM / MiniMax / DeepSeek / Qwen / GLM / OpenAI / Claude），数据不上传。

macOS arm64 .dmg 下载 ↓
github.com/shadow-vincent/insight-os/releases

独立咨询顾问 / 公众号作者 / 知识工作者 适用。MIT 开源。

---

## Twitter / X（英文）

**正文**：

Just shipped Insight Asset OS v1.0 — turn scattered notes into atomic judgment assets you can actually reuse.

Core idea (not "AI summary"):

- 1 card = 1 atomic judgment
- 1 topic kernel = 1 sentence + 3-5 counter-intuitive insights (each cites source cards)
- Writing companion = 1 sentence + 3 cards → skeleton + counter-arguments + cross-references + repeat-argument detection
- Asset graph + pedigree graph = 5-dim visual encoding of your judgment network

LLM-agnostic: any OpenAI-compatible API (Ollama / vLLM / DeepSeek / Qwen / GLM / OpenAI / Claude / custom endpoint). Data never leaves your machine.

Stack: Next.js 15 + React 19 + TypeScript + SQLite + Drizzle ORM + react-force-graph-2d. Desktop via Electron 32.

macOS arm64 .dmg:
github.com/shadow-vincent/insight-os/releases

MIT, free, for indie consultants & knowledge workers.

---

## 知乎 / B 站（长文）

**标题**：3 个月做了个 Insight Asset OS：把零散经验沉淀为可调用的判断力资产

**正文**：

# 背景

做了 3 个月独立顾问，每次客户现场都要快速调出"我过去对这类问题的判断"。

但经验散在 Notion / 印象笔记 / 微信收藏夹 / 书本笔记里。搜索成本高，调出来还经常发现"我记得写过但找不到了"。

Notion AI / Obsidian AI / 飞书 AI 都试过。问题是它们都偏向"帮你总结"，不是"帮你沉淀判断"。我要的不是"AI 总结这篇笔记"，而是"AI 帮我从过去 30 张卡里提炼主题核心判断"。

# 解决思路

Insight Asset OS 的核心是 **"判断力资产化 + 链接化"**。

## 1. 原子级卡

每张卡 = 1 个判断（不是文章、不是笔记）。

# 2. 主题思想内核

每个主题 1 句核心判断 + 3-5 条反常识（每条引用具体源卡）。

# 3. 写作陪练

1 句核心 + 3 张卡 = 写作骨架 + 反方观点 + 推荐引用 + 重复论点检测。

# 4. 资产图谱 + 血脉图

5 维视觉编码，看清判断力的演化。

# LLM 兼容

不绑定特定 LLM。任何 OpenAI API 兼容服务（本地 Ollama / 自部署 vLLM / MiniMax / DeepSeek / Qwen / GLM / OpenAI / Claude / 自定义 endpoint）都行。数据不上传。

# 技术栈

- Next.js 15 + React 19 + TypeScript
- 自建设计系统（CSS variables + 双主题 blue/green）
- SQLite + Drizzle ORM（单文件数据库，隐私隔离）
- react-force-graph-2d（资产图谱）
- Electron 32（macOS arm64 .dmg）

# 下载

https://github.com/shadow-vincent/insight-os/releases

# 适用人群

- 独立咨询顾问 / 自由职业者
- 公众号作者 / 自媒体
- 知识工作者 / 管理者
- 读书 / 学习者

License: MIT。