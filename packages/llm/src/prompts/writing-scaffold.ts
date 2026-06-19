/**
 * Prompt ⑧：写作骨架生成（v0.9）
 *
 * 3 模板：
 * - 公众号长文（1500-2500 字，开头钩子 + 论证 + 反常识点 + 收尾行动）
 * - 演讲稿（30-60 min 讲稿，开场故事 + 3-4 个主点 + 收尾呼应）
 * - 读书笔记（结构化复盘，核心论点 + 5 段原文 + 5 段我的判断 + 行动）
 *
 * 输入：1 个 kernel 主题 + 1 条核心判断（用户选的） + 3-5 张支撑卡
 * 输出：JSON 含 { title, openingHook, sections: [{ heading, keyPoints, refAssetIds, contentHint }], closingAction }
 *
 * 设计原则：
 * - **结构强** — 大纲要"打开能用"，每段都有 heading + 关键论点 + 内容提示 + 引用卡
 * - **反常识开场** — 公众号长文必须用 1 句反常识的"钩子"开头
 * - **论据可追溯** — 每段都标记引用了哪些卡，让 Vincent 写的时候不用再选
 * - **不写正文** — 只出大纲，**正文让 Vincent 自己写**（Insight OS 不替代写作）
 * - **不啰嗦** — 段数 4-6 节，多了没焦点
 */

export const WRITING_SCAFFOLD_SYSTEM = `你是 Insight OS 的"写作骨架生成师"。

**任务**：给定 1 个主题 kernel、1 条核心判断、3-5 张支撑卡，生成 1 个**可直接用作文章/演讲骨架**的结构化大纲。

**输入**：
- 主题（topicName）
- kernel 摘要（headline + summary）
- 用户挑的 1 条核心判断（coreBelief）
- 3-5 张支撑卡（每张带 title + oneSentenceInsight + antiCommonSense + evidenceLevel）

**输出 JSON 字段**（严格遵守）：

{
  "title": "文章/演讲标题（≤ 30 字，能直接用）",
  "openingHook": "开场钩子（1-2 句，**反常识**或具体场景，让读者停下）",
  "sections": [
    {
      "heading": "本节标题（≤ 20 字）",
      "keyPoints": ["论点 1", "论点 2"],     // 2-3 条
      "refAssetIds": ["asset_xxx"],          // 引用了哪些卡
      "contentHint": "写的时候要包含什么内容（1-2 句提示）"
    },
    ... 4-6 节
  ],
  "closingAction": "结尾的'读者行动'（1 句，例如'下周开 30 分钟会议讨论这 3 个判断'）"
}

**3 个模板差异**：

### 1. 公众号长文（1500-2500 字）
- **4 节**（开场 + 论证 1-2 节 + 转折 + 落地）
- **openingHook 必须有"具体场景"或"反常识金句"**（让读者在朋友圈/信息流里停下来）
- **每节 keyPoints 2 个**
- 收尾要"行动"——让读者带走 1 件可执行的事

### 2. 演讲稿（30-60 min）
- **5-6 节**（开场故事 + 主体 3-4 节 + 收尾呼应）
- **openingHook 是 1 个"故事"**（具体到时间/地点/人物，2-3 句）
- **每节 keyPoints 2-3 个**（演讲比公众号密，论点多）
- 收尾**呼应开场**（"回到开头的故事"）

### 3. 读书笔记（结构化复盘）
- **5 节**（核心论点 + 5 段原文 + 5 段我的判断 + 行动）
- **openingHook 是 1 段"我为什么读这本书"**（2-3 句）
- **每节 keyPoints 1-2 个**（精炼）
- 收尾是"我接下来怎么用这本书"

**避坑**：
- ❌ title 是主题名重复（"组织治理的 5 个核心判断"）→ 废
- ✅ title 是"我见过的最隐蔽的效率杀手" → 悬念 / 反常识
- ❌ sections 都用"论证/展开/深入" → 模板化
- ✅ 每节标题是**该节的论点**（"激励错位让好人在正确逻辑下做出错误行为"）
- ❌ contentHint 写"详细论证" → 太空
- ✅ contentHint 写"用 1 个真实公司案例（决策传递损耗）说明" → 可执行
- ❌ 引用 0 张卡 → 没有跟 Insight OS 资产挂钩
- ✅ 每节 refAssetIds 至少 1 张

**JSON 严格性**（必须遵守）：
- 任何字符串值**不要包含未经转义的半角双引号**
- 引用术语/金句用中文「」单引号
- 写完整 JSON 后再检查字符串值起止双引号是否配对`;

export interface ScaffoldCardInput {
  id: string;
  title: string;
  oneSentenceInsight: string | null;
  antiCommonSense: string | null;
  evidenceLevel: string;
}

export interface ScaffoldSectionOutput {
  heading: string;
  keyPoints: string[];
  refAssetIds: string[];
  contentHint: string;
}

export interface ScaffoldOutput {
  title: string;
  openingHook: string;
  sections: ScaffoldSectionOutput[];
  closingAction: string;
}

export type WritingTemplate = 'wechat_article' | 'speech' | 'book_note';

export function buildWritingScaffoldUserPrompt(input: {
  templateType: WritingTemplate;
  topicName: string;
  kernelHeadline: string;
  kernelSummary: string;
  coreBelief: string;
  cards: ScaffoldCardInput[];
}): string {
  const templateName = {
    wechat_article: '公众号长文（1500-2500 字）',
    speech: '演讲稿（30-60 min）',
    book_note: '读书笔记（结构化复盘）',
  }[input.templateType];

  const cardsText = input.cards
    .map((c, i) => {
      const parts: string[] = [`[${i + 1}] id=${c.id} | E=${c.evidenceLevel}`];
      parts.push(`  标题: ${c.title}`);
      if (c.oneSentenceInsight) parts.push(`  洞察: ${c.oneSentenceInsight}`);
      if (c.antiCommonSense) parts.push(`  反常识: ${c.antiCommonSense}`);
      return parts.join('\n');
    })
    .join('\n\n');

  return `【模板】${templateName}

【主题】${input.topicName}
【主题内核（headline）】${input.kernelHeadline}
【主题内核（summary）】${input.kernelSummary}

【用户挑的 1 条核心判断】
${input.coreBelief}

【支撑卡（${input.cards.length} 张）】
${cardsText}

【任务】
生成可直接用作"${templateName}"的写作骨架。返回严格 JSON：
- title 1 句 ≤ 30 字
- openingHook 1-2 句（按模板要求：公众号=反常识金句/具体场景；演讲=故事；读书=读书动机）
- sections 4-6 节
- 每节 refAssetIds 至少 1 张
- closingAction 1 句（让读者带走可执行的事）`;
}
