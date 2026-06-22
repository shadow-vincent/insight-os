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

    // 解析 scaffold（3 个 fallback 顺序）
    // 1. scaffoldJson 列（新 API /api/writing/scaffold 写入）
    // 2. content 列（老 API /api/output/scaffold 直接 JSON.stringify 写入 — 历史数据全在这）
    // 3. 都没有 → null（显示空状态）
    let scaffold = null;
    const scaffoldRaw = (row as any).scaffoldJson ?? (row as any).scaffold_json ?? null;
    if (scaffoldRaw) {
      try {
        scaffold = JSON.parse(scaffoldRaw);
      } catch { /* ignore */ }
    }
    if (!scaffold && row.content) {
      // 老 schema 直接把 scaffold JSON 写到 content 列
      try {
        const parsed = JSON.parse(row.content);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sections)) {
          scaffold = parsed;
        }
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