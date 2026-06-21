/**
 * 数据真实性深度校验（V1.2 阶段 D1）
 *
 * 接受文章内容，扫描数字 + LLM 推荐查证源 + 标注建议
 *
 * 流程：
 *   1. 正则扫所有数字（已有 data-fidelity-scanner）
 *   2. 拿未标注的数字 batch 给 LLM
 *   3. LLM 推荐：可能的来源 / 推算逻辑 / 替代数据
 *   4. 返回标注文本片段（让 UI 高亮显示）
 *
 * Request: { content: string }
 * Response: {
 *   ok,
 *   checks: Array<{
 *     text, number, position, context,
 *     source: 'cited' | 'inferred' | 'uncited' | 'industry-common',
 *     recommendations: Array<{
 *       type: 'source-link' | 'rephrase' | 'remove',
 *       suggestion: string,
 *       confidence: 'low' | 'medium' | 'high'
 *     }>
 *   }>,
 *   summary: { total, cited, inferred, uncited, industryCommon }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanNumbers } from '@insight-os/llm';
import { callLLM, summarizeNumberChecks } from '@insight-os/llm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content } = body;

    if (!content || content.trim().length < 50) {
      return NextResponse.json({ ok: false, error: 'content 太短' }, { status: 400 });
    }

    // 1. 扫描所有数字
    const checks = scanNumbers(content);

    // 2. 只把 uncited 的送给 LLM 推荐查证源
    const uncited = checks.filter(c => c.source === 'uncited');

    if (uncited.length === 0) {
      return NextResponse.json({
        ok: true,
        checks,
        summary: summarizeNumberChecks(checks),
        message: '所有数字都有标注或属于行业通用，无需查证',
      });
    }

    // 3. LLM 批量推荐（最多 5 个数字一起问，避免 prompt 太大）
    const uncitedForLLM = uncited.slice(0, 5);
    const systemPrompt = `你是 Vincent 的数据真实性顾问。

**任务**：对给定文章中的未标注数字，推荐查证方案。

**输入**：1-N 个数字 + 上下文片段

**输出严格 JSON**：
{
  "recommendations": [
    {
      "position": <number>,                  // 数字在文章中的位置
      "number": "<number>",                  // 数字原文
      "type": "source-link" | "rephrase" | "remove",
      "suggestion": "<string>",              // 具体建议
      "confidence": "low" | "medium" | "high"
    }
  ]
}

**type 含义**：
- source-link：推荐可能的数据来源（"可能是 XX 报告 / XX 调研 / 行业惯例"）
- rephrase：建议改写措辞（"改为'按 XX 推算' / '据 XX 研究'"）
- remove：建议删除这个数字（"无可靠来源，建议删"）

**suggestion 示例**：
- "可能是'德鲁克《管理》'一书中的数据，建议补注'——《管理》第 X 章'"
- "如无可靠来源，建议改为'据行业惯例，AI 工具的 ROI 通常在 3-5 倍之间'"
- "无可靠来源，建议删除这个具体数字"

不要编造具体的研究/数据来源。如果你不确定，就标 low confidence + remove。`;

    const userPrompt = `## 待查证数字（${uncitedForLLM.length} 个）

${uncitedForLLM.map((c, i) => `${i + 1}. 位置 ${c.position}：数字 "${c.number}"
   上下文：...${c.context}...`).join('\n\n')}

## 文章全文
${content.slice(0, 3000)}${content.length > 3000 ? '...[截断]' : ''}

请按 JSON 格式输出 recommendations。`;

    const result = await callLLM<{
      recommendations: Array<{
        position: number;
        number: string;
        type: 'source-link' | 'rephrase' | 'remove';
        suggestion: string;
        confidence: 'low' | 'medium' | 'high';
      }>;
    }>(systemPrompt, userPrompt, {
      temperature: 0.3,
      maxTokens: 1500,
      jsonMode: true,
    });

    if (!result.ok || !result.data) {
      // LLM 失败时返回基本扫描结果
      return NextResponse.json({
        ok: true,
        checks,
        summary: summarizeNumberChecks(checks),
        llmRecommendations: null,
        message: `LLM 推荐失败（${result.error}），但基础扫描已完成`,
      });
    }

    // 4. 把 LLM 推荐 merge 到 check 结果
    const recMap = new Map(result.data.recommendations.map(r => [r.position, r]));
    const enrichedChecks = checks.map(c => ({
      ...c,
      recommendations: recMap.has(c.position) ? [recMap.get(c.position)!] : c.suggestions.map(s => ({
        type: 'rephrase' as const,
        suggestion: s,
        confidence: 'medium' as const,
      })),
    }));

    return NextResponse.json({
      ok: true,
      checks: enrichedChecks,
      summary: summarizeNumberChecks(checks),
      llmRecommendations: result.data.recommendations,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}