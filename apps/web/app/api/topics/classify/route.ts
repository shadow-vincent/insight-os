/**
 * POST /api/topics/classify
 *
 * 输入: { assetId }
 * 流程: 读资产卡 → LLM 推断它属于哪些主题 → 写 asset_topics 表
 *
 * 返回: { ok, topics: [{ id, name, confidence }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, topics, assetTopics, getActiveKernelsForInjection } from '@insight-os/db';
import { eq, inArray } from 'drizzle-orm';
import { callLLM } from '@insight-os/llm';
import { isLLMConfigured } from '@insight-os/core';
import { randomUUID } from 'node:crypto';

export async function POST(req: NextRequest) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json({ ok: false, error: 'LLM 未配置' }, { status: 400 });
    }

    const body = await req.json();
    const { assetId } = body;

    if (!assetId) {
      return NextResponse.json({ ok: false, error: '缺少 assetId' }, { status: 400 });
    }

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });
    const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!asset) {
      return NextResponse.json({ ok: false, error: '资产不存在' }, { status: 404 });
    }

    // 读所有主题
    const allTopics = db.select().from(topics).orderBy(topics.sortOrder).all();
    if (allTopics.length === 0) {
      return NextResponse.json({ ok: false, error: '请先运行 seed-topics 创建主题' }, { status: 400 });
    }

    // 准备 prompt
    const topicList = allTopics.map(t => `- ${t.id}: ${t.name} (${t.description ?? ''})`).join('\n');

    const systemPrompt = `你是 Vincent 的研究助理。Vincent 是一名独立管理咨询顾问。

**你的任务**：根据一张资产卡的标题、一句话洞察、反常识判断，判断它属于哪些主题。

**规则**：
1. **一张卡可以属于多个主题**（最多 3 个）
2. **置信度 (confidence)**：
   - 90-100: 强相关，主题核心问题就是这张卡
   - 60-89: 中等相关，主题里有部分内容覆盖
   - 30-59: 弱相关，可以参考但不是核心
   - 0-29: 不选
3. **宁缺毋滥**：不确定的主题不选
4. **输出严格 JSON 数组**`;

    const userPrompt = `请判断这张资产卡属于哪些主题：

## 资产卡
- 标题: ${asset.title}
- 一句话洞察: ${asset.oneSentenceInsight ?? '(无)'}
- 反常识判断: ${asset.antiCommonSense ?? '(无)'}
- 关键词: ${asset.tagsJson}

## 候选主题
${topicList}

## 输出 JSON
\`\`\`json
[
  { "topic_id": "topic_xxx", "confidence": 85 },
  { "topic_id": "topic_yyy", "confidence": 60 }
]
\`\`\`

只输出 JSON 数组，不要其他文字。`;

    const kernel = getActiveKernelsForInjection();
    const result = await callLLM<Array<{ topic_id: string; confidence: number }>>(
      systemPrompt,
      userPrompt,
      { temperature: 0.2, maxTokens: 500 ,
      kernel,}
    );

    if (!result.ok || !result.data) {
      return NextResponse.json({ ok: false, error: result.error || 'LLM 分类失败', raw: result.raw }, { status: 500 });
    }

    // 容错：LLM 可能返回 {data: [...]} 或直接 [...] 或 {classifications: [...]}
    let classifications: any[] = [];
    if (Array.isArray(result.data)) {
      classifications = result.data;
    } else if (typeof result.data === 'object' && result.data !== null) {
      // 尝试从常见字段里抽
      classifications = (result.data as any).classifications
        ?? (result.data as any).topics
        ?? (result.data as any).results
        ?? [];
    }

    // 校验：topic_id 必须存在，confidence 必须 30-100
    const validTopicIds = new Set(allTopics.map(t => t.id));
    const validClassifications = classifications
      .filter((c: any) => c && typeof c === 'object' && validTopicIds.has(c.topic_id))
      .filter((c: any) => typeof c.confidence === 'number' && c.confidence >= 30)
      .slice(0, 3); // 最多 3 个

    // 删旧关联
    db.delete(assetTopics).where(eq(assetTopics.assetId, assetId)).run();

    // 写新关联
    const now = Math.floor(Date.now() / 1000);
    for (const c of validClassifications) {
      db.insert(assetTopics)
        .values({
          id: `at_${randomUUID().slice(0, 8)}`,
          assetId,
          topicId: c.topic_id,
          confidence: Math.round(c.confidence),
          assignedBy: 'llm',
          createdAt: now,
        })
        .run();
    }

    // 返回友好数据
    type TopicRow = typeof topics.$inferSelect;
    const allTopicsTyped = allTopics as TopicRow[];
    const topicMap = new Map<string, TopicRow>(allTopicsTyped.map(t => [t.id, t]));
    return NextResponse.json({
      ok: true,
      topics: validClassifications.map(c => ({
        id: c.topic_id,
        name: topicMap.get(c.topic_id)?.name ?? c.topic_id,
        confidence: Math.round(c.confidence),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
