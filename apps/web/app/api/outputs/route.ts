/**
 * GET /api/outputs
 *
 * 列出所有生成记录（按时间倒序，最多 50 条）
 * 返回前端友好的 shape：含 assetTitle / assetCount / isMulti
 *
 * 与 /api/output/list 的区别：本接口做 join，输出可直接渲染的字段
 */

import { NextResponse } from 'next/server';
import { getDb, outputs, assets } from '@insight-os/db';
import { desc, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const list = db.select().from(outputs).orderBy(desc(outputs.createdAt)).limit(50).all();

    // 收集所有 assetId
    const allAssetIds = new Set<string>();
    for (const o of list) {
      try {
        const ids: string[] = JSON.parse(o.assetIdsJson || '[]');
        ids.forEach(id => allAssetIds.add(id));
      } catch { /* 忽略 */ }
    }

    // 一次性查出所有相关资产
    type AssetRow = typeof assets.$inferSelect;
    const assetRows: AssetRow[] = allAssetIds.size > 0
      ? db.select().from(assets).where(inArray(assets.id, Array.from(allAssetIds))).all() as AssetRow[]
      : [];
    const assetMap = new Map<string, AssetRow>(assetRows.map(a => [a.id, a]));

    // 转换 shape
    const items = list.map(o => {
      let ids: string[] = [];
      try { ids = JSON.parse(o.assetIdsJson || '[]'); } catch { /* */ }
      const primaryId = ids[0];
      const primary = primaryId ? assetMap.get(primaryId) : null;

      let isMulti = false;
      try {
        const parsed = JSON.parse(o.content || '{}');
        isMulti = parsed.isMulti === true;
      } catch { /* */ }

      return {
        id: o.id,
        title: o.title,
        content: o.content,
        outputType: o.outputType,
        audience: o.audience,
        status: o.status,
        createdAt: o.createdAt,
        assetIds: ids,
        assetCount: ids.length,
        primaryAssetTitle: primary?.title || '(已删除资产)',
        primaryAssetId: primaryId,
        isMulti,
        rating: null, // 暂未实现单条反馈
      };
    });

    return NextResponse.json({ ok: true, count: items.length, outputs: items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
