/**
 * /candidates/[id]
 *
 * v1.8.0 候选详情页
 *
 * 用户从主页"加工 →"点进来，看到候选判断的完整信息：
 * - 标题 / 核心判断 / 反常识点 / 主题标签 / 适用场景
 * - 7 维度评分 + 总分 + 推荐动作
 * - 关联资产（如果有）
 * - 4 个动作：加工 / 稍后 / 忽略 / 合并
 *
 * 设计原则（按 Vincent v3 评价第 2 条）：
 * - 不暴露 CandidateJudgment / ProposedAsset / KernelCandidate 等系统术语
 * - 推荐理由人话化
 * - 评分条默认展开（详情页要让用户看到评分依据）
 */

import { CandidateDetailClient } from './CandidateDetailClient';

export const dynamic = 'force-dynamic';

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CandidateDetailClient id={id} />;
}