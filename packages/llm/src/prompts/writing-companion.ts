/**
 * Prompt ⑨：写作陪练（v0.9.4）
 *
 * 3 动作：
 * - counter_argument — 反方观点（"读者会怎么挑战你的论点"）
 * - recommend_cards — 推荐能引用的卡（"这段主题能引用你的资产库里哪几张"）
 * - duplicate_check — 重复论点检测（"这个论点你过去 6 个月讲过没"）
 *
 * 设计原则：
 * - **陪练 ≠ 替写** — LLM 只给挑战/推荐/检测，**不替 Vincent 写**
 * - **具体到可执行** — 反方要 3 个具体问题，不空泛
 * - **严格 JSON** — 3 个动作返回不同 schema，遵守字段类型
 */

export const WRITING_COMPANION_SYSTEM = `你是 Insight OS 的"写作陪练"。

**角色**：你是一个**有判断的编辑**——不是帮作者写，是帮作者**磨**观点。

**任务**：根据当前动作，提供对 Vincent 当前段落的"挑战 / 推荐 / 检测"。

**输出 JSON**（根据动作 type 字段）：

### A. counter_argument（反方观点）
{
  "type": "counter_argument",
  "questions": [
    "问题 1（具体到读者身份+具体场景）",
    "问题 2",
    "问题 3"
  ]
}
- 3 个问题必须**不同角度**（事实/逻辑/场景/反例）
- 站在读者立场（"读完这段我最大的疑问是…"）
- **不要回答问题**，只提问题

### B. recommend_cards（推荐能引用的卡）
{
  "type": "recommend_cards",
  "assetIds": ["asset_xxx", "asset_yyy"],
  "reasoning": "为什么这 2 张适合（1-2 句）"
}
- 最多 2 张卡
- 必须从输入的 assets 列表里选
- 理由要"这 1 段 + 这 1 张卡" 的具体连接

### C. duplicate_check（重复论点检测）
{
  "type": "duplicate_check",
  "previousOutputs": [
    { "title": "文章标题", "date": "2025-09-15", "overlap": "与当前段落的重叠判断（1 句）" },
    ...0-3 条
  ]
}
- 0-3 条历史文章
- 只列**真正重叠**的，不是任何引用过相关卡的都算
- 没有重叠就空数组

**输入参数**：
- action: 'counter_argument' | 'recommend_cards' | 'duplicate_check'
- currentText: Vincent 当前段落（≥ 30 字）
- coreBelief: 当前文章的核心判断
- availableCards: 资产库里能引用的卡列表（id + title + insight + anti）
- recentOutputs: 最近 6 个月的输出列表（id + title + date + 关联的 assetIds）

**JSON 严格性**：
- 字符串值不要嵌套半角双引号
- 中文引号用「」`;

export interface CompanionCardInput {
  id: string;
  title: string;
  oneSentenceInsight: string | null;
  antiCommonSense: string | null;
  evidenceLevel: string;
}

export interface CompanionRecentOutput {
  id: string;
  title: string;
  date: string;
  assetIds: string[];
}

export type CompanionAction = 'counter_argument' | 'recommend_cards' | 'duplicate_check';

export interface CompanionResponse {
  type: CompanionAction;
  // counter_argument
  questions?: string[];
  // recommend_cards
  assetIds?: string[];
  reasoning?: string;
  // duplicate_check
  previousOutputs?: Array<{ title: string; date: string; overlap: string }>;
}

export function buildWritingCompanionUserPrompt(input: {
  action: CompanionAction;
  currentText: string;
  coreBelief: string;
  cards: CompanionCardInput[];
  recentOutputs: CompanionRecentOutput[];
}): string {
  const actionLabel = {
    counter_argument: 'A. 反方观点 — 列出读者会挑战你的 3 个问题',
    recommend_cards: 'B. 推荐能引用的卡 — 从可用卡里选最多 2 张',
    duplicate_check: 'C. 重复论点检测 — 对比过去 6 个月输出看有没有类似判断',
  }[input.action];

  const cardsText = input.cards.slice(0, 30).map(c => {
    const parts: string[] = [`- id=${c.id} | ${c.title}`];
    if (c.oneSentenceInsight) parts.push(`    洞察: ${c.oneSentenceInsight}`);
    if (c.antiCommonSense) parts.push(`    反常识: ${c.antiCommonSense}`);
    return parts.join('\n');
  }).join('\n');

  const outputsText = input.recentOutputs.slice(0, 30).map(o => {
    return `- id=${o.id} | ${o.date} | ${o.title}\n    引用卡: ${o.assetIds.slice(0, 3).join(', ')}`;
  }).join('\n');

  return `【动作】${actionLabel}

【当前段落】
${input.currentText}

【本文核心判断】
${input.coreBelief}

【可用卡（资产库）】
${cardsText || '（无）'}

【过去 6 个月输出（仅 writing 类型）】
${outputsText || '（无）'}

【任务】
按"${actionLabel}"执行，返回严格 JSON。`;
}
