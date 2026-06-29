/**
 * AI 味自检 prompt（V1.2）
 *
 * 用途：生成完整文章后，独立 prompt 评估"AI 味程度"
 *
 * 设计：
 *   - 输入：生成的文章内容 + 用户禁止词列表
 *   - 输出：score 0-100 + 命中问题列表 + 修改建议
 *   - 不直接修改文章，只给反馈（避免反复改稿反而失去 Vincent 风格）
 *   - 配合 output/multi/route.ts 自动 retry: score < 70 重新生成 1 次
 *
 * 不替代 L0 脱 AI 味 8 条（那在 system prompt 里），而是**事后**独立评分
 */
export declare const AI_TASTE_CHECK_SYSTEM: string;
export interface AITasteCheckResult {
    score: number;
    passed: boolean;
    issues: Array<{
        category: string;
        severity: 'low' | 'medium' | 'high';
        location: string;
        quote: string;
        problem: string;
        suggestion: string;
    }>;
    highlights: Array<{
        location: string;
        quote: string;
        why: string;
    }>;
    summary: string;
}
export interface AITasteCheckInput {
    content: string;
    bannedWords?: string[];
    outputType?: string;
    maxTokens?: number;
}
/**
 * 评估文章的 AI 味程度
 */
export declare function aiTasteCheck(input: AITasteCheckInput): Promise<{
    ok: boolean;
    data?: AITasteCheckResult;
    error?: string;
}>;
