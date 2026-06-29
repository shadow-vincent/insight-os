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
import { getDb, assets, outputs, getActiveKernelsForInjection } from '@insight-os/db';
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
    const { assetIds, outputType, audience, context, styleHints, variants } = body;
    // variants: 1-5 批量生成（默认 1，>1 时返回 N 个完整版让用户选）

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

    if (!['talk_script', 'article_outline', 'article_full', 'speech', 'book_note', 'email'].includes(outputType)) {
      return NextResponse.json({
        ok: false,
        error: `不支持的输出类型: ${outputType}（支持：talk_script / article_outline / article_full / speech / book_note / email）`,
      }, { status: 400 });
    }

    // 读 N 张资产卡
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });
    type AssetRow = typeof assets.$inferSelect;
    const found = db.select().from(assets).where(inArray(assets.id, assetIds)).all() as AssetRow[];
    if (found.length !== assetIds.length) {
      const foundIds = new Set(found.map((a: AssetRow) => a.id));
      const missing = assetIds.filter(id => !foundIds.has(id));
      return NextResponse.json({
        ok: false,
        error: `部分资产不存在: ${missing.join(', ')}`,
      }, { status: 404 });
    }

    // 保持请求顺序
    const assetMap = new Map(found.map((a: AssetRow) => [a.id, a]));
    const ordered: AssetRow[] = assetIds.map(id => assetMap.get(id)!);

    // 准备 Prompt ⑤ 的输入（含场景输出片段）
    const llmInput: CompositeOutputInput = {
      assetSummaries: ordered.map((a: AssetRow) => {
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

    // 调 LLM（多卡 prompt 较长，article_full 需要更大 maxTokens 容纳 1500-2500 字文章 + JSON 包装）
    const userPrompt = buildCompositeOutputUserPrompt(llmInput);

    // V1.1+ 阶段 A: 注入 5 维度配置（L3 YAML 读取）
    let dimensionsBlock = '';
    let activeConfig: import('@insight-os/core').WritingConfig | null = null;
    try {
      const { getActivePreset } = await import('@insight-os/core');
      const { serializeDimensions } = await import('@insight-os/llm');
      activeConfig = getActivePreset();
      dimensionsBlock = serializeDimensions(activeConfig.dimensions);
    } catch (e: any) {
      console.warn('[output/multi] Failed to load writing config, using default prompt:', e.message);
    }

    // 把 5 维度配置追加到 user prompt 末尾
    const userPromptWithDims = dimensionsBlock
      ? `${userPrompt}\n\n---\n\n# 用户定制的 5 维度配置（来自 active preset: ${activeConfig?.name ?? 'unknown'}）\n\n${dimensionsBlock}`
      : userPrompt;

    const isFullArticle = outputType === 'article_full';
    const isSpeech = outputType === 'speech';
    const isBookNote = outputType === 'book_note';
    const isEmail = outputType === 'email';

    // V1.2: 注入 few-shot（如果 preset 有 fewShotRefs）
    let fewShotBlock = '';
    if (activeConfig?.dimensions?.quality?.fewShotRefs?.length) {
      try {
        const { buildFewShotBlock } = await import('@insight-os/llm');
        const { getDb, outputs } = await import('@insight-os/db');
        const db2 = getDb();
        const block = await buildFewShotBlock(
          activeConfig.dimensions.quality.fewShotRefs,
          {
            readOutput: async (id: string) => {
              const { eq } = await import('drizzle-orm');
              const rows = await db2.select().from(outputs).where(eq(outputs.id, id)).limit(1);
              const r = rows[0];
              if (!r) return null;
              return { title: r.title, content: r.content, outputType: r.outputType };
            },
          }
        );
        fewShotBlock = block.formattedBlock;
      } catch (e: any) {
        console.warn('[output/multi] Few-shot injection failed:', e.message);
      }
    }

    // 把 few-shot 块加到 user prompt（如果 active preset 启用了）
    const userPromptWithFewShot = fewShotBlock
      ? `${userPromptWithDims}\n\n---\n\n${fewShotBlock}`
      : userPromptWithDims;

    // 用 active preset 的 temperature / topP（如果设了）
    const presetTemp = activeConfig?.llmParams?.temperature;
    const presetTopP = activeConfig?.llmParams?.topP;
    // 各类型 maxTokens: speech 需要 6000（3000-5000 字口语化稿），article_full 5000，其他 3500
    const defaultMaxTokens = isSpeech ? 6000 : isFullArticle ? 5000 : 3500;
    const defaultTemp = isSpeech ? 0.7 : isFullArticle ? 0.75 : 0.7;

    // V1.2: variants 批量生成（>1 时并行生成 N 个完整版）
    const variantCount = Math.min(Math.max(parseInt(String(variants ?? 1)) || 1, 1), 3);  // 限制 1-3
    if (variantCount === 1) {
      // 单个版本（保持原行为）
      const kernel = getActiveKernelsForInjection();
      const result = await callLLM<CompositeOutputOutput>(
        COMPOSITE_OUTPUT_SYSTEM,
        userPromptWithFewShot,
        {
          temperature: presetTemp ?? defaultTemp,
          topP: presetTopP,
          maxTokens: defaultMaxTokens,
          kernel,
        }
      );
      var llmResult = result;  // 单个转成数组
    } else {
      // 批量生成：并行 N 次，temperature 略抖动产生变体
      const promises = Array.from({ length: variantCount }, (_, i) => {
        // 第 N 个版本微调 temperature ±0.1 产生差异
        const tempOffset = (i - Math.floor(variantCount / 2)) * 0.1;
        return callLLM<CompositeOutputOutput>(
          COMPOSITE_OUTPUT_SYSTEM,
          userPromptWithFewShot,
          {
            temperature: Math.max(0.2, Math.min(1.0, (presetTemp ?? defaultTemp) + tempOffset)),
            topP: presetTopP,
            maxTokens: defaultMaxTokens,
          }
        );
      });
      const results = await Promise.all(promises);
      // 找第一个成功的
      const firstOk = results.find(r => r.ok);
      if (!firstOk || !firstOk.data) {
        return NextResponse.json({
          ok: false,
          error: firstOk?.error || '所有变体生成失败',
          code: 'LLM_CALL_FAILED',
        }, { status: 500 });
      }
      var llmResult = firstOk;
    }

    if (!llmResult.ok || !llmResult.data) {
      // 调试：把 raw 输出最后 1000 字符到 log
      const rawTail = llmResult.raw ? llmResult.raw.slice(-1000) : '(empty)';
      console.error('[output/multi] LLM raw output (parse failed):', rawTail);
      return NextResponse.json({
        ok: false,
        error: llmResult.error || 'LLM 响应解析失败',
        code: 'LLM_CALL_FAILED',
        raw: llmResult.raw,
      }, { status: 500 });
    }

    // 保存到 outputs 表
    const now = Math.floor(Date.now() / 1000);
    const outputId = `out_${randomUUID().slice(0, 8)}`;

    // 校验 assetReferences 完整性（LLM 漏掉的补空）
    const refMap = new Map((llmResult.data.assetReferences || []).map((r: any) => [r.assetId, r]));
    const assetReferences = ordered.map((a: AssetRow) => {
      const ref = refMap.get(a.id);
      return {
        assetId: a.id,
        assetTitle: ref?.assetTitle || a.title,
        referencedIn: ref?.referencedIn || [],
        coreInsightUsed: ref?.coreInsightUsed ?? true,
      };
    });

    const fullContent = JSON.stringify({
      title: llmResult.data.title,
      primary_version: llmResult.data.primary_version,
      variants: llmResult.data.variants,
      key_quotes: llmResult.data.key_quotes,
      usage_suggestion: llmResult.data.usage_suggestion,
      structure_rationale: llmResult.data.structure_rationale,
      assetReferences,
      isMulti: true,
    }, null, 2);

    db.insert(outputs)
      .values({
        id: outputId,
        assetIdsJson: JSON.stringify(assetIds),
        outputType: outputType as 'talk_script' | 'article_outline' | 'article_full' | 'speech' | 'book_note' | 'email',
        title: llmResult.data.title,
        content: fullContent,
        audience,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      } as any)  // drizzle 0.36.4 .values() 类型签名 bug
      .run();

    // 更新每张卡的 lastUsedAt（同步触发反馈计数由下次反馈时增加）
    for (const id of assetIds) {
      db.update(assets)
        .set({ lastUsedAt: now, updatedAt: now })
        .where(eq(assets.id, id))
        .run();
    }

    // V1.2: 生成后质量检查（AI 味自检 + 数据真实性扫描）
    let qualityChecks: Awaited<ReturnType<typeof runPostGenerationChecks>> | null = null;
    try {
      qualityChecks = await runPostGenerationChecks(llmResult.data.primary_version, {
        outputType,
        bannedWords: activeConfig?.dimensions?.quality?.bannedWords,
        activeConfig,
      });
    } catch (e: any) {
      console.warn('[output/multi] quality checks failed:', e.message);
    }

    // 如果 AI 味自检失败（score < 70 且有重试预算），重生成 1 次
    // V1.2: 先 mark 留 TODO，下次版本实现

    return NextResponse.json({
      ok: true,
      outputId,
      data: { ...llmResult.data, assetReferences },
      assetCount: assetIds.length,
      usage: llmResult.usage,
      qualityChecks,  // V1.2 新增
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ============================================
// 辅助：生成后质量检查（独立 export 供其他 route 用）
// ============================================

/**
 * 对生成的文章做 AI 味自检 + 数据真实性扫描
 * 返回检查结果（不修改文章）
 */
export async function runPostGenerationChecks(
  content: string,
  options: {
    outputType: string;
    bannedWords?: string[];
    activeConfig?: import('@insight-os/core').WritingConfig | null;
  }
): Promise<{
  aiTasteCheck?: { ok: boolean; data?: any; error?: string };
  dataFidelity?: { total: number; cited: number; uncited: number; issues: string[] };
}> {
  const result: any = {};
  const activeConfig = options.activeConfig;

  // 1. AI 味自检（如果 preset 启用了）
  if (activeConfig?.dimensions?.quality?.aiTasteCheck !== false) {
    try {
      const { aiTasteCheck } = await import('@insight-os/llm');
      result.aiTasteCheck = await aiTasteCheck({
        content,
        outputType: options.outputType,
        bannedWords: options.bannedWords,
      });
    } catch (e: any) {
      result.aiTasteCheck = { ok: false, error: e.message };
    }
  }

  // 2. 数据真实性扫描
  try {
    const { scanNumbers, summarizeNumberChecks } = await import('@insight-os/llm');
    const checks = scanNumbers(content);
    result.dataFidelity = summarizeNumberChecks(checks);
  } catch (e: any) {
    console.warn('[runPostGenerationChecks] data fidelity failed:', e.message);
  }

  return result;
}
