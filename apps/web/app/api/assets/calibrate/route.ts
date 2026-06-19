/**
 * POST /api/assets/calibrate
 *
 * 输入：{ assetId }
 * 流程：调 LLM Prompt ② 对轻量卡做苏格拉底三问校准
 *
 * 返回：{ ok, calibration }
 *
 * 不修改 assets 表（calibration 结果只是建议，用户手动决定是否升级）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { eq } from 'drizzle-orm';
import {
  buildCalibrateUserPrompt,
  CALIBRATE_SYSTEM,
  callLLM,
  type CalibrateInput,
  type CalibrateOutput,
} from '@insight-os/llm';
import { isLLMConfigured } from '@insight-os/core';

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
    const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!asset) {
      return NextResponse.json({ ok: false, error: '资产不存在' }, { status: 404 });
    }

    // 准备 prompt ② 输入
    const userPrompt = buildCalibrateUserPrompt({
      initialInsight: asset.oneSentenceInsight ?? asset.title,
      antiCommonSense: asset.antiCommonSense ?? null,
      sourceContext: asset.source ?? undefined,
    });

    const result = await callLLM<CalibrateOutput>(
      CALIBRATE_SYSTEM,
      userPrompt,
      { temperature: 0.5, maxTokens: 2000 }
    );

    if (!result.ok || !result.data) {
      return NextResponse.json({
        ok: false,
        error: result.error || 'LLM 校准失败',
        raw: result.raw,
      }, { status: 500 });
    }

    return NextResponse.json({ ok: true, calibration: result.data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
