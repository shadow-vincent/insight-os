/**
 * POST /api/writing/companion  写作陪练（v0.9.4）
 *
 * 3 动作：
 *   - counter_argument: 反方观点（3 个具体问题）
 *   - recommend_cards: 推荐能引用的卡（最多 2 张）
 *   - duplicate_check: 重复论点检测（0-3 条历史输出）
 *
 * Body: {
 *   writingId: 'writing_xxx',     // 当前写作记录
 *   action: 'counter_argument' | 'recommend_cards' | 'duplicate_check',
 *   currentText: '当前段落（≥ 30 字）',
 *   coreBelief: '本文核心判断',
 * }
 *
 * 推荐/重复检测时，会自动用写作的 assetIds + 同主题历史输出做参考
 */

import { NextRequest } from 'next/server';
import { eq, ne, and, desc, inArray } from 'drizzle-orm';
import { getDb, outputs, assets } from '@insight-os/db';
import { isLLMConfigured } from '@insight-os/core';
import { callLLM } from '@insight-os/llm';
import {
  WRITING_COMPANION_SYSTEM,
  buildWritingCompanionUserPrompt,
  type CompanionAction,
  type CompanionResponse,
  type CompanionCardInput,
  type CompanionRecentOutput,
} from '@insight-os/llm';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS: CompanionAction[] = ['counter_argument', 'recommend_cards', 'duplicate_check'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { writingId, action, currentText, coreBelief } = body;

    // 1) 校验
    if (!writingId || typeof writingId !== 'string') {
      return Response.json({ ok: false, error: '缺少 writingId' }, { status: 400 });
    }
    if (!action || !VALID_ACTIONS.includes(action)) {
      return Response.json({ ok: false, error: `action 必须是 ${VALID_ACTIONS.join('|')}` }, { status: 400 });
    }
    if (!currentText || typeof currentText !== 'string' || currentText.trim().length < 20) {
      return Response.json({ ok: false, error: 'currentText 至少 20 字' }, { status: 400 });
    }
    if (!coreBelief || typeof coreBelief !== 'string') {
      return Response.json({ ok: false, error: '缺少 coreBelief' }, { status: 400 });
    }

    // 2) 拿写作记录
    const db = getDb();
    const writing = db.select().from(outputs).where(eq(outputs.id, writingId)).get();
    if (!writing) {
      return Response.json({ ok: false, error: '写作记录不存在' }, { status: 404 });
    }

    // 3) 准备数据
    let cards: CompanionCardInput[] = [];
    let recentOutputs: CompanionRecentOutput[] = [];

    if (action === 'recommend_cards') {
      // 推荐卡：拿当前写作关联的卡 + 同主题的其他卡（最多 30 张）
      const writingAssetIds = JSON.parse(writing.assetIdsJson || '[]') as string[];
      const seedIds = new Set(writingAssetIds);

      // 找同主题的所有卡
      let sameTopicCardIds: string[] = [];
      if (writing.topicId) {
        const sqlite = (await import('@insight-os/db')).getRawSqlite();
        const links = sqlite.prepare(`SELECT asset_id FROM asset_topics WHERE topic_id = ?`).all(writing.topicId) as any[];
        sameTopicCardIds = links.map(l => l.asset_id);
      }

      // 合并 + 去重 + 限 30
      const candidateIds = Array.from(new Set([...writingAssetIds, ...sameTopicCardIds])).slice(0, 30);
      if (candidateIds.length > 0) {
        const rows = db.select().from(assets).where(inArray(assets.id, candidateIds)).all();
        cards = rows.map(c => ({
          id: c.id,
          title: c.title,
          oneSentenceInsight: c.oneSentenceInsight,
          antiCommonSense: c.antiCommonSense,
          evidenceLevel: c.evidenceLevel,
        }));
      }
    } else if (action === 'duplicate_check') {
      // 重复检测：拿过去 6 个月的 writing 输出（不含自己）
      const sixMonthsAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30 * 6;
      const recent = db.select().from(outputs)
        .where(and(
          eq(outputs.outputType, 'writing'),
          ne(outputs.id, writingId),
        ))
        .orderBy(desc(outputs.createdAt))
        .all();
      recentOutputs = recent
        .filter(o => (o.createdAt ?? 0) >= sixMonthsAgo)
        .slice(0, 20)
        .map(o => ({
          id: o.id,
          title: o.title,
          date: new Date((o.createdAt ?? 0) * 1000).toISOString().slice(0, 10),
          assetIds: JSON.parse(o.assetIdsJson || '[]'),
        }));
    }
    // counter_argument 不需要 cards/recentOutputs

    // 4) 调 LLM
    if (!isLLMConfigured()) {
      return Response.json({
        ok: false,
        error: '未配 LLM Key，无法用写作陪练。先在 ⚙ 设置里配 LLM。',
      }, { status: 400 });
    }

    const userPrompt = buildWritingCompanionUserPrompt({
      action,
      currentText: currentText.slice(0, 2000),
      coreBelief: coreBelief.slice(0, 500),
      cards,
      recentOutputs,
    });
    const res = await callLLM<CompanionResponse>(WRITING_COMPANION_SYSTEM, userPrompt, {
      jsonMode: true,
      temperature: 0.6,
      maxTokens: 800,
    });
    if (!res.ok || !res.data) {
      return Response.json({ ok: false, error: `LLM 陪练失败：${res.error ?? '未知错误'}` }, { status: 500 });
    }

    return Response.json({
      ok: true,
      action,
      response: res.data,
      contextCounts: { cards: cards.length, recentOutputs: recentOutputs.length },
    });
  } catch (e: any) {
    console.error('[writing/companion]', e);
    return Response.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
