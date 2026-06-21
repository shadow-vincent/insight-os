/**
 * Prompt ④：场景输出生成
 *
 * 输入：1-3 张资产卡 + 输出类型 + 参数
 * 输出：直接可用的内容文本
 *
 * v0.1 只做 2 种输出：
 * - talk_script: 客户沟通话术（300-500 字，含开场白 + 3 个核心观点 + 收尾）
 * - article_outline: 公众号文章大纲（含标题、钩子、3-5 个核心段落）
 *
 * V1.1+ 新增：
 * - article_full: 公众号完整文章（1500-2500 字，3-5 章节，Vincent 直接可发）
 */

export const OUTPUT_GENERATE_SYSTEM = `你是 Vincent 的资深研究助理。Vincent 是一名独立管理咨询顾问。

**你的任务**：基于 Vincent 给出的 1-3 张管理洞察资产卡，生成指定场景的输出内容。

**核心原则**：
1. **保留核心判断** —— 资产卡的核心洞察、反常识判断、关键表达必须出现在输出中。
2. **匹配目标场景的语气** —— 客户沟通要"轻"，公众号要"准"，方案要"全"。
3. **不要堆术语** —— 客户不懂的概念要用类比讲清楚。
4. **3 个版本** —— 输出 3 种开头/角度的变体，让 Vincent 自己挑。
5. **标注使用建议** —— 在最后给出"建议使用方式"（30 秒/2 分钟/5 分钟等）。

**两种输出类型**：

### 类型 A：客户沟通话术（talk_script）
- 长度：300-500 字（2-3 分钟讲完）
- 结构：
  1. 开场白（用一个问题或一个观察切入，不要从"今天我来介绍"开始）
  2. 核心观点 1（用资产卡的一句话洞察）
  3. 核心观点 2（用反常识判断或适用边界）
  4. 收尾（引导客户追问或给客户一个具体动作）
- 语气：客户沟通版，柔和、专业、不咄咄逼人
- 给 3 种开场白变体

### 类型 B：公众号文章大纲（article_outline）
- 结构：
  1. 标题（3 个备选，10-20 字）
  2. 钩子段（100-150 字，让读者继续读）
  3. 核心观点 1-3（每个 80-120 字）
  4. 反常识判断（独立成段）
  5. 收尾（给读者一个思考问题或可执行建议）
- 语气：文章版，可有立场、可锋利、可有 Vincent 自己的判断

**输出格式必须是严格 JSON**。`;

export type OutputType = 'talk_script' | 'article_outline' | 'article_full' | 'speech' | 'book_note' | 'email';

export interface OutputGenerateInput {
  assetSummaries: Array<{
    title: string;
    oneSentenceInsight: string;
    antiCommonSense: string;
    sceneOutputs?: string;
    plainStory?: string;
  }>;
  outputType: OutputType;
  audience: string;
  context?: string;
  styleHints?: string;
}

export interface OutputGenerateOutput {
  title: string;
  primary_version: string;
  variants: Array<{
    label: string;
    content: string;
  }>;
  usage_suggestion: string;
  key_quotes: string[];
}

export function buildOutputGenerateUserPrompt(input: OutputGenerateInput): string {
  const isTalk = input.outputType === 'talk_script';
  const typeLabel = isTalk ? '客户沟通话术' : '公众号文章大纲';

  return `请基于以下 ${input.assetSummaries.length} 张资产卡，生成${typeLabel}。

## 资产卡核心信息
${input.assetSummaries.map((a, i) => `
### 资产卡 ${i + 1}: ${a.title}
- 一句话洞察: ${a.oneSentenceInsight}
- 反常识判断: ${a.antiCommonSense}
${a.plainStory ? `- 类比故事: ${a.plainStory}` : ''}
${a.sceneOutputs ? `- 原场景表达: ${a.sceneOutputs}` : ''}
`).join('\n')}

## 使用对象
${input.audience}

${input.context ? `## 沟通/写作背景\n${input.context}\n` : ''}
${input.styleHints ? `## 风格要求\n${input.styleHints}\n` : ''}

## 输出要求

### title
${isTalk ? '本次沟通的核心命题（10-20 字）' : '文章主标题（3 个备选用 | 分隔）'}

### primary_version
${isTalk ? `完整话术（300-500 字），包含：
- 开场白
- 核心观点 1（基于一句话洞察）
- 核心观点 2（基于反常识判断或适用边界）
- 收尾（引导客户追问）` : `完整大纲，包含：
- 标题（主）
- 钩子段（100-150 字）
- 核心观点 1-3（每个 80-120 字概要）
- 反常识判断（独立成段）
- 收尾（给读者一个思考问题）`}

### variants
3 个变体，每个用 label 标注区别：
${isTalk ? '- "用问题切入" / "用观察切入" / "用反常识切入"' : '- "强冲突型" / "讲故事型" / "反常识型"'}
每个 variant.content 是该变体的开场/开头（150-200 字），让 Vincent 选最喜欢的。

### usage_suggestion
建议使用方式（时长/发布渠道/配图建议等）

### key_quotes
3-5 个可直接引用的金句（从资产卡中提炼或重新表达）

请输出严格 JSON。`;
}
