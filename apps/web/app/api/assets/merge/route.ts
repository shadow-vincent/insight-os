/**
 * POST /api/assets/merge
 *
 * 合并多张 asset 卡成 1 张
 * - 创建 1 张新 asset (type='asset', status='in_use')
 * - 旧 N 张 asset 改 status='archived'，tagsJson 标注 [merged:newId]
 * - 写 1 个合并 .md 文件
 * - 旧 .md 文件标记 [merged:newId]
 *
 * Body:
 *   {
 *     assetIds: string[],
 *     mergedData: {
 *       title: string,
 *       oneSentenceInsight: string,
 *       antiCommonSense?: string,
 *       tags?: string[],
 *       evidenceLevel?: string,
 *       priority?: string,
 *     }
 *   }
 *
 * Returns: { ok, newAssetId, mergedCount }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { inArray, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isLLMConfigured, readConfig } from '@insight-os/core';

export const dynamic = 'force-dynamic';

interface MergeRequest {
  assetIds: string[];
  mergedData: {
    title: string;
    oneSentenceInsight: string;
    antiCommonSense?: string;
    tags?: string[];
    evidenceLevel?: string;
    priority?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json({
        ok: false,
        error: 'LLM 未配置',
        code: 'LLM_NOT_CONFIGURED',
      }, { status: 400 });
    }

    const body: MergeRequest = await req.json();
    const { assetIds, mergedData } = body;

    // 校验
    if (!Array.isArray(assetIds) || assetIds.length < 2) {
      return NextResponse.json({
        ok: false,
        error: '至少需要 2 张资产才能合并',
      }, { status: 400 });
    }

    if (!mergedData?.title?.trim() || !mergedData?.oneSentenceInsight?.trim()) {
      return NextResponse.json({
        ok: false,
        error: '合并后标题 / 洞察必填',
      }, { status: 400 });
    }

    const db = getDb();

    // 读旧资产
    const oldAssets = db.select().from(assets)
      .where(inArray(assets.id, assetIds))
      .all();

    if (oldAssets.length !== assetIds.length) {
      return NextResponse.json({
        ok: false,
        error: `部分资产不存在（找到 ${oldAssets.length}/${assetIds.length}）`,
      }, { status: 400 });
    }

    // 合并 tags：去重
    const mergedTagsSet = new Set<string>(mergedData.tags || []);
    for (const old of oldAssets) {
      const oldTags: string[] = JSON.parse(old.tagsJson || '[]');
      for (const t of oldTags) mergedTagsSet.add(t);
    }
    mergedTagsSet.delete('merged');
    const mergedTags = Array.from(mergedTagsSet);

    // 写新资产 .md
    const cfg = readConfig();
    const vaultDir = cfg.paths.vaultPath + '/04_管理洞察';
    const fileName = `资产卡_合并_${mergedData.title.slice(0, 20)}_${Date.now()}.md`;
    const filePath = resolve(vaultDir, fileName);

    if (!existsSync(dirname(filePath))) {
      mkdirSync(dirname(filePath), { recursive: true });
    }

    const frontmatter = [
      '---',
      `id: merge_${randomUUID().slice(0, 8)}`,
      `title: ${mergedData.title}`,
      `type: asset`,
      `evidenceLevel: ${mergedData.evidenceLevel || 'E1'}`,
      `priority: ${mergedData.priority || 'B'}`,
      `tags: ${JSON.stringify(mergedTags)}`,
      `source: ${assetIds.join(' + ')}`,
      `mergedFrom: ${JSON.stringify(assetIds)}`,
      `createdAt: ${new Date().toISOString()}`,
      '---',
      '',
      `# ${mergedData.title}`,
      '',
      `> ${mergedData.oneSentenceInsight}`,
      '',
      mergedData.antiCommonSense ? `## 反常识\n\n${mergedData.antiCommonSense}\n\n` : '',
      '## 合并来源',
      '',
      ...oldAssets.map((a: any) => `- **${a.title}** (${a.id})`),
      '',
    ].join('\n');

    writeFileSync(filePath, frontmatter, 'utf-8');

    // 写 db 新资产
    const now = Math.floor(Date.now() / 1000);
    const newId = `merge_${randomUUID().slice(0, 8)}`;

    db.insert(assets).values({
      id: newId,
      type: 'asset',
      status: 'in_use',
      title: mergedData.title,
      evidenceLevel: mergedData.evidenceLevel || 'E1',
      priority: mergedData.priority || 'B',
      tagsJson: JSON.stringify(mergedTags),
      source: `merge · ${new Date().toISOString().slice(0, 10)} · ${assetIds.length} 张合并`,
      sourceType: 'knowledge_card',
      oneSentenceInsight: mergedData.oneSentenceInsight,
      antiCommonSense: mergedData.antiCommonSense || null,
      filePath,
      fileMtime: now,
      fileHash: `merge_${now}`,
      feedbackCount: 0,
      createdAt: now,
      updatedAt: now,
    }).run();

    // 旧资产 archived + tag 标注
    const mergedMarker = `merged:${newId}`;
    for (const old of oldAssets) {
      const oldTags: string[] = JSON.parse(old.tagsJson || '[]');
      const newTags = [...oldTags.filter(t => !t.startsWith('merged:')), mergedMarker];
      db.update(assets)
        .set({
          status: 'archived',
          tagsJson: JSON.stringify(newTags),
          updatedAt: now,
        })
        .where(eq(assets.id, old.id))
        .run();
    }

    return NextResponse.json({
      ok: true,
      newAssetId: newId,
      mergedCount: assetIds.length,
      title: mergedData.title,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}