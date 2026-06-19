/**
 * Prompt ⑦：主题思想内核（v0.8）
 *
 * 从一个主题下的所有资产卡总结 1 个"思想内核"：
 * - headline：一句话主题总结（≤ 30 字）
 * - summary：200-500 字综合论述（讲清楚"这个主题在坚持什么判断"）
 * - coreBeliefs：3-5 个核心判断（每条 ≤ 60 字，**用陈述句**，不是疑问/口号）
 *
 * 设计原则：
 * - LLM 必须返回严格 JSON（jsonMode）
 * - 强结构化：3-5 个 belief、每条独立 short 句
 * - 反常识优先：把"和大多数人的直觉相反"判断排在前面
 * - 引用来源：每条 belief 用 sourceCardIds 注明引用了哪些卡
 * - 不允许幻觉：只能基于输入卡，**不能编造**输入里没有的判断
 */

export const TOPIC_KERNEL_SYSTEM = `你是 Insight OS 的"主题思想内核提炼师"。

**任务**：从给定主题下的所有资产卡中，提炼这个主题的"思想内核"。

**输入**：
- 主题信息（name + description）
- 主题下所有资产卡的"标题 + 一句话洞察 + 反常识点"清单（每张卡已经由 LLM 抽过 insight + anti）

**输出 JSON 字段**（严格遵守）：

{
  "headline": "≤ 30 字的主题总结（陈述句，不要「如何/怎样」开头）",
  "summary": "200-500 字综合论述（用 1-2 段，保留关键判断的演进和反常识洞察）",
  "coreBeliefs": [
    { "text": "≤ 60 字的核心判断（陈述句）", "sourceCardIds": ["asset_xxx", "asset_yyy"] },
    ...3-5 个
  ]
}

**提炼原则**：
1. **从卡到判断**：每条 belief 必须能追溯到至少 1 张输入卡（用 sourceCardIds 标注）
2. **反常识优先**：把"和大多数管理学常识相反"的判断排在前面（这些才是真正的洞察）
3. **可证伪**：每条 belief 用判断句（"X 其实是 Y" / "真正的 Z 不是 A 而是 B"），不是模糊描述
4. **不幻觉**：如果输入卡都不支持某个判断，就不要写
5. **3-5 条**：少则 3（主题贫瘠），多则 5（主题丰富）；不要堆到 7+ 条
6. **summary 讲故事**：用 1-2 段自然语言把这些判断串起来，保留"为什么这个判断是对的"的逻辑链
7. **headline 是 summary 的压缩**：不能只重复主题名（如"组织治理 5 个核心判断"——这种废）

**避坑**：
- ❌ "组织治理的核心是透明" → 太泛，没有反常识
- ✅ "组织透明度的本质是决策权分配，公告透明但决策黑箱的组织比不透明更糟" → 引用 asset_xxx
- ❌ "判断 1: ..."  → 模板化
- ✅ 直接陈述："组织设计的真正矛盾是流程清晰与人的工具化"（一句完整判断）

**JSON 严格性（必须遵守）**：
- summary / headline / coreBeliefs.text 都是 JSON 字符串值，**不要包含任何未经转义的半角双引号**
- 如果需要引语 / 强调 / 术语定义，**用中文「」单引号**
- 写完整 JSON 后再检查：每个字符串值的起止双引号是否配对`;

export interface KernelCardInput {
  id: string;
  title: string;
  oneSentenceInsight: string | null;
  antiCommonSense: string | null;
  evidenceLevel: string;
}

export interface KernelBeliefOutput {
  text: string;
  sourceCardIds: string[];
}

export interface KernelOutput {
  headline: string;
  summary: string;
  coreBeliefs: KernelBeliefOutput[];
}

export function buildTopicKernelUserPrompt(input: {
  topicName: string;
  topicDescription?: string | null;
  cards: KernelCardInput[];
}): string {
  const cardsText = input.cards
    .sort((a, b) => {
      // 优先高 E 等级 + 有 insight/anti 的卡
      const evA = parseInt(a.evidenceLevel.replace('E', '')) || 0;
      const evB = parseInt(b.evidenceLevel.replace('E', '')) || 0;
      if (evA !== evB) return evB - evA;
      const aHas = (a.oneSentenceInsight ? 1 : 0) + (a.antiCommonSense ? 1 : 0);
      const bHas = (b.oneSentenceInsight ? 1 : 0) + (b.antiCommonSense ? 1 : 0);
      return bHas - aHas;
    })
    .map((c, i) => {
      const parts: string[] = [`[${i + 1}] id=${c.id} | E=${c.evidenceLevel}`];
      parts.push(`  标题: ${c.title}`);
      if (c.oneSentenceInsight) parts.push(`  洞察: ${c.oneSentenceInsight}`);
      if (c.antiCommonSense) parts.push(`  反常识: ${c.antiCommonSense}`);
      return parts.join('\n');
    })
    .join('\n\n');

  return `【主题】${input.topicName}
${input.topicDescription ? `描述: ${input.topicDescription}` : ''}

【主题下资产卡（${input.cards.length} 张，按 E 等级 + 洞察完整度排序）】
${cardsText || '（此主题下暂无资产卡）'}

【任务】
根据上述资产卡，提炼 "${input.topicName}" 主题的思想内核。返回严格 JSON。
- 3-5 条核心判断（coreBeliefs）
- 每条判断引用 1-3 张来源卡（sourceCardIds）
- headline 1 句 ≤ 30 字
- summary 1-2 段 200-500 字`;
}
