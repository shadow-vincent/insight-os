/**
 * GET /api/assets
 * 列出资产卡
 *
 * Query params:
 *   - status: 按 status 过滤（inbox / sorting / candidate / in_use / archived）
 *   - type: 按 type 过滤（light / asset / kernel）
 *   - all: 设为 '1' 时不过滤 type（包含 light 卡），默认只返 type=asset
 *
 * 默认行为：只列正式资产卡（type=asset，候选池 light 卡不混入）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets } from '@insight-os/db';
import { desc, eq, and, ne } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const includeAll = url.searchParams.get('all') === '1';

  const db = getDb();
  let query = db.select().from(assets).$dynamic();
  const conditions = [];
  if (status) conditions.push(eq(assets.status, status as any));
  if (type) {
    conditions.push(eq(assets.type, type as any));
  } else if (!includeAll) {
    // 默认只返正式资产卡（排除 light 卡 / kernel 卡）
    conditions.push(ne(assets.type, 'light'));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  const list = query.orderBy(desc(assets.updatedAt)).all();

  return NextResponse.json({ ok: true, count: list.length, items: list });
}
