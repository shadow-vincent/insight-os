/**
 * GET /api/sync/status
 *
 * 返回当前 db 状态：实体计数 + 最近一次导出/导入记录
 * 用于 /settings/sync 页面显示
 */

import { NextResponse } from 'next/server';
import { getDb, assets, topics, userKernels, outputs, writingDrafts, writingVersions } from '@insight-os/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });
    return NextResponse.json({
      ok: true,
      counts: {
        assets: db.select().from(assets).all().length,
        topics: db.select().from(topics).all().length,
        userKernels: db.select().from(userKernels).all().length,
        outputs: db.select().from(outputs).all().length,
        writingDrafts: db.select().from(writingDrafts).all().length,
        writingVersions: db.select().from(writingVersions).all().length,
      },
      lastSyncAt: db.select().from(writingDrafts).all()
        .reduce((max, d) => Math.max(max, d.updatedAt), 0) || null,
      iCloudTip: {
        mac: '把导出的 ZIP 拖到 iCloud Drive 任意位置，macOS 会自动同步',
        windows: 'iCloud for Windows 安装后，ZIP 放进 iCloud 文件夹',
        cross: '或用 Dropbox / OneDrive / Google Drive 任意网盘',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
