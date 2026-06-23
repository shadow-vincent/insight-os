/**
 * POST /api/output/generate
 *
 * 输入: { assetId, outputType, audience, context, styleHints }
 * 输出: { ok, outputId, content, ... }
 *
 * 流程：
 * 1. 读资产卡 → 准备 prompt ④ 的输入
 * 2. 调 LLM（用 prompt ④）
 * 3. 保存到 outputs 表
 * 4. 更新资产的 last_used_at + feedback_count
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, outputs, getActiveKernelsForInjection } from '@insight-os/db';
import { eq } from 'drizzle-orm';
import { callLLM, buildOutputGenerateUserPrompt, OUTPUT_GENERATE_SYSTEM, type OutputGenerateInput, type OutputGenerateOutput, type OutputType } from '@insight-os/llm';
import { isLLMConfigured, readConfig } from '@insight-os/core';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export async function POST(req: NextRequest) {
  try {
    // 检查 LLM 是否配置
    if (!isLLMConfigured()) {
      return NextResponse.json({
        ok: false,
        error: 'LLM 未配置，请先在 /settings 配置 API Key',
        code: 'LLM_NOT_CONFIGURED',
      }, { status: 400 });
    }

    const body = await req.json();
    const { assetId, outputType, audience, context, styleHints } = body;

    if (!assetId || !outputType || !audience) {
      return NextResponse.json({
        ok: false,
        error: '缺少必要参数：assetId / outputType / audience',
      }, { status: 400 });
    }

    if (!['talk_script', 'article_outline'].includes(outputType)) {
      return NextResponse.json({
        ok: false,
        error: `不支持的输出类型: ${outputType}（v0.1 只支持 talk_script / article_outline）`,
      }, { status: 400 });
    }

    // 读资产卡
    const db = getDb();
    const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!asset) {
      return NextResponse.json({ ok: false, error: '资产不存在' }, { status: 404 });
    }

    // 读 .md 文件获取更多上下文（场景输出章节）
    let sceneOutputs: string | undefined;
    try {
      const content = readFileSync(asset.filePath, 'utf-8');
      const sceneMatch = content.match(/##\s*(?:场景输出|第三层|第三层：场景输出卡)[\s\S]*?(?=---|^##\s*[^#])/m);
      if (sceneMatch) {
        sceneOutputs = sceneMatch[0].slice(0, 800); // 截断避免 prompt 过长
      }
    } catch {
      // 文件读不到不影响
    }

    // 准备 prompt ④ 的输入
    const llmInput: OutputGenerateInput = {
      assetSummaries: [{
        title: asset.title,
        oneSentenceInsight: asset.oneSentenceInsight ?? '',
        antiCommonSense: asset.antiCommonSense ?? '',
        ...(sceneOutputs ? { sceneOutputs } : {}),
      }],
      outputType: outputType as OutputType,
      audience,
      ...(context ? { context } : {}),
      ...(styleHints ? { styleHints } : {}),
    };

    // 调 LLM
    const userPrompt = buildOutputGenerateUserPrompt(llmInput);
    const kernel = getActiveKernelsForInjection();
    const result = await callLLM<OutputGenerateOutput>(
      OUTPUT_GENERATE_SYSTEM,
      userPrompt,
      { temperature: 0.7, maxTokens: 2000 ,
      kernel,}
    );

    if (!result.ok || !result.data) {
      return NextResponse.json({
        ok: false,
        error: result.error || 'LLM 响应解析失败',
        code: 'LLM_CALL_FAILED',
        raw: result.raw,
      }, { status: 500 });
    }

    // 保存到 outputs 表
    const now = Math.floor(Date.now() / 1000);
    const outputId = `out_${randomUUID().slice(0, 8)}`;

    // 构造完整内容（主版本 + 变体）
    const fullContent = JSON.stringify({
      title: result.data.title,
      primary_version: result.data.primary_version,
      variants: result.data.variants,
      key_quotes: result.data.key_quotes,
      usage_suggestion: result.data.usage_suggestion,
    }, null, 2);

    db.insert(outputs)
      .values({
        id: outputId,
        assetIdsJson: JSON.stringify([assetId]),
        outputType: outputType as 'talk_script' | 'article_outline',
        title: result.data.title,
        content: fullContent,
        audience,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // 更新资产卡的 last_used_at + feedback_count（feedback_count 不增，统计用）
    db.update(assets)
      .set({
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(assets.id, assetId))
      .run();

    return NextResponse.json({
      ok: true,
      outputId,
      data: result.data,
      usage: result.usage,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
