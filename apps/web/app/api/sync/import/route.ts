/**
 * POST /api/sync/import
 *
 * 接收 multipart/form-data 上传的 ZIP 文件
 *
 * 模式：
 *   - ?dryRun=1 → 返回 diff 预览（不写 db），告诉用户将新增/更新/跳过多少
 *   - 默认 → 应用 last-write-wins
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, topics, assetTopics, topicKernels, userKernels, outputs, writingDrafts, writingVersions } from '@insight-os/db';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

interface DiffItem { insert: string[]; update: string[]; skip: string[] }
interface DiffReport {
  manifest: any;
  diff: Record<string, DiffItem>;
  totalInsert: number;
  totalUpdate: number;
  totalSkip: number;
  message: string;
  dryRun: boolean;
}

const TABLES = [
  { table: assets, folder: 'assets', key: 'assets' },
  { table: topics, folder: 'topics', key: 'topics' },
  { table: assetTopics, folder: 'asset_topics', key: 'assetTopics' },
  { table: topicKernels, folder: 'topic_kernels', key: 'topicKernels' },
  { table: userKernels, folder: 'kernels', key: 'userKernels' },
  { table: outputs, folder: 'outputs', key: 'outputs' },
  { table: writingDrafts, folder: 'writing_drafts', key: 'writingDrafts' },
  { table: writingVersions, folder: 'writing_versions', key: 'writingVersions' },
] as const;

async function loadZip(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('ZIP 缺少 manifest.json');
  const manifest = JSON.parse(await manifestFile.async('text'));
  if (manifest.source !== 'insight-os') throw new Error('不是 Insight OS 备份文件');
  return { zip, manifest };
}

async function computeDiff(zip: JSZip, manifest: any): Promise<DiffReport> {
  const db = getDb();

  if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
  const diff: Record<string, DiffItem> = {};
  let totalInsert = 0, totalUpdate = 0, totalSkip = 0;

  for (const { table, folder, key } of TABLES) {
    const folderPath = `data/${folder}/`;
    const items: DiffItem = { insert: [], update: [], skip: [] };
    const existingIds = new Set(db.select().from(table).all().map((r: any) => r.id));
    const allEntries = Object.values(zip.files);
    for (const f of allEntries) {
      if (f.dir || !f.name.startsWith(folderPath) || !f.name.endsWith('.json')) continue;
      try {
        const text = await f.async('text');
        const row = JSON.parse(text) as { id: string };
        if (!row.id) { items.skip.push(f.name); totalSkip++; continue; }
        if (existingIds.has(row.id)) { items.update.push(row.id); totalUpdate++; }
        else { items.insert.push(row.id); totalInsert++; }
      } catch { items.skip.push(f.name); totalSkip++; }
    }
    diff[key] = items;
  }

  return {
    manifest, diff,
    totalInsert, totalUpdate, totalSkip,
    message: dryRunMessage(totalInsert, totalUpdate),
    dryRun: true,
  };
}

function dryRunMessage(ins: number, upd: number): string {
  if (ins === 0 && upd === 0) return 'ZIP 里的所有实体都已经在本地，没有新内容。';
  if (ins > 0 && upd > 0) return `将新增 ${ins} 个 · 更新 ${upd} 个实体。已存在的将被覆盖（last-write-wins）。`;
  if (ins > 0) return `将新增 ${ins} 个实体。本地无冲突。`;
  return `将更新 ${upd} 个已存在实体。`;
}

async function applyImport(zip: JSZip) {
  const db = getDb();

  if (!db) return NextResponse.json({ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} });
  const counts = { inserted: 0, updated: 0, skipped: 0 };
  const errors: string[] = [];

  for (const { table, folder } of TABLES) {
    const folderPath = `data/${folder}/`;
    const allEntries = Object.values(zip.files);
    for (const f of allEntries) {
      if (f.dir || !f.name.startsWith(folderPath) || !f.name.endsWith('.json')) continue;
      try {
        const text = await f.async('text');
        const row = JSON.parse(text) as { id: string };
        if (!row.id) { counts.skipped++; continue; }
        const all = db.select().from(table).all() as any[];
        const existing = all.find(r => r.id === row.id);
        if (existing) {
          const updateSet: Record<string, unknown> = { ...row };
          delete (updateSet as any).id;
          db.update(table).set(updateSet as any).where(eq((table as any).id, row.id)).run();
          counts.updated++;
        } else {
          db.insert(table).values(row as any).run();
          counts.inserted++;
        }
      } catch (e: any) {
        errors.push(`${folder}/${f.name}: ${e.message}`);
        counts.skipped++;
      }
    }
  }

  return { counts, errors };
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: '必须上传 ZIP 文件' }, { status: 400 });
    }

    const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
    const { zip, manifest } = await loadZip(file);

    if (dryRun) {
      const report = await computeDiff(zip, manifest);
      return NextResponse.json({ ok: true, ...report });
    }

    const { counts, errors } = await applyImport(zip);
    return NextResponse.json({
      ok: true,
      manifest,
      counts,
      errors: errors.length > 0 ? errors.slice(0, 5) : [],
      importedAt: Math.floor(Date.now() / 1000),
      dryRun: false,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
