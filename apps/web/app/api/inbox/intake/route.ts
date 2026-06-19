/**
 * POST /api/inbox/intake
 *
 * 输入：粘贴的文本 / 上传的 Markdown / 项目资料片段
 * 流程：调 LLM Prompt ① 生成轻量卡 → 写 assets 表（type=light, status=candidate）
 *
 * 返回：{ ok, assetId, lightCard }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import {
  buildLightCardUserPrompt,
  LIGHT_CARD_SYSTEM,
  callLLM,
  type LightCardInput,
  type LightCardOutput,
} from '@insight-os/llm';
import { isLLMConfigured, readConfig } from '@insight-os/core';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

export async function POST(req: NextRequest) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json({
        ok: false,
        error: 'LLM 未配置',
        code: 'LLM_NOT_CONFIGURED',
      }, { status: 400 });
    }

    const body = await req.json();
    const { rawContent, sourceType } = body;

    if (!rawContent || typeof rawContent !== 'string' || rawContent.trim().length < 10) {
      return NextResponse.json({
        ok: false,
        error: '内容太短（至少 10 字）',
      }, { status: 400 });
    }

    // 调 LLM 整理
    const userPrompt = buildLightCardUserPrompt({
      rawContent: rawContent.slice(0, 8000), // 限制输入长度
      sourceType: (sourceType as LightCardInput['sourceType']) ?? 'manual',
    });
    const result = await callLLM<LightCardOutput>(
      LIGHT_CARD_SYSTEM,
      userPrompt,
      { temperature: 0.4, maxTokens: 1500 }
    );

    if (!result.ok || !result.data) {
      return NextResponse.json({
        ok: false,
        error: result.error || 'LLM 整理失败',
        code: 'LLM_CALL_FAILED',
        raw: result.raw,
      }, { status: 500 });
    }

    const lc = result.data;

    // 写 assets 表（type=light, status=candidate）
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const id = `lc_${randomUUID().slice(0, 8)}`;

    // 写入文件位置：放在 .md 文件夹下的 _light_cards/ 子目录
    // 这样 v0.2 可以直接被 indexer 索引
    const cfg = readConfig();
    const vaultDir = cfg.paths.vaultPath + '/04_管理洞察';
    const filePath = resolve(vaultDir, '_light_cards', `资产卡_轻量_${lc.title.slice(0, 20)}_${id}.md`);

    db.insert(assets)
      .values({
        id,
        type: 'light',
        status: lc.recommended_next_action === 'archive' ? 'archived' : 'candidate',
        title: lc.title,
        evidenceLevel: 'E0', // 轻量卡默认 E0
        priority: lc.priority,
        tagsJson: JSON.stringify(lc.keywords ?? []),
        source: `${sourceType ?? 'manual'} · ${new Date().toISOString().slice(0, 10)}`,
        sourceType: 'knowledge_card',
        oneSentenceInsight: lc.initial_insight,
        antiCommonSense: lc.anti_common_sense,
        filePath,
        fileMtime: now,
        fileHash: `lc_${now}`, // 轻量卡用合成 hash（后续可以同步到 .md 再走 indexer）
        feedbackCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return NextResponse.json({
      ok: true,
      assetId: id,
      lightCard: lc,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
