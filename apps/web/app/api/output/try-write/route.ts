/**
 * POST /api/output/try-write
 *
 * 试写屏：用某个 preset 真生成一篇（不依赖资产卡）
 *
 * Request: { content: string, outputType, audience, presetName }
 * Response: { ok, data: CompositeOutputOutput, qualityChecks }
 *
 * 流程：
 *   1. 读指定 preset（不用 active）
 *   2. 构造"伪资产卡"（用用户粘贴的 content 当 oneSentenceInsight）
 *   3. 调 LLM（用 multi prompt 同一份 + preset 5 维度 + few-shot）
 *   4. 跑 AI 味自检 + 数据真实性扫描
 *   5. 返回结果（不存 outputs 表，试写是临时预览）
 */

import { getActiveKernelsForInjection } from '@insight-os/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  callLLM,
  COMPOSITE_OUTPUT_SYSTEM,
  buildCompositeOutputUserPrompt,
  serializeDimensions,
  type CompositeOutputInput,
  type CompositeOutputOutput,
  aiTasteCheck,
  scanNumbers,
  summarizeNumberChecks,
} from '@insight-os/llm';
import { isLLMConfigured, readPreset, type WritingConfig } from '@insight-os/core';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json({
        ok: false,
        error: 'LLM 未配置，请先在 /settings 配置 API Key',
        code: 'LLM_NOT_CONFIGURED',
      }, { status: 400 });
    }

    const body = await req.json();
    const { content, outputType, audience, presetName } = body;

    if (!content || content.trim().length < 50) {
      return NextResponse.json({
        ok: false,
        error: 'content 至少 50 字',
      }, { status: 400 });
    }

    if (!outputType || !['article_full', 'speech', 'book_note', 'email', 'article_outline', 'talk_script'].includes(outputType)) {
      return NextResponse.json({ ok: false, error: '不支持的 outputType' }, { status: 400 });
    }

    // 1. 读 preset
    const config: WritingConfig | null = presetName
      ? readPreset(presetName)
      : null;
    if (presetName && !config) {
      return NextResponse.json({ ok: false, error: `preset 不存在: ${presetName}` }, { status: 404 });
    }

    // 2. 构造"伪资产卡"：用 content 当 oneSentenceInsight
    const fakeAsset = {
      id: 'try_write_pseudo',
      title: '用户粘贴内容',
      oneSentenceInsight: content.slice(0, 300),
      antiCommonSense: '',
    };

    // 3. 构造 LLM 输入
    const llmInput: CompositeOutputInput = {
      assetSummaries: [fakeAsset],
      outputType: outputType as any,
      audience: audience || '读者',
    };

    const userPrompt = buildCompositeOutputUserPrompt(llmInput);
    const dims = config?.dimensions;
    const dimensionsBlock = dims ? serializeDimensions(dims) : '';
    const userPromptWithDims = dimensionsBlock
      ? `${userPrompt}\n\n---\n\n# 用户定制的 5 维度配置（来自 preset: ${presetName ?? 'default'}）\n\n${dimensionsBlock}`
      : userPrompt;

    // 4. 调 LLM
    const isFullArticle = outputType === 'article_full';
    const isSpeech = outputType === 'speech';
    const defaultMaxTokens = isSpeech ? 6000 : isFullArticle ? 5000 : 3500;
    const defaultTemp = isSpeech ? 0.7 : isFullArticle ? 0.75 : 0.7;

    const kernel = getActiveKernelsForInjection();
    const result = await callLLM<CompositeOutputOutput>(
      COMPOSITE_OUTPUT_SYSTEM,
      userPromptWithDims,
      {
        temperature: config?.llmParams?.temperature ?? defaultTemp,
        topP: config?.llmParams?.topP,
        maxTokens: defaultMaxTokens,
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

    // 5. 质量检查
    const aiTaste = await aiTasteCheck({
      content: result.data.primary_version,
      outputType,
      bannedWords: config?.dimensions?.quality?.bannedWords,
    });

    const numberChecks = scanNumbers(result.data.primary_version);
    const dataFidelity = summarizeNumberChecks(numberChecks);

    return NextResponse.json({
      ok: true,
      data: { ...result.data, assetReferences: result.data.assetReferences || [] },
      qualityChecks: {
        aiTasteCheck: aiTaste.ok ? { ok: true, data: aiTaste.data } : { ok: false, error: aiTaste.error },
        dataFidelity,
      },
      usage: result.usage,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}