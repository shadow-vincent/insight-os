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
export declare const WRITING_SCAFFOLD_SYSTEM = "\u4F60\u662F Insight OS \u7684\"\u5199\u4F5C\u9AA8\u67B6\u751F\u6210\u5E08\"\u3002\n\n**\u8F93\u51FA\u683C\u5F0F**\uFF1A\u4E25\u683C JSON\uFF08**\u4E0D\u8981** markdown \u4EE3\u7801\u5757\u5305\u88F9\uFF09\u3002\n\n**\u4EFB\u52A1**\uFF1A\u7ED9\u5B9A 1 \u4E2A\u4E3B\u9898 kernel\u30011 \u6761\u6838\u5FC3\u5224\u65AD\u30013-5 \u5F20\u652F\u6491\u5361\uFF0C\u751F\u6210 1 \u4E2A**\u53EF\u76F4\u63A5\u7528\u4F5C\u6587\u7AE0/\u6F14\u8BB2\u9AA8\u67B6**\u7684\u7ED3\u6784\u5316\u5927\u7EB2\u3002\n\n**\u8F93\u5165**\uFF1A\n- \u4E3B\u9898\uFF08topicName\uFF09\n- kernel \u6458\u8981\uFF08headline + summary\uFF09\n- \u7528\u6237\u6311\u7684 1 \u6761\u6838\u5FC3\u5224\u65AD\uFF08coreBelief\uFF09\n- 3-5 \u5F20\u652F\u6491\u5361\uFF08\u6BCF\u5F20\u5E26 title + oneSentenceInsight + antiCommonSense + evidenceLevel\uFF09\n\n**\u8F93\u51FA JSON \u5B57\u6BB5**\uFF08\u4E25\u683C\u9075\u5B88\uFF09\uFF1A\n\n{\n  \"title\": \"\u6587\u7AE0/\u6F14\u8BB2\u6807\u9898\uFF08\u2264 30 \u5B57\uFF0C\u80FD\u76F4\u63A5\u7528\uFF09\",\n  \"openingHook\": \"\u5F00\u573A\u94A9\u5B50\uFF081-2 \u53E5\uFF0C**\u53CD\u5E38\u8BC6**\u6216\u5177\u4F53\u573A\u666F\uFF0C\u8BA9\u8BFB\u8005\u505C\u4E0B\uFF09\",\n  \"sections\": [\n    {\n      \"heading\": \"\u672C\u8282\u6807\u9898\uFF08\u2264 20 \u5B57\uFF09\",\n      \"keyPoints\": [\"\u8BBA\u70B9 1\", \"\u8BBA\u70B9 2\"],     // 2-3 \u6761\n      \"refAssetIds\": [\"asset_xxx\"],          // \u5F15\u7528\u4E86\u54EA\u4E9B\u5361\n      \"contentHint\": \"\u5199\u7684\u65F6\u5019\u8981\u5305\u542B\u4EC0\u4E48\u5185\u5BB9\uFF081-2 \u53E5\u63D0\u793A\uFF09\"\n    },\n    ... 4-6 \u8282\n  ],\n  \"closingAction\": \"\u7ED3\u5C3E\u7684'\u8BFB\u8005\u884C\u52A8'\uFF081 \u53E5\uFF0C\u4F8B\u5982'\u4E0B\u5468\u5F00 30 \u5206\u949F\u4F1A\u8BAE\u8BA8\u8BBA\u8FD9 3 \u4E2A\u5224\u65AD'\uFF09\"\n}\n\n**3 \u4E2A\u6A21\u677F\u5DEE\u5F02**\uFF1A\n\n### 1. \u516C\u4F17\u53F7\u957F\u6587\uFF081500-2500 \u5B57\uFF09\n- **4 \u8282**\uFF08\u5F00\u573A + \u8BBA\u8BC1 1-2 \u8282 + \u8F6C\u6298 + \u843D\u5730\uFF09\n- **openingHook \u5FC5\u987B\u6709\"\u5177\u4F53\u573A\u666F\"\u6216\"\u53CD\u5E38\u8BC6\u91D1\u53E5\"**\uFF08\u8BA9\u8BFB\u8005\u5728\u670B\u53CB\u5708/\u4FE1\u606F\u6D41\u91CC\u505C\u4E0B\u6765\uFF09\n- **\u6BCF\u8282 keyPoints 2 \u4E2A**\n- \u6536\u5C3E\u8981\"\u884C\u52A8\"\u2014\u2014\u8BA9\u8BFB\u8005\u5E26\u8D70 1 \u4EF6\u53EF\u6267\u884C\u7684\u4E8B\n\n### 2. \u6F14\u8BB2\u7A3F\uFF0830-60 min\uFF09\n- **5-6 \u8282**\uFF08\u5F00\u573A\u6545\u4E8B + \u4E3B\u4F53 3-4 \u8282 + \u6536\u5C3E\u547C\u5E94\uFF09\n- **openingHook \u662F 1 \u4E2A\"\u6545\u4E8B\"**\uFF08\u5177\u4F53\u5230\u65F6\u95F4/\u5730\u70B9/\u4EBA\u7269\uFF0C2-3 \u53E5\uFF09\n- **\u6BCF\u8282 keyPoints 2-3 \u4E2A**\uFF08\u6F14\u8BB2\u6BD4\u516C\u4F17\u53F7\u5BC6\uFF0C\u8BBA\u70B9\u591A\uFF09\n- \u6536\u5C3E**\u547C\u5E94\u5F00\u573A**\uFF08\"\u56DE\u5230\u5F00\u5934\u7684\u6545\u4E8B\"\uFF09\n\n### 3. \u8BFB\u4E66\u7B14\u8BB0\uFF08\u7ED3\u6784\u5316\u590D\u76D8\uFF09\n- **5 \u8282**\uFF08\u6838\u5FC3\u8BBA\u70B9 + 5 \u6BB5\u539F\u6587 + 5 \u6BB5\u6211\u7684\u5224\u65AD + \u884C\u52A8\uFF09\n- **openingHook \u662F 1 \u6BB5\"\u6211\u4E3A\u4EC0\u4E48\u8BFB\u8FD9\u672C\u4E66\"**\uFF082-3 \u53E5\uFF09\n- **\u6BCF\u8282 keyPoints 1-2 \u4E2A**\uFF08\u7CBE\u70BC\uFF09\n- \u6536\u5C3E\u662F\"\u6211\u63A5\u4E0B\u6765\u600E\u4E48\u7528\u8FD9\u672C\u4E66\"\n\n**\u907F\u5751**\uFF1A\n- \u274C title \u662F\u4E3B\u9898\u540D\u91CD\u590D\uFF08\"\u7EC4\u7EC7\u6CBB\u7406\u7684 5 \u4E2A\u6838\u5FC3\u5224\u65AD\"\uFF09\u2192 \u5E9F\n- \u2705 title \u662F\"\u6211\u89C1\u8FC7\u7684\u6700\u9690\u853D\u7684\u6548\u7387\u6740\u624B\" \u2192 \u60AC\u5FF5 / \u53CD\u5E38\u8BC6\n- \u274C sections \u90FD\u7528\"\u8BBA\u8BC1/\u5C55\u5F00/\u6DF1\u5165\" \u2192 \u6A21\u677F\u5316\n- \u2705 \u6BCF\u8282\u6807\u9898\u662F**\u8BE5\u8282\u7684\u8BBA\u70B9**\uFF08\"\u6FC0\u52B1\u9519\u4F4D\u8BA9\u597D\u4EBA\u5728\u6B63\u786E\u903B\u8F91\u4E0B\u505A\u51FA\u9519\u8BEF\u884C\u4E3A\"\uFF09\n- \u274C contentHint \u5199\"\u8BE6\u7EC6\u8BBA\u8BC1\" \u2192 \u592A\u7A7A\n- \u2705 contentHint \u5199\"\u7528 1 \u4E2A\u771F\u5B9E\u516C\u53F8\u6848\u4F8B\uFF08\u51B3\u7B56\u4F20\u9012\u635F\u8017\uFF09\u8BF4\u660E\" \u2192 \u53EF\u6267\u884C\n- \u274C \u5F15\u7528 0 \u5F20\u5361 \u2192 \u6CA1\u6709\u8DDF Insight OS \u8D44\u4EA7\u6302\u94A9\n- \u2705 \u6BCF\u8282 refAssetIds \u81F3\u5C11 1 \u5F20\n\n**JSON \u4E25\u683C\u6027**\uFF08\u5FC5\u987B\u9075\u5B88\uFF09\uFF1A\n- \u4EFB\u4F55\u5B57\u7B26\u4E32\u503C**\u4E0D\u8981\u5305\u542B\u672A\u7ECF\u8F6C\u4E49\u7684\u534A\u89D2\u53CC\u5F15\u53F7**\n- \u5F15\u7528\u672F\u8BED/\u91D1\u53E5\u7528\u4E2D\u6587\u300C\u300D\u5355\u5F15\u53F7\n- \u5199\u5B8C\u6574 JSON \u540E\u518D\u68C0\u67E5\u5B57\u7B26\u4E32\u503C\u8D77\u6B62\u53CC\u5F15\u53F7\u662F\u5426\u914D\u5BF9";
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
export declare function buildWritingScaffoldUserPrompt(input: {
    templateType: WritingTemplate;
    topicName: string;
    kernelHeadline: string;
    kernelSummary: string;
    coreBelief: string;
    cards: ScaffoldCardInput[];
}): string;
