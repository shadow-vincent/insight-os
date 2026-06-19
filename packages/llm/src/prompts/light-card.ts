/**
 * Prompt ①：轻量卡整理
 *
 * 输入：原始观察（粘贴文本 / Markdown / 项目资料片段）
 * 输出：轻量卡的结构化字段
 *
 * 设计原则：
 * - 明确业务角色（资深管理咨询顾问的助手）
 * - 强制 JSON 结构化
 * - 字段都有合法值约束
 * - 必填字段不能省略
 */

export const LIGHT_CARD_SYSTEM = `你是 Vincent 的资深研究助理。Vincent 是一名独立管理咨询顾问，专门服务企业的数字化与 AI 转型。

**你的任务**：把 Vincent 粘贴的零散内容（语音转写、读书笔记、客户对话、项目资料片段、文章摘录）整理成一张「轻量卡」。轻量卡的作用是**快速判断这条内容是否值得深入加工为管理洞察资产**。

**核心原则**：
1. **不夸大，不编造**：原始内容没有的就不要补充。
2. **不空话**：洞察要落到具体问题上，不要"赋能""升级"这种套话。
3. **不丢失细节**：关键术语、人名、数据、案例要保留。
4. **快速判断优先级**：根据"是否反常识"和"是否可输出"给 A/B/C 优先级。

**输出格式必须是严格 JSON**（不要任何解释、不要 markdown 代码块标记）。`;

export interface LightCardInput {
  rawContent: string;
  sourceType: 'manual' | 'markdown' | 'project' | 'article' | 'voice';
}

export interface LightCardOutput {
  title: string;
  source_type: 'voice' | 'knowledge_card' | 'project' | 'article' | 'original' | 'unknown';
  summary: string;
  keywords: string[];
  scene: string;
  initial_insight: string;
  anti_common_sense: string | null;
  possible_use_cases: string[];
  recommended_next_action: 'archive' | 'candidate' | 'socratic' | 'upgrade_to_asset' | 'generate_output';
  priority: 'A' | 'B' | 'C';
  reasoning: string;
}

export function buildLightCardUserPrompt(input: LightCardInput): string {
  return `请将以下内容整理为「轻量洞察卡」。

## 原始内容
"""
${input.rawContent}
"""

## 来源类型
${input.sourceType}

## 输出字段说明（必须全部填写，不能省略）
- title: 10-20 字的标题，要能直接当资产卡标题用
- source_type: 推断来源（voice=语音转写 / knowledge_card=知识卡片 / project=项目资料 / article=文章摘录 / original=原创 / unknown=不明）
- summary: 1-2 句话的摘要
- keywords: 3-5 个关键词数组
- scene: 一句话说明这条内容产生的场景（"与某客户 CFO 沟通"/"读《卓有成效》第三章"等）
- initial_insight: 从内容中提取的核心洞察（1-2 句），**没有就老实写"无明确洞察"**
- anti_common_sense: 反常识判断（如果有），没有就给 null
- possible_use_cases: 可能的输出场景数组（"客户沟通话术"/"公众号文章"/"方案页"/"课程小节"等），没有就给空数组
- recommended_next_action: 推荐下一步
   - archive: 内容质量不够，直接归档
   - candidate: 有初步洞察，进候选池
   - socratic: 需要苏格拉底三问校准
   - upgrade_to_asset: 已经是成熟洞察，直接升级资产卡
   - generate_output: 已经能直接输出内容
- priority: A / B / C
   - A: 反常识 + 高反密度 + 可输出
   - B: 有洞察但不锋利
   - C: 一般观察
- reasoning: 给 priority 的简短理由

请输出 JSON。`;
}
