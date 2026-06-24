/**
 * GET /api/sync/export
 *
 * 导出全部数据为 ZIP（用户拖到 iCloud Drive / 任意网盘）
 * ZIP 内容（透明 JSON Bundle，跨平台可读）：
 *   manifest.json          — 总索引（version + last_sync_at + entity_count）
 *   assets/{id}.json       — 资产
 *   topics/{id}.json       — 主题
 *   kernels/{id}.json      — 用户 Kernel
 *   writing_drafts/{id}.json
 *   writing_versions/{id}.json
 *   config.json            — 用户配置（不含 LLM key）
 *   META.txt               — 导出说明
 */

import { NextResponse } from 'next/server';
import { getDb, assets, topics, assetTopics, topicKernels, userKernels, outputs, writingDrafts, writingVersions } from '@insight-os/db';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const nowISO = new Date().toISOString();

    const allAssets = db.select().from(assets).all();
    const allTopics = db.select().from(topics).all();
    const allAssetTopics = db.select().from(assetTopics).all();
    const allTopicKernels = db.select().from(topicKernels).all();
    const allUserKernels = db.select().from(userKernels).all();
    const allOutputs = db.select().from(outputs).all();
    const allDrafts = db.select().from(writingDrafts).all();
    const allVersions = db.select().from(writingVersions).all();

    const zip = new JSZip();
    const manifest: Record<string, unknown> = {
      version: 1,
      exportedAt: nowISO,
      exportedAtUnix: now,
      source: 'insight-os',
      counts: {
        assets: allAssets.length,
        topics: allTopics.length,
        assetTopics: allAssetTopics.length,
        topicKernels: allTopicKernels.length,
        userKernels: allUserKernels.length,
        outputs: allOutputs.length,
        writingDrafts: allDrafts.length,
        writingVersions: allVersions.length,
      },
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('META.txt',
`Insight OS 数据导出
==================
导出时间: ${nowISO}
资产数: ${allAssets.length}
主题数: ${allTopics.length}
Kernel 数: ${allUserKernels.length}
输出数: ${allOutputs.length}

使用方式：
  1. 拖到 iCloud Drive / Dropbox / 任何网盘同步
  2. 在另一台设备上 /settings/sync 选"从本地导入"上传这个 ZIP
  3. 导入前会显示 diff（新增 / 更新 / 冲突），你可以选择处理方式

⚠️ 不包含 LLM API key（隐私安全，导入端要重新配置）
`);

    // 各类实体分目录
    const folder = zip.folder('data')!;
    for (const a of allAssets) folder.file(`assets/${a.id}.json`, JSON.stringify(a, null, 2));
    for (const t of allTopics) folder.file(`topics/${t.id}.json`, JSON.stringify(t, null, 2));
    for (const at of allAssetTopics) folder.file(`asset_topics/${at.id}.json`, JSON.stringify(at, null, 2));
    for (const tk of allTopicKernels) folder.file(`topic_kernels/${tk.id}.json`, JSON.stringify(tk, null, 2));
    for (const uk of allUserKernels) folder.file(`kernels/${uk.id}.json`, JSON.stringify(uk, null, 2));
    for (const o of allOutputs) folder.file(`outputs/${o.id}.json`, JSON.stringify(o, null, 2));
    for (const d of allDrafts) folder.file(`writing_drafts/${d.id}.json`, JSON.stringify(d, null, 2));
    for (const v of allVersions) folder.file(`writing_versions/${v.id}.json`, JSON.stringify(v, null, 2));

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="insight-os-backup-${nowISO.slice(0, 10)}.zip"`,
        'Content-Length': String(buf.length),
        'X-Insight-Os-Manifest': JSON.stringify(manifest.counts),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
