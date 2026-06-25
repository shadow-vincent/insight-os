/**
 * GET /api/dashboard/action-today
 *
 * V1.6「行动驾驶舱」数据源
 *
 * 返回 3 栏（每栏 3 件事 = 今天最该推进的 9 件事）：
 * 1. **待校准** = status='candidate' 的资产，按 evidenceLevel 升序（最低先升级）
 * 2. **可输出** = 资产数 ≥ 3 的主题（够料出文章/课程/方案），按资产数降序
 * 3. **待反馈升级** = 有 feedback 但 output.status != 'feedback_done'，按反馈时间降序
 *
 * 不调 LLM（纯数据汇总，跟 Weekly Reflection 一致）
 */

import { NextResponse } from 'next/server';
import { getDb, assets, feedback, outputs, topics, assetTopics } from '@insight-os/db';
import { eq, and, ne, desc, asc, gt, sql, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const PER_SECTION = 3;
const TOPIC_MIN_ASSETS = 3; // 主题资产数 ≥ 3 才算"可输出"

export async function GET() {
  try {
    const db = getDb();

    // 1) 待校准：candidate 资产 + 按 evidenceLevel 升序（E0 先升级）+ feedbackCount 降序
    const candidates = db
      .select({
        id: assets.id,
        title: assets.title,
        evidenceLevel: assets.evidenceLevel,
        feedbackCount: assets.feedbackCount,
        oneSentenceInsight: assets.oneSentenceInsight,
        createdAt: assets.createdAt,
        lastUsedAt: assets.lastUsedAt,
      })
      .from(assets)
      .where(eq(assets.status, 'candidate'))
      .orderBy(asc(assets.evidenceLevel), desc(assets.feedbackCount), desc(assets.createdAt))
      .limit(PER_SECTION)
      .all();

    // 2) 可输出：资产数 ≥ TOPIC_MIN_ASSETS 的主题，按资产数降序
    const topicAssetCounts = db
      .select({
        topicId: assetTopics.topicId,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(assetTopics)
      .groupBy(assetTopics.topicId)
      .having(sql`count(*) >= ${TOPIC_MIN_ASSETS}`)
      .all();

    const readyTopicIds = topicAssetCounts.map((r) => r.topicId);
    const readyTopicsRaw =
      readyTopicIds.length > 0
        ? db.select().from(topics).where(inArray(topics.id, readyTopicIds)).all()
        : [];

    // 内存里 join topic + count，按 count 降序
    const sortedReadyTopics = readyTopicsRaw
      .map((t) => ({
        ...t,
        assetCount: topicAssetCounts.find((c) => c.topicId === t.id)?.count ?? 0,
      }))
      .sort((a, b) => b.assetCount - a.assetCount)
      .slice(0, PER_SECTION);

    // 3) 待反馈升级：outputs.status != 'feedback_done' 且有关联 feedback（最近 30 天）
    const THIRTY_DAYS = 30 * 24 * 3600;
    const now = Math.floor(Date.now() / 1000);
    const monthAgo = now - THIRTY_DAYS;

    const pendingFeedbackOutputs = db
      .select({
        id: outputs.id,
        title: outputs.title,
        outputType: outputs.outputType,
        status: outputs.status,
        updatedAt: outputs.updatedAt,
        createdAt: outputs.createdAt,
      })
      .from(outputs)
      .where(ne(outputs.status, 'feedback_done'))
      .all();

    // 关联 feedback 找最近 1 条
    const outputIds = pendingFeedbackOutputs.map((o) => o.id);
    const recentFeedback =
      outputIds.length > 0
        ? db
            .select()
            .from(feedback)
            .where(and(inArray(feedback.outputId, outputIds), gt(feedback.createdAt, monthAgo)))
            .orderBy(desc(feedback.createdAt))
            .all()
        : [];

    // 每个 output 找最近 1 条 feedback
    const pendingFeedbackList = pendingFeedbackOutputs
      .map((o) => {
        const fb = recentFeedback.find((f) => f.outputId === o.id);
        return fb
          ? {
              outputId: o.id,
              outputTitle: o.title,
              outputType: o.outputType,
              outputStatus: o.status,
              feedbackId: fb.id,
              feedbackScene: fb.scene,
              feedbackMostTouched: fb.mostTouchedPoint,
              feedbackAt: fb.createdAt,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.feedbackAt - a.feedbackAt)
      .slice(0, PER_SECTION);

    return NextResponse.json({
      ok: true,
      generatedAt: now,
      sections: {
        candidates: {
          label: '待校准',
          description: '候选池里最值得升级成正式资产的判断',
          items: candidates.map((c) => ({
            id: c.id,
            title: c.title,
            subtitle: c.oneSentenceInsight ?? '',
            badge: c.evidenceLevel,
            meta: `${c.feedbackCount} 次反馈 · 候选 ${Math.floor((now - c.createdAt) / 86400)} 天`,
            href: `/assets/${c.id}`,
          })),
        },
        readyTopics: {
          label: '可输出',
          description: `资产 ≥ ${TOPIC_MIN_ASSETS} 的主题，可以直接出文章/课程/方案`,
          items: sortedReadyTopics.map((t) => ({
            id: t.id,
            title: t.name,
            subtitle: t.description ?? '',
            badge: `${t.assetCount} 张资产`,
            meta: '',
            href: `/topics/${t.slug}`,
          })),
        },
        pendingFeedback: {
          label: '待反馈升级',
          description: '已有反馈但还没反哺到资产等级 / Kernel 的输出',
          items: pendingFeedbackList.map((p) => ({
            id: p.outputId,
            title: p.outputTitle,
            subtitle: p.feedbackMostTouched ?? p.feedbackScene ?? '',
            badge: p.outputType,
            meta: `${Math.floor((now - p.feedbackAt) / 86400)} 天前反馈`,
            href: `/output/${p.outputId}`,
          })),
        },
      },
      counts: {
        candidatesTotal: candidates.length,
        readyTopicsTotal: sortedReadyTopics.length,
        pendingFeedbackTotal: pendingFeedbackList.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
