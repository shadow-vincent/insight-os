/**
 * GET  /api/writing/[id]   取写作（含骨架 + 正文 + 关联资产）
 * PATCH /api/writing/[id]  更新正文 / 写作状态 / 发布 URL
 *
 * PATCH body: { content?, writingStatus?, sourceUrl?, title? }
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, outputs, assets, topicKernels } from '@insight-os/db';

export const dynamic = 'force-dynamic';

interface PathContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: PathContext) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const row = db.select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) {
      return Response.json({ ok: false, error: '写作记录不存在' }, { status: 404 });
    }

    // 关联资产
    const assetIds = JSON.parse(row.assetIdsJson || '[]') as string[];
    const cards: any[] = [];
    for (const aid of assetIds) {
      const a = db.select().from(assets).where(eq(assets.id, aid)).get();
      if (a) cards.push({
        id: a.id,
        title: a.title,
        evidenceLevel: a.evidenceLevel,
        oneSentenceInsight: a.oneSentenceInsight,
        antiCommonSense: a.antiCommonSense,
        feedbackCount: a.feedbackCount ?? 0,
      });
    }

    // 主题 kernel（如果有）
    let kernel: any = null;
    if (row.topicId) {
      const k = db.select().from(topicKernels).where(eq(topicKernels.topicId, row.topicId)).get();
      if (k) {
        kernel = {
          headline: k.headline,
          summary: k.summary,
          coreBeliefs: JSON.parse(k.coreBeliefsJson),
        };
      }
    }

    return Response.json({
      ok: true,
      writing: {
        id: row.id,
        title: row.title,
        content: row.content,
        templateType: row.templateType,
        writingStatus: row.writingStatus,
        sourceUrl: row.sourceUrl,
        topicId: row.topicId,
        audience: row.audience,
        scaffold: row.scaffoldJson ? JSON.parse(row.scaffoldJson) : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        cards,
        kernel,
      },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: PathContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { content, writingStatus, sourceUrl, title } = body;

    const db = getDb();
    const row = db.select().from(outputs).where(eq(outputs.id, id)).get();
    if (!row) {
      return Response.json({ ok: false, error: '写作记录不存在' }, { status: 404 });
    }

    const update: any = { updatedAt: Math.floor(Date.now() / 1000) };
    if (typeof content === 'string') update.content = content;
    if (typeof title === 'string' && title.length > 0) update.title = title.slice(0, 60);
    if (writingStatus && ['scaffold', 'draft', 'published'].includes(writingStatus)) {
      update.writingStatus = writingStatus;
    }
    if (typeof sourceUrl === 'string') update.sourceUrl = sourceUrl.slice(0, 500);

    db.update(outputs).set(update).where(eq(outputs.id, id)).run();

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
