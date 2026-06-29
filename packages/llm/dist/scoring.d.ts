/**
 * v1.8.0 候选评分主入口
 *
 * 输入：原始素材（笔记 / 聊天记录 / 项目复盘）
 * 输出：7 维度评分 + 推荐动作 + 4 硬规则命中
 *
 * 使用方式：
 *   import { scoreCandidate } from '@insight-os/llm';
 *   const result = await scoreCandidate(material, { existingAssets });
 */
export interface ScoreBreakdown {
    clear: number;
    evidence: number;
    contrarian: number;
    reusable: number;
    output: number;
    kernel: number;
    novelty: number;
}
export type RecommendedAction = 'process' | 'candidate' | 'signal' | 'ignore';
export interface HardRuleMatch {
    emotion_only: boolean;
    inspiration_only: boolean;
    merge_suggestion: string | null;
    kernel_recommendation: boolean;
}
export interface ScoreCandidateResult {
    ok: boolean;
    summary: string;
    candidateTitle: string;
    candidateStatement: string;
    detectedTopics: string[];
    evidenceType: string[];
    contrarianPoint: string | null;
    applicableScenarios: string[];
    similarAssetIds: string[];
    breakdown: ScoreBreakdown;
    scoreTotal: number;
    recommendedAction: RecommendedAction;
    hardRuleMatch: HardRuleMatch;
    reasoning: string;
    actionLabel: string;
    error?: string;
    raw?: string | null;
}
export interface ScoreCandidateOptions {
    /** 已有资产标题数组（用于检测相似，默认空） */
    existingAssets?: string[];
    /** 温度，默认 0.3（评分稳定） */
    temperature?: number;
    /** 模型，覆盖 config.json */
    model?: string;
}
/**
 * 对原始素材做 7 维度评分
 *
 * 输入：material + 已有资产（可选）
 * 输出：评分结果（即使 LLM 失败也返回部分结果，error 字段说明）
 */
export declare function scoreCandidate(material: string, options?: ScoreCandidateOptions): Promise<ScoreCandidateResult>;
