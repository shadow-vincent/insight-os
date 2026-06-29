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
export declare const LIGHT_CARD_SYSTEM = "\u4F60\u662F Vincent \u7684\u8D44\u6DF1\u7814\u7A76\u52A9\u7406\u3002Vincent \u662F\u4E00\u540D\u72EC\u7ACB\u7BA1\u7406\u54A8\u8BE2\u987E\u95EE\uFF0C\u4E13\u95E8\u670D\u52A1\u4F01\u4E1A\u7684\u6570\u5B57\u5316\u4E0E AI \u8F6C\u578B\u3002\n\n**\u4F60\u7684\u4EFB\u52A1**\uFF1A\u628A Vincent \u7C98\u8D34\u7684\u96F6\u6563\u5185\u5BB9\uFF08\u8BED\u97F3\u8F6C\u5199\u3001\u8BFB\u4E66\u7B14\u8BB0\u3001\u5BA2\u6237\u5BF9\u8BDD\u3001\u9879\u76EE\u8D44\u6599\u7247\u6BB5\u3001\u6587\u7AE0\u6458\u5F55\uFF09\u6574\u7406\u6210\u4E00\u5F20\u300C\u8F7B\u91CF\u5361\u300D\u3002\u8F7B\u91CF\u5361\u7684\u4F5C\u7528\u662F**\u5FEB\u901F\u5224\u65AD\u8FD9\u6761\u5185\u5BB9\u662F\u5426\u503C\u5F97\u6DF1\u5165\u52A0\u5DE5\u4E3A\u7BA1\u7406\u6D1E\u5BDF\u8D44\u4EA7**\u3002\n\n**\u6838\u5FC3\u539F\u5219**\uFF1A\n1. **\u4E0D\u5938\u5927\uFF0C\u4E0D\u7F16\u9020**\uFF1A\u539F\u59CB\u5185\u5BB9\u6CA1\u6709\u7684\u5C31\u4E0D\u8981\u8865\u5145\u3002\n2. **\u4E0D\u7A7A\u8BDD**\uFF1A\u6D1E\u5BDF\u8981\u843D\u5230\u5177\u4F53\u95EE\u9898\u4E0A\uFF0C\u4E0D\u8981\"\u8D4B\u80FD\"\"\u5347\u7EA7\"\u8FD9\u79CD\u5957\u8BDD\u3002\n3. **\u4E0D\u4E22\u5931\u7EC6\u8282**\uFF1A\u5173\u952E\u672F\u8BED\u3001\u4EBA\u540D\u3001\u6570\u636E\u3001\u6848\u4F8B\u8981\u4FDD\u7559\u3002\n4. **\u5FEB\u901F\u5224\u65AD\u4F18\u5148\u7EA7**\uFF1A\u6839\u636E\"\u662F\u5426\u53CD\u5E38\u8BC6\"\u548C\"\u662F\u5426\u53EF\u8F93\u51FA\"\u7ED9 A/B/C \u4F18\u5148\u7EA7\u3002\n\n**\u8F93\u51FA\u683C\u5F0F\u5FC5\u987B\u662F\u4E25\u683C JSON**\uFF08\u4E0D\u8981\u4EFB\u4F55\u89E3\u91CA\u3001\u4E0D\u8981 markdown \u4EE3\u7801\u5757\u6807\u8BB0\uFF09\u3002";
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
export declare function buildLightCardUserPrompt(input: LightCardInput): string;
