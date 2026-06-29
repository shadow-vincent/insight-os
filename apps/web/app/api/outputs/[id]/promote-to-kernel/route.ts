/**
 * POST /api/outputs/[id]/promote-to-kernel
 *
 * v1.8.4 输出后强化机制 · 沉淀为方法论
 *
 * 流程：
 *   1. 拿 output + 引用的 asset
 *   2. LLM 提炼这条 output 用到的"判断方式"（potential kernel）
 *   3. 创建 user_kernels 记录（status=active，confidence=60 默认）
 *   4. 关联 evidence_asset_ids
 *   5. 返回 kernel 详情，让用户去「我的方法论」页确认
 *
 * 类别自动推断（4 类 → V1.8.4 5 类）：
 *   - belief: 长期价值主张
 *   - contrarian: 反常识
 *   - expertise: 擅长领域
 *   - challenge: 想挑战的常识
 *   - principle: 工作原则（新增 V1.8.4）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, outputs, userKernels, getActiveKernelsForInjection } from '@insight-os/db';
import { callLLM } from '@insight-os/llm';
import { isLLMConfigured } from '@insight-os/core';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

const STRENGTHEN_SYSTEM = `你是 Vincent 的研究助理。Vincent 是一名独立管理咨询顾问 + 培训师 + 专业创作者。

**任务**：分析 Vincent 刚生成的一条输出（文章 / 话术 / 课程 / 邮件），提炼这条输出体现的「判断方式」—— 也就是 Vincent 长期持有、能复用的方法论。

**5 类可选**：
- **belief** —— 长期价值主张 / 哲学立场（"我相信 X"）
- **contrarian** —— 反常识判断（"行业都说 X，但实际上是 Y"）
- **expertise** —— 擅长问题域（"我对 X 领域有判断"）
- **challenge** —— 想挑战的常识（"我想消灭 X 套话"）
- **principle** —— 工作原则（"我做事的方式 = X"）（V1.8.4 新增）

**严格 JSON 输出**（不要 markdown）：
{
  "category": "belief|contrarian|expertise|challenge|principle",
  "content": "一句话判断（30-50 字）",
  "scope": "适用场景（如 '客户咨询 · 公众号'）",
  "counter_example": "什么时候不成立（可空）",
  "reasoning": "1 句为什么这是 Vincent 的方法论"
}`;

function buildStrengthenUserPrompt(outputTitle: string, outputContent: string, outputType: string, audience: string | null, assetTitles: string[]): string {
  return `请从以下输出中提炼 Vincent 的方法论：

**输出类型**：${outputType}
**适用对象**：${audience ?? '未指定'}
**标题**：${outputTitle}
**引用的判断资产**：${assetTitles.length > 0 ? assetTitles.map(t => `- ${t}`).join('\n') : '（无）'}

**输出内容**：
"""
${outputContent.slice(0, 2000)}
"""

**任务**：
1. 这条输出用了什么"判断方式"？（不是写的内容本身，是 Vincent 怎么写的）
2. 这是 5 类里的哪一类？
3. 提炼成一句方法论（30-50 字）
4. 适用场景
5. 什么时候不成立

注意：
- 5 类里如果都不太像，**默认 principle**（工作原则）
- content 必须能从这条输出反推（不空泛）
- 不要泛泛说"Vincent 写得很好"——要具体到判断方式`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isLLMConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'LLM 未配置，无法自动提炼方法论' },
        { status: 400 }
      );
    }

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });

    // 1. 拿 output
    const output = db.select().from(outputs).where(eq(outputs.id, id)).get();
    if (!output) {
      return NextResponse.json({ ok: false, error: '输出不存在' }, { status: 404 });
    }

    // 2. 拿引用的资产
    let assetIds: string[] = [];
    try { assetIds = JSON.parse(output.assetIdsJson || '[]'); } catch { /* noop */ }
    const referencedAssets = assetIds.length > 0
      ? db.select({ id: assets.id, title: assets.title })
          .from(assets)
          .where(inArray(assets.id, assetIds))
          .all()
      : [];

    // 3. 调 LLM 提炼方法论
    const kernels = getActiveKernelsForInjection();
    const result = await callLLM<{
      category?: string;
      content?: string;
      scope?: string;
      counter_example?: string;
      reasoning?: string;
    }>(
      STRENGTHEN_SYSTEM,
      buildStrengthenUserPrompt(
        output.title,
        output.content,
        output.outputType,
        output.audience ?? null,
        referencedAssets.map((a: any) => a.title)
      ),
      { temperature: 0.3, kernel: kernels }
    );

    if (!result.ok || !result.data) {
      return NextResponse.json(
        { ok: false, error: `方法论提炼失败: ${result.error}` },
        { status: 500 }
      );
    }

    // 4. 验证 category
    const validCategories = ['belief', 'contrarian', 'expertise', 'challenge', 'principle'] as const;
    const category = validCategories.includes(result.data.category as any)
      ? (result.data.category as typeof validCategories[number])
      : 'principle';

    // 5. 写 user_kernels
    const now = Math.floor(Date.now() / 1000);
    const kernelId = `kernel_${randomUUID().slice(0, 12)}`;

    db.insert(userKernels).values({
      id: kernelId,
      category,
      kind: category === 'principle' ? 'principle' : 'belief',
      content: result.data.content ?? '（待编辑）',
      confidence: 60,  // V1.8.4 默认 60，Vincent 可调
      counterExample: result.data.counter_example ?? null,
      scope: result.data.scope ?? null,
      evidenceAssetIdsJson: JSON.stringify(assetIds),
      referencedCount: 1,  // 这次已经引用一次
      lastVerifiedAt: now,
      status: 'active',
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    } as any).run();

    return NextResponse.json({
      ok: true,
      kernelId,
      message: `已提炼为「${category}」类方法论候选`,
      suggestedCategory: category,
      suggestedContent: result.data.content,
      reasoning: result.data.reasoning,
    });
  } catch (e: any) {
    console.error('[api/outputs/[id]/promote-to-kernel] error:', e);
    return NextResponse.json(
      { ok: false, error: e.message ?? String(e) },
      { status: 500 }
    );
  }
}