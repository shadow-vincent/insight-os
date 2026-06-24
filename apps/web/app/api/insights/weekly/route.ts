/**
 * GET /api/insights/weekly
 *
 * Weekly Reflection 报告（v1.5 MVP）
 * 收集过去 7 天的活动 + 30 天没验证的 Kernel + Kernel 被引用情况
 * 不调 LLM（纯数据汇总，Vincent 切真 key 后 V1.6 加 LLM 智能总结）
 *
 * return: {
 *   ok,
 *   weekRange: { start, end },
 *   summary: { assetsNew, feedbackNew, outputsNew, kernelsNew, totalAssets, totalKernels },
 *   topAssets: [...按引用/反馈排序],
 *   topFeedback: [...最有触动的反馈],
 *   staleKernels: [...30 天没验证的 Kernel],
 *   topKernels: [...被引用最多的 Kernel]
 * }
 */

import { NextResponse } from 'next/server';
import { getDb, assets, feedback, outputs, userKernels } from '@insight-os/db';
import { gt, desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const ONE_WEEK = 7 * 24 * 3600;
const STALE_DAYS = 30;

export async function GET() {
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - ONE_WEEK;
    const staleAgo = now - STALE_DAYS * 24 * 3600;

    // 本周新增
    const newAssets = db.select().from(assets)
      .where(gt(assets.createdAt, weekAgo))
      .orderBy(desc(assets.createdAt))
      .all();

    const newFeedback = db.select().from(feedback)
      .where(gt(feedback.createdAt, weekAgo))
      .orderBy(desc(feedback.createdAt))
      .all();

    const newOutputs = db.select().from(outputs)
      .where(gt(outputs.createdAt, weekAgo))
      .orderBy(desc(outputs.createdAt))
      .all();

    const newKernels = db.select().from(userKernels)
      .where(gt(userKernels.createdAt, weekAgo))
      .all();

    // 总数
    const totalAssets = db.select().from(assets).all().length;
    const totalKernels = db.select().from(userKernels).all().length;
    const totalOutputs = db.select().from(outputs).all().length;
    const totalFeedback = db.select().from(feedback).all().length;

    // Top 5 被引用最多 Kernel
    const topKernels = db.select().from(userKernels)
      .where(eq(userKernels.status, 'active'))
      .orderBy(desc(userKernels.referencedCount))
      .limit(5)
      .all();

    // 30 天没验证的 Kernel（lastVerifiedAt 为 null 或 < staleAgo）
    const allActiveKernels = db.select().from(userKernels)
      .where(eq(userKernels.status, 'active'))
      .all();
    const staleKernels = allActiveKernels
      .filter(k => !k.lastVerifiedAt || k.lastVerifiedAt < staleAgo)
      .sort((a, b) => (a.lastVerifiedAt ?? 0) - (b.lastVerifiedAt ?? 0))
      .slice(0, 10);

    // 反馈排名（按 reaction 长度或具体内容）
    const topFeedback = newFeedback
      .filter(f => f.reaction && f.reaction.length > 5)
      .sort((a, b) => (b.reaction?.length ?? 0) - (a.reaction?.length ?? 0))
      .slice(0, 5);

    // 输出排名
    const topOutputs = newOutputs.slice(0, 5);

    // 主题变化（哪些主题资产增长最快）
    // 简化：列出所有主题 + 资产数
    // 留 V1.6

    return NextResponse.json({
      ok: true,
      weekRange: {
        start: new Date(weekAgo * 1000).toISOString(),
        end: new Date(now * 1000).toISOString(),
      },
      summary: {
        assetsNew: newAssets.length,
        feedbackNew: newFeedback.length,
        outputsNew: newOutputs.length,
        kernelsNew: newKernels.length,
        totalAssets,
        totalKernels,
        totalOutputs,
        totalFeedback,
      },
      newAssets: newAssets.slice(0, 10).map(a => ({
        id: a.id,
        title: a.title,
        evidenceLevel: a.evidenceLevel,
        insight: a.oneSentenceInsight,
      })),
      topFeedback: topFeedback.map(f => ({
        id: f.id,
        assetId: f.assetId,
        scene: f.scene,
        reaction: f.reaction,
        mostTouchedPoint: f.mostTouchedPoint,
        followUpQuestions: f.followUpQuestions,
      })),
      newOutputs: topOutputs.map(o => ({
        id: o.id,
        title: o.title,
        outputType: o.outputType,
        writingStatus: o.writingStatus,
      })),
      staleKernels: staleKernels.map(k => ({
        id: k.id,
        category: k.category,
        content: k.content,
        confidence: k.confidence,
        lastVerifiedAt: k.lastVerifiedAt,
        daysSinceVerify: k.lastVerifiedAt ? Math.floor((now - k.lastVerifiedAt) / 86400) : null,
      })),
      topKernels: topKernels.map(k => ({
        id: k.id,
        category: k.category,
        content: k.content,
        confidence: k.confidence,
        referencedCount: k.referencedCount,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
