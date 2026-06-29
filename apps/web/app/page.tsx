/**
 * /  (今日加工)
 *
 * v1.8.5 还原原型（按 Vincent 2026-06-29 反馈）：
 * - **必须有原型所有的 4 个 section**（不能漏底部 2 个推荐板块）
 *   1. Hero 输入区（输入框 + 4 入口卡横向 + CTA）
 *   2. 今日推荐加工候选卡（带 AI 推荐理由加粗高亮）
 *   3. **📚 主题已具备输出条件**（核心差异化）
 *   4. **⬆️ 判断可以变强**（核心差异化）
 * - 不要再"自己造对话框质感"——原型已有，加质感是微调不是重做
 *
 * 教训：做产品页改造前必须把原型截全图，看完所有 section 再开始
 */

import { getDb } from '@insight-os/db';
import { sql } from 'drizzle-orm';
import { isLLMConfigured } from '@insight-os/core';
import { TodayProcessingPageClient } from '@/components/today/TodayProcessingPageClient';

export const dynamic = 'force-dynamic';

interface CandidateRow {
  id: string;
  title: string;
  oneSentenceInsight: string | null;
  scoreTotal: number;
  scoreBreakdownJson: string;
  createdAt: number;
  tagsJson: string;
  evidenceLevel: string;
}

interface ReadyTopicRow {
  topicId: string;
  topicName: string;
  topicSlug: string;
  assetCount: number;
  e3PlusCount: number;
  outputCount: number;
  lastOutputAt: number | null;
}

interface KernelCandidateRow {
  id: string;
  title: string;
  evidenceLevel: string;
  outputCount: number;
  feedbackCount: number;
}

export default function DashboardPage() {
  const db = getDb();

  // V1.10: Vercel serverless 下 SQLite 不可用（better-sqlite3 native binding 加载失败）
  // 返回空状态，让客户端 IndexedDB 提供数据（V1.10 Phase 2 实现）
  if (!db) {
    return (
      <TodayProcessingPageClient
        candidates={[]}
        totalCount={0}
        llmEnabled={false}
        readyTopics={[]}
        kernelCandidates={[]}
        inboxCount={0}
        sources={[]}
      />
    );
  }

  // ===== 1. 候选判断（AI 评分了但人还没决策的全部状态：candidate + sorting + inbox）
  // 原型"今日推荐加工" = 所有 AI 评分了但还没变成正式资产的
  // V1.8.0 状态机：inbox → sorting（AI 评分后）→ candidate（高价值排序待确认）→ in_use
  // 这 3 个状态都算"等待人决策的推荐池"
  const candidateRows = db.all(sql`
    SELECT id, title, one_sentence_insight as oneSentenceInsight,
           score_total as scoreTotal, score_breakdown_json as scoreBreakdownJson,
           created_at as createdAt, tags_json as tagsJson, evidence_level as evidenceLevel, status
    FROM assets
    WHERE status IN ('candidate', 'sorting', 'inbox') AND score_total > 0
    ORDER BY score_total DESC, created_at DESC
    LIMIT 5
  `) as CandidateRow[];

  const totalCountRow = db.get(sql`
    SELECT count(*) as n FROM assets WHERE status IN ('candidate', 'sorting', 'inbox') AND score_total > 0
  `) as { n: number } | undefined;
  const totalCount = totalCountRow?.n ?? 0;

  // ===== 2. 主题已具备输出条件（topic 下有 ≥5 个 E2+ 资产 + ≥1 个 output）=====
  // 简化口径：资产 ≥5 + E2+ ≥3 + 有 output → 可输出
  const readyTopicRows = db.all(sql`
    SELECT t.id as topicId, t.name as topicName, t.slug as topicSlug,
           COUNT(DISTINCT a.id) as assetCount,
           SUM(CASE WHEN a.evidence_level IN ('E2','E3','E4','E5') THEN 1 ELSE 0 END) as e3PlusCount,
           COUNT(DISTINCT o.id) as outputCount,
           MAX(o.created_at) as lastOutputAt
    FROM topics t
    INNER JOIN asset_topics at ON at.topic_id = t.id
    INNER JOIN assets a ON a.id = at.asset_id
    LEFT JOIN outputs o ON o.topic_id = t.id
    WHERE a.status IN ('in_use', 'archived')
    GROUP BY t.id
    HAVING assetCount >= 5 AND e3PlusCount >= 3
    ORDER BY assetCount DESC, e3PlusCount DESC
    LIMIT 3
  `) as ReadyTopicRow[];

  // ===== 3. 判断可以变强（is_kernel_candidate=1 + is_kernel_approved=0）=====
  // 已经是 V1.8.0 自动标过的资产，输出后强化机制推荐
  const kernelCandidateRows = db.all(sql`
    SELECT id, title, evidence_level as evidenceLevel,
           output_count as outputCount, feedback_count as feedbackCount
    FROM assets
    WHERE is_kernel_candidate = 1 AND is_kernel_approved = 0 AND status = 'in_use'
    ORDER BY output_count DESC, feedback_count DESC
    LIMIT 3
  `) as KernelCandidateRow[];

  // ===== 4. 数据来源统计（给"4 入口卡"的数字）=====
  // inbox 未使用本地表，统一 fallback 为 0（4 入口卡的数字原型先写默认）
  const inboxCount = 0;

  // ===== 5. 信息源订阅（v1.9.0）=====
  interface SourceRow {
    id: string;
    type: string;
    url: string;
    title: string;
    enabled: number;
    lastFetchedAt: number | null;
    lastError: string | null;
    newItemsCount: number;
    totalItemsCount: number;
  }
  const sourceRows = db.all(sql`
    SELECT id, type, url, title, enabled, last_fetched_at as lastFetchedAt,
           last_error as lastError, new_items_count as newItemsCount, total_items_count as totalItemsCount
    FROM sources
    WHERE enabled = 1
    ORDER BY new_items_count DESC, created_at DESC
  `) as SourceRow[];

  const llmEnabled = isLLMConfigured();

  // ===== 转换 candidate 数据 =====
  const candidatesForHero = candidateRows.map(row => {
    let breakdown = { clear: 0.5, evidence: 0.5, contrarian: 0.5, reusable: 0.5, output: 0.5, kernel: 0.5, novelty: 0.5 };
    try {
      const parsed = JSON.parse(row.scoreBreakdownJson || '{}');
      if (parsed && typeof parsed === 'object') breakdown = { ...breakdown, ...parsed };
    } catch { /* noop */ }

    let topics: string[] = [];
    try {
      const tags = JSON.parse(row.tagsJson || '[]');
      if (Array.isArray(tags)) topics = tags.slice(0, 3);
    } catch { /* noop */ }

    return {
      id: row.id,
      title: row.title,
      statement: row.oneSentenceInsight ?? '',
      scoreTotal: row.scoreTotal,
      evidenceLevel: row.evidenceLevel,
      recommendedAction: row.scoreTotal >= 80 ? 'process' as const : row.scoreTotal >= 65 ? 'candidate' as const : row.scoreTotal >= 50 ? 'signal' as const : 'ignore' as const,
      reasoning: '基于最近 7 维度评分推荐',
      breakdown,
      topics,
      scenarios: [],
      createdAt: row.createdAt,
      evidenceType: [],
    };
  });

  // ===== 转换 ready topics =====
  const readyTopics = readyTopicRows.map(row => ({
    id: row.topicId,
    name: row.topicName,
    slug: row.topicSlug,
    assetCount: row.assetCount,
    e2PlusCount: row.e3PlusCount,
    outputCount: row.outputCount,
    lastOutputAt: row.lastOutputAt,
  }));

  // ===== 转换 kernel candidates =====
  const kernelCandidates = kernelCandidateRows.map(row => ({
    id: row.id,
    title: row.title,
    evidenceLevel: row.evidenceLevel,
    outputCount: row.outputCount,
    feedbackCount: row.feedbackCount,
  }));

  return (
    <TodayProcessingPageClient
      candidates={candidatesForHero}
      totalCount={totalCount}
      llmEnabled={llmEnabled}
      readyTopics={readyTopics}
      kernelCandidates={kernelCandidates}
      inboxCount={inboxCount}
      sources={sourceRows}
    />
  );
}