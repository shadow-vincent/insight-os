/**
 * Prompt ②：苏格拉底三问校准
 *
 * 输入：轻量卡的核心洞察
 * 输出：三问答案 + 是否值得入库的建议
 *
 * 苏格拉底三问：
 * 1. 这个观点的反面是什么？
 * 2. 这个观点成立的边界是什么？
 * 3. 如何讲给不懂的人听？
 */

export const CALIBRATE_SYSTEM = `你是 Vincent 的资深研究助理。Vincent 是一名独立管理咨询顾问。

**你的任务**：对 Vincent 给出的轻量卡洞察执行「苏格拉底三问」校准。这是 v0.1 的**质量门**——只通过校准的洞察才能升级为资产卡。

**苏格拉底三问**：
1. **反面观点是什么？** —— 强观点必有强反驳。如果反驳很弱，说明洞察本身也很弱。
2. **成立的边界是什么？** —— 任何洞察都有适用条件，不讲边界等于不严谨。
3. **如何讲给不懂的人听？** —— 如果只能用术语解释，说明洞察还没下沉到「可调用」的程度。

**核心原则**：
1. **三问必须给具体答案**，**质量要求**：不空话、不夸大、不敷衍、不编造。每条判断必须可被具体场景验证。

**禁止"看情况""具体问题具体分析"这种敷衍。
2. **要尖锐**：如果洞察扛不住三问，要明确说"不建议升级"，不要勉强。
3. **不要复读原文**：校准是基于洞察**生成新视角**，不是把洞察换个说法复述。
4. **如果原始洞察太模糊**，直接返回 should_promote=false，理由是"洞察不清晰，需要更多输入"。

**输出格式必须是严格 JSON**。`;

export interface CalibrateInput {
  initialInsight: string;
  antiCommonSense?: string | null;
  sourceContext?: string;
}

export interface CalibrateOutput {
  opposite_view: string;
  boundary_conditions: string;
  plain_story: string;
  calibrated_insight: string;
  anti_common_sense_refined: string;
  should_promote: boolean;
  not_promote_reason: string | null;
  target_path: 'asset' | 'candidate' | 'archive';
  priority: 'A' | 'B' | 'C';
  internal_critique: string;
}

export function buildCalibrateUserPrompt(input: CalibrateInput): string {
  return `请对以下洞察执行苏格拉底三问校准。

## 待校准洞察
"""
${input.initialInsight}
"""

${input.antiCommonSense ? `## 原始反常识判断\n${input.antiCommonSense}\n` : ''}
${input.sourceContext ? `## 来源上下文\n${input.sourceContext}\n` : ''}

## 三问（必须给出具体答案，不要敷衍）

**Q1：反面观点是什么？**
强观点必有强反驳。如果反驳很弱，说明洞察本身也很弱。

**Q2：这个观点成立的边界是什么？**
任何洞察都有适用条件。明确说出：在什么场景下成立？在什么场景下不成立？

**Q3：如何讲给不懂的人听？**
要求：用一个具体的类比、生活场景或小故事，让一个完全外行能在 30 秒内听懂这个洞察。

## 输出字段说明（必须全部填写）
- opposite_view: Q1 的答案（具体反驳观点 + 为什么这个反驳有道理）
- boundary_conditions: Q2 的答案（列出 2-3 个明确的边界）
- plain_story: Q3 的答案（具体类比或小故事，30 秒能讲完）
- calibrated_insight: 三问之后的**新**核心判断（不是原文复述，是经过校准后的锐化版本）
- anti_common_sense_refined: 校准后的反常识判断（更锋利）
- should_promote: true / false
- not_promote_reason: 如果 should_promote=false，说明原因（"洞察不清晰"/"反驳太弱"/"边界太窄"等）
- target_path: 
   - asset: 通过校准，值得升级为资产卡
   - candidate: 有价值但需要更多素材，先放候选池
   - archive: 价值不够，建议归档
- priority: A / B / C
- internal_critique: 你作为助手的内心独白——"这个洞察真正厉害的地方在哪"或"这个洞察最弱的地方在哪"

请输出 JSON。`;
}
