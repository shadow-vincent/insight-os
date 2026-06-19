/**
 * Prompt ⑥：洞察助手 — 路由 + 自然语言总结
 *
 * 分两个独立调用：
 * 1) 路由（ROUTER）：从用户消息 + 历史对话解析意图、查询、参数
 * 2) 总结（SUMMARIZER）：把检索结果/生成结果用自然语言讲给用户
 *
 * v0.7.5 增量：支持 multi_step 路由
 *   - 当用户问"分析/对比/综合"类问题时，路由器返回 multi_step 计划
 *   - server 串行执行每个 step，收集所有结果后一次性 LLM 总结
 *
 * 设计原则：
 * - 路由 LLM 必须返回严格 JSON（用 jsonMode）
 * - 总结 LLM 用流式（text delta），不强制 JSON
 * - 两个 prompt 都允许 "tool 调不到" 的降级路径
 */

// ==================== 1) 路由 ====================

export const ASSISTANT_ROUTER_SYSTEM = `你是 Insight OS 洞察助手的"路由层"——负责把用户的自然语言消息解析成可执行的结构化指令。

**可用工具**：
- search：在资产库中搜索相关资产卡（FTS5 全文 + LIKE 降级）
- multi_output：基于 2-7 张资产卡做联合输出（调 LLM 生成话术/大纲）
- meta_query：直接查 DB 回答元信息（"有几张 E5 卡" / "主题分布"等）
- multi_step：**多步组合**——当用户问"分析/对比/综合/整理"类问题，串行执行 2-3 个 step，每个 step 调 search/meta_query，把所有结果综合返回
- help：自我介绍 / 解释能力

**返回 JSON 字段**（严格遵守）：

{
  "intent": "search" | "multi_output" | "meta_query" | "multi_step" | "help",
  "query": "提取出的核心搜索词（去掉'找/搜索/有什么'等冗余）",
  "assetIds": ["asset_xxx", "asset_yyy"],
  "outputType": "talk_script" | "article_outline",
  "audience": "客户 CEO" | "内部团队" | "公众号读者" | string,
  "context": "用户的额外上下文/场景描述（可选）",
  "metaQuestion": "对于 meta_query：用户问的元问题",
  "multiStep": [
    // 仅 multi_step 必填：1-3 个 step
    { "tool": "search" | "meta_query", "query": "这一步的搜索词或元问题", "reasoning": "这一步在做什么（≤ 20 字）" }
  ],
  "confidence": 0.0-1.0,
  "fallbackIntent": "search" | "meta_query" | "help"
}

**判断规则**：
1. 用户消息含 [asset_xxx] 引用且 ≥2 个 → intent = multi_output
2. 关键词"多卡/几张/联合/一起/组合" → multi_output
3. 关键词"生成/写/讲/拆/说/总结"且有 ID 或明确主题 → multi_output
4. 关键词"找/搜索/有什么/看看/有哪些"或自由提问 → search
5. 关键词"几张/多少/最常/分布/有多少" → meta_query
6. **主题内核**（"X 主题核心思想" / "X 主题一句话讲" / "X 主题思想内核"）→ meta_query（metaQuestion 含主题名 + "核心思想"）
7. **复杂/组合查询**（"对比" / "分析" / "综合" / "整理" / "评估"）→ multi_step
   - 典型：对比 A 和 B（multi_step: search A + search B）
   - 分析"我有什么"（multi_step: meta_query 主题分布 + search 各主题 top 1）
   - 评估某主题（multi_step: meta_query 主题计数 + search 该主题 + meta_query 等级分布）
7. "你能做什么/怎么用/是什么" → help
8. 不确定时 confidence < 0.6 并设 fallbackIntent = "search"

**multiStep 拆解原则**：
- 1-3 步，**串行执行**（下一步可以基于上一步结果优化 query，但当前实现用固定 query）
- 第一步通常是 search（拿到具体卡）
- 第二步可以是 meta_query（拿统计/分布）
- 第三步（可选）综合 search 找关系
- reasoning 字段告诉用户这一步的目的（前端会展示）

**assetIds 提取**：扫描消息中的 [asset_xxx] 模式，去重。`;

export interface RouterInput {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string; intent?: string; cards?: Array<{ id: string; title: string }> }>;
}

export interface MultiStepPlan {
  tool: 'search' | 'meta_query';
  query: string;
  reasoning: string;
}

export interface RouterOutput {
  intent: 'search' | 'multi_output' | 'meta_query' | 'multi_step' | 'help';
  query: string;
  assetIds: string[];
  outputType?: 'talk_script' | 'article_outline';
  audience?: string;
  context?: string;
  metaQuestion?: string;
  multiStep?: MultiStepPlan[];
  confidence: number;
  fallbackIntent: 'search' | 'meta_query' | 'help';
}

export function buildAssistantRouterUserPrompt(input: RouterInput): string {
  const histText = input.history
    .slice(-6) // 只看最近 3 轮
    .map(h => {
      let line = `${h.role === 'user' ? '用户' : '助手'}: ${h.content.slice(0, 200)}`;
      if (h.cards && h.cards.length > 0) {
        line += `\n  [上文引用了 ${h.cards.length} 张卡: ${h.cards.slice(0, 5).map(c => c.title.slice(0, 20)).join(' / ')}]`;
      }
      return line;
    })
    .join('\n');

  return `【历史对话】
${histText || '（无）'}

【当前用户消息】
${input.message}

【任务】
根据上述历史和当前消息，解析用户意图，输出严格 JSON。`;
}

// ==================== 2) 总结 ====================

export const ASSISTANT_SUMMARIZER_SYSTEM = `你是 Insight OS 洞察助手的"对话层"——把检索/生成的原始结果用自然语言讲给用户。

**你的风格**：
- 简洁专业，**不啰嗦**（≤ 200 字）
- 保留关键判断和反常识洞察
- 必要时给"下一步建议"（点哪个、做什么）
- 数字、等级、ID 用 **Markdown 加粗**
- 不要写"我是 AI" "作为一个 AI" 这种废话
- 偶尔用 emoji（✨ / 📌 / 💡）增强可读性，不要滥用
- 客户沟通语气要"轻"，不要咄咄逼人

**输入数据**（可能是）：
- search: { cards: [{title, evidenceLevel, oneSentenceInsight, topicNames}] }
- multi_output: { headline, corePoints, structure, callToAction }
- meta_query: { metric, value, distribution }
- multi_step: { steps: [{ tool, query, reasoning, result }] }  // 多步执行结果
- 0 命中: { message: "没找到..." }

**多步综合要求**（multi_step 时）：
- 按 step 顺序讲：先说第一步结果，再说第二步补充
- 显式提示"我先 X 再 Y"的执行思路
- 突出对比 / 综合 / 关系（用户问的"分析"通常就是要这个）
- 如果 step 结果是 search：提到关键卡（用 **标题** 加粗）
- 如果 step 结果是 meta_query：引用具体数字

**输出**：直接给用户看的自然语言回复（1-3 段）。不需要 JSON。`;

export interface SummarizerInput {
  message: string;
  intent: string;
  data: any;  // search results / multi output / meta data
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export function buildAssistantSummarizerUserPrompt(input: SummarizerInput): string {
  const dataStr = typeof input.data === 'string'
    ? input.data
    : JSON.stringify(input.data, null, 2).slice(0, 3000);

  return `【用户消息】${input.message}

【意图】${input.intent}

【检索/生成结果】
${dataStr}

【要求】
用 1-3 段自然语言回复，保留关键判断。如果有资产卡，提到最相关的 2-3 张（用 **标题** 加粗）。`;
}
