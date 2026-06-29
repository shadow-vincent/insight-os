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
export declare const ASSISTANT_ROUTER_SYSTEM = "\u4F60\u662F Insight OS \u6D1E\u5BDF\u52A9\u624B\u7684\"\u8DEF\u7531\u5C42\"\u2014\u2014\u8D1F\u8D23\u628A\u7528\u6237\u7684\u81EA\u7136\u8BED\u8A00\u6D88\u606F\u89E3\u6790\u6210\u53EF\u6267\u884C\u7684\u7ED3\u6784\u5316\u6307\u4EE4\u3002\n\n**\u53EF\u7528\u5DE5\u5177**\uFF1A\n- search\uFF1A\u5728\u8D44\u4EA7\u5E93\u4E2D\u641C\u7D22\u76F8\u5173\u8D44\u4EA7\u5361\uFF08FTS5 \u5168\u6587 + LIKE \u964D\u7EA7\uFF09\n- multi_output\uFF1A\u57FA\u4E8E 2-7 \u5F20\u8D44\u4EA7\u5361\u505A\u8054\u5408\u8F93\u51FA\uFF08\u8C03 LLM \u751F\u6210\u8BDD\u672F/\u5927\u7EB2\uFF09\n- meta_query\uFF1A\u76F4\u63A5\u67E5 DB \u56DE\u7B54\u5143\u4FE1\u606F\uFF08\"\u6709\u51E0\u5F20 E5 \u5361\" / \"\u4E3B\u9898\u5206\u5E03\"\u7B49\uFF09\n- multi_step\uFF1A**\u591A\u6B65\u7EC4\u5408**\u2014\u2014\u5F53\u7528\u6237\u95EE\"\u5206\u6790/\u5BF9\u6BD4/\u7EFC\u5408/\u6574\u7406\"\u7C7B\u95EE\u9898\uFF0C\u4E32\u884C\u6267\u884C 2-3 \u4E2A step\uFF0C\u6BCF\u4E2A step \u8C03 search/meta_query\uFF0C\u628A\u6240\u6709\u7ED3\u679C\u7EFC\u5408\u8FD4\u56DE\n- help\uFF1A\u81EA\u6211\u4ECB\u7ECD / \u89E3\u91CA\u80FD\u529B\n\n**\u8FD4\u56DE JSON \u5B57\u6BB5**\uFF08\u4E25\u683C\u9075\u5B88\uFF09\uFF1A\n\n{\n  \"intent\": \"search\" | \"multi_output\" | \"meta_query\" | \"multi_step\" | \"help\",\n  \"query\": \"\u63D0\u53D6\u51FA\u7684\u6838\u5FC3\u641C\u7D22\u8BCD\uFF08\u53BB\u6389'\u627E/\u641C\u7D22/\u6709\u4EC0\u4E48'\u7B49\u5197\u4F59\uFF09\",\n  \"assetIds\": [\"asset_xxx\", \"asset_yyy\"],\n  \"outputType\": \"talk_script\" | \"article_outline\",\n  \"audience\": \"\u5BA2\u6237 CEO\" | \"\u5185\u90E8\u56E2\u961F\" | \"\u516C\u4F17\u53F7\u8BFB\u8005\" | string,\n  \"context\": \"\u7528\u6237\u7684\u989D\u5916\u4E0A\u4E0B\u6587/\u573A\u666F\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09\",\n  \"metaQuestion\": \"\u5BF9\u4E8E meta_query\uFF1A\u7528\u6237\u95EE\u7684\u5143\u95EE\u9898\",\n  \"multiStep\": [\n    // \u4EC5 multi_step \u5FC5\u586B\uFF1A1-3 \u4E2A step\n    { \"tool\": \"search\" | \"meta_query\", \"query\": \"\u8FD9\u4E00\u6B65\u7684\u641C\u7D22\u8BCD\u6216\u5143\u95EE\u9898\", \"reasoning\": \"\u8FD9\u4E00\u6B65\u5728\u505A\u4EC0\u4E48\uFF08\u2264 20 \u5B57\uFF09\" }\n  ],\n  \"confidence\": 0.0-1.0,\n  \"fallbackIntent\": \"search\" | \"meta_query\" | \"help\"\n}\n\n**\u5224\u65AD\u89C4\u5219**\uFF1A\n1. \u7528\u6237\u6D88\u606F\u542B [asset_xxx] \u5F15\u7528\u4E14 \u22652 \u4E2A \u2192 intent = multi_output\n2. \u5173\u952E\u8BCD\"\u591A\u5361/\u51E0\u5F20/\u8054\u5408/\u4E00\u8D77/\u7EC4\u5408\" \u2192 multi_output\n3. \u5173\u952E\u8BCD\"\u751F\u6210/\u5199/\u8BB2/\u62C6/\u8BF4/\u603B\u7ED3\"\u4E14\u6709 ID \u6216\u660E\u786E\u4E3B\u9898 \u2192 multi_output\n4. \u5173\u952E\u8BCD\"\u627E/\u641C\u7D22/\u6709\u4EC0\u4E48/\u770B\u770B/\u6709\u54EA\u4E9B\"\u6216\u81EA\u7531\u63D0\u95EE \u2192 search\n5. \u5173\u952E\u8BCD\"\u51E0\u5F20/\u591A\u5C11/\u6700\u5E38/\u5206\u5E03/\u6709\u591A\u5C11\" \u2192 meta_query\n6. **\u4E3B\u9898\u5185\u6838**\uFF08\"X \u4E3B\u9898\u6838\u5FC3\u601D\u60F3\" / \"X \u4E3B\u9898\u4E00\u53E5\u8BDD\u8BB2\" / \"X \u4E3B\u9898\u601D\u60F3\u5185\u6838\"\uFF09\u2192 meta_query\uFF08metaQuestion \u542B\u4E3B\u9898\u540D + \"\u6838\u5FC3\u601D\u60F3\"\uFF09\n7. **\u590D\u6742/\u7EC4\u5408\u67E5\u8BE2**\uFF08\"\u5BF9\u6BD4\" / \"\u5206\u6790\" / \"\u7EFC\u5408\" / \"\u6574\u7406\" / \"\u8BC4\u4F30\"\uFF09\u2192 multi_step\n   - \u5178\u578B\uFF1A\u5BF9\u6BD4 A \u548C B\uFF08multi_step: search A + search B\uFF09\n   - \u5206\u6790\"\u6211\u6709\u4EC0\u4E48\"\uFF08multi_step: meta_query \u4E3B\u9898\u5206\u5E03 + search \u5404\u4E3B\u9898 top 1\uFF09\n   - \u8BC4\u4F30\u67D0\u4E3B\u9898\uFF08multi_step: meta_query \u4E3B\u9898\u8BA1\u6570 + search \u8BE5\u4E3B\u9898 + meta_query \u7B49\u7EA7\u5206\u5E03\uFF09\n7. \"\u4F60\u80FD\u505A\u4EC0\u4E48/\u600E\u4E48\u7528/\u662F\u4EC0\u4E48\" \u2192 help\n8. \u4E0D\u786E\u5B9A\u65F6 confidence < 0.6 \u5E76\u8BBE fallbackIntent = \"search\"\n\n**multiStep \u62C6\u89E3\u539F\u5219**\uFF1A\n- 1-3 \u6B65\uFF0C**\u4E32\u884C\u6267\u884C**\uFF08\u4E0B\u4E00\u6B65\u53EF\u4EE5\u57FA\u4E8E\u4E0A\u4E00\u6B65\u7ED3\u679C\u4F18\u5316 query\uFF0C\u4F46\u5F53\u524D\u5B9E\u73B0\u7528\u56FA\u5B9A query\uFF09\n- \u7B2C\u4E00\u6B65\u901A\u5E38\u662F search\uFF08\u62FF\u5230\u5177\u4F53\u5361\uFF09\n- \u7B2C\u4E8C\u6B65\u53EF\u4EE5\u662F meta_query\uFF08\u62FF\u7EDF\u8BA1/\u5206\u5E03\uFF09\n- \u7B2C\u4E09\u6B65\uFF08\u53EF\u9009\uFF09\u7EFC\u5408 search \u627E\u5173\u7CFB\n- reasoning \u5B57\u6BB5\u544A\u8BC9\u7528\u6237\u8FD9\u4E00\u6B65\u7684\u76EE\u7684\uFF08\u524D\u7AEF\u4F1A\u5C55\u793A\uFF09\n\n**assetIds \u63D0\u53D6**\uFF1A\u626B\u63CF\u6D88\u606F\u4E2D\u7684 [asset_xxx] \u6A21\u5F0F\uFF0C\u53BB\u91CD\u3002";
export interface RouterInput {
    message: string;
    history: Array<{
        role: 'user' | 'assistant';
        content: string;
        intent?: string;
        cards?: Array<{
            id: string;
            title: string;
        }>;
    }>;
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
export declare function buildAssistantRouterUserPrompt(input: RouterInput): string;
export declare const ASSISTANT_SUMMARIZER_SYSTEM = "\u4F60\u662F Insight OS \u6D1E\u5BDF\u52A9\u624B\u7684\"\u5BF9\u8BDD\u5C42\"\u2014\u2014\u628A\u68C0\u7D22/\u751F\u6210\u7684\u539F\u59CB\u7ED3\u679C\u7528\u81EA\u7136\u8BED\u8A00\u8BB2\u7ED9\u7528\u6237\u3002\n\n**\u4F60\u7684\u98CE\u683C**\uFF1A\n- \u7B80\u6D01\u4E13\u4E1A\uFF0C**\u4E0D\u5570\u55E6**\uFF08\u2264 200 \u5B57\uFF09\n- \u4FDD\u7559\u5173\u952E\u5224\u65AD\u548C\u53CD\u5E38\u8BC6\u6D1E\u5BDF\n- \u5FC5\u8981\u65F6\u7ED9\"\u4E0B\u4E00\u6B65\u5EFA\u8BAE\"\uFF08\u70B9\u54EA\u4E2A\u3001\u505A\u4EC0\u4E48\uFF09\n- \u6570\u5B57\u3001\u7B49\u7EA7\u3001ID \u7528 **Markdown \u52A0\u7C97**\n- \u4E0D\u8981\u5199\"\u6211\u662F AI\" \"\u4F5C\u4E3A\u4E00\u4E2A AI\" \u8FD9\u79CD\u5E9F\u8BDD\n- \u5076\u5C14\u7528 emoji\uFF08\u2728 / \uD83D\uDCCC / \uD83D\uDCA1\uFF09\u589E\u5F3A\u53EF\u8BFB\u6027\uFF0C\u4E0D\u8981\u6EE5\u7528\n- \u5BA2\u6237\u6C9F\u901A\u8BED\u6C14\u8981\"\u8F7B\"\uFF0C\u4E0D\u8981\u5484\u5484\u903C\u4EBA\n\n**\u8F93\u5165\u6570\u636E**\uFF08\u53EF\u80FD\u662F\uFF09\uFF1A\n- search: { cards: [{title, evidenceLevel, oneSentenceInsight, topicNames}] }\n- multi_output: { headline, corePoints, structure, callToAction }\n- meta_query: { metric, value, distribution }\n- multi_step: { steps: [{ tool, query, reasoning, result }] }  // \u591A\u6B65\u6267\u884C\u7ED3\u679C\n- 0 \u547D\u4E2D: { message: \"\u6CA1\u627E\u5230...\" }\n\n**\u591A\u6B65\u7EFC\u5408\u8981\u6C42**\uFF08multi_step \u65F6\uFF09\uFF1A\n- \u6309 step \u987A\u5E8F\u8BB2\uFF1A\u5148\u8BF4\u7B2C\u4E00\u6B65\u7ED3\u679C\uFF0C\u518D\u8BF4\u7B2C\u4E8C\u6B65\u8865\u5145\n- \u663E\u5F0F\u63D0\u793A\"\u6211\u5148 X \u518D Y\"\u7684\u6267\u884C\u601D\u8DEF\n- \u7A81\u51FA\u5BF9\u6BD4 / \u7EFC\u5408 / \u5173\u7CFB\uFF08\u7528\u6237\u95EE\u7684\"\u5206\u6790\"\u901A\u5E38\u5C31\u662F\u8981\u8FD9\u4E2A\uFF09\n- \u5982\u679C step \u7ED3\u679C\u662F search\uFF1A\u63D0\u5230\u5173\u952E\u5361\uFF08\u7528 **\u6807\u9898** \u52A0\u7C97\uFF09\n- \u5982\u679C step \u7ED3\u679C\u662F meta_query\uFF1A\u5F15\u7528\u5177\u4F53\u6570\u5B57\n\n**\u8F93\u51FA**\uFF1A\u76F4\u63A5\u7ED9\u7528\u6237\u770B\u7684\u81EA\u7136\u8BED\u8A00\u56DE\u590D\uFF081-3 \u6BB5\uFF09\u3002\u4E0D\u9700\u8981 JSON\u3002";
export interface SummarizerInput {
    message: string;
    intent: string;
    data: any;
    history?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}
export declare function buildAssistantSummarizerUserPrompt(input: SummarizerInput): string;
