/**
 * POST /api/kernel/infer-from-assets
 *
 * V1.6: 从高频被引用的资产一键提炼 Kernel
 *
 * 流程：
 * 1. 查最常被引用的前 N 个资产（按 output 引用频次）
 * 2. 调 LLM 总结出 1 条 Kernel 候选（kind=experience）
 * 3. 返回候选给用户确认（不直接写入 db）
 *
 * 用户路径：
 * 1. /kernel 列表页 → "✨ 从高频资产提炼 Kernel" 按钮
 * 2. 调这个 API → 返回 { content, counterExample, scope, evidenceAssetIds, confidence }
 * 3. 用户在 modal 看 + 改 → "保存为 Kernel" → 调 /api/kernel POST
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, outputs } from '@insight-os/db';
import { sql, like, inArray } from 'drizzle-orm';
import { callLLM } from '@insight-os/llm';
import { isLLMConfigured } from '@insight-os/core';

export const dynamic = 'force-dynamic';

const TOP_N = 5; // 取最常被引用的前 5 张资产

const SYSTEM_PROMPT = `你是一位资深的咨询顾问 / 知识工作者方法论提炼专家。

任务：基于用户给定的 5 张"被高频引用的资产"标题，**提炼出 1 条普适的判断**——这条判断可以指导 AI 在所有场景下都按这个方向工作。

要求：
- 必须是 1 句话（30-80 字），不空话、不夸大
- 必须是用户的方法论（"我信奉的做事原则"），不是事实陈述
- 必须有"什么时候不适用"的反例
- 必须有具体 scope（"AI 提问 · 写 prompt · 内容创作"等）

输出 JSON 格式：
{
  "content": "一句话方法论判断",
  "counterExample": "什么时候不适用",
  "scope": "适用场景",
  "confidence": 0-100,
  "reasoning": "为什么这 5 张资产能提炼出这条判断（2-3 句）"
}`;

interface AssetWithCount {
  id: string;
  title: string;
  oneSentenceInsight: string | null;
  refCount: number;
  evidenceLevel: string;
}

export async function POST(_req: NextRequest) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json(
        { ok: false, error: '请先在「设置」配置 LLM key' },
        { status: 400 }
      );
    }

    const db = getDb();


    if (!db) return NextResponse.json({ ok: false, code: 'NO_SQLITE', error: 'Vercel 部署版不支持此操作，请用浏览器 IndexedDB' });

    // 1) 找最常被引用的资产：扫 outputs.assetIdsJson，LIKE 算频次
    // 简化方案：先拿所有 outputs 解析算频次，再 join assets
    const allOutputs = db
      .select({ assetIdsJson: outputs.assetIdsJson })
      .from(outputs)
      .all();

    const refCount = new Map<string, number>();
    for (const o of allOutputs) {
      try {
        const ids = JSON.parse(o.assetIdsJson ?? '[]') as string[];
        for (const aid of ids) {
          refCount.set(aid, (refCount.get(aid) ?? 0) + 1);
        }
      } catch {
        /* noop */
      }
    }

    // 排序拿 top N
    const topIds = Array.from(refCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([id]) => id);

    if (topIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: '没有足够被引用的资产（需要至少 1 张资产被引用过）' },
        { status: 400 }
      );
    }

    // 2) 拿 top 资产的标题 + 一句话洞察
    const topAssets = db
      .select({
        id: assets.id,
        title: assets.title,
        oneSentenceInsight: assets.oneSentenceInsight,
        evidenceLevel: assets.evidenceLevel,
      })
      .from(assets)
      .where(inArray(assets.id, topIds))
      .all();

    // 按 refCount 顺序排序
    const sortedAssets: AssetWithCount[] = topIds
      .map((id) => {
        const a = topAssets.find((x) => x.id === id);
        return a
          ? { ...a, refCount: refCount.get(id) ?? 0 }
          : null;
      })
      .filter((x): x is AssetWithCount => x !== null);

    // 3) 调 LLM 提炼
    const assetListText = sortedAssets
      .map((a, i) => `${i + 1}. [${a.evidenceLevel}] ${a.title}（被引用 ${a.refCount} 次）${a.oneSentenceInsight ? `\n   ${a.oneSentenceInsight}` : ''}`)
      .join('\n');

    const userPrompt = `基于以下 5 张被高频引用的资产，请提炼 1 条普适的方法论判断：\n\n${assetListText}`;

    const llmResult = await callLLM<{
      content: string;
      counterExample: string;
      scope: string;
      confidence: number;
      reasoning: string;
    }>(SYSTEM_PROMPT, userPrompt, {
      temperature: 0.4,
      jsonMode: true,
    });

    if (!llmResult.ok || !llmResult.data) {
      return NextResponse.json(
        { ok: false, error: llmResult.error ?? 'LLM 调用失败', raw: llmResult.raw },
        { status: 500 }
      );
    }

    const candidate = llmResult.data;

    return NextResponse.json({
      ok: true,
      candidate: {
        category: 'belief',
        kind: 'experience',
        content: candidate.content,
        counterExample: candidate.counterExample,
        scope: candidate.scope,
        confidence: candidate.confidence ?? 75,
        evidenceAssetIds: sortedAssets.map((a) => a.id),
        reasoning: candidate.reasoning,
        sourceLabel: '从高频资产提炼',
      },
      sourceAssets: sortedAssets,
      model: llmResult.model,
      usage: llmResult.usage,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
