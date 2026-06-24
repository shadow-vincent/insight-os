/**
 * GET  /api/writing/[id]/versions          — 列表（按时间倒序，最多 20 个）
 * POST /api/writing/[id]/versions          — 手动保存版本（带 note）
 *
 * 重大改动（改写润色前、多平台适配后）会自动 snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, writingVersions } from '@insight-os/db';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const MAX_VERSIONS = 20;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: writingId } = await params;
    const db = getDb();
    const list = db
      .select()
      .from(writingVersions)
      .where(eq(writingVersions.writingId, writingId))
      .orderBy(desc(writingVersions.createdAt))
      .limit(MAX_VERSIONS)
      .all();
    return NextResponse.json({ ok: true, versions: list });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: writingId } = await params;
    const { content, title, note, createdBy = 'manual' } = await req.json() as {
      content: string;
      title?: string;
      note?: string;
      createdBy?: string;
    };
    if (typeof content !== 'string') {
      return NextResponse.json({ ok: false, error: 'content 必须为字符串' }, { status: 400 });
    }

    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const versionId = `ver_${writingId}_${now}`;

    db.insert(writingVersions)
      .values({ id: versionId, writingId, content, title: title ?? null, note: note ?? null, createdBy, createdAt: now })
      .run();

    // 保留最近 MAX_VERSIONS 个版本，超出自动清旧
    const allVersions = db
      .select({ id: writingVersions.id, createdAt: writingVersions.createdAt })
      .from(writingVersions)
      .where(eq(writingVersions.writingId, writingId))
      .orderBy(desc(writingVersions.createdAt))
      .all();
    if (allVersions.length > MAX_VERSIONS) {
      const toDelete = allVersions.slice(MAX_VERSIONS);
      for (const v of toDelete) {
        db.delete(writingVersions).where(eq(writingVersions.id, v.id)).run();
      }
    }

    return NextResponse.json({ ok: true, versionId, createdAt: now });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
