/**
 * POST /api/writing/[id]/publish  发布并反哺（v0.9.5）
 *
 * Body: { sourceUrl?: '公众号 URL（可选）' }
 *
 * 副作用（事务）：
 *   1. outputs.writingStatus = 'published'
 *   2. outputs.status = 'used'
 *   3. outputs.sourceUrl = ...
 *   4. assets.feedback_count +1（仅 writing 关联的卡）
 *   5. assets.last_used_at = now
 *
 * 幂等：如果已经 published，直接返回 ok
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, getRawSqlite, outputs, assets } from '@insight-os/db';

export const dynamic = 'force-dynamic';

interface PathContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: PathContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const sourceUrl = typeof body?.sourceUrl === 'string' ? body.sourceUrl.slice(0, 500) : null;

    const db = getDb();


    if (!db) return NextResponse.json({ ok: false, code: 'NO_SQLITE', error: 'Vercel 部署版不支持此操作，请用浏览器 IndexedDB' });
    const sqlite = getRawSqlite();
    const row = db.select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) {
      return Response.json({ ok: false, error: '写作记录不存在' }, { status: 404 });
    }

    // 幂等检查
    if (row.writingStatus === 'published') {
      return Response.json({ ok: true, alreadyPublished: true, sourceUrl: row.sourceUrl });
    }

    const now = Math.floor(Date.now() / 1000);
    const assetIds = JSON.parse(row.assetIdsJson || '[]') as string[];

    // 1) 标记 published
    db.update(outputs).set({
      writingStatus: 'published',
      status: 'used',
      sourceUrl,
      updatedAt: now,
    }).where(eq(outputs.id, id)).run();

    // 2) 关联资产 +1 + 更新 last_used_at
    const updateAsset = sqlite.prepare(`
      UPDATE assets
      SET feedback_count = COALESCE(feedback_count, 0) + 1,
          last_used_at = ?
      WHERE id = ?
    `);

    let bumped = 0;
    const tx = sqlite.transaction((ids: string[]) => {
      for (const aid of ids) {
        const r = updateAsset.run(now, aid);
        if (r.changes > 0) bumped += 1;
      }
    });
    tx(assetIds);

    return Response.json({
      ok: true,
      bumpedAssetCount: bumped,
      sourceUrl,
      publishedAt: now,
    });
  } catch (e: any) {
    console.error('[writing/publish]', e);
    return Response.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
