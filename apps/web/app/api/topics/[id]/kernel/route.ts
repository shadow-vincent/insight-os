/**
 * GET  /api/topics/[id]/kernel    — 取主题思想内核（如果有）
 * POST /api/topics/[id]/kernel    — 生成 / 重新生成思想内核
 * DELETE /api/topics/[id]/kernel — 清空（回到没生成状态）
 *
 * v0.8 思想内核：LLM 从主题下所有资产卡总结 1 个内核
 *   - headline（一句话主题总结）
 *   - summary（200-500 字综合）
 *   - coreBeliefs（3-5 个核心判断 + 来源卡）
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, getRawSqlite, topics, assets, assetTopics, topicKernels, getActiveKernelsForInjection } from '@insight-os/db';
import { isLLMConfigured } from '@insight-os/core';
import { callLLM } from '@insight-os/llm';
import {
  TOPIC_KERNEL_SYSTEM,
  buildTopicKernelUserPrompt,
  type KernelOutput,
  type KernelCardInput,
} from '@insight-os/llm';

export const dynamic = 'force-dynamic';

interface PathContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: PathContext) {
  try {
    const { id: topicId } = await ctx.params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    const row = db.select().from(topicKernels).where(eq(topicKernels.topicId, topicId)).get();
    if (!row) {
      return Response.json({ ok: true, kernel: null });
    }
    return Response.json({
      ok: true,
      kernel: {
        id: row.id,
        topicId: row.topicId,
        headline: row.headline,
        summary: row.summary,
        coreBeliefs: JSON.parse(row.coreBeliefsJson),
        sourceAssetIds: JSON.parse(row.sourceAssetIdsJson),
        generatedAt: row.generatedAt,
        generationModel: row.generationModel,
      },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: PathContext) {
  try {
    const { id: topicId } = await ctx.params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });

    // 1) 查主题
    const topic = db.select().from(topics).where(eq(topics.id, topicId)).get();
    if (!topic) {
      return Response.json({ ok: false, error: '主题不存在' }, { status: 404 });
    }

    // 2) 拿主题下所有资产卡（带 insight / anti）
    const sqlite = getRawSqlite();
    const links = db.select().from(assetTopics).where(eq(assetTopics.topicId, topicId)).all();
    const cardIds = links.map(l => l.assetId);

    if (cardIds.length === 0) {
      return Response.json({
        ok: false,
        error: '此主题下还没有资产卡，无法生成内核。先在资产详情页加几张卡到这个主题。',
      }, { status: 400 });
    }

    const cardRows = db.select().from(assets).where(eq(assets.id, cardIds[0])).all();
    // 用 SQL 一次拿所有（避免 drizzle 的 where...in 多参数在 better-sqlite3 报错）
    const cardsRaw = sqlite.prepare(`
      SELECT id, title, one_sentence_insight as oneSentenceInsight,
             anti_common_sense as antiCommonSense, evidence_level as evidenceLevel
      FROM assets WHERE id IN (${cardIds.map(() => '?').join(',')}) AND type = 'asset'
    `).all(...cardIds) as any[];

    const cardInputs: KernelCardInput[] = cardsRaw.map(c => ({
      id: c.id,
      title: c.title,
      oneSentenceInsight: c.oneSentenceInsight,
      antiCommonSense: c.antiCommonSense,
      evidenceLevel: c.evidenceLevel,
    }));

    // 3) 调 LLM（如果配了），否则降级到规则汇总
    let kernelData: KernelOutput;
    let model = 'manual';

    if (isLLMConfigured()) {
      const userPrompt = buildTopicKernelUserPrompt({
        topicName: topic.name,
        topicDescription: topic.description,
        cards: cardInputs,
      });
      const res = await callLLM<KernelOutput>(TOPIC_KERNEL_SYSTEM, userPrompt, {
        jsonMode: true,
        temperature: 0.4,
        maxTokens: 1500,
        kernel: getActiveKernelsForInjection(),
      });
      if (res.ok && res.data) {
        kernelData = res.data;
        model = res.model ?? 'llm';
      } else {
        return Response.json({
          ok: false,
          error: `LLM 生成失败：${res.error ?? '未知错误'}`,
        }, { status: 500 });
      }
    } else {
      // fallback：未配 LLM，简单拼 top 3 卡标题 + 简单模板
      const top3 = cardInputs.slice(0, 3);
      kernelData = {
        headline: `${topic.name} 主题下 ${cardInputs.length} 张卡`,
        summary: `未配 LLM，无法生成完整思想内核。手动查看 ${top3.map(c => `「${c.title}」`).join(' / ')} 等 ${cardInputs.length} 张资产卡，或先在 ⚙ 设置里配 LLM Key。`,
        coreBeliefs: top3.map(c => ({
          text: c.oneSentenceInsight || c.title,
          sourceCardIds: [c.id],
        })),
      };
    }

    // 4) 校验：3-5 个 coreBeliefs、每条 sourceCardIds 至少 1 个
    if (!kernelData.headline || kernelData.headline.length > 60) {
      kernelData.headline = (kernelData.headline || '').slice(0, 30) || topic.name;
    }
    if (!kernelData.coreBeliefs || kernelData.coreBeliefs.length === 0) {
      return Response.json({ ok: false, error: 'LLM 返回的核心判断为空，请重试' }, { status: 500 });
    }
    kernelData.coreBeliefs = kernelData.coreBeliefs.slice(0, 5);
    kernelData.coreBeliefs = kernelData.coreBeliefs.map(b => ({
      text: (b.text || '').slice(0, 200),
      sourceCardIds: Array.isArray(b.sourceCardIds) ? b.sourceCardIds.filter(Boolean) : [],
    })).filter(b => b.text);

    // 5) upsert：先看有没有，有就更新，没有就插入
    const existing = db.select().from(topicKernels).where(eq(topicKernels.topicId, topicId)).get();
    const now = Math.floor(Date.now() / 1000);
    if (existing) {
      db.update(topicKernels)
        .set({
          headline: kernelData.headline,
          summary: kernelData.summary || '',
          coreBeliefsJson: JSON.stringify(kernelData.coreBeliefs),
          sourceAssetIdsJson: JSON.stringify(
            Array.from(new Set(kernelData.coreBeliefs.flatMap(b => b.sourceCardIds)))
          ),
          generatedAt: now,
          generationModel: model,
        })
        .where(eq(topicKernels.id, existing.id))
        .run();
    } else {
      db.insert(topicKernels).values({
        id: randomUUID(),
        topicId,
        headline: kernelData.headline,
        summary: kernelData.summary || '',
        coreBeliefsJson: JSON.stringify(kernelData.coreBeliefs),
        sourceAssetIdsJson: JSON.stringify(
          Array.from(new Set(kernelData.coreBeliefs.flatMap(b => b.sourceCardIds)))
        ),
        generatedAt: now,
        generationModel: model,
      }).run();
    }

    return Response.json({
      ok: true,
      kernel: {
        topicId,
        headline: kernelData.headline,
        summary: kernelData.summary,
        coreBeliefs: kernelData.coreBeliefs,
        generatedAt: now,
        generationModel: model,
        sourceCardCount: cardInputs.length,
      },
    });
  } catch (e: any) {
    console.error('[kernel POST]', e);
    return Response.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: PathContext) {
  try {
    const { id: topicId } = await ctx.params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
    db.delete(topicKernels).where(eq(topicKernels.topicId, topicId)).run();
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
