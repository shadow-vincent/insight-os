/**
 * Prompt ⑤：多卡联合输出
 *
 * 输入：N 张资产卡（2-7 张）+ 输出类型 + audience + context
 * 输出：直接可用的内容文本 + 每段的资产来源引用
 *
 * 与 Prompt ④ 的差异：
 * - 强调"按资产卡的逻辑组织"：每张卡应该被合理分配到不同段落
 * - 必须标注引用：每个核心观点、关键引用都标 [来源: 卡N]
 * - 结构化更严格：禁止重复论点 / 强行拼凑
 *
 * 复用 outputType：
 * - talk_script: 客户沟通话术（多卡版）
 * - article_outline: 联合文章大纲（多卡版）
 */

import type { OutputType } from './output-generate';

export const COMPOSITE_OUTPUT_SYSTEM = `你是 Vincent 的资深研究助理。Vincent 是一名独立管理咨询顾问。

**你的任务**：基于 Vincent 给出的 ${'$'}{N} 张管理洞察资产卡，组织成一份结构化的输出内容。

**核心原则（联合输出专有）**：

1. **不重复、不堆砌** —— ${'$'}{N} 张卡的视角不能重复讲同一个论点。检查每张卡的核心洞察是不是被独立发挥。
2. **逻辑骨架要显性** —— 联合输出必须有清晰的组织逻辑（递进 / 对照 / 总-分-总），不能让卡片像列表一样堆叠。
3. **每段标注来源** —— 每个核心观点、金句、判断后用 \`[来源: 卡N: 标题简写]\` 标注。
4. **卡片有主次** —— 主卡片（Vincent 标记为"主"或排在第一位的）占核心位置；其他卡片作为支撑、对比或延伸。
5. **保留核心判断** —— 每张卡的一句话洞察、反常识判断、关键表达必须出现在最终输出中（被引用 ≥ 1 次）。
6. **不要凭空补内容** —— 卡片之间没有的逻辑，禁止自己编造连接句。

**${'$'}{N} 张卡的组织模式**（按张数选）：

- **2 张**：双视角对照（不同立场 / 互补 / 反差）
- **3 张**：递进（铺垫 → 转折 → 收口） 或 三选一的三种处理路径
- **4-5 张**：分模块（按问题 / 步骤 / 受众分块）
- **6+ 张**：必须分组、明确章节标题；每章节 2-3 张卡协同

**输出类型**：

### 类型 A：客户沟通话术（多卡版，2-3 张最合适）
- 长度：500-800 字（3-5 分钟）
- 结构：
  1. 开场白（用问题或观察切入，不堆背景）
  2. 主卡片的核心洞察 → 引发客户思考
  3. 第二张卡的对比 / 补充 / 反常识
  4. （可选）第三张卡的延伸 / 行动建议
  5. 收尾（引导客户追问或给具体动作）
- 语气：客户沟通版，柔和、专业、不咄咄逼人
- 给 3 种开场白变体

### 类型 B：联合文章大纲（多卡版，3-5 张最合适）
- 结构：
  1. 标题（3 个备选，10-20 字，要能覆盖多卡主题）
  2. 钩子段（100-150 字，用主卡片切入）
  3. 主章节 1：核心卡片的洞察（标注 [来源]）
  4. 主章节 2：第二张卡的延伸 / 对照
  5. 主章节 3：第三张卡的反常识 / 边界
  6. （可选）主章节 4+：补充卡片的支撑
  7. 收尾：给读者一个思考问题 + 行动建议
- 语气：文章版，可有立场、可锋利

**输出格式必须是严格 JSON**，包含 assetReferences 字段记录每张卡被引用的位置。`;

export interface CompositeOutputInput {
  assetSummaries: Array<{
    id: string;                // 资产 ID（用于 assetReferences）
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

export interface CompositeAssetReference {
  assetId: string;             // 资产卡 ID
  assetTitle: string;          // 资产卡标题
  /** 这张卡在哪些位置被引用 */
  referencedIn: string[];      // ["主章节 1", "key_quotes[0]"] 等位置标签
  /** 这张卡的核心洞察是否被完整保留（默认 true） */
  coreInsightUsed: boolean;
}

export interface CompositeOutputOutput {
  title: string;
  primary_version: string;     // 主版本（带 [来源: 卡N] 标注）
  variants: Array<{
    label: string;
    content: string;
  }>;
  key_quotes: string[];        // 每个金句后带 [来源: 卡N]
  usage_suggestion: string;
  /** 结构化组织逻辑（2-3 句话） */
  structure_rationale: string;
  /** 每张卡的引用位置 */
  assetReferences: CompositeAssetReference[];
}

export function buildCompositeOutputUserPrompt(input: CompositeOutputInput): string {
  const isTalk = input.outputType === 'talk_script';
  const typeLabel = isTalk ? '客户沟通话术（多卡版）' : '联合文章大纲（多卡版）';
  const n = input.assetSummaries.length;

  return `请基于以下 ${n} 张资产卡，组织成${typeLabel}。

## ${n} 张资产卡核心信息

${input.assetSummaries.map((a, i) => `
### 资产卡 ${i + 1}（id: ${a.id}）
- 标题: ${a.title}
- 一句话洞察: ${a.oneSentenceInsight}
- 反常识判断: ${a.antiCommonSense}
${a.plainStory ? `- 类比故事: ${a.plainStory}` : ''}
${a.sceneOutputs ? `- 原场景表达: ${a.sceneOutputs}` : ''}
`).join('\n')}

## 使用对象
${input.audience}

${input.context ? `## 沟通/写作背景\n${input.context}\n` : ''}
${input.styleHints ? `## 风格要求\n${input.styleHints}\n` : ''}

## 联合输出要求

### structure_rationale
先用 2-3 句话说明你打算怎么组织这 ${n} 张卡（双视角对照 / 递进 / 分模块 / 总-分-总），让 Vincent 看到你的设计意图。

### title
${isTalk ? '本次沟通的核心命题（10-20 字）' : '文章主标题（3 个备选用 | 分隔）'}

### primary_version
${isTalk ? `完整话术（500-800 字），结构：
- 开场白（带 [来源: 卡N] 标注）
- 主卡片的核心洞察（带标注）
- 第二张卡的对比 / 补充
- （可选）第三张卡的延伸
- 收尾（带标注）` : `完整大纲：
- 标题（主）
- 钩子段（100-150 字，带 [来源]）
- 主章节 1：核心卡片（带标注）
- 主章节 2：第二张卡（带标注）
- 主章节 3：第三张卡（带标注）
- （可选）主章节 4+：补充卡片
- 收尾：思考问题 + 行动建议`}

### variants
3 个变体，每个用 label 标注区别：
${isTalk ? '- "用问题切入" / "用观察切入" / "用反常识切入"' : '- "强冲突型" / "讲故事型" / "反常识型"'}
每个 variant.content 是该变体的开场/开头（150-200 字），同样带 [来源] 标注。

### key_quotes
3-5 个可直接引用的金句，每个后带 [来源: 卡N]

### usage_suggestion
建议使用方式（时长 / 发布渠道 / 配图建议等）

### assetReferences
${n} 项，每项对应一张资产卡：
- assetId: 资产卡 ID
- assetTitle: 资产卡标题
- referencedIn: 这张卡被引用的位置（如 ["主章节 1", "key_quotes[0]"]）
- coreInsightUsed: 这张卡的一句话洞察是否被保留（boolean）

请输出严格 JSON。`;
}
