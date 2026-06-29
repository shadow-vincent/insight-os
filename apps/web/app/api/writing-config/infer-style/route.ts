/**
 * POST /api/writing-config/infer-style
 * 从 1-5 篇文章样本反推写作风格 5 维度配置
 *
 * Request body:
 *   {
 *     sources: Array<
 *       | { type: 'paste'; text: string; title?: string }
 *       | { type: 'asset'; id: string }   // 资产 id，从 outputs 表读 article_full
 *     >
 *   }
 *
 * Response: {
 *   ok,
 *   summary: string,              // 200 字风格总结
 *   suggestedName: string,        // 建议预设名
 *   confidence: 'low' | 'medium' | 'high',
 *   config: WritingConfig         // 完整 5 维度配置草稿（不写盘）
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractStyle } from '@insight-os/llm';
import type { WritingConfig } from '@insight-os/core';

export const dynamic = 'force-dynamic';

interface PasteSource { type: 'paste'; text: string; title?: string }
interface AssetSource { type: 'asset'; id: string }
type Source = PasteSource | AssetSource;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sources: Source[] = body.sources ?? [];

    if (!Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json({ ok: false, error: 'sources 不能为空' }, { status: 400 });
    }
    if (sources.length > 5) {
      return NextResponse.json({ ok: false, error: '最多 5 个样本' }, { status: 400 });
    }

    // ===== 解析 sources → 统一成 StyleSample =====
    const samples: Array<{ text: string; title?: string }> = [];

    for (const src of sources) {
      if (src.type === 'paste') {
        if (!src.text || src.text.trim().length === 0) {
          return NextResponse.json({ ok: false, error: '粘贴样本不能为空' }, { status: 400 });
        }
        samples.push({ text: src.text, title: src.title });
      } else if (src.type === 'asset') {
        if (!src.id) {
          return NextResponse.json({ ok: false, error: '资产样本缺少 id' }, { status: 400 });
        }
        // 从 outputs 表读 article_full / article_outline
        const article = await loadArticleById(src.id);
        if (!article) {
          return NextResponse.json({
            ok: false,
            error: `资产 ${src.id} 不存在或不是可读的文章类型（需要 article_full / article_outline / writing）`,
          }, { status: 404 });
        }
        samples.push({ text: article.content, title: article.title });
      } else {
        return NextResponse.json({ ok: false, error: '未知的 source type' }, { status: 400 });
      }
    }

    // ===== 调 LLM 反推 =====
    const result = await extractStyle(samples, { temperature: 0.3, maxTokens: 1500 });
    if (!result.ok || !result.data) {
      return NextResponse.json({ ok: false, error: result.error ?? '反推失败' }, { status: 500 });
    }

    const llmResult = result.data;

    // ===== 包装成 WritingConfig 草稿（不写盘，等用户确认）=====
    const config: WritingConfig = {
      name: llmResult.suggestedName || `inferred-${Date.now()}`,
      outputType: 'article_full',  // 默认 article_full
      description: llmResult.summary.slice(0, 80),
      forkedFrom: null,
      updatedAt: Date.now(),
      dimensions: {
        style: llmResult.config.style,
        sentence: llmResult.config.sentence,
        structure: llmResult.config.structure,
        length: { ...llmResult.config.length, variants: 1 },
        quality: { ...llmResult.config.quality, aiTasteCheck: true, fewShotRefs: [] },
      },
      llmParams: {
        model: 'deepseek-chat',
        temperature: llmResult.config.style.temperature,
        topP: 0.9,
      },
    };

    return NextResponse.json({
      ok: true,
      summary: llmResult.summary,
      suggestedName: llmResult.suggestedName,
      confidence: llmResult.confidence,
      config,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ============================================
// Helper: 从 outputs 表读 article
// ============================================

async function loadArticleById(id: string): Promise<{ title: string; content: string } | null> {
  // 动态 import 避免循环依赖（web → db）
  const { getDb } = await import('@insight-os/db');
  const { outputs } = await import('@insight-os/db');
  const { eq } = await import('drizzle-orm');

  const db = getDb();


  if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
  const rows = await db.select().from(outputs).where(eq(outputs.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;

  // 只接受 article 类型
  const validTypes = ['article_full', 'article_outline', 'writing'];
  if (!validTypes.includes(row.outputType)) {
    return null;
  }

  return { title: row.title, content: row.content };
}