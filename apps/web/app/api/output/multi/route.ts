/**
 * POST /api/output/multi
 *
 * 多卡联合输出：一次基于 2-7 张资产卡，组织成结构化输出
 *
 * 输入: { assetIds: string[], outputType, audience, context, styleHints }
 * 输出: { ok, outputId, data: { ..., assetReferences } }
 *
 * 流程：
 * 1. 读 N 张资产卡 → 准备 Prompt ⑤ 的输入
 * 2. 调 LLM（用 Prompt ⑤）
 * 3. 保存到 outputs 表（assetIdsJson = 全部 ID）
 * 4. 更新每张卡的 lastUsedAt
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, outputs } from '@insight-os/db';
import { eq, inArray } from 'drizzle-orm';
import {
  callLLM,
  COMPOSITE_OUTPUT_SYSTEM,
  buildCompositeOutputUserPrompt,
  type OutputType,
  type CompositeOutputInput,
  type CompositeOutputOutput,
} from '@insight-os/llm';
import { isLLMConfigured } from '@insight-os/core';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const MIN_ASSETS = 2;
const MAX_ASSETS = 7;

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
    const { assetIds, outputType, audience, context, styleHints } = body;

    if (!Array.isArray(assetIds) || assetIds.length < MIN_ASSETS) {
      return NextResponse.json({
        ok: false,
        error: `联合输出至少需要 ${MIN_ASSETS} 张资产卡`,
      }, { status: 400 });
    }

    if (assetIds.length > MAX_ASSETS) {
      return NextResponse.json({
        ok: false,
        error: `联合输出最多 ${MAX_ASSETS} 张资产卡（当前 ${assetIds.length}）`,
      }, { status: 400 });
    }

    if (!outputType || !audience) {
      return NextResponse.json({
        ok: false,
        error: '缺少必要参数：outputType / audience',
      }, { status: 400 });
    }

    if (!['talk_script', 'article_outline'].includes(outputType)) {
      return NextResponse.json({
        ok: false,
        error: `不支持的输出类型: ${outputType}`,
      }, { status: 400 });
    }

    // 读 N 张资产卡
    const db = getDb();
    const found = db.select().from(assets).where(inArray(assets.id, assetIds)).all();
    if (found.length !== assetIds.length) {
      const foundIds = new Set(found.map(a => a.id));
      const missing = assetIds.filter(id => !foundIds.has(id));
      return NextResponse.json({
        ok: false,
        error: `部分资产不存在: ${missing.join(', ')}`,
      }, { status: 404 });
    }

    // 保持请求顺序
    const assetMap = new Map(found.map(a => [a.id, a]));
    const ordered = assetIds.map(id => assetMap.get(id)!);

    // 准备 Prompt ⑤ 的输入（含场景输出片段）
    const llmInput: CompositeOutputInput = {
      assetSummaries: ordered.map(a => {
        let sceneOutputs: string | undefined;
        try {
          const content = readFileSync(a.filePath, 'utf-8');
          const sceneMatch = content.match(/##\s*(?:场景输出|第三层|第三层：场景输出卡)[\s\S]*?(?=---|^##\s*[^#])/m);
          if (sceneMatch) sceneOutputs = sceneMatch[0].slice(0, 600);
        } catch { /* 读不到不影响 */ }
        return {
          id: a.id,
          title: a.title,
          oneSentenceInsight: a.oneSentenceInsight ?? '',
          antiCommonSense: a.antiCommonSense ?? '',
          ...(sceneOutputs ? { sceneOutputs } : {}),
        };
      }),
      outputType: outputType as OutputType,
      audience,
      ...(context ? { context } : {}),
      ...(styleHints ? { styleHints } : {}),
    };

    // 调 LLM（多卡 prompt 较长，给更大 maxTokens）
    const userPrompt = buildCompositeOutputUserPrompt(llmInput);
    const result = await callLLM<CompositeOutputOutput>(
      COMPOSITE_OUTPUT_SYSTEM,
      userPrompt,
      { temperature: 0.7, maxTokens: 3500 }
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

    // 校验 assetReferences 完整性（LLM 漏掉的补空）
    const refMap = new Map((result.data.assetReferences || []).map(r => [r.assetId, r]));
    const assetReferences = ordered.map(a => {
      const ref = refMap.get(a.id);
      return {
        assetId: a.id,
        assetTitle: ref?.assetTitle || a.title,
        referencedIn: ref?.referencedIn || [],
        coreInsightUsed: ref?.coreInsightUsed ?? true,
      };
    });

    const fullContent = JSON.stringify({
      title: result.data.title,
      primary_version: result.data.primary_version,
      variants: result.data.variants,
      key_quotes: result.data.key_quotes,
      usage_suggestion: result.data.usage_suggestion,
      structure_rationale: result.data.structure_rationale,
      assetReferences,
      isMulti: true,
    }, null, 2);

    db.insert(outputs)
      .values({
        id: outputId,
        assetIdsJson: JSON.stringify(assetIds),
        outputType: outputType as 'talk_script' | 'article_outline',
        title: result.data.title,
        content: fullContent,
        audience,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // 更新每张卡的 lastUsedAt（同步触发反馈计数由下次反馈时增加）
    for (const id of assetIds) {
      db.update(assets)
        .set({ lastUsedAt: now, updatedAt: now })
        .where(eq(assets.id, id))
        .run();
    }

    return NextResponse.json({
      ok: true,
      outputId,
      data: { ...result.data, assetReferences },
      assetCount: assetIds.length,
      usage: result.usage,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
