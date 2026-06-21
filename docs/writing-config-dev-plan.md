# 写作风格配置系统 · 开发方案

> **目标读者**：MiniMax code（或任何接手实施的工程师）
> **项目**：Insight OS · `/Users/vincent/Documents/insight-os`
> **配套原型**：`/Users/vincent/Documents/insight-os/prototype/writing-config.html`（**实施前必看**）
> **预计工期**：3-4 周
> **架构版本**：v0.10 → v0.11

---

## 0. 背景 & 范围

### 0.1 为什么做

当前 `packages/llm/src/prompts/writing-companion.ts` 和 `writing-scaffold.ts` 的 prompt 是**写死的字符串常量**——温度、风格、长度全部 hardcode。

这导致两个问题：
1. **用户无法定制**：同一个工具给不同顾问用，输出味道都一样
2. **配置变更需要改代码**：调一个"短句比"就要发版

### 0.2 做什么

实现**5 维度可配置**的写作 prompt 系统，按 **L0 / L1 / L2 / L3 四层架构**组织。

### 0.3 不做什么

- ❌ **不做 SaaS 多用户**：本项目是单机本地版，每用户一份 YAML 配置
- ❌ **不重做 4 步 wizard**：现有 `/writing/new` 流程不变
- ❌ **不重做 outputs 表的核心字段**：仅新增关联字段
- ❌ **不做 LLM 模型路由**：model 字段还是从 settings 读

### 0.4 关键约束

- 现有 6 个 prompt 文件**不能破坏**（`asset-upgrade.ts` / `calibrate.ts` / `output-generate.ts` 等）
- 现有 `outputs` 表的**已有数据不能丢**
- 配置存为 **YAML 文件**（不用 DB），路径 `~/.insight-os/writing-configs/*.yaml`
- 至少 3 套 ship-ready 预设随产品出厂

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│ L0 基础设施层（写死在 .ts 文件中）                            │
│   - packages/llm/src/prompts/_base/system-foundation.ts      │
│   - 内容：角色定义、JSON 严格性、Markdown 输出约定             │
│   - 所有 prompt 共享，不分场景                                │
├─────────────────────────────────────────────────────────────┤
│ L1 哲学层（写死在 .ts 文件中）                                │
│   - packages/llm/src/prompts/_base/philosophy.ts             │
│   - 内容：7 条核心信念 + 8 条 AI 味规则 + 6 条联合输出原则     │
│   - 所有写作 prompt 共享                                      │
├─────────────────────────────────────────────────────────────┤
│ L2 模板层（按 outputType 拆分）                               │
│   - packages/llm/src/prompts/writing/scaffold-{type}.ts     │
│   - packages/llm/src/prompts/writing/companion-{type}.ts    │
│   - 内容：outputType-specific 指令 + few-shot 范例            │
│   - type = article_full | speech | book_note | email         │
├─────────────────────────────────────────────────────────────┤
│ L3 用户配置层（YAML 文件）                                    │
│   - ~/.insight-os/writing-configs/{name}.yaml                │
│   - 5 维度参数 + LLM 参数 + few-shot 引用列表                 │
│   - 用户可创建任意多个，激活其中一个                          │
└─────────────────────────────────────────────────────────────┘
```

**调用链**：
```
LLM call
  → 加载 L0 (foundation.ts)        [固定]
  → 加载 L1 (philosophy.ts)        [固定]
  → 加载 L2 (按 outputType 选)      [按场景]
  → 加载 L3 (读 active preset)      [按用户配置]
  → 拼装为完整 system prompt
  → 调 LLM
```

---

## 2. 文件改动清单

### 2.1 新增文件

| 路径 | 作用 | 行数预估 |
|---|---|---|
| `packages/llm/src/prompts/_base/system-foundation.ts` | L0 基础设施层 prompt | 80 |
| `packages/llm/src/prompts/_base/philosophy.ts` | L1 哲学层 prompt | 120 |
| `packages/llm/src/prompts/writing/scaffold-article-full.ts` | L2 公众号长文 scaffold | 150 |
| `packages/llm/src/prompts/writing/scaffold-speech.ts` | L2 演讲稿 scaffold | 150 |
| `packages/llm/src/prompts/writing/scaffold-book-note.ts` | L2 读书笔记 scaffold | 150 |
| `packages/llm/src/prompts/writing/companion-article-full.ts` | L2 公众号长文 companion | 150 |
| `packages/llm/src/prompts/writing/companion-speech.ts` | L2 演讲稿 companion | 150 |
| `packages/llm/src/prompts/writing/companion-book-note.ts` | L2 读书笔记 companion | 150 |
| `packages/core/src/writing-config.ts` | L3 配置类型定义 + 读写 API | 300 |
| `packages/core/src/writing-presets.ts` | 3 套 ship-ready 预设 | 400 |
| `apps/web/app/settings/writing/page.tsx` | 配置页主入口 | 600 |
| `apps/web/app/settings/writing/WritingConfigClient.tsx` | 客户端交互组件 | 800 |
| `apps/web/app/settings/writing/components/PresetList.tsx` | 屏 1 Preset 列表 | 300 |
| `apps/web/app/settings/writing/components/ConfigEditor.tsx` | 屏 2 5 维度编辑器 | 800 |
| `apps/web/app/settings/writing/components/YamlPreview.tsx` | 屏 3 YAML 视图 | 250 |
| `apps/web/app/settings/writing/components/ImportModal.tsx` | 屏 4 导入模态 | 250 |
| `apps/web/app/settings/writing/components/ExportModal.tsx` | 屏 4 导出模态 | 200 |
| `apps/web/app/api/writing-config/route.ts` | CRUD API | 200 |
| `apps/web/app/api/writing-config/active/route.ts` | 激活切换 API | 80 |
| `tests/writing-config.test.mjs` | 单元测试 | 300 |

### 2.2 修改文件

| 路径 | 改动 |
|---|---|
| `packages/llm/src/prompts/writing-scaffold.ts` | 改为**薄壳**，调用 L0+L1+L2 拼接逻辑 |
| `packages/llm/src/prompts/writing-companion.ts` | 改为**薄壳**，调用 L0+L1+L2 拼接逻辑 |
| `packages/llm/src/prompts/index.ts` | 新增 L0/L1/L2 导出 |
| `packages/core/src/index.ts` | 导出 `writing-config` 和 `writing-presets` |
| `packages/core/src/config.ts` | `AppConfig` 加 `activeWritingPreset: string` 字段 |
| `apps/web/app/settings/page.tsx` | 在主题卡片后插入"写作风格配置"导航入口 |
| `apps/web/app/layout.tsx` | sidebar 加 "写作风格" 菜单项 |
| `apps/web/app/api/writing/scaffold/route.ts` | 读 L3 配置注入到 prompt |
| `apps/web/app/api/writing/companion/route.ts` | 读 L3 配置注入到 prompt |
| `apps/web/components/ThemeProvider.tsx` | 不改，复用 |
| `apps/web/app/globals.css` | 增量加 slider / chip / dim-section / yaml-view 样式 |

---

## 3. L3 YAML Schema（核心）

文件：`packages/core/src/writing-config.ts`

```typescript
// ============================================
// 5 维度配置的类型定义
// ============================================

export type OutputType = 'article_full' | 'speech' | 'book_note' | 'email';

export interface StyleDimension {
  tone: number;                    // 0-100, 冷峻→温暖
  stance: 'neutral' | 'advisory' | 'critical' | 'coach';
  persona: string;                 // 自由文本，如 "资深独立顾问"
  viewpoint: 'first' | 'second' | 'third' | 'mixed';
  termDensity: 'low' | 'medium' | 'high';
  temperature: number;             // 0.0-1.0
}

export interface SentenceDimension {
  rhythm: 'short' | 'mixed' | 'long';
  shortRatio: number;              // 0.0-1.0
  paragraphLength: number;         // 中文字数 40-400
  rhetoric: RhetoricType[];        // 多选
}

export type RhetoricType = 'metaphor' | 'analogy' | 'rhetorical' | 'story' | 'data';

export interface StructureDimension {
  headingStyle: 'numbered-question' | 'question' | 'statement' | 'parallel';
  corePosition: 'title' | 'opening' | 'middle' | 'ending';
  argumentPattern: 'total-detail-total' | 'progressive' | 'parallel' | 'contrast';
  sectionCount: number;            // 2-8
  ending: 'call-to-action' | 'quote' | 'open' | 'summary';
}

export interface LengthDimension {
  targetWords: number;             // 300-10000
  sectionCount: number;            // 2-8, 与 structure.sectionCount 联动
  perSectionWords: number;         // 100-1500
  variants: number;                // 1-5
  keyQuotes: number;               // 0-10
}

export interface QualityDimension {
  citationLimit: number;           // 0-20
  bannedWords: string[];           // 禁用词列表
  dataFidelity: 'strict' | 'loose' | 'none';
  aiTasteCheck: boolean;
  fewShotRefs: string[];           // 引用 outputs 表 id
}

export interface LLMParams {
  model: string;                   // 复用 settings.llm.model
  temperature: number;             // 0.0-1.0
  topP: number;                    // 0.0-1.0
}

export interface WritingConfig {
  name: string;                    // 显示名
  outputType: OutputType;
  description?: string;            // 备注
  forkedFrom: string | null;       // 来源预设 id
  updatedAt: number;               // unix ms
  dimensions: {
    style: StyleDimension;
    sentence: SentenceDimension;
    structure: StructureDimension;
    length: LengthDimension;
    quality: QualityDimension;
  };
  llmParams: LLMParams;
}

// ============================================
// 读写 API
// ============================================

export function getUserConfigDir(): string;     // ~/.insight-os/writing-configs/
export function listPresets(): WritingConfigMeta[];  // 列所有 preset 元信息（不读全文）
export function readPreset(name: string): WritingConfig | null;
export function writePreset(name: string, config: WritingConfig): void;  // 原子写
export function deletePreset(name: string): void;
export function duplicatePreset(srcName: string, newName: string): WritingConfig;

export function getActivePreset(): WritingConfig;  // 从 AppConfig.activeWritingPreset 读
export function setActivePreset(name: string): void;
```

**关键约定**：
- 文件名 = `{name}.yaml`（name 限制 `^[a-z0-9-]+$`，中文名自动转拼音或转 ID）
- 写文件用**原子写**（先写 `*.yaml.tmp` 再 `rename`）
- 删除前检查**是否是 active preset**（是则拒绝，提示先切换）
- 读取时 **YAML 解析失败不抛异常**，返回 `null` 并 log warn

---

## 4. Prompt 分层实施细节

### 4.1 L0 基础设施层

文件：`packages/llm/src/prompts/_base/system-foundation.ts`

```typescript
export const L0_FOUNDATION = `
# 角色
你是一个严谨、专业的写作助手。

# 输出格式
- 默认使用 Markdown 格式
- 标题使用 ## / ### 二级和三级
- 引用用 > 区块引用
- 代码用 \`\`\` 包裹并标注语言

# JSON 严格性（当要求 JSON 输出时）
- 禁止半角双引号嵌套（用中文「」或转义）
- 字符串内的引号用中文「」或全角引号
- 数字不加千分位
- null 用小写
`;
```

**注意点**：
- L0 是**所有 prompt 共享**的前缀，包括 `asset-upgrade` / `calibrate` / `output-generate` 等非写作 prompt
- 实施时**先不改其他 prompt** 的引用，只在 `writing-scaffold.ts` 和 `writing-companion.ts` 引入

### 4.2 L1 哲学层

文件：`packages/llm/src/prompts/_base/philosophy.ts`

```typescript
export const L1_PHILOSOPHY = `
# 7 条核心信念
1. 观点优先于结构：先有判断，再有论证
2. 类比是理解的桥梁：复杂概念必须有具体类比
3. 案例 > 理论：每个论点至少配 1 个真实案例
4. 反常识才是洞察：陈述"人尽皆知"等于没说
5. 短句是金：能用 10 字说清的不用 30 字
6. 行动可执行：结尾必须是读者明天就能做的事
7. 金句 = 浓缩的观点：每篇文章 3-5 个可被引用的句子

# 8 条 AI 味规则（生成后自检）
1. 避免总分总套话（"综上所述"/"总而言之"）
2. 避免排比堆砌（连续 3 个以上相同句式）
3. 避免假大空形容词（"非常重要"/"极其关键"）
4. 避免无信息密度的过渡句（"接下来让我们看看"）
5. 避免万能金句（"不忘初心"/"砥砺前行"）
6. 避免模板化小标题（"一、二、三"无信息量）
7. 避免堆砌名人名言而无自己的观点
8. 避免"我们认为"式的模糊主体

# 6 条联合输出原则
1. 输出有且仅有一个核心观点
2. 标题 = 核心观点的浓缩
3. 首段必须出现核心观点
4. 每个章节标题是论点而非"展开"
5. 结尾必须呼应标题
6. 全文字数偏差不超过目标 ±15%
`;
```

**注意点**：
- L1 内容**先以 Vincent 现有口径为准**（从现有 prompt 里抽离），未来可调
- L1 改动需要**同步更新所有 4 个 L2 模板**的引用

### 4.3 L2 模板层

文件命名：`packages/llm/src/prompts/writing/scaffold-{outputType}.ts`

**每个 L2 文件结构**：
```typescript
import { L0_FOUNDATION } from '../_base/system-foundation';
import { L1_PHILOSOPHY } from '../_base/philosophy';
import { StyleDimension, SentenceDimension, /* ... */ } from '@insight-os/core/writing-config';

export const L2_SCAFFOLD_ARTICLE_FULL = `
# 任务
根据用户提供的主题内核 + 核心判断 + 支撑卡，生成公众号长文的写作骨架。

# 输入说明
[保持现有内容...]

# 5 维度配置（动态注入）
{{style_dim}}
{{sentence_dim}}
{{structure_dim}}
{{length_dim}}
{{quality_dim}}

# 输出 JSON Schema
[保持现有内容...]
`;

export function buildScaffoldPrompt(
  outputType: OutputType,
  baseData: ScaffoldInput,
  dimensions: WritingConfig['dimensions'],
  llmParams: LLMParams
): { system: string; user: string } {
  // 1. 按 outputType 选 L2 模板
  const l2Template = selectL2ScaffoldTemplate(outputType);
  // 2. 把 5 维度序列化为自然语言段
  const dimsStr = serializeDimensions(dimensions);
  // 3. 拼装完整 system prompt
  const system = [L0_FOUNDATION, L1_PHILOSOPHY, l2Template].join('\n\n').replace('{{*_dim}}', dimsStr);
  // 4. 拼装 user prompt（保持现有 buildWritingScaffoldUserPrompt 逻辑）
  const user = buildScaffoldUserPrompt(baseData);
  return { system, user };
}
```

**注意点**：
- **L2 模板的"5 维度配置"段用占位符** `{{style_dim}}` 等，由 `serializeDimensions()` 动态替换
- 这样**改 5 维度配置不需要改 L2 模板**
- `serializeDimensions()` 是新函数，约 80 行，把 `StyleDimension` 等转成 LLM 可读的自然语言

### 4.4 薄壳改造

`packages/llm/src/prompts/writing-scaffold.ts`（改动后）：

```typescript
// 从原来的"导出 1 个 SYSTEM 常量"
// 改为"导出 1 个 buildPrompt 函数"

import { buildScaffoldPrompt } from './writing/scaffold-router';
export { buildScaffoldPrompt as buildWritingScaffoldPrompt };
```

`apps/web/app/api/writing/scaffold/route.ts` 改动：

```typescript
// 之前：
const userPrompt = buildWritingScaffoldUserPrompt({ ... });
await callLLM(WRITING_SCAFFOLD_SYSTEM, userPrompt, { ... });

// 之后：
const config = getActivePreset();
const { system, user } = buildWritingScaffoldPrompt(
  config.outputType,
  { ...baseData },
  config.dimensions,
  config.llmParams
);
await callLLM(system, user, {
  ...config.llmParams,
  jsonMode: true,
});
```

**关键不变量**：
- 现有 `scaffoldJson` 的字段定义**不能变**（`title` / `openingHook` / `sections[]` / `closingAction`）
- 现有 `callLLM` 的 options 字段不能变
- 现有 fallback（无 LLM 时的模板输出）**保留**

---

## 5. 3 套 Ship-Ready 预设

文件：`packages/core/src/writing-presets.ts`

### 预设 1 · Vincent 标准版

```typescript
export const PRESET_VINCENT_STANDARD: WritingConfig = {
  name: 'vincent-standard',
  outputType: 'article_full',
  description: '专业顾问的对外发声 · 公众号长文 · 偏观点输出',
  forkedFrom: null,
  updatedAt: Date.now(),
  dimensions: {
    style: {
      tone: 70,
      stance: 'advisory',
      persona: '资深独立顾问',
      viewpoint: 'second',
      termDensity: 'medium',
      temperature: 0.6,
    },
    sentence: {
      rhythm: 'mixed',
      shortRatio: 0.4,
      paragraphLength: 120,
      rhetoric: ['analogy', 'rhetorical'],
    },
    structure: {
      headingStyle: 'numbered-question',
      corePosition: 'opening',
      argumentPattern: 'total-detail-total',
      sectionCount: 5,
      ending: 'call-to-action',
    },
    length: {
      targetWords: 2500,
      sectionCount: 5,
      perSectionWords: 500,
      variants: 1,
      keyQuotes: 3,
    },
    quality: {
      citationLimit: 5,
      bannedWords: ['赋能', '抓手', '闭环', '对齐', '打通', '颗粒度', '底层逻辑'],
      dataFidelity: 'strict',
      aiTasteCheck: true,
      fewShotRefs: [],
    },
  },
  llmParams: {
    model: 'deepseek-chat',
    temperature: 0.6,
    topP: 0.9,
  },
};
```

### 预设 2 · 客户沟通版

```typescript
export const PRESET_CLIENT_COMM: WritingConfig = {
  name: 'client-comm',
  outputType: 'email',  // ← 关键差异
  description: '温和·叙事化·邮件 / 简短报告',
  forkedFrom: 'vincent-standard',
  updatedAt: Date.now(),
  dimensions: {
    style: {
      tone: 80,                // 更温暖
      stance: 'advisory',
      persona: '资深独立顾问',
      viewpoint: 'second',
      termDensity: 'low',      // 更通俗
      temperature: 0.5,        // 更稳
    },
    sentence: {
      rhythm: 'short',         // 短句为主
      shortRatio: 0.7,         // 70% 短句
      paragraphLength: 80,     // 段落短
      rhetoric: ['analogy', 'story'],
    },
    structure: {
      headingStyle: 'statement',
      corePosition: 'opening',
      argumentPattern: 'total-detail-total',
      sectionCount: 3,         // 3 节
      ending: 'summary',
    },
    length: {
      targetWords: 800,        // 短
      sectionCount: 3,
      perSectionWords: 250,
      variants: 1,
      keyQuotes: 1,
    },
    quality: {
      citationLimit: 2,
      bannedWords: ['赋能', '抓手', '闭环'],
      dataFidelity: 'loose',
      aiTasteCheck: true,
      fewShotRefs: [],
    },
  },
  llmParams: {
    model: 'deepseek-chat',
    temperature: 0.5,
    topP: 0.9,
  },
};
```

### 预设 3 · 学术严谨版

```typescript
export const PRESET_ACADEMIC: WritingConfig = {
  name: 'academic',
  outputType: 'article_full',
  description: '严谨·数据驱动·论文 / 研究报告',
  forkedFrom: 'vincent-standard',
  updatedAt: Date.now(),
  dimensions: {
    style: {
      tone: 30,                // 冷峻
      stance: 'neutral',
      persona: '研究员',
      viewpoint: 'third',
      termDensity: 'high',     // 术语密
      temperature: 0.3,        // 保守
    },
    sentence: {
      rhythm: 'long',          // 长句
      shortRatio: 0.2,
      paragraphLength: 200,
      rhetoric: ['data', 'metaphor'],
    },
    structure: {
      headingStyle: 'numbered-question',
      corePosition: 'opening',
      argumentPattern: 'progressive',  // 层层递进
      sectionCount: 6,
      ending: 'summary',
    },
    length: {
      targetWords: 4000,
      sectionCount: 6,
      perSectionWords: 650,
      variants: 1,
      keyQuotes: 2,
    },
    quality: {
      citationLimit: 15,       // 引用密
      bannedWords: ['赋能', '抓手'],
      dataFidelity: 'strict',
      aiTasteCheck: true,
      fewShotRefs: [],
    },
  },
  llmParams: {
    model: 'deepseek-chat',
    temperature: 0.3,
    topP: 0.85,
  },
};
```

**首次启动**：
- 在 `packages/core/src/writing-presets.ts` 导出 `SHIP_READY_PRESETS: WritingConfig[]`
- `packages/core/src/writing-config.ts` 加 `ensureShippedPresets()` 函数：检查 `~/.insight-os/writing-configs/` 目录，如果 3 套都不存在就写入
- `packages/core/src/writing-config.ts` 加 `getOrCreateShippedPreset(name)` 函数：读 preset，**不存在时返回 ship-ready 副本**（不写盘），保证向后兼容

---

## 6. API 设计

### 6.1 `GET /api/writing-config`

**Response**:
```json
{
  "presets": [
    { "name": "vincent-standard", "outputType": "article_full", "updatedAt": 1719000000000, "isSystem": true, "active": true },
    { "name": "client-comm", "outputType": "email", "updatedAt": 1719000000000, "isSystem": false, "active": false }
  ],
  "activeName": "vincent-standard"
}
```

**只返回元信息**（不返回 5 维度完整内容），减小 payload。

### 6.2 `GET /api/writing-config/:name`

**Response**:
```json
{
  "name": "vincent-standard",
  "outputType": "article_full",
  "description": "...",
  "forkedFrom": null,
  "updatedAt": 1719000000000,
  "dimensions": { ... },
  "llmParams": { ... }
}
```

**读全文**。YAML 解析失败返回 500 + 错误信息。

### 6.3 `PUT /api/writing-config/:name`

**Request Body**: 完整 `WritingConfig`
**Behavior**:
- 校验 name 合法（`^[a-z0-9-]+$`）
- 校验 5 维度参数范围（如 `tone` 必须在 0-100）
- **冲突检测**（mock 几条规则）：
  - `shortRatio > 0.7` 且 `paragraphLength > 200` → 警告
  - `stance === 'critical'` 且 `tone < 30` → 警告
- 写盘（原子写）
- 返回 `{ ok: true, warnings?: string[] }`

### 6.4 `DELETE /api/writing-config/:name`

**Behavior**:
- 检查是否是 `activeName` → 是则返回 400
- 删文件
- 返回 `{ ok: true }`

### 6.5 `POST /api/writing-config/:name/duplicate`

**Request Body**: `{ "newName": "my-copy" }`
**Behavior**: 复制 preset，clear `forkedFrom = srcName`
**Response**: 新 preset 全文

### 6.6 `POST /api/writing-config/active`

**Request Body**: `{ "name": "vincent-standard" }`
**Behavior**: 写 `AppConfig.activeWritingPreset`
**Response**: `{ ok: true, activeName: "vincent-standard" }`

### 6.7 `POST /api/writing-config/import`

**Request Body**: YAML 字符串（不是 multipart，避免文件上传复杂度）
**Behavior**:
- 解析 YAML
- 校验 schema
- 检查重名
- 保存（重名自动加 `_2`）
- 返回 `{ ok: true, name: "...", warnings?: string[] }`

### 6.8 `POST /api/writing-config/export`

**Request Body**: `{ "name": "...", "includeLLMParams": false, "includeFewShot": true }`
**Response**: `{ yaml: "...", filename: "vincent-standard.yaml" }`

---

## 7. UI 实施

### 7.1 页面路径

新增 `/settings/writing`，不在原 `/settings` 内（避免那个 720px 容器太挤）。

修改 `apps/web/app/settings/page.tsx` 加导航：
```tsx
<a href="/settings/writing" className="card card-hover" style={{ marginTop: 16 }}>
  <div className="row gap-12">
    <span style={{ fontSize: 20 }}>✎</span>
    <div>
      <div className="fw-600">写作风格配置</div>
      <div className="text-3 text-sm">3 套预设 · 当前: Vincent 标准版</div>
    </div>
    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>→</span>
  </div>
</a>
```

修改 `apps/web/app/layout.tsx` sidebar 加菜单项（在"设置"之前）：
```tsx
<a className="nav-item" href="/settings/writing">
  <span className="nav-icon">✎</span>
  <span>写作风格</span>
  <span className="pill pill-soft" style={{ marginLeft: 'auto' }}>新</span>
</a>
```

### 7.2 组件结构

```
WritingConfigClient (顶层)
  ├─ useState: screen ('list' | 'editor' | 'yaml')
  ├─ useState: editingPreset (WritingConfig | null)
  ├─ useEffect: GET /api/writing-config → 列表
  │
  ├─ screen === 'list'    → PresetList
  ├─ screen === 'editor'  → ConfigEditor
  └─ screen === 'yaml'    → YamlPreview
```

### 7.3 复用 globals.css 已有

**直接复用**（不要新写）：
- `.card` / `.card-pad-md` / `.card-header` / `.card-title` / `.card-body`
- `.btn` / `.btn-primary` / `.btn-accent` / `.btn-ghost` / `.btn-sm`
- `.input` / `.textarea` / `.select` / `.label` / `.label-hint`
- `.pill` / `.pill-soft` / `.pill-success` / `.pill-warning`
- `.callout` / `.callout-warning` / `.callout-accent`
- `.page-title` / `.page-subtitle`

**新增**（在 `globals.css` 末尾追加）：
- `.tabs` / `.tab` / `.tab-num`（顶部 4 屏切换）
- `.chip` / `.chip-group` / `.chip.active` / `.chip-multi`（维度 chip）
- `.slider` / `.slider-row` / `.slider-value`（滑块）
- `.toggle` / `.toggle.on`（开关）
- `.dim-section` / `.dim-header` / `.dim-body` / `.dim-letter`（折叠）
- `.editor-layout` / `.preview-panel` / `.preview-card`（左右栏）
- `.style-bar` / `.style-dot`（风格画像）
- `.yaml-view` / `.yaml-body` / `.yaml-line` / `.yaml-key` / `.yaml-string` / `.yaml-comment`
- `.modal-overlay` / `.modal-card` / `.modal-header` / `.modal-footer` / `.modal-close`
- `.dropzone` / `.preset-list` / `.preset-row` / `.system-preset-grid`
- `.theme-toggle`（右上角主题切换）
- `.fewshot-list` / `.fewshot-item`（few-shot 选择）

**所有新增样式都要支持 `data-theme="blue|green"` 双主题**（用 CSS 变量，不要写死颜色）。

### 7.4 关键交互细节

**编辑器（ConfigEditor）**：
- 5 维度用 accordion（默认第 1 个展开）
- 每个 slider `onInput` 时**只更新本地 state**（不调 API）
- 右上"保存"按钮：表单 `dirty` 时 `btn-accent`，否则 `btn:disabled`
- 离开页面前如果 `dirty` → `beforeunload` 提示

**实时预览（preview-card）**：
- 右侧固定 420px 宽
- 风格画像（6 个 dot 维度）随 slider 实时变
- 底部显示冲突警告（callout-warning）
- "⏎ 重新生成"按钮：调 `/api/writing-config/preview-mock`（mock 接口，返回一段固定样例文本）

**YAML 预览**：
- 用 `<pre>` + 简单语法高亮（关键字 primary 色，字符串 string 色，注释 italic gray）
- 复制按钮：复制到剪贴板
- 下载按钮：触发 `<a download>` 链接

**导入模态**：
- 拖拽区接受 `.yaml` 和 `.yml` 文件
- FileReader 读文本 → POST `/api/writing-config/import`
- 显示解析结果 + 冲突警告
- 改名后保存

**导出模态**：
- 显示当前 preset 元信息
- 2 个 toggle：`includeLLMParams`（默认关）/ `includeFewShot`（默认开）
- "下载 .yaml" / "复制到剪贴板" 按钮

---

## 8. 数据迁移 & 向后兼容

### 8.1 现有 outputs 数据的处理

`outputs` 表已有数据，**不受影响**：
- `outputs.writingStatus` 保持原值
- `outputs.scaffoldJson` 保持原值
- **不**在新 schema 加 `styleConfigId` 字段（避免迁移成本）

**新生成的 outputs**（v0.11+）：
- 调 scaffold API 时，从 active preset 读配置
- 不在 outputs 表存配置引用（保持简洁）
- 用户切换 preset 不影响历史 outputs

### 8.2 配置文件目录

- 首次启动：自动创建 `~/.insight-os/writing-configs/`
- 3 套 ship-ready 预设**首次启动时写入**（用 `ensureShippedPresets()`）
- 默认激活 `vincent-standard`

### 8.3 旧 prompt 文件的处理

- `writing-scaffold.ts` 和 `writing-companion.ts` 改为"薄壳"（导出一个 `buildXxxPrompt` 函数）
- **不删文件**（其他模块可能 import）
- 旧 SYSTEM 常量（如 `WRITING_SCAFFOLD_SYSTEM`）保留为 deprecated 导出，加 `@deprecated` JSDoc

---

## 9. 验收标准

### 9.1 功能验收

- [ ] **预设管理**：能创建 / 编辑 / 复制 / 删除 / 激活 / 导入 / 导出预设
- [ ] **3 套 ship-ready**：首次启动自动出现在"我的预设"列表
- [ ] **5 维度实时生效**：修改 active preset 的任一维度参数后，下一次写作的输出风格有可见变化
- [ ] **冲突检测**：违反"短句比 > 0.7 且段落 > 200 字"等规则时，保存 API 返回 warnings
- [ ] **YAML round-trip**：导出 → 重新导入 → 内容完全一致（除 updatedAt）
- [ ] **原子写**：写入时模拟断电（用 `kill -9` 测试），文件不损坏
- [ ] **active 切换**：切换 active preset 后，`/writing/new` 步骤 4 显示新的 outputType 模板

### 9.2 视觉验收

- [ ] **双主题**：blue / green 都能正常显示，无颜色不生效
- [ ] **响应式**：≥1024px 完整布局，<1024px 显示警告条
- [ ] **无 emoji**：除少量系统图标（如 ⏎ 重新生成）外，业务文案不用 emoji
- [ ] **DM Serif Display**：页面 h1 用衬线字体
- [ ] **行宽**：编辑器左栏 ≤ 720px，避免水平滚动

### 9.3 性能验收

- [ ] 切换预设 API 响应 < 200ms
- [ ] 加载 preset 全文 API 响应 < 300ms
- [ ] YAML 渲染（5 维度 + 50 行）< 100ms

### 9.4 测试覆盖

- [ ] `tests/writing-config.test.mjs`：覆盖 listPresets / readPreset / writePreset / deletePreset / duplicatePreset / getActivePreset / setActivePreset / ensureShippedPresets 全部 API
- [ ] **至少 1 个端到端测试**：创建自定义 preset → 激活 → 走完 4 步 wizard → 写作 → 输出风格变化

---

## 10. 风险 & 缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| L1 哲学层内容需要 Vincent 拍板 | L1 是定调，错了所有输出都偏 | 实施时**先用现有 prompt 内容反推 L1**，Vincent 后续按需调整 |
| 5 维度参数范围定错 | LLM 输出不稳定 | 在 3 套 ship-ready 预设上**反复测试**，调范围 |
| YAML 解析失败 | 用户配置丢失 | 写盘前备份 `*.yaml.bak`，读取时 try-catch |
| active preset 损坏 | 整个写作流程挂 | 启动时检查 active，不存在则 fallback 到 ship-ready |
| UI 复杂度高 | 实施延期 | **MVP 砍 2 个维度**（先做 A 风格 + C 结构 + E 质检，砍 B 句式和 D 长度） |
| 现有写作 prompt 改动 | 影响用户 | **保留旧 API 作为 deprecated**，新代码用 router 函数 |

---

## 11. 实施顺序（强建议按此执行）

### 阶段 1 · 地基（3-4 天）

1. ✅ 创建 L0 / L1 文件，写入内容
2. ✅ 创建 `WritingConfig` 类型 + 3 套 ship-ready 预设数据
3. ✅ 实现 `writing-config.ts` 的 8 个核心 API
4. ✅ 写 8 个 API 的单元测试

**验收**：能 `node -e` 调 API 读写预设，看 `~/.insight-os/writing-configs/` 文件正确生成

### 阶段 2 · Prompt 路由（2-3 天）

5. ✅ 把 4 套 L2 模板拆成独立文件
6. ✅ 写 `serializeDimensions()` 函数
7. ✅ 写 `buildScaffoldPrompt()` / `buildCompanionPrompt()` 路由函数
8. ✅ 改造 `writing-scaffold.ts` / `writing-companion.ts` 为薄壳
9. ✅ 改造 `apps/web/app/api/writing/scaffold/route.ts` 用新 API

**验收**：用同一主题/支撑卡，调 scaffold API 3 次（3 个不同 preset），输出风格明显不同

### 阶段 3 · 配置页 UI（4-5 天）

10. ✅ 加 sidebar 菜单 + settings 入口
11. ✅ 写 `PresetList` 组件
12. ✅ 写 `ConfigEditor` 组件（5 维度 + 实时预览）
13. ✅ 写 `YamlPreview` 组件
14. ✅ 写 `ImportModal` / `ExportModal`
15. ✅ 写 `globals.css` 新增样式

**验收**：能打开 `/settings/writing`，完成 "查看列表 → 编辑 → 保存 → 切到 YAML 预览 → 导出" 全流程

### 阶段 4 · 收尾（1-2 天）

16. ✅ 写 1 个 E2E 测试
17. ✅ 写 CHANGELOG
18. ✅ 跑通所有现有测试，确保没回归

---

## 12. 关键代码示例（关键路径）

### 12.1 serializeDimensions 示例

```typescript
// packages/core/src/writing-config.ts

export function serializeDimensions(dims: WritingConfig['dimensions']): string {
  const { style, sentence, structure, length, quality } = dims;

  return `
# 5 维度配置（用户定制 · 当前激活: ${dims.style.persona}）

## A 风格
- 语气温度: ${style.tone}/100（${style.tone > 60 ? '温暖' : style.tone > 30 ? '中性' : '冷峻'}）
- 立场: ${STANCE_LABELS[style.stance]}
- 人设: ${style.persona}
- 视角: ${VIEWPOINT_LABELS[style.viewpoint]}
- 术语密度: ${style.termDensity}
- LLM 创造性: ${style.temperature}

## B 句式
- 节奏: ${RHYTHM_LABELS[sentence.rhythm]}
- 短句占比: ${Math.round(sentence.shortRatio * 100)}%
- 段落字数: ${sentence.paragraphLength} 字
- 修辞偏好: ${sentence.rhetoric.map(r => RHETORIC_LABELS[r]).join('、')}

## C 结构
- 标题风格: ${HEADING_LABELS[structure.headingStyle]}
- 核心位置: ${POSITION_LABELS[structure.corePosition]}
- 论证模式: ${ARGUMENT_LABELS[structure.argumentPattern]}
- 章节数: ${structure.sectionCount}
- 收尾: ${ENDING_LABELS[structure.ending]}

## D 长度
- 目标字数: ${length.targetWords} 字
- 章节数: ${length.sectionCount}
- 单章字数: ${length.perSectionWords} 字
- 变体数: ${length.variants}
- 关键金句: ${length.keyQuotes} 个

## E 质检
- 引用上限: ${quality.citationLimit}
- 禁用词: ${quality.bannedWords.join('、') || '无'}
- 数据真实性: ${FIDELITY_LABELS[quality.dataFidelity]}
- AI 味自检: ${quality.aiTasteCheck ? '开启' : '关闭'}
- few-shot 引用: ${quality.fewShotRefs.length} 个
`.trim();
}

const STANCE_LABELS = { neutral: '中立', advisory: '顾问式建议', critical: '批判', coach: '教练' } as const;
// ... 其他 label 表
```

### 12.2 路由函数示例

```typescript
// packages/llm/src/prompts/writing/scaffold-router.ts

import { L0_FOUNDATION } from '../_base/system-foundation';
import { L1_PHILOSOPHY } from '../_base/philosophy';
import { L2_SCAFFOLD_ARTICLE_FULL } from './scaffold-article-full';
import { L2_SCAFFOLD_SPEECH } from './scaffold-speech';
import { L2_SCAFFOLD_BOOK_NOTE } from './scaffold-book-note';
import { serializeDimensions, WritingConfig, OutputType } from '@insight-os/core/writing-config';

const L2_TEMPLATES = {
  article_full: L2_SCAFFOLD_ARTICLE_FULL,
  speech: L2_SCAFFOLD_SPEECH,
  book_note: L2_SCAFFOLD_BOOK_NOTE,
  email: L2_SCAFFOLD_ARTICLE_FULL,  // email 复用 article_full
};

export interface ScaffoldInput {
  topicName: string;
  kernelHeadline: string;
  kernelSummary: string;
  coreBelief: string;
  cards: Array<{ id: string; title: string; oneSentenceInsight: string; antiCommonSense: string; evidenceLevel: string }>;
}

export function buildScaffoldPrompt(
  outputType: OutputType,
  input: ScaffoldInput,
  config: WritingConfig,
): { system: string; user: string } {
  const l2 = L2_TEMPLATES[outputType];
  const dimsStr = serializeDimensions(config.dimensions);

  const system = [
    L0_FOUNDATION,
    L1_PHILOSOPHY,
    l2,
  ].join('\n\n').replace('{{dimensions}}', dimsStr);

  const user = buildScaffoldUserPrompt(input);

  return { system, user };
}
```

### 12.3 原子写示例

```typescript
// packages/core/src/writing-config.ts

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yaml from 'yaml';  // 需要新增依赖

export function getUserConfigDir(): string {
  const home = os.homedir();
  return path.join(home, '.insight-os', 'writing-configs');
}

export async function writePreset(name: string, config: WritingConfig): Promise<void> {
  const dir = getUserConfigDir();
  await fs.mkdir(dir, { recursive: true });

  const filepath = path.join(dir, `${name}.yaml`);
  const tmpPath = `${filepath}.tmp`;
  const bakPath = `${filepath}.bak`;

  // 1. 写 .tmp
  const yamlStr = yaml.stringify(config);
  await fs.writeFile(tmpPath, yamlStr, 'utf-8');

  // 2. 备份旧文件
  try {
    await fs.copyFile(filepath, bakPath);
  } catch (e) {
    // 旧文件不存在，忽略
  }

  // 3. 原子重命名
  await fs.rename(tmpPath, filepath);
}

export async function readPreset(name: string): Promise<WritingConfig | null> {
  const filepath = path.join(getUserConfigDir(), `${name}.yaml`);
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return yaml.parse(content) as WritingConfig;
  } catch (e) {
    console.warn(`[writing-config] Failed to read ${name}:`, e);
    return null;
  }
}
```

---

## 13. 依赖说明

### 13.1 新增 npm 依赖

| 包 | 用途 | 大小 |
|---|---|---|
| `yaml` | YAML 解析/序列化 | ~150KB |
| `zod` | 5 维度参数校验 | ~50KB（已有则忽略） |

### 13.2 不新增

- ❌ 不引入 state management（用 React Context 即可）
- ❌ 不引入新 UI 库（用现有 .card / .btn / .input）
- ❌ 不引入 yaml 编辑器（用 `<pre>` + 简单高亮即可）

---

## 14. 不要做的事（重要）

1. **不要把 5 维度存到 outputs 表** — outputs 是结果，配置是输入，分开存
2. **不要在 prompt 里 hardcode 任何用户偏好** — 全部走 L3
3. **不要让 L2 模板直接 import L3** — L2 只引用 L0/L1，L3 由 router 动态注入
4. **不要破坏现有 4 步 wizard** — 保持 `/writing/new` 流程
5. **不要在 5 维度里加 "preset 名称" 字段** — name 是 metadata，不参与 prompt
6. **不要让 active preset 被删除** — 必须先切换才能删
7. **不要在 UI 暴露 .yaml 路径细节** — 用 "保存" / "导出" 动词，不暴露文件系统

---

## 15. 验收 demo 脚本

完成所有阶段后，跑这个 demo 验证端到端流程：

```bash
# 1. 启动项目
cd /Users/vincent/Documents/insight-os
npm run dev

# 2. 打开浏览器
# 访问 http://localhost:3000/settings/writing
# 看到 3 套 ship-ready 预设

# 3. 验证 5 维度生效
# - 编辑 "Vincent 标准版"，把 temperature 改成 0.9
# - 保存
# - 访问 /writing/new，走完 4 步
# - 看生成的文章语气明显更发散

# 4. 验证 YAML round-trip
# - 导出 "Vincent 标准版" 为 vincent-standard.yaml
# - 删除该 preset
# - 导入刚才的 yaml
# - 内容完全一致

# 5. 验证切换 preset
# - 激活 "客户沟通版"
# - 走 /writing/new
# - 看到 outputType 自动变成 email
# - 看到字数目标变成 800 字
```

---

## 附录 A · 原型 HTML 实施对照表

| 原型元素 | 实施位置 | 备注 |
|---|---|---|
| 4 屏 tab 切换 | `WritingConfigClient.tsx` | 用 useState |
| 主题切换器 | `globals.css` 已支持 | 复用 ThemeProvider |
| Preset 列表卡片 | `PresetList.tsx` | 当前激活用 card-hero 类 |
| 5 维度折叠 | `ConfigEditor.tsx` | 用 useState 跟踪 open 状态 |
| Slider | `ConfigEditor.tsx` + `.slider` CSS | onInput 实时更新 style-bar |
| Chip | `ConfigEditor.tsx` + `.chip` CSS | 单选/多选用 data-multi |
| 风格画像 | `ConfigEditor.tsx` 右侧 | 6 个 dot，slider 联动 |
| 冲突警告 | `ConfigEditor.tsx` 右侧底部 | 调 API 时返回 warnings |
| YAML 高亮 | `YamlPreview.tsx` | 用正则分类关键字/字符串/注释 |
| 导入拖拽区 | `ImportModal.tsx` | FileReader + 调 API |
| 导出 toggle | `ExportModal.tsx` | 2 个开关控制 YAML 内容 |

---

**END · 实施时遇到任何不明确的地方，参考 `/prototype/writing-config.html` 原型**
