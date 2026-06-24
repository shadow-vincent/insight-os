/**
 * POST /api/sync/import
 *
 * 接收 multipart/form-data 上传的 ZIP 文件，解压后批量写回 db
 * 策略（v1.5 MVP）：
 *   - 同一 id 存在 → 用 imported 的覆盖（last-write-wins）
 *   - 新 id → insert
 *   - 返回 diff 报告（用户确认后才生效 — V1.6 加 UI）
 *
 * ⚠️ 当前为 MVP：直接全量覆盖（不做 diff 确认 UI，V1.6 加）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, topics, assetTopics, topicKernels, userKernels, outputs, writingDrafts, writingVersions } from '@insight-os/db';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: '必须上传 ZIP 文件' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buf);

    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      return NextResponse.json({ ok: false, error: 'ZIP 缺少 manifest.json，不是合法的 Insight OS 备份' }, { status: 400 });
    }
    const manifest = JSON.parse(await manifestFile.async('text'));
    if (manifest.source !== 'insight-os') {
      return NextResponse.json({ ok: false, error: '不是 Insight OS 备份文件' }, { status: 400 });
    }

    const db = getDb();
    const counts = { inserted: 0, updated: 0, skipped: 0 };
    const errors: string[] = [];

    // 工具：批量 upsert 实体
    async function importTable<T extends { id: string }>(
      table: any,
      folderName: string,
      label: string,
    ) {
      const folder = zip.folder(`data/${folderName}`);
      if (!folder) return;
      const files = Object.values(folder.files).filter(f => !f.dir);
      for (const f of files) {
        try {
          const text = await f.async('text');
          const row = JSON.parse(text) as T;
          const existing = db.select().from(table).where((table as any).id ? (table as any).id.equals?.(row.id) : undefined as any).get?.()
            ?? db.select().from(table).all().find((r: any) => r.id === row.id);
          if (existing) {
            // update
            const updateSet: Record<string, unknown> = {};
            for (const k of Object.keys(row)) updateSet[k] = (row as any)[k];
            db.update(table).set(updateSet as any).where((table as any).id ? (table as any).id.equals?.(row.id) : undefined as any).run();
            counts.updated++;
          } else {
            db.insert(table).values(row as any).run();
            counts.inserted++;
          }
        } catch (e: any) {
          errors.push(`${label}/${f.name}: ${e.message}`);
          counts.skipped++;
        }
      }
    }

    // 等价的 drizzle eq：直接用 { id } 查找
    const eqId = (table: any, id: string) => (table as any).id.equals?.(id) ?? undefined;

    // 简化版：每张表用基础 find
    async function importById<T extends { id: string }>(
      table: any,
      folderName: string,
      label: string,
    ) {
      const folderPath = `data/${folderName}/`;
      const allEntries = Object.values(zip.files);
      for (const f of allEntries) {
        if (f.dir) continue;
        if (!f.name.startsWith(folderPath)) continue;
        if (!f.name.endsWith('.json')) continue;
        try {
          const text = await f.async('text');
          const row = JSON.parse(text) as T;
          if (!row.id) {
            errors.push(`${label}/${f.name}: 缺少 id 字段`);
            counts.skipped++;
            continue;
          }
          const all = db.select().from(table).all() as any[];
          const existing = all.find(r => r.id === row.id);
          if (existing) {
            // 不更新 id 字段（防止主键冲突）
            const updateSet: Record<string, unknown> = { ...row };
            delete (updateSet as any).id;
            db.update(table).set(updateSet as any).where(eq((table as any).id, row.id)).run();
            counts.updated++;
          } else {
            db.insert(table).values(row as any).run();
            counts.inserted++;
          }
        } catch (e: any) {
          errors.push(`${label}/${f.name}: ${e.message}`);
          counts.skipped++;
        }
      }
    }

    await importById(assets, 'assets', 'assets');
    await importById(topics, 'topics', 'topics');
    await importById(assetTopics, 'asset_topics', 'assetTopics');
    await importById(topicKernels, 'topic_kernels', 'topicKernels');
    await importById(userKernels, 'kernels', 'userKernels');
    await importById(outputs, 'outputs', 'outputs');
    await importById(writingDrafts, 'writing_drafts', 'writingDrafts');
    await importById(writingVersions, 'writing_versions', 'writingVersions');

    return NextResponse.json({
      ok: true,
      manifest,
      counts,
      errors: errors.length > 0 ? errors.slice(0, 5) : [],
      importedAt: Math.floor(Date.now() / 1000),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
