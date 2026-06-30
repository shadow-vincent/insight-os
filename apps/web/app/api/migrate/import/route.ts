/**
 * POST /api/migrate/import
 *
 * V1.11.8: 客户端 IDB 导出的 JSON → server SQLite
 *
 * 反向 V1.10 迁移（V1.10 是 SQLite → IDB）
 *
 * 场景：
 * - 用户用 Vercel demo 体验 → 导出 JSON 到本机
 * - 装本地版 Insight OS → 打开 localhost:4191
 * - /settings/data 点"导入 JSON" → 选文件 → 调本 API
 * - 数据进本地 SQLite
 *
 * 行为：
 * - 接 { assets, outputs, feedback, topics, assetTopics, sources, sourceItems,
 *        topicKernels, userKernels, writingDrafts, writingVersions }
 * - 全表 delete + insert（transaction 防止半截状态）
 * - 返回 { ok, counts }
 *
 * Vercel 上：db() 返回 null → 404 + 提示"请用本地版"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, outputs, feedback, topics, assetTopics, sources, sourceItems, topicKernels, userKernels, writingDrafts, writingVersions } from '@insight-os/db';

export const dynamic = 'force-dynamic';

interface ImportBody {
  assets?: any[];
  outputs?: any[];
  feedback?: any[];
  topics?: any[];
  assetTopics?: any[];
  sources?: any[];
  sourceItems?: any[];
  topicKernels?: any[];
  userKernels?: any[];
  writingDrafts?: any[];
  writingVersions?: any[];
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    if (!db) {
      // Vercel 没 SQLite → 提示用户用本地版
      return NextResponse.json({
        ok: false,
        error: '本功能仅本地版生效（Vercel 部署版没 SQLite）。请用本地 dev 或 Electron 桌面版。',
        code: 'NO_SQLITE',
      }, { status: 400 });
    }

    const body = (await req.json()) as ImportBody;

    // 字段映射：camelCase IDB → snake_case Drizzle 列（如果 Drizzle 需要）
    // 注：Drizzle 0.x 的 $inferInsert 类型已经接受 camelCase，这里直接传
    const counts: Record<string, number> = {};

    // 整体 transaction：任一失败回滚
    db.transaction((tx) => {
      // 顺序：先清子表，再清主表
      if (body.feedback?.length) {
        tx.delete(feedback).run();
        for (const row of body.feedback) tx.insert(feedback).values(row).run();
        counts.feedback = body.feedback.length;
      }
      if (body.writingVersions?.length) {
        tx.delete(writingVersions).run();
        for (const row of body.writingVersions) tx.insert(writingVersions).values(row).run();
        counts.writingVersions = body.writingVersions.length;
      }
      if (body.writingDrafts?.length) {
        tx.delete(writingDrafts).run();
        for (const row of body.writingDrafts) tx.insert(writingDrafts).values(row).run();
        counts.writingDrafts = body.writingDrafts.length;
      }
      if (body.sourceItems?.length) {
        tx.delete(sourceItems).run();
        for (const row of body.sourceItems) tx.insert(sourceItems).values(row).run();
        counts.sourceItems = body.sourceItems.length;
      }
      if (body.assetTopics?.length) {
        tx.delete(assetTopics).run();
        for (const row of body.assetTopics) tx.insert(assetTopics).values(row).run();
        counts.assetTopics = body.assetTopics.length;
      }
      if (body.outputs?.length) {
        tx.delete(outputs).run();
        for (const row of body.outputs) tx.insert(outputs).values(row).run();
        counts.outputs = body.outputs.length;
      }
      if (body.topicKernels?.length) {
        tx.delete(topicKernels).run();
        for (const row of body.topicKernels) tx.insert(topicKernels).values(row).run();
        counts.topicKernels = body.topicKernels.length;
      }
      if (body.userKernels?.length) {
        tx.delete(userKernels).run();
        for (const row of body.userKernels) tx.insert(userKernels).values(row).run();
        counts.userKernels = body.userKernels.length;
      }
      if (body.assets?.length) {
        tx.delete(assets).run();
        for (const row of body.assets) tx.insert(assets).values(row).run();
        counts.assets = body.assets.length;
      }
      if (body.topics?.length) {
        tx.delete(topics).run();
        for (const row of body.topics) tx.insert(topics).values(row).run();
        counts.topics = body.topics.length;
      }
      if (body.sources?.length) {
        tx.delete(sources).run();
        for (const row of body.sources) tx.insert(sources).values(row).run();
        counts.sources = body.sources.length;
      }
    });

    return NextResponse.json({
      ok: true,
      importedAt: Date.now(),
      counts,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}