/**
 * POST /api/kernel/feedback-suggest
 *
 * 反向校准：根据资产 + 反馈内容，规则匹配出最相关的 active Kernel
 * 用户可一键加反例到 Kernel（防"过度套用 Kernel"）
 *
 * body: { assetId, reaction: string }
 * return: { ok, suggestions: [{kernelId, kernelContent, score, suggestedCounterExample}] }
 *
 * 评分规则（v1.5 MVP，无 LLM）：
 *   - 标题关键词匹配：+3 / 词
 *   - insight 关键词匹配：+2 / 词
 *   - counterExample 已存在 → 排除（已经标过的）
 *   - 反馈里出现 Kernel 内容关键词 → +5 / 词
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, userKernels, feedback } from '@insight-os/db';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { assetId, reaction } = await req.json() as { assetId: string; reaction?: string };
    if (!assetId) {
      return NextResponse.json({ ok: false, error: '缺少 assetId' }, { status: 400 });
    }
    const db = getDb();

    // 1) 拿资产
    const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!asset) {
      return NextResponse.json({ ok: false, error: '资产不存在' }, { status: 404 });
    }

    // 2) 拿最近 feedback (这条资产)
    const recentFeedback = db.select().from(feedback)
      .where(eq(feedback.assetId, assetId))
      .orderBy(desc(feedback.createdAt))
      .limit(5)
      .all();

    // 3) 拿所有 active Kernel
    const kernels = db.select().from(userKernels)
      .where(eq(userKernels.status, 'active'))
      .all();

    // 4) 简单关键词匹配评分
    const assetText = [
      asset.title,
      asset.oneSentenceInsight ?? '',
      asset.antiCommonSense ?? '',
    ].join(' ').toLowerCase();

    const feedbackText = [
      ...recentFeedback.map(f => `${f.reaction ?? ''} ${f.mostTouchedPoint ?? ''} ${f.followUpQuestions ?? ''}`),
      reaction ?? '',
    ].join(' ').toLowerCase();

    // 拆词：sliding window 1-4 字 + 完整英文词
    const tokens = (s: string) => {
      const set = new Set<string>();
      // 中文 2-4 字 sliding window
      for (let len = 2; len <= 4; len++) {
        for (let i = 0; i <= s.length - len; i++) {
          const sub = s.slice(i, i + len);
          if (/^[\u4e00-\u9fa5]+$/.test(sub)) set.add(sub);
        }
      }
      // 英文/数字完整词
      const en = s.match(/[a-z0-9]+/g) || [];
      for (const w of en) if (w.length >= 2) set.add(w);
      return set;
    };

    const aTokens = tokens(assetText);
    const fTokens = tokens(feedbackText);

    const suggestions = kernels
      .map(k => {
        const kText = k.content.toLowerCase();
        const kTokens = tokens(kText);
        let score = 0;
        const matchedWords: string[] = [];
        for (const t of kTokens) {
          if (aTokens.has(t)) { score += 3; matchedWords.push(t); }
          else if (fTokens.has(t)) { score += 5; matchedWords.push(t); }
        }
        const hasCounter = !!(k.counterExample && k.counterExample.trim());
        return { kernel: k, score, matchedWords: Array.from(new Set(matchedWords)).slice(0, 5), hasCounter };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // 5) 构造建议反例
    return NextResponse.json({
      ok: true,
      asset: { id: asset.id, title: asset.title, insight: asset.oneSentenceInsight },
      feedbackText: reaction ?? null,
      suggestions: suggestions.map(s => {
        const reason = s.score >= 10
          ? '反馈直接提到了该 Kernel'
          : s.score >= 5
          ? '资产内容与 Kernel 强相关'
          : '资产与 Kernel 主题相关';
        return {
          kernelId: s.kernel.id,
          kernelCategory: s.kernel.category,
          kernelContent: s.kernel.content,
          kernelConfidence: s.kernel.confidence,
          kernelCounterExample: s.kernel.counterExample ?? null,
          hasCounter: s.hasCounter,
          score: s.score,
          matchedWords: s.matchedWords,
          reason,
          suggestedCounterExample: buildSuggestedCounterExample(s.kernel.content, asset.title, reaction),
        };
      }),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function buildSuggestedCounterExample(kernelContent: string, assetTitle: string, reaction?: string): string {
  const ctx = reaction && reaction.length > 5
    ? `（来自反馈：${reaction.slice(0, 60)}${reaction.length > 60 ? '…' : ''}）`
    : '';
  return `${assetTitle.slice(0, 30)}${assetTitle.length > 30 ? '…' : ''} 时不成立。${ctx}`;
}
