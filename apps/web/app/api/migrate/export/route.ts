/**
 * POST /api/migrate/export
 *
 * V1.10 启动时调用：从老 SQLite 读数据，返回 JSON 给前端写入 IndexedDB
 *
 * 仅 Electron 桌面版 + 本地 dev 有效（Vercel 没 SQLite → 返回 404）
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  assets,
  outputs,
  feedback,
  topics,
  assetTopics,
  sources,
  sourceItems,
  topicKernels,
  userKernels,
  writingDrafts,
  writingVersions,
} from '@insight-os/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    if (!db) {
      // Vercel / 没 SQLite 环境 → 不需要迁移
      return NextResponse.json({ ok: false, empty: true, message: 'No SQLite db to migrate' }, { status: 200 });
    }

    // 读所有 11 张表
    const dump: Record<string, any[]> = {
      assets: db.select().from(assets).all(),
      outputs: db.select().from(outputs).all(),
      feedback: db.select().from(feedback).all(),
      topics: db.select().from(topics).all(),
      assetTopics: db.select().from(assetTopics).all(),
      sources: db.select().from(sources).all(),
      sourceItems: db.select().from(sourceItems).all(),
      topicKernels: db.select().from(topicKernels).all(),
      userKernels: db.select().from(userKernels).all(),
      writingDrafts: db.select().from(writingDrafts).all(),
      writingVersions: db.select().from(writingVersions).all(),
    };

    return NextResponse.json({
      ok: true,
      migratedAt: Date.now(),
      counts: Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, v.length])),
      ...dump,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}