/**
 * GET /api/writing/[id]
 * 读单个写作详情（含 scaffoldJson + content）
 *
 * Response: { ok, writing: OutputRow + parsed scaffold (if scaffold status) }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, outputs } from '@insight-os/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const rows = db.select().from(outputs).where(eq(outputs.id, id)).limit(1).all();
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'writing 不存在' }, { status: 404 });
    }
    const row = rows[0];

    // 解析 scaffoldJson（如果存在）
    let scaffold = null;
    if (row.scaffoldJson) {
      try {
        scaffold = JSON.parse(row.scaffoldJson);
      } catch { /* ignore */ }
    }

    // 解析 content（JSON 或纯文本）
    let content = null;
    try {
      content = JSON.parse(row.content);
    } catch {
      content = { primary_version: row.content };
    }

    return NextResponse.json({
      ok: true,
      writing: { ...row, scaffold, content },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}