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

import { callLLM } from './client.ts';
import {
  SCORE_CANDIDATE_SYSTEM,
  buildScoreCandidateUserPrompt,
  ACTION_USER_LABEL,
} from './prompts/score-candidate.ts';

export interface ScoreBreakdown {
  clear: number;       // 判断清晰度 (0-1)
  evidence: number;    // 证据强度 (0-1)
  contrarian: number;  // 反常识 (0-1)
  reusable: number;    // 可复用 (0-1)
  output: number;      // 输出潜力 (0-1)
  kernel: number;      // Kernel 相关 (0-1)
  novelty: number;     // 新颖度 (0-1)
}

export type RecommendedAction = 'process' | 'candidate' | 'signal' | 'ignore';

export interface HardRuleMatch {
  emotion_only: boolean;
  inspiration_only: boolean;
  merge_suggestion: string | null;  // asset_id of similar asset
  kernel_recommendation: boolean;
}

export interface ScoreCandidateResult {
  ok: boolean;
  // 评分
  summary: string;
  candidateTitle: string;
  candidateStatement: string;
  detectedTopics: string[];
  evidenceType: string[];
  contrarianPoint: string | null;
  applicableScenarios: string[];
  similarAssetIds: string[];
  breakdown: ScoreBreakdown;
  scoreTotal: number;  // 0-100
  recommendedAction: RecommendedAction;
  hardRuleMatch: HardRuleMatch;
  reasoning: string;
  // 用户话术
  actionLabel: string;
  // 错误
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
 * 7 维度权重
 */
const WEIGHTS = {
  clear: 20,
  evidence: 20,
  contrarian: 15,
  reusable: 15,
  output: 15,
  kernel: 10,
  novelty: 5,
};

/**
 * 根据总分 + 硬规则决定推荐动作
 *
 * 注意：硬规则优先于总分
 */
function decideAction(scoreTotal: number, hardRules: HardRuleMatch): RecommendedAction {
  // 硬规则覆盖
  if (hardRules.emotion_only) return 'ignore';
  if (hardRules.inspiration_only && scoreTotal < 65) return 'signal';

  // 总分决定
  if (scoreTotal >= 80) return 'process';
  if (scoreTotal >= 65) return 'candidate';
  if (scoreTotal >= 50) return 'signal';
  return 'ignore';
}

/**
 * 对原始素材做 7 维度评分
 *
 * 输入：material + 已有资产（可选）
 * 输出：评分结果（即使 LLM 失败也返回部分结果，error 字段说明）
 */
export async function scoreCandidate(
  material: string,
  options: ScoreCandidateOptions = {}
): Promise<ScoreCandidateResult> {
  // 默认空结果（LLM 失败时也返回）
  const empty: ScoreCandidateResult = {
    ok: false,
    summary: '',
    candidateTitle: '',
    candidateStatement: '',
    detectedTopics: [],
    evidenceType: [],
    contrarianPoint: null,
    applicableScenarios: [],
    similarAssetIds: [],
    breakdown: { clear: 0, evidence: 0, contrarian: 0, reusable: 0, output: 0, kernel: 0, novelty: 0 },
    scoreTotal: 0,
    recommendedAction: 'ignore',
    hardRuleMatch: { emotion_only: false, inspiration_only: false, merge_suggestion: null, kernel_recommendation: false },
    reasoning: '',
    actionLabel: ACTION_USER_LABEL.ignore,
    error: 'LLM 未返回',
    raw: null,
  };

  if (!material || material.trim().length < 5) {
    return { ...empty, error: '素材太短（< 5 字符）' };
  }

  const userPrompt = buildScoreCandidateUserPrompt(material, options.existingAssets);

  const result = await callLLM<{
    summary?: string;
    candidate_title?: string;
    candidate_statement?: string;
    detected_topics?: string[];
    evidence_type?: string[];
    contrarian_point?: string | null;
    applicable_scenarios?: string[];
    similar_asset_ids?: string[];
    breakdown?: Partial<ScoreBreakdown>;
    score_total?: number;
    recommended_action?: RecommendedAction;
    hard_rule_match?: Partial<HardRuleMatch>;
    reasoning?: string;
  }>(SCORE_CANDIDATE_SYSTEM, userPrompt, {
    temperature: options.temperature ?? 0.3,
    jsonMode: true,
    ...(options.model ? { model: options.model } : {}),
  });

  if (!result.ok || !result.data) {
    return { ...empty, error: result.error ?? '未知错误', raw: result.raw };
  }

  const d = result.data;

  // 安全解析 breakdown（LLM 可能漏字段）
  const breakdown: ScoreBreakdown = {
    clear: clamp01(d.breakdown?.clear ?? 0.5),
    evidence: clamp01(d.breakdown?.evidence ?? 0.5),
    contrarian: clamp01(d.breakdown?.contrarian ?? 0.5),
    reusable: clamp01(d.breakdown?.reusable ?? 0.5),
    output: clamp01(d.breakdown?.output ?? 0.5),
    kernel: clamp01(d.breakdown?.kernel ?? 0.5),
    novelty: clamp01(d.breakdown?.novelty ?? 0.5),
  };

  // 用 breakdown 加权重算总分（不信任 LLM 的 score_total，自己算）
  const computedTotal = Math.round(
    breakdown.clear * WEIGHTS.clear +
    breakdown.evidence * WEIGHTS.evidence +
    breakdown.contrarian * WEIGHTS.contrarian +
    breakdown.reusable * WEIGHTS.reusable +
    breakdown.output * WEIGHTS.output +
    breakdown.kernel * WEIGHTS.kernel +
    breakdown.novelty * WEIGHTS.novelty
  );

  const hardRules: HardRuleMatch = {
    emotion_only: Boolean(d.hard_rule_match?.emotion_only),
    inspiration_only: Boolean(d.hard_rule_match?.inspiration_only),
    merge_suggestion: d.hard_rule_match?.merge_suggestion ?? null,
    kernel_recommendation: Boolean(d.hard_rule_match?.kernel_recommendation),
  };

  // 决定推荐动作（硬规则覆盖 > 总分）
  const action = decideAction(computedTotal, hardRules);

  return {
    ok: true,
    summary: d.summary ?? '',
    candidateTitle: d.candidate_title ?? '',
    candidateStatement: d.candidate_statement ?? '',
    detectedTopics: Array.isArray(d.detected_topics) ? d.detected_topics : [],
    evidenceType: Array.isArray(d.evidence_type) ? d.evidence_type : [],
    contrarianPoint: d.contrarian_point ?? null,
    applicableScenarios: Array.isArray(d.applicable_scenarios) ? d.applicable_scenarios : [],
    similarAssetIds: Array.isArray(d.similar_asset_ids) ? d.similar_asset_ids : [],
    breakdown,
    scoreTotal: computedTotal,
    recommendedAction: action,
    hardRuleMatch: hardRules,
    reasoning: d.reasoning ?? '',
    actionLabel: ACTION_USER_LABEL[action],
    raw: result.raw,
  };
}

function clamp01(n: number): number {
  if (typeof n !== 'number' || isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}