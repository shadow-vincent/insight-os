/**
 * v1.7 主题战役：根据主题 + 选中的卡片，LLM 生成系列文章大纲
 *
 * POST /api/topic-articles/generate
 * body: { topicId: string, assetIds: string[], count: number (1-5) }
 * returns: { ok: true, articles: [{title, outline, draft, citedAssetIds}] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, assetTopics, topics, topicKernels } from '@insight-os/db';
import { eq, inArray } from 'drizzle-orm';
import { callLLM } from '@insight-os/llm';
import { isLLMConfigured, readConfig, type ArticleLength } from '@insight-os/core';

export const dynamic = 'force-dynamic';

interface ArticleOut {
  index: number;
  title: string;
  outline: string[];
  draft: string;
  citedAssetIds: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topicId, assetIds, count, length: lengthOverride } = body as {
      topicId: string;
      assetIds: string[];
      count: number;
      length?: ArticleLength;  // 临时覆盖（单次任务用）
    };

    // v1.7: 温度 / 篇幅长度从 config 读（用户已在 settings 配），body 可临时覆盖
    const cfg = readConfig();
    const length: ArticleLength = lengthOverride ?? cfg.preferences?.articleLength ?? 'deep';
    const temperature = cfg.preferences?.llmTemperature ?? 0.5;

    const LENGTH_TO_MAX: Record<ArticleLength, number> = {
      short: 1500,
      medium: 3000,
      deep: 6000,
      ultra: 8000,
    };
    const maxTokens = LENGTH_TO_MAX[length] ?? 6000;

    // 1. 参数校验
    if (!topicId || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'topicId 与 assetIds 必填' },
        { status: 400 }
      );
    }
    if (length && !['short', 'medium', 'deep', 'ultra'].includes(length)) {
      return NextResponse.json(
        { ok: false, error: `length 必须是 short/medium/deep/ultra 之一，收到了 "${length}"` },
        { status: 400 }
      );
    }
    void length; // 后续 prompt 用到
    const n = Math.max(1, Math.min(5, Number(count) || 1));
    if (assetIds.length < n) {
      return NextResponse.json(
        { ok: false, error: `至少选 ${n} 张卡片才能生成 ${n} 篇文章（你选了 ${assetIds.length} 张）` },
        { status: 400 }
      );
    }

    // 2. 查主题
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });
    const topic = db.select().from(topics).where(eq(topics.id, topicId)).get();
    if (!topic) {
      return NextResponse.json({ ok: false, error: '主题不存在' }, { status: 404 });
    }

    // 3. 查资产
    const assetRows = db
      .select()
      .from(assets)
      .where(inArray(assets.id, assetIds))
      .all();
    if (assetRows.length === 0) {
      return NextResponse.json({ ok: false, error: '资产不存在' }, { status: 404 });
    }

    // 4. 查主题级 kernel（topic_kernels 表：每个主题 1 条）
    const topicKernel = db
      .select()
      .from(topicKernels)
      .where(eq(topicKernels.topicId, topicId))
      .get();

    // 5. 组装 LLM prompt
    const assetsBlock = assetRows
      .map(
        (a, i) =>
          `[卡片 ${i + 1}] ID=${a.id}\n` +
          `         标题: ${a.title}\n` +
          `         证据: ${a.evidenceLevel}\n` +
          `         观点: ${a.oneSentenceInsight || '—'}\n` +
          `         反直觉: ${a.antiCommonSense || '—'}`
      )
      .join('\n\n');

    const assetIdList = assetRows.map((a) => a.id).join(', ');

    const kernelBlock = topicKernel
      ? `主题内核：${topicKernel.headline}\n${topicKernel.summary}\n核心信念：\n` +
        (JSON.parse(topicKernel.coreBeliefsJson || '[]') as string[])
          .slice(0, 3)
          .map((b) => '· ' + b)
          .join('\n')
      : '';

    const systemPrompt = `你是「Insight Asset OS」的写作助手，专门帮用户基于已有卡片生成系列文章大纲。

主题战役定义：用户围绕一个主题（如「AI 时代的判断力」），基于已有卡片，生成 N 篇有节奏的系列文章。

核心规则：
1. 每篇文章必须有明确的观点（不是泛泛介绍）
2. 每篇文章引用 1-2 张卡片（citedAssetIds 用资产 ID，不是数字）
3. N 篇文章之间要有递进或对比关系（不是同质重复）
4. 大纲要 4-6 段，每段一句话
5. 草稿要**充分展开**：开头用具体场景引入（不是抽象观点），中间给 2-3 个具体例子或反例，结尾给出可执行建议
6. 标题要具体、有判断（不要"如何 XXX"这种平庸标题）
7. 篇幅：${
      length === 'short' ? '短文（约 800-1200 字），只讲最核心的观点' :
      length === 'medium' ? '中等篇幅（约 1500-2000 字），给 1-2 个具体例子' :
      length === 'deep' ? '深度长文（约 2500-3500 字），充分展开论述' :
      length === 'ultra' ? '超深度（约 4000+ 字），像公众号爆款深度文，从多个角度充分展开' :
      '深度长文（约 2500-3500 字）'
    }

输出严格 JSON：
{
  "articles": [
    {
      "index": 1,
      "title": "...",
      "outline": ["段1", "段2", "段3", "段4"],
      "draft": "...",
      "citedAssetIds": ["asset_xxx", "asset_yyy"]
    }
  ]
}`;

    const userPrompt = `主题：${topic.name}
${topic.description ? `主题描述：${topic.description}\n` : ''}${topic.coreBeliefs ? `核心信念：\n${(topic.coreBeliefs as string[]).slice(0, 3).map((b) => '· ' + b).join('\n')}\n` : ''}
${kernelBlock ? `相关内核：\n${kernelBlock}\n` : ''}
已选卡片（${assetRows.length} 张）：
${assetsBlock}

请生成 ${n} 篇${n === 1 ? '**深度长文**（一篇即可，篇幅像公众号深度文，把所选卡片的核心观点充分展开论述，给出具体场景、案例与行动建议）' : n > 1 ? '文章（每篇要有自己的切入点，文章之间有递进或对比）' : '文章'}。

每篇 citedAssetIds 必须是上面已选卡片中的真实 ID（候选 ID 列表：${assetIdList}）。`;

    // 6. 调 LLM（callLLM 自动从 config.json 读 base/model/apiKey）
    if (!isLLMConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'LLM 未配置（先去 /docs/llm-setup 配置 key）' },
        { status: 400 }
      );
    }
    const result = await callLLM<{ articles: ArticleOut[] }>(
      systemPrompt,
      userPrompt,
      {
        jsonMode: true,
        maxTokens,
        temperature,
      }
    );

    if (!result.ok || !result.data) {
      return NextResponse.json(
        { ok: false, error: result.error || 'LLM 调用失败' },
        { status: 502 }
      );
    }

    // 7. 校验 LLM 返回的 citedAssetIds 都是真实选中的
    const validIds = new Set(assetIds);
    const articles = (result.data.articles || []).map((a, i) => ({
      index: a.index ?? i + 1,
      title: a.title ?? `第 ${i + 1} 篇`,
      outline: Array.isArray(a.outline) ? a.outline : [],
      draft: a.draft ?? '',
      citedAssetIds: (a.citedAssetIds || []).filter((id) => validIds.has(id)),
    }));

    return NextResponse.json({
      ok: true,
      topic: { id: topic.id, name: topic.name, description: topic.description },
      articleCount: articles.length,
      articles,
    });
  } catch (err) {
    console.error('[topic-articles/generate] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}