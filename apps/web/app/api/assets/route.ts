/**
 * GET /api/assets
 * 列出资产卡
 *
 * Query params:
 *   - status: 按 status 过滤（inbox / sorting / candidate / in_use / archived）
 *   - type: 按 type 过滤（light / asset / kernel）
 *   - all: 设为 '1' 时不过滤 type（包含 light 卡），默认只返 type=asset
 *   - topic: 按主题过滤（走 assetTopics join，限定 limit=30）
 *
 * 默认行为：只列正式资产卡（type=asset，候选池 light 卡不混入）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, assetTopics } from '@insight-os/db';
import { desc, eq, and, ne, inArray } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const includeAll = url.searchParams.get('all') === '1';
    const topicId = url.searchParams.get('topic');
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '500', 10) || 500, 500);

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });
    type AssetRow = typeof assets.$inferSelect;
    let list: AssetRow[];

    if (topicId) {
      // 按主题过滤：先拿 assetTopics 关联的 id，再批量查 assets
      const links = db.select().from(assetTopics).where(eq(assetTopics.topicId, topicId)).all();
      const ids = links.map(l => l.assetId);
      if (ids.length === 0) {
        return NextResponse.json({ ok: true, count: 0, items: [] });
      }
      const baseConditions = [
        inArray(assets.id, ids),
        ...(type ? [eq(assets.type, type as any)] : includeAll ? [] : [ne(assets.type, 'light')]),
        ...(status ? [eq(assets.status, status as any)] : []),
      ];
      list = db.select().from(assets).where(and(...baseConditions)).orderBy(desc(assets.updatedAt)).limit(limit).all() as AssetRow[];
    } else {
      let query = db.select().from(assets).$dynamic();
      const conditions = [];
      if (status) conditions.push(eq(assets.status, status as any));
      if (type) {
        conditions.push(eq(assets.type, type as any));
      } else if (!includeAll) {
        conditions.push(ne(assets.type, 'light'));
      }
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      list = query.orderBy(desc(assets.updatedAt)).all() as AssetRow[];
    }

    return NextResponse.json({ ok: true, count: list.length, items: list });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message || '资产列表查询失败',
    }, { status: 500 });
  }
}
