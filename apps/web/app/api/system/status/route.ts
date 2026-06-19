/**
 * GET  /api/system/status   检视系统状态（用于 Onboarding 引导）
 *
 * 返回:
 *   {
 *     ok,
 *     llmConfigured: boolean,        // LLM key 是否配了
 *     vaultPath: string,             // 当前 vault 路径
 *     vaultPathValid: boolean,       // 路径是否存在
 *     hasAssets: boolean,            // 库里有没有资产
 *     hasSeed: boolean,              // 是否已 seed 过（v1.0 检测法：是否有 'sample-' 前缀资产）
 *     needsOnboarding: boolean,      // 整体判断
 *     reasons: string[],             // 为什么需要 onboarding
 *   }
 */

import { NextRequest } from 'next/server';
import { existsSync } from 'node:fs';
import { readConfig, isLLMConfigured } from '@insight-os/core';
import { getDb, getRawSqlite, assets } from '@insight-os/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const cfg = readConfig();
    const db = getDb();
    const sqlite = getRawSqlite();

    const llmConfigured = isLLMConfigured();
    const vaultPath = cfg.paths.vaultPath;
    const vaultPathValid = !!vaultPath && existsSync(vaultPath);

    const totalAssets = db.select({ count: sql<number>`count(*)` })
      .from(assets).get()?.count ?? 0;
    const hasAssets = totalAssets > 0;

    // 是否已 seed（v1.0 检测：有 sample- 前缀的资产就算已 seed）
    const seedCount = sqlite.prepare(`SELECT count(*) as c FROM assets WHERE id LIKE 'sample-%'`).get() as any;
    const hasSeed = (seedCount?.c ?? 0) > 0;

    const reasons: string[] = [];
    if (!llmConfigured) reasons.push('未配 LLM');
    if (!vaultPathValid) reasons.push('Vault 路径无效');
    if (!hasAssets) reasons.push('资产库为空');

    // needsOnboarding: 任何一个关键项缺失，且没有 seed 数据
    const needsOnboarding = !hasSeed && (!llmConfigured || !vaultPathValid || !hasAssets);

    return Response.json({
      ok: true,
      llmConfigured,
      vaultPath,
      vaultPathValid,
      totalAssets,
      hasAssets,
      hasSeed,
      needsOnboarding,
      reasons,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
