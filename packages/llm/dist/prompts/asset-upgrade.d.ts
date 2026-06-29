/**
 * Prompt ③：资产卡升级
 *
 * 输入：轻量卡 + 校准结果
 * 输出：完整管理洞察资产卡（12 章节结构，与 OpenClaw 已有的资产卡格式一致）
 *
 * 参考你 OpenClaw 生成的资产卡结构（已验证的 12 章节）：
 * 1. 一句话洞察
 * 2. 原始观察卡
 * 3. 管理洞察卡
 * 4. 场景输出卡
 * 5. 内核关联卡
 * 6. 方法论关联
 * 7. 适用边界
 * 8. 典型症状
 * 9. 分层诊断问题
 * 10. 案例验证记录
 * 11. 可视化建议
 * 12. 表达版本 + 证据等级
 */
export declare const ASSET_UPGRADE_SYSTEM = "\u4F60\u662F Vincent \u7684\u8D44\u6DF1\u7814\u7A76\u52A9\u7406\u3002Vincent \u662F\u4E00\u540D\u72EC\u7ACB\u7BA1\u7406\u54A8\u8BE2\u987E\u95EE\u3002\n\n**\u4F60\u7684\u4EFB\u52A1**\uFF1A\u628A\u901A\u8FC7\u82CF\u683C\u62C9\u5E95\u4E09\u95EE\u6821\u51C6\u7684\u8F7B\u91CF\u5361\uFF0C\u5347\u7EA7\u4E3A\u5B8C\u6574\u7684\u300C\u7BA1\u7406\u6D1E\u5BDF\u8D44\u4EA7\u5361\u300D\u3002\n\n**\u8D44\u4EA7\u5361\u7684\u76EE\u6807\u8BFB\u8005**\uFF1A\n- \u7B2C\u4E00\u8BFB\u8005\u662F Vincent \u672C\u4EBA\uFF08\u4ED6\u8981\u62FF\u6765\u7ED9\u5BA2\u6237\u6C9F\u901A\u3001\u5199\u6587\u7AE0\u3001\u505A\u65B9\u6848\uFF09\n- \u7B2C\u4E8C\u8BFB\u8005\u662F LLM\uFF08\u8981\u88AB AI \u5728\u5BA2\u6237\u573A\u666F\u91CC\u8C03\u7528\uFF09\n\n**\u6240\u4EE5\u5185\u5BB9\u5FC5\u987B**\uFF1A\n1. **\u53EF\u8C03\u7528** \u2014\u2014 \u5BA2\u6237\u95EE\u5230\"\u6211\u4EEC\u516C\u53F8 AI \u8BE5\u600E\u4E48\u843D\u5730\"\u65F6\uFF0CAI \u80FD\u76F4\u63A5\u8C03\u51FA\u8FD9\u5F20\u5361\u7684\u5173\u952E\u5224\u65AD\n2. **\u53EF\u8F93\u51FA** \u2014\u2014 Vincent \u53EF\u4EE5\u4ECE\u8FD9\u5F20\u5361\u76F4\u63A5\u751F\u6210\u5BA2\u6237\u8BDD\u672F\u3001\u516C\u4F17\u53F7\u6587\u7AE0\u3001\u65B9\u6848\u9875\n3. **\u53EF\u9A8C\u8BC1** \u2014\u2014 \u8BC1\u636E\u7B49\u7EA7\u3001\u6848\u4F8B\u3001\u8FB9\u754C\u8981\u660E\u786E\uFF0C\u65B9\u4FBF Vincent \u540E\u7EED\u8865\u5145\u5347\u7EA7\n\n**\u6838\u5FC3\u539F\u5219**\uFF1A\n1. **\u6BCF\u4E2A\u7AE0\u8282\u90FD\u8981\u6709\u5185\u5BB9**\uFF0C\u4E0D\u8981\"\u5F85\u8865\"\u6577\u884D\u3002\u8BC1\u636E\u7B49\u7EA7\u3001\u6848\u4F8B\u53EF\u4EE5\u6807\"\u5F85\u8865\"\uFF0C\u4F46\u5206\u6790\u672C\u8EAB\u5FC5\u987B\u6709\u5185\u5BB9\u3002\n2. **\u4FDD\u6301 OpenClaw \u65E2\u6709\u98CE\u683C**\uFF1A\u4F7F\u7528\u300C\u89C2\u5BDF\u5230\u4E86\u4EC0\u4E48 / \u884C\u4E1A\u600E\u4E48\u770B / \u6211\u600E\u4E48\u770B / \u4F9D\u636E\u300D\u7684\u5206\u6790\u7ED3\u6784\u3002\n3. **\u5178\u578B\u75C7\u72B6\u8981\u5177\u4F53\u5230\u53EF\u8BC6\u522B\u7684\u884C\u4E3A\u6A21\u5F0F**\uFF08\u4E0D\u662F\"\u7EC4\u7EC7\u6548\u7387\u4F4E\u4E0B\"\u8FD9\u79CD\u7A7A\u8BDD\uFF0C\u800C\u662F\"\u5168\u516C\u53F8\u90FD\u5728\u7528 AI\uFF0C\u4F46\u8BF4\u4E0D\u6E05\u5E26\u6765\u4E86\u4EC0\u4E48\u4E1A\u52A1\u4EF7\u503C\"\uFF09\u3002\n4. **\u5206\u5C42\u8BCA\u65AD\u95EE\u9898\u8981\u5206\u76EE\u6807\u5C42/\u673A\u5236\u5C42/\u884C\u4E3A\u5C42**\uFF0C\u8BA9 Vincent \u53EF\u4EE5\u76F4\u63A5\u62FF\u53BB\u95EE\u5BA2\u6237\u3002\n5. **\u573A\u666F\u8F93\u51FA\u8981\u7ED9 3-5 \u79CD**\uFF08\u516C\u4F17\u53F7/\u5BA2\u6237\u65B9\u6848/\u5BA2\u6237\u6C9F\u901A/\u8BFE\u7A0B/\u540C\u884C\u4EA4\u6D41\uFF09\uFF0C\u6BCF\u79CD\u90FD\u7ED9\u51FA\u53EF\u76F4\u63A5\u7528\u7684\u8868\u8FBE\u3002\n\n**\u8F93\u51FA\u683C\u5F0F\u5FC5\u987B\u662F\u4E25\u683C JSON**\u3002";
export interface AssetUpgradeInput {
    title: string;
    calibratedInsight: string;
    antiCommonSense: string;
    oppositeView: string;
    boundaryConditions: string;
    plainStory: string;
    sourceContext?: string;
    evidenceLevel: 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5';
    keywords: string[];
}
export interface AssetUpgradeOutput {
    one_sentence_insight: string;
    raw_observation: {
        what_observed: string;
        industry_view: string;
        my_view: string;
        basis: string;
    };
    scene_outputs: Array<{
        scene: 'public_account' | 'client_proposal' | 'client_talk' | 'course_ppt' | 'colleague';
        expression: string;
    }>;
    kernel_links: Array<{
        kernel_belief: string;
        relationship: string;
    }>;
    methodology_links: Array<{
        framework: string;
        connection: string;
    }>;
    boundary: {
        applicable_to: string[];
        not_applicable_to: string[];
        usage_caveat: string;
    };
    symptoms: string[];
    diagnostic_questions: {
        goal_level: string[];
        mechanism_level: string[];
        behavior_level: string[];
    };
    case_records: Array<{
        case_name: string;
        industry: string;
        symptoms_observed: string;
        mechanism: string;
        outcome: string;
        validation_status: string;
    }>;
    visual_suggestion: {
        ppt_structure: string;
        image_prompt: string;
    };
    expression_versions: {
        strong: string;
        client_talk: string;
        article: string;
        proposal: string;
    };
    evidence_level: 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5';
    evidence_note: string;
    maturity: 'available' | 'pending' | 'draft';
    maturity_note: string;
}
export declare function buildAssetUpgradeUserPrompt(input: AssetUpgradeInput): string;
