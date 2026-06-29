/**
 * GET /api/articles?types=article_full,article_outline,writing&limit=30
 *
 * 列出 outputs 表里 article 类型的样本（用于「从样本提炼风格」资产库 tab）
 *
 * Response: { ok, articles: Array<{id, title, preview, outputType, createdAt}> }
 *
 * - preview 是 content 前 200 字
 * - 按 createdAt 倒序
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, outputs } from '@insight-os/db';
import { desc, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const typesParam = url.searchParams.get('types') ?? 'article_full,article_outline,writing';
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30'), 100);
    const types = typesParam.split(',').map(s => s.trim()).filter(Boolean);

    const db = getDb();


    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });
    const rows = await db
      .select({
        id: outputs.id,
        title: outputs.title,
        content: outputs.content,
        outputType: outputs.outputType,
        createdAt: outputs.createdAt,
      })
      .from(outputs)
      .where(inArray(outputs.outputType, types as any))
      .orderBy(desc(outputs.createdAt))
      .limit(limit);

    const articles = rows.map(r => ({
      id: r.id,
      title: r.title,
      preview: r.content.length > 200 ? r.content.slice(0, 200) + '…' : r.content,
      outputType: r.outputType,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ ok: true, articles });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}