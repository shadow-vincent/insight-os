/**
 * POST /api/materials/paste
 *
 * v1.8.0 主动判断加工系统
 *
 * 接收 Vincent 粘贴的素材，调 LLM 7 维度评分，生成候选判断。
 *
 * 流程：
 *   1. 接受 { content, source? }
 *   2. 调用 scoreCandidate7Dims（packages/llm）
 *   3. 根据 recommended_action 写 assets 表（type=light, status=candidate|sorting|inbox）
 *   4. 返回新创建的 asset ID
 *
 * 输入：{ content: string, source?: 'manual' | 'inbox' | 'openclaw' }
 * 输出：{ ok, assetId, score, action, candidateTitle, candidateStatement }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { scoreCandidate, type RecommendedAction } from '@insight-os/llm';
import { isLLMConfigured } from '@insight-os/core';
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inArray } from 'drizzle-orm';

interface PasteRequest {
  content: string;
  source?: 'manual' | 'inbox' | 'openclaw' | 'upload';
  topicHint?: string; // 后续 V1.9 用：用户指定主题
  dryRun?: boolean;   // 单测用：只评分不写库
}

const MIN_CONTENT_LENGTH = 5;
const MAX_CONTENT_LENGTH = 50000;

/**
 * 推荐动作 → assets.status 映射
 *
 * 关系：
 *   process (80+)  → candidate （待你确认）
 *   candidate (65-79) → candidate
 *   signal (50-64)  → sorting （仅素材信号）
 *   ignore (0-49)   → inbox （仅收集，不进候选）
 */
function actionToStatus(action: RecommendedAction): 'candidate' | 'sorting' | 'inbox' {
  switch (action) {
    case 'process':
    case 'candidate':
      return 'candidate';
    case 'signal':
      return 'sorting';
    case 'ignore':
    default:
      return 'inbox';
  }
}

/**
 * 给素材生成一个临时文件路径（v1.8.0 仍然要求 file_path）
 * 实际使用 tmp 目录，不持久化 .md（V1.8.1 再做完整 .md 落盘）
 */
function makeTempFilePath(content: string): { filePath: string; fileMtime: number; fileHash: string } {
  const dir = mkdtempSync(join(tmpdir(), 'insight-paste-'));
  const filePath = join(dir, 'pasted.md');
  const now = Math.floor(Date.now() / 1000);
  writeFileSync(filePath, content, 'utf-8');
  // 简化 hash（仅用于检测外部修改）
  const fileHash = `paste-${now}-${content.length}`;
  return { filePath, fileMtime: now, fileHash };
}

export async function POST(req: NextRequest) {
  try {
    // 1. 解析 body
    const body = (await req.json()) as PasteRequest;
    const content = (body.content ?? '').trim();
    const source = body.source ?? 'manual';
    const dryRun = body.dryRun ?? false;

    if (!content) {
      return NextResponse.json(
        { ok: false, error: '素材内容不能为空' },
        { status: 400 }
      );
    }
    if (content.length < MIN_CONTENT_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `素材太短（至少 ${MIN_CONTENT_LENGTH} 字符，当前 ${content.length}）` },
        { status: 400 }
      );
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `素材太长（最多 ${MAX_CONTENT_LENGTH} 字符，当前 ${content.length}）` },
        { status: 400 }
      );
    }

    // 2. 检查 LLM 是否配置
    if (!isLLMConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'LLM 未配置，请先在设置里配置 API key' },
        { status: 400 }
      );
    }

    // 3. 加载已有资产标题（用于检测相似）
    const db = getDb();
    const existingAssetTitles = db.select({ title: assets.title })
      .from(assets)
      .where(inArray(assets.status, ['in_use', 'candidate'] as any))
      .limit(50)
      .all()
      .map((r: any) => r.title);

    // 4. 调 LLM 评分
    // V1.8.0 暂不在 score 里注入 kernel（避免覆盖评分独立性），V1.8.1 评估后再说
    const scoreResult = await scoreCandidate(content, {
      existingAssets: existingAssetTitles,
    });

    if (!scoreResult.ok) {
      return NextResponse.json(
        { ok: false, error: `评分失败: ${scoreResult.error}` },
        { status: 500 }
      );
    }

    // 5. dryRun 单测模式：返回评分但不写库
    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        score: scoreResult.scoreTotal,
        action: scoreResult.recommendedAction,
        candidateTitle: scoreResult.candidateTitle,
        candidateStatement: scoreResult.candidateStatement,
        breakdown: scoreResult.breakdown,
        reasoning: scoreResult.reasoning,
      });
    }

    // 6. 写 assets 表
    const now = Math.floor(Date.now() / 1000);
    const assetId = `asset_${randomUUID().slice(0, 12)}`;
    const status = actionToStatus(scoreResult.recommendedAction);

    // 临时文件路径（V1.8.1 会做完整 .md 落盘）
    const { filePath, fileMtime, fileHash } = makeTempFilePath(content);

    // 主题标签合并：检测到的主题 + 已有 tags
    const tagsJson = JSON.stringify(scoreResult.detectedTopics ?? []);

    // 文件名：从 candidateTitle 推断
    const sanitizedTitle = (scoreResult.candidateTitle || '未命名素材').slice(0, 60);
    const fileNameHint = sanitizedTitle.replace(/[\\/:*?"<>|]/g, '_');

    db.insert(assets).values({
      id: assetId,
      type: 'light',
      status,
      title: scoreResult.candidateTitle || '未命名素材',
      evidenceLevel: 'E0',
      priority: 'C',
      tagsJson,
      source: source,
      sourceType: source === 'openclaw' ? 'knowledge_card' : 'original',
      oneSentenceInsight: scoreResult.candidateStatement || content.slice(0, 100),
      antiCommonSense: scoreResult.contrarianPoint || null,
      filePath,
      fileMtime,
      fileHash,
      feedbackCount: 0,
      lastUsedAt: null,
      // v1.8.0 新字段
      sourceMaterialId: null,
      scoreTotal: scoreResult.scoreTotal,
      scoreBreakdownJson: JSON.stringify(scoreResult.breakdown),
      outputCount: 0,
      processedAt: null,
      isKernelCandidate: 0,
      isKernelApproved: 0,
      relatedIdsJson: JSON.stringify(scoreResult.similarAssetIds ?? []),
      createdAt: now,
      updatedAt: now,
    } as any).run();

    return NextResponse.json({
      ok: true,
      assetId,
      score: scoreResult.scoreTotal,
      action: scoreResult.recommendedAction,
      actionLabel: scoreResult.actionLabel,
      candidateTitle: scoreResult.candidateTitle,
      candidateStatement: scoreResult.candidateStatement,
      detectedTopics: scoreResult.detectedTopics,
      applicableScenarios: scoreResult.applicableScenarios,
      breakdown: scoreResult.breakdown,
      reasoning: scoreResult.reasoning,
      hardRuleMatch: scoreResult.hardRuleMatch,
      fileNameHint,
      status,
    });
  } catch (e: any) {
    console.error('[api/materials/paste] error:', e);
    return NextResponse.json(
      { ok: false, error: e.message ?? String(e) },
      { status: 500 }
    );
  }
}