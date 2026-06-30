/**
 * POST /api/writing/scaffold  生成写作骨架（v0.9.2）
 *
 * Body:
 *   {
 *     templateType: 'wechat_article' | 'speech' | 'book_note',
 *     topicId: 'topic_xxx',
 *     coreBelief: '核心判断（用户挑的 1 条）',
 *     assetIds: ['asset_a', 'asset_b', 'asset_c'],  // 3-5 张
 *   }
 *
 * Response: { ok, writingId, scaffold: { title, openingHook, sections, closingAction } }
 *
 * 副作用：
 *   1. 创建一条 outputs 记录（outputType='writing', writingStatus='scaffold'）
 *   2. 不修改 feedback_count（写完发布时 +1）
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { getDb, topics, assets, topicKernels, outputs, getActiveKernelsForInjection } from '@insight-os/db';
import { isLLMConfigured } from '@insight-os/core';
import { callLLM } from '@insight-os/llm';
import {
  WRITING_SCAFFOLD_SYSTEM,
  buildWritingScaffoldUserPrompt,
  type ScaffoldOutput,
  type ScaffoldCardInput,
  type WritingTemplate,
} from '@insight-os/llm';

export const dynamic = 'force-dynamic';

const VALID_TEMPLATES: WritingTemplate[] = ['wechat_article', 'speech', 'book_note'];
const TEMPLATE_LABEL: Record<WritingTemplate, string> = {
  wechat_article: '公众号长文',
  speech: '演讲稿',
  book_note: '读书笔记',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateType, topicId, coreBelief, assetIds } = body;

    // 1) 校验输入
    if (!templateType || !VALID_TEMPLATES.includes(templateType)) {
      return Response.json({ ok: false, error: `templateType 必须是 ${VALID_TEMPLATES.join('|')}` }, { status: 400 });
    }
    const tmpl = templateType as WritingTemplate;
    if (!topicId || typeof topicId !== 'string') {
      return Response.json({ ok: false, error: '缺少 topicId' }, { status: 400 });
    }
    if (!coreBelief || typeof coreBelief !== 'string' || coreBelief.trim().length < 5) {
      return Response.json({ ok: false, error: '核心判断不能为空且至少 5 字' }, { status: 400 });
    }
    if (!Array.isArray(assetIds) || assetIds.length < 1 || assetIds.length > 8) {
      return Response.json({ ok: false, error: 'assetIds 必须 1-8 张' }, { status: 400 });
    }

    // 2) 查主题 + kernel
    const db = getDb();

    if (!db) return NextResponse.json({ ok: false, code: 'NO_SQLITE', error: 'Vercel 部署版不支持此操作，请用浏览器 IndexedDB' });
    const topic = db.select().from(topics).where(eq(topics.id, topicId)).get();
    if (!topic) {
      return Response.json({ ok: false, error: '主题不存在' }, { status: 404 });
    }
    const kernel = db.select().from(topicKernels).where(eq(topicKernels.topicId, topicId)).get();

    // 3) 查支撑卡
    const cardRows = db.select().from(assets).where(inArray(assets.id, assetIds)).all();
    if (cardRows.length !== assetIds.length) {
      return Response.json({ ok: false, error: '部分 assetId 不存在' }, { status: 400 });
    }
    const cardInputs: ScaffoldCardInput[] = cardRows.map(c => ({
      id: c.id,
      title: c.title,
      oneSentenceInsight: c.oneSentenceInsight,
      antiCommonSense: c.antiCommonSense,
      evidenceLevel: c.evidenceLevel,
    }));

    // 4) 调 LLM（如果配了） / fallback 模板
    let scaffold: ScaffoldOutput;
    let model = 'manual';

    if (isLLMConfigured()) {
      const userPrompt = buildWritingScaffoldUserPrompt({
        templateType: tmpl,
        topicName: topic.name,
        kernelHeadline: kernel?.headline ?? topic.name,
        kernelSummary: kernel?.summary ?? topic.description ?? '',
        coreBelief,
        cards: cardInputs,
      });
      const activeKernels = getActiveKernelsForInjection();
      const res = await callLLM<ScaffoldOutput>(WRITING_SCAFFOLD_SYSTEM, userPrompt, {
        jsonMode: true,
        temperature: 0.5,
        maxTokens: 1800,
        kernel: activeKernels.slice(0, 3),
      });
      if (!res.ok || !res.data) {
        return Response.json({
          ok: false,
          error: `LLM 生成失败：${res.error ?? '未知错误'}`,
        }, { status: 500 });
      }
      scaffold = res.data;
      model = res.model ?? 'llm';
    } else {
      // fallback 模板：未配 LLM 用 LLM 不在时的简化骨架
      scaffold = {
        title: `${topic.name}：${coreBelief.slice(0, 12)}`,
        openingHook: `关于「${topic.name}」，我最近在想一件事：${coreBelief}`,
        sections: cardInputs.slice(0, 4).map((c, i) => ({
          heading: c.title,
          keyPoints: c.oneSentenceInsight ? [c.oneSentenceInsight] : [c.title],
          refAssetIds: [c.id],
          contentHint: c.antiCommonSense ?? '展开论证',
        })),
        closingAction: '在 ⚙ 设置里配 LLM Key，可以获得更深入的骨架。',
      };
    }

    // 5) 校验 LLM 输出
    if (!scaffold.title || scaffold.title.length > 60) {
      scaffold.title = (scaffold.title || '').slice(0, 30) || topic.name;
    }
    if (!Array.isArray(scaffold.sections) || scaffold.sections.length === 0) {
      return Response.json({ ok: false, error: 'LLM 骨架 sections 为空' }, { status: 500 });
    }
    scaffold.sections = scaffold.sections.slice(0, 6).map(s => ({
      heading: (s.heading || '未命名段落').slice(0, 40),
      keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints.slice(0, 3).map(k => (k || '').slice(0, 200)) : [],
      refAssetIds: Array.isArray(s.refAssetIds) ? s.refAssetIds.filter(Boolean) : [],
      contentHint: (s.contentHint || '').slice(0, 200),
    }));

    // 6) 落库：创建一条 outputs（type=writing, writingStatus=scaffold）
    const writingId = `writing_${randomUUID()}`;
    const now = Math.floor(Date.now() / 1000);
    db.insert(outputs).values({
      id: writingId,
      assetIdsJson: JSON.stringify(assetIds),
      outputType: 'writing',
      title: scaffold.title,
      content: '',  // 写作正文先空，写时再保存
      audience: templateType,
      status: 'draft',
      scaffoldJson: JSON.stringify(scaffold),
      templateType: TEMPLATE_LABEL[tmpl],
      topicId,
      writingStatus: 'scaffold',
      createdAt: now,
      updatedAt: now,
    }).run();

    return Response.json({
      ok: true,
      writingId,
      scaffold,
      templateType: TEMPLATE_LABEL[tmpl],
      topicName: topic.name,
      kernelHeadline: kernel?.headline ?? null,
      generationModel: model,
    });
  } catch (e: any) {
    console.error('[writing/scaffold]', e);
    return Response.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
