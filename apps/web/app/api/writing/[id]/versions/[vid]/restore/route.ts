/**
 * POST /api/writing/[id]/versions/[vid]/restore
 *
 * 恢复版本：把版本内容写回 outputs.content（published 状态时拒绝）和 writing_drafts.content
 * 恢复前自动 snapshot 当前内容（防误操作）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, outputs, writingDrafts, writingVersions } from '@insight-os/db';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  try {
    const { id: writingId, vid } = await params;
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });

    // 1) 找版本
    const version = db
      .select()
      .from(writingVersions)
      .where(and(eq(writingVersions.id, vid), eq(writingVersions.writingId, writingId)))
      .get();
    if (!version) {
      return NextResponse.json({ ok: false, error: '版本不存在' }, { status: 404 });
    }

    // 2) 检查 writing 状态（published 拒绝）
    const writing = db.select().from(outputs).where(eq(outputs.id, writingId)).get();
    if (!writing) {
      return NextResponse.json({ ok: false, error: '写作记录不存在' }, { status: 404 });
    }
    if (writing.writingStatus === 'published') {
      return NextResponse.json({ ok: false, error: '已发布状态不允许恢复版本' }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);

    // 3) 恢复前自动 snapshot 当前内容（防误操作）
    const currentContent = JSON.stringify(writing.content);
    const snapshotId = `ver_${writingId}_${now}_pre_restore`;
    db.insert(writingVersions)
      .values({
        id: snapshotId,
        writingId,
        content: currentContent,
        title: writing.title,
        note: `恢复前自动快照（恢复到 ${vid}）`,
        createdBy: 'system',
        createdAt: now,
      })
      .run();

    // 4) 恢复内容到 outputs + writing_drafts
    db.update(outputs)
      .set({ content: version.content, title: version.title ?? writing.title, updatedAt: now })
      .where(eq(outputs.id, writingId))
      .run();

    const existingDraft = db.select().from(writingDrafts).where(eq(writingDrafts.writingId, writingId)).get();
    if (existingDraft) {
      db.update(writingDrafts)
        .set({ content: version.content, title: version.title ?? writing.title, updatedAt: now })
        .where(eq(writingDrafts.writingId, writingId))
        .run();
    } else {
      db.insert(writingDrafts)
        .values({
          id: `draft_${writingId}_${now}`,
          writingId,
          content: version.content,
          title: version.title ?? writing.title,
          updatedAt: now,
        })
        .run();
    }

    return NextResponse.json({ ok: true, restoredFrom: vid, snapshotId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
