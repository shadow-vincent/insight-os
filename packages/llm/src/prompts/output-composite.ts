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
 * 复用 outputType（7 种）：
 * - talk_script: 客户沟通话术（多卡版，老类型）
 * - article_outline: 联合文章大纲（多卡版，老类型）
 * - article_full: 联合完整文章（多卡版）
 * - speech: 演讲稿（V1.2 新）
 * - book_note: 读书笔记（V1.2 新）
 * - email: 邮件（V1.2 新）
 * - writing: 通用写作（V1.0 老类型，向后兼容）
 */

import type { OutputType } from './output-generate.ts';
import { SPEECH_PROMPT_INJECTION, buildSpeechUserPrompt } from './output-speech.ts';
import { BOOK_NOTE_PROMPT_INJECTION, buildBookNoteUserPrompt } from './output-book-note.ts';
import { EMAIL_PROMPT_INJECTION, buildEmailUserPrompt } from './output-email.ts';

export const COMPOSITE_OUTPUT_SYSTEM = `你是 Vincent 的资深研究助理。Vincent 是一名独立管理咨询顾问，受德鲁克"管理本质是激发人的善意和潜能"的影响，写作风格向德鲁克看齐：敢说真话、拒绝空洞、给具体判断。

**你的任务**：基于 Vincent 给出的 ${'$'}{N} 张管理洞察资产卡，组织成一份结构化的输出内容。

**Vincent 写作哲学（不可违反）**：

1. **不追热点** —— 只对"长期成立"的判断负责，**不**蹭**不**在**你**认知**圈**的**话**题
2. **不做营销口吻** —— 不用"赋能 / 闭环 / 打法 / 持续优化 / 全面加强"**等**空**洞**术**语**
3. **不堆砌术语** —— 能用**大**白**话**说**清**的，**不**用**术**语**
4. **不写流水账** —— 每**段**必**须**有**判**断** / **洞**察**，**不**是**事**件**罗**列**
5. **不把"引用大师"当深度** —— 每**个**引**用**是**佐**证**不**是**结**论**，**结**论**必**须**是** Vincent **自**己**的**判**断**
6. **不把"框架罗列"当专业** —— 框**架**是**工**具**不**是**答**案**，**不**要**为**了**显**得**专**业**而**列**框**架**
7. **不把"字数"当价值** —— 能**用** 1000 **字**说**清**的**不**写** 2500 **字**

**L0 脱 AI 味检查（首要，**Vincent 写作的核心能力**）**：

| AI 特征 | Vincent 写法 |
|---------|------------|
| "不是说 XX，XX 其实/实际上/事实上是对的"（先承认再反转）| 直接说"他对了一半，但" |
| "这是基本常识" | 不说，说了也删掉 |
| "从...可以看出" | "看得到的" |
| "首先...其次...最后"（机械罗列）| 用"然后""接着""再说"自然过渡 |
| 大量"的"字结构连用 | 适当断句 |
| 句式过于均匀对称 | 长短错落，有节奏 |
| "我们应该""我们需要"（说教腔）| "不如""可以试试""先做" |
| 结语给读者留作业/道德总结 | 点到为止，不说教 |

**检查方法**：读出声，不通顺的地方就是 AI 味。

**联合输出专有原则**：

1. **不重复、不堆砌** —— ${'$'}{N} 张卡的视角不能重复讲同一个论点
2. **逻辑骨架要显性** —— 联合输出必须有清晰的组织逻辑（递进 / 对照 / 总-分-总）
3. **每段标注来源** —— 每个核心观点后用 \`[来源: 卡N]\` 标注
4. **卡片有主次** —— 主卡片占核心位置；其他作为支撑、对比或延伸
5. **保留核心判断** —— 每张卡的一句话洞察必须出现 ≥ 1 次
6. **不要凭空补内容** —— 卡片之间没有的逻辑，禁止自己编造

**${'$'}{N} 张卡的组织模式**：

- **2 张**：双视角对照（不同立场 / 互补 / 反差）
- **3 张**：递进（铺垫 → 转折 → 收口）或 三选一
- **4-5 张**：分模块（按问题 / 步骤 / 受众分块）
- **6+ 张**：必须分组、明确章节标题

**输出类型**：

### 类型 A：客户沟通话术（多卡版，2-3 张最合适）
- 长度：500-800 字（3-5 分钟）
- 客户沟通版语气，柔和、专业、不咄咄逼人
- 给 3 种开场白变体

### 类型 B：联合文章大纲（多卡版，3-5 张最合适）
- 标题 3 个备选 + 钩子段 + 3-5 个核心章节 + 收尾
- 大纲版，只到骨架

### 类型 C：联合完整文章（多卡版，3-5 张最合适）
- 长度：1500-2500 字（公众号长文 / 深度文章）
- 完整文章是**直接可发布**的成品，**不**是骨架
- 严格按 Vincent 的写作哲学 + L0 脱 AI 味标准

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
  const isFullArticle = input.outputType === 'article_full';
  const isSpeech = input.outputType === 'speech';
  const isBookNote = input.outputType === 'book_note';
  const isEmail = input.outputType === 'email';
  const isOutline = input.outputType === 'article_outline';

  // 类型特定 prompt 注入（用于 system prompt 的增强）
  const typeInjection =
    isSpeech ? SPEECH_PROMPT_INJECTION :
    isBookNote ? BOOK_NOTE_PROMPT_INJECTION :
    isEmail ? EMAIL_PROMPT_INJECTION :
    '';

  const typeLabel = isTalk ? '客户沟通话术（多卡版）' :
    isSpeech ? '演讲稿（多卡版）' :
    isBookNote ? '读书笔记（多卡版）' :
    isEmail ? '邮件（多卡版）' :
    isFullArticle ? '联合完整文章（多卡版）' :
    '联合文章大纲（多卡版）';

  const n = input.assetSummaries.length;

  // 主 prompt body（所有类型共享结构）
  const promptBody = `请基于以下 ${n} 张资产卡，组织成${typeLabel}。

${typeInjection ? `\n${typeInjection}\n` : ''}

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
${isTalk || isEmail ? '本次沟通/邮件的核心命题（10-20 字）' :
  isSpeech ? '演讲的核心命题（10-20 字，Vincent 自己记住的，不是 PPT 标题）' :
  isBookNote ? '笔记的核心命题（10-20 字）' :
  '文章主标题（3 个备选用 | 分隔）'}

### primary_version
${
  isTalk ? `完整话术（500-800 字），结构：
- 开场白（带 [来源: 卡N] 标注）
- 主卡片的核心洞察（带标注）
- 第二张卡的对比 / 补充
- （可选）第三张卡的延伸
- 收尾（带标注）` :
  isSpeech ? buildSpeechUserPrompt(n).match(/### primary_version[\s\S]+?(?=### )/)?.[0].replace(/### primary_version\n/, '') || buildSpeechUserPrompt(n) :
  isBookNote ? buildBookNoteUserPrompt(n).match(/### primary_version[\s\S]+?(?=### )/)?.[0].replace(/### primary_version\n/, '') || buildBookNoteUserPrompt(n) :
  isEmail ? buildEmailUserPrompt(n).match(/### primary_version[\s\S]+?(?=### )/)?.[0].replace(/### primary_version\n/, '') || buildEmailUserPrompt(n) :
  isFullArticle ? buildFullArticlePrompt(n) :
  `完整大纲：
- 标题（主）
- 钩子段（100-150 字，带 [来源]）
- 主章节 1：核心卡片（带标注）
- 主章节 2：第二张卡（带标注）
- 主章节 3：第三张卡（带标注）
- （可选）主章节 4+：补充卡片
- 收尾：思考问题 + 行动建议`
}

### variants
${
  isEmail ? '邮件**不**需要变体（不能发 3 个版本），直接跳过此字段' :
  isBookNote ? `3 个开头变体（150-200 字 / 个）：
- "价值切入" / "问题切入" / "冲突切入"` :
  isSpeech ? `3 个开场 hook 变体（300-500 字 / 个）：
- "反常识切入" / "场景切入" / "个人故事切入"` :
  isTalk ? `3 个变体：- "用问题切入" / "用观察切入" / "用反常识切入"` :
  isFullArticle ? `3 个变体：- "开头变体 1" / "开头变体 2" / "开头变体 3"（每个是文章开头 200-300 字，可选不同切入角度）` :
  `3 个变体：- "强冲突型" / "讲故事型" / "反常识型"`
}

### subject
${isEmail ? '3 个备选邮件主题行（10-25 字 / 个）' : '不需要此字段'}

### key_quotes
${
  isEmail ? '1-3 个**邮件中可圈可点**的表达（既专业又有温度的句子）' :
  isSpeech ? '3-5 个**适合演讲**的金句（短、有节奏、可被记住）' :
  isBookNote ? '3-5 个**作者原话**（带出处标记「——书名，作者」）' :
  '3-5 个可直接引用的金句，每个后带 [来源: 卡N]'
}

### usage_suggestion
建议使用方式（时长 / 发布渠道 / 配图建议等）

### assetReferences
${n} 项，每项对应一张资产卡：
- assetId: 资产卡 ID
- assetTitle: 资产卡标题
- referencedIn: 这张卡被引用的位置（如 ["主章节 1", "key_quotes[0]"]）
- coreInsightUsed: 这张卡的一句话洞察是否被保留（boolean）

请输出严格 JSON。`;

  return promptBody;
}

/**
 * article_full 专属 user prompt 增强
 *
 * Vincent 写作哲学 + 4 层质检清单
 * （L0 已在 system prompt 里，这里是 L1-L4）
 */
function buildFullArticlePrompt(n: number): string {
  return `**完整文章（1500-2500 字）**，这是 Vincent 直接复制粘贴就能发布的成品。

## 写作格式（强制）

### 标题
- 有张力，能引发思考
- 10-20 字
- 3 个备选

### 一句话核心观点
- 开头第一段必须有**明确立场**（**不**是"两者都有道理"、**不**是"具体情况具体分析"）
- 让读者读完第一段就知道 Vincent 站在哪边

### 论据结构
- 每个核心判断后跟：**证据/原话（标注来源）** + **解读**
- **不**只**罗**列**证**据**，**不**做**空**洞**解**读**
- 解读要有 Vincent 自己的视角

### 结尾
- 留一个**开放性问题**（**不**是"你有什么看法"这种泛问，而是具体的延伸思考）
- 留**一**个**可操作**的**建议**

## 4 层质检（输出前必过，**不**通过**不**许**输**出**）

### L1 硬性禁用词（违反直接修改）

**禁用词/禁用表达**：
- ❌ 随着时代的发展、在当今社会、随着社会进步
- ❌ 需要客户思考、见仁见智、视情况而定、原则上、一般情况下
- ❌ 持续优化、不断提升、全面加强（无具体内容）
- ❌ 赋能、生态、闭环、打法（空洞术语）
- ❌ 大量使用破折号"——"做插入语

**通过标准**：发现任意一项，直接修改。

### L2 风格一致性

**开头检查**：
- 是否直接切入？（**禁**止**废**话**铺**垫**）
- 是否在第一段就给出**核心判断**？（结论先行）

**节奏检查**：
- 长段落（> 150 字）是否拆分？
- 是否有 1-2 句的短段落做节奏调节？

**引用控制**：
- 全篇引用**不**超过 **2** 处**（**含**德**鲁**克**或**其**他**任**何**人**的**直**接**引**用**）
- 引用是**佐**证**不**是**结**论**，**结**论**必**须**是** Vincent **自**己**的**判**断**

**口语化检查**：
- 是否有"我认为""我们应该"的**泛**泛**而**谈**？（**应**改**为**具**体**判**断**）

### L3 内容质量

**观点支撑**：
- 每个结论**有**数据 / 案例 / 逻辑**支撑**
- **避**免**"我认为"**开**头**（**应**用**"逻辑上"**或**"实践中"**）

**逻辑完整性**：
- 提出问题后**立**即**给**答**案**
- 提出风险后**立**即**给**对**策**
- **禁**止**"需要进一步讨论"**类**悬**浮**结**论**

**数据真实性**：
- 具体数字（样本量、百分比、绝对值）**必**须**标**注**来**源**
- **如**果**是**推**算**（**不**是**实**证**），**标**注**"按行业惯例推算"**或**"逻辑推断"**
- **绝**对**禁**止**虚**构**"我们做过调研"**类**数**据**
- **绝**对**禁**止**捏**造**具**体**研**究**引**用**（**研**究**机**构** + **年**份** + **数**字**）
- 如**需**引**用**"据 XX 研**究**"，**必**须**先**确**认**该**研**究**存**在**，**或**明**确**标**注**「来源：逻辑推断，待核实」

**独特性**：
- 这篇文章是否**只**能**在** Vincent 这**里**出**现**？（**独**特**视**角**）
- 还是任何人都能写出来？（**避**免**模**板**化**）

### L4 价值终审

**温度感**：
- 读完全文，读者是否感受到"这**个**人**真**的**在**说**话**"？
- 还是有"在写作文"的感觉？

**最终价值**：
- 读者读完是否**有**收**获**？（**新**视**角** / **新**判**断** / **被**说**服**）
- 还是仍然**无**感**？

## 章节结构要求

1. 开头 200-300 字：用主卡片的**反**常**识** / 故**事** / 颠**覆**性**观**察**切**入，**不**要"今天我们来聊..."**这**种**陈**词**滥**调**
2. 主体 3-5 个章节（每章节 300-500 字）：
   - 每章节用 \`## 小标题\` 标记
   - 章节内**充**分**展**开**，举 1-2 个具体例子 / 类比 / 数据点
   - 每个核心观点后用 \`[来源: 卡N]\` 标注来源
   - 可以加粗关键判断（**xxx**），可以引用金句（> xxx）
3. 收尾 200-300 字：
   - 给读者**一**个**具**体**可**操**作**的**行**动**建**议**
   - **一**个**思**考**问**题**（**引**发**共**鸣**）
4. 章节之间有**逻**辑**过**渡**句**（**不**是**简**单**分**段**）

## 关键

写出来是** Vincent 直接能发的成品**，**不**要**骨**架**感**。**每**次**输**出**前**必**须**过**完** 4 **层**质**检**，**不**达**标**直**接**修**改**。`;
}
