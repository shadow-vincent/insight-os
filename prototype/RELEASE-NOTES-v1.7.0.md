# Insight Asset OS · V1.7.0

V1.7 是一个**功能补齐 + onboarding 重构**版本 —— 把 V1.6 收尾功能打磨成"日常用得起来"，同时简化 onboarding 流程。

主要交付：
- **主题文章** —— 选主题 + 卡片 → AI 生成 1-5 篇系列文章
- **Daily Loop** —— Dashboard 顶部 4 步循环（扔进/校准/输出/记录）
- **Settings 全局偏好** —— LLM 温度 + 写作默认篇幅（不用每次任务选）
- **Onboarding 简化** —— 删 5 选 1 场景卡，1 句话引导 + 跳设置
- **LLM 客户端默认值优化** —— maxTokens 提到 6000（深度长文场景）
- **1 个 bug 修复** —— 微信爬虫 CACHE_DIR 路径嵌套
- **docs/llm-setup** —— DeepSeek 5 步接入教程

## 🎉 这版推荐升

V1.6 用户**建议升**——主题文章 + Daily Loop 是 V1.7 主线，能立即用到。
V1.5.x 用户**强烈推荐升**——同时拿到 V1.6 全部功能（首页驾驶舱 / 5 阶段进化线 / Kernel 学习页）。

## 🆕 主题文章（V1.7 主线）

**痛点**：之前 `/writing/new` 只能"挑 1 条核心判断 + 3-5 张支撑卡 → 生成 1 个写作骨架"。但用户经常想要"围绕一个主题展开多篇文章"。

**新功能**：选 1 个主题 → 勾几张卡片 → AI 生成 1-5 篇完整文章。

### 用法

```
/topic-articles/new
   ↓
选 1 个主题（如"AI 转型"）
   ↓
勾 1-N 张卡片（默认 1 张）
   ↓
选篇数（1 / 2 / 3 / 4 / 5）+ 篇幅（settings 配默认）
   ↓
AI 生成 1-5 篇完整文章（每篇带标题 + 大纲 + 草稿）
```

### 关键设计

- **每篇带 citedAssetIds**：返回的 `articles[].citedAssetIds` 准确列出引用了哪几张卡（验证：单测 100% 命中）
- **1 张卡片可以生成 1 篇文章**：但不能生成 N 篇（N 张以下 → 报错）—— 强制素材足够
- **篇幅软引导，不硬截**：prompt 告诉 LLM "建议 X 档字数"，但不 `slice(0,n)` 硬截（信任 LLM）
- **温度从 settings 读（默认 0.5）**：稳定可预测，不每次任务选

### 4 档篇幅实测

| 档位 | 期望字数 | 实测字数 |
|------|---------|---------|
| 短文 | 800-1200 | 1100-1200 |
| 中等 | 1500-2000 | 1500-1700 |
| 深度长文 | 2500-3500 | 900-1000（偏低，待优化）|
| 超深度 | 4000+ | 2200（接近 4000+ 一半，待优化）|

**新 API**：
- `POST /api/topic-articles/generate`（接 `{topicId, assetIds, count}`，从 config 读 temperature + articleLength）

**新测试**：`tests/topic-articles.test.mjs` 7/7 全过。

---

## 🆕 Daily Loop（V1.7 #2）

**痛点**：用户反馈"不知道 Insight OS 每天应该做什么" —— Daily Loop 给出**每天 4 步循环**。

### 4 步循环

```
1. 扔进 1 条观察    —— 今天看到的、听到的、想到的
2. 校准 1 张候选卡  —— 候选池里挑一张升级 / 改证据等级
3. 输出 1 个可用片段 —— 基于资产写一段话 / 文章 / 方案
4. 记录 1 条反馈    —— 客户/同事/读者的反应
```

### 关键设计

- **localStorage 持久化**（key 含日期 0 点自动重置）—— 不依赖后端
- **完成动画** —— 4 步全做完触发庆祝页
- **进度条 + 数字显示** —— 顶部"今天完成 0/4"
- **CTA「我承诺做」** —— 自动标记完成 + 解锁庆祝页

### 4 色配色（视觉差异化）

| 步骤 | 颜色 | 图标 |
|------|------|------|
| 扔进 | 蓝 | 📥 |
| 校准 | 紫 | 🎯 |
| 输出 | 绿 | ✍️ |
| 记录 | 橙 | 📊 |

**新组件**：
- `apps/web/components/DailyLoopCard.tsx`（展示卡）
- `apps/web/components/useDailyLoop.ts`（localStorage hook）

**新测试**：`tests/daily-loop.test.mjs` 8/8 全过（initState / markStep / completedCount / allDone / 跨日重置 / immutability / isSameDate）。

---

## 🆕 Settings 全局偏好（V1.7 #3）

**痛点**：之前 LLM 温度写死 0.7，篇幅 maxTokens 写死 4000 —— 用户每次任务都改不了。

**新功能**：把 LLM 行为参数放到 settings 配，全局生效。

### Settings 页新增 2 个字段

| 字段 | 类型 | 默认值 | 范围 |
|------|------|--------|------|
| LLM 温度 | slider | 0.5 | 0 - 1.2 |
| 写作默认篇幅 | select | 深度长文 | 短文/中等/深度长文/超深度 |

### 数据流

```
settings 配置 → POST /api/config { preferences: {...} }
   ↓
POST /api/topic-articles/generate (不传 length)
   ↓
API 读 config.preferences.articleLength + llmTemperature
   ↓
调 LLM（用对应 maxTokens + temperature）
```

### 单次覆盖

主题文章页 select 可**临时改**篇幅（不持久化）—— body 里 `length: 'ultra'` 覆盖 config 默认。

### 实现

- `packages/core/src/config.ts`：加 `preferences: { llmTemperature, articleLength }` 字段
- `apps/web/app/api/config/route.ts`：POST 接受 `body.preferences`（温度限制 0-2，篇幅限制 4 档）
- `apps/web/app/api/topic-articles/generate/route.ts`：从 config 读 + body 临时覆盖

---

## 🆕 Onboarding 简化（V1.7 #4）

**痛点**：V1.6 加了 5 选 1 场景卡（写文章 / 做方案 / 沉淀经验 / 提炼方法论 / 沉淀素材），但**用户选哪个没区别**（默认模板用户进 `/write` 自己改就行）。Vincent 抓"5 选 1 没意义"——**删掉**。

### 新版 onboarding

```
/onboarding
   ↓
1 句话：Insight OS 是个人判断力工作台
   ↓
首次使用建议：去 settings 配 LLM + 资产库路径
   ↓
两个按钮：⚙ 去设置 / 跳过，先逛逛
```

**文件**：`apps/web/app/onboarding/page.tsx` 从 765 行简化到 130 行。

---

## 🔧 LLM 客户端默认值优化

`packages/llm/src/client.ts`：

| 函数 | 默认 maxTokens | 之前 |
|------|----------------|------|
| `callLLM` | 6000 | 2000 |
| `streamLLM` | 4000 | 1500 |

**理由**：写作场景普遍需要 2500-3500 字（深度长文），旧默认值 2000 不够生成完整草稿。

---

## 🐛 Bug 修复

### 微信爬虫 CACHE_DIR 路径嵌套

**症状**：`apps/web/apps/web/storage/cache/import-url/*.json` 误生成（dev 模式 cwd 嵌套）。

**根因**：`apps/web/lib/weixin-scraper.ts` 写死 `resolve(process.cwd(), 'apps/web/storage/cache/import-url')` —— 但 Next.js dev 模式 `process.cwd()` 已经是 `apps/web`，再拼 `apps/web/` 变嵌套。

**修法**：改成 `resolve(process.cwd(), 'storage/cache/import-url')`（cwd 已经是 `apps/web`）。

**副作用**：补 .gitignore 规则 `apps/web/apps/`（兜底防御嵌套路径再出现）。

---

## 📚 新文档

### docs/llm-setup

5 步接入 DeepSeek API 教程 + 替代方案（OpenAI / 本地 Ollama / 自部署 vLLM）。位置：`/docs/llm-setup`。

---

## 📊 单测覆盖

```
ℹ tests 129
ℹ pass 129
ℹ fail 0
```

新增：
- `tests/daily-loop.test.mjs` 8/8
- `tests/topic-articles.test.mjs` 7/7

---

## 📦 安装与升级

桌面 .dmg：`Insight Asset OS_1.7.0_aarch64.dmg`（约 358MB）

升级方式（macOS）：
1. 下载 .dmg
2. 拖入 Applications 文件夹（**必须拖入，不要直接打开**）
3. 旧版会被自动覆盖（本地 SQLite 数据库保留）

如首次安装，参考 `/docs/quickstart`。

---

## 🔗 资源

- GitHub：https://github.com/shadow-vincent/insight-os
- README + 入门：https://insight-os.vercel.app/docs/quickstart
- 操作手册：https://insight-os.vercel.app/docs

---

*发布于 2026-06-27 · Vincent + Mavis*