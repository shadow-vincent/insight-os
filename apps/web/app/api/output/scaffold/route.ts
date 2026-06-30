/**
 * POST /api/output/scaffold
 *
 * 写作骨架生成：基于 N 张资产卡 + templateType → 结构化大纲 JSON
 *
 * 输入: { assetIds: string[], templateType: 'article' | 'speech' | 'book_note', topic?, coreBelief? }
 * 输出: { ok, outputId, scaffold: { title, openingHook, sections, closingAction } }
 *
 * 保存到 outputs 表，writingStatus = 'scaffold'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, outputs, getActiveKernelsForInjection } from '@insight-os/db';
import { inArray } from 'drizzle-orm';
import { callLLM, WRITING_SCAFFOLD_SYSTEM, buildWritingScaffoldUserPrompt } from '@insight-os/llm';
import { isLLMConfigured, readPreset } from '@insight-os/core';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json({
        ok: false,
        error: 'LLM 未配置',
        code: 'LLM_NOT_CONFIGURED',
      }, { status: 400 });
    }

    const body = await req.json();
    const { assetIds, templateType = 'wechat_article', topic = '', coreBelief = '' } = body;

    if (!Array.isArray(assetIds) || assetIds.length < 1 || assetIds.length > 5) {
      return NextResponse.json({
        ok: false,
        error: 'assetIds 必须 1-5 张',
      }, { status: 400 });
    }

    if (!['wechat_article', 'speech', 'book_note'].includes(templateType)) {
      return NextResponse.json({ ok: false, error: '不支持的 templateType（wechat_article / speech / book_note）' }, { status: 400 });
    }

    // 读 N 张资产卡
    const db = getDb();

    if (!db) return NextResponse.json({ ok: false, code: 'NO_SQLITE', error: 'Vercel 部署版不支持此操作，请用浏览器 IndexedDB' });
    const found = db.select().from(assets).where(inArray(assets.id, assetIds)).all();
    if (found.length !== assetIds.length) {
      const foundIds = new Set(found.map(a => a.id));
      const missing = assetIds.filter(id => !foundIds.has(id));
      return NextResponse.json({ ok: false, error: `资产不存在: ${missing.join(', ')}` }, { status: 404 });
    }

    // 准备 prompt 输入
    const kernelSummary = {
      headline: topic || found[0].title,
      summary: coreBelief || found[0].oneSentenceInsight || '',
    };

    const promptInput = {
      templateType: templateType as 'wechat_article' | 'speech' | 'book_note',
      topicName: topic || found[0].title,
      kernelHeadline: kernelSummary.headline,
      kernelSummary: kernelSummary.summary,
      coreBelief: coreBelief || found[0].oneSentenceInsight || found[0].antiCommonSense || '',
      cards: found.map(a => ({
        id: a.id,
        title: a.title,
        oneSentenceInsight: a.oneSentenceInsight,
        antiCommonSense: a.antiCommonSense,
        evidenceLevel: a.evidenceLevel,
      })),
    };

    const userPrompt = buildWritingScaffoldUserPrompt(promptInput);

    // 调 LLM
    const kernel = getActiveKernelsForInjection();
    const result = await callLLM<{
      title: string;
      openingHook: string;
      sections: Array<{
        heading: string;
        keyPoints: string[];
        refAssetIds: string[];
        contentHint: string;
      }>;
      closingAction: string;
    }>(
      WRITING_SCAFFOLD_SYSTEM,
      userPrompt,
      {
        temperature: 0.5,
        maxTokens: 2500,
        jsonMode: true,
      kernel,
      }
    );

    if (!result.ok || !result.data) {
      return NextResponse.json({
        ok: false,
        error: result.error || '生成失败',
        raw: result.raw,
      }, { status: 500 });
    }

    // 保存到 outputs 表
    const now = Math.floor(Date.now() / 1000);
    const outputId = `out_${randomUUID().slice(0, 8)}`;
    const scaffoldJson = JSON.stringify(result.data);

    db.insert(outputs).values({
      id: outputId,
      assetIdsJson: JSON.stringify(assetIds),
      outputType: 'writing',  // writing 类型用 writingStatus 区分
      title: result.data.title,
      content: scaffoldJson,
      audience: '',
      status: 'draft',
      writingStatus: 'scaffold',
      templateType: templateType,
      topicId: '',
      createdAt: now,
      updatedAt: now,
    } as any).run();

    return NextResponse.json({
      ok: true,
      outputId,
      scaffold: result.data,
      usage: result.usage,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}