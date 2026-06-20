/**
 * .md 文件索引器
 *
 * 核心规则：
 * 1. .md 文件是权威源，索引器只读不写
 * 2. 数据库里只存元数据（id/type/status/...），不存长文本
 * 3. 文件 hash 用于检测外部修改
 * 4. 增量索引：跳过 hash 一致的文件
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { getDb, getRawSqlite, assets } from '@insight-os/db';
import { eq } from 'drizzle-orm';
import {
  normalizeType,
  normalizeTags,
  normalizeEvidenceLevel,
  inferSourceType,
  type CardType,
  type EvidenceLevel,
} from '@insight-os/core';

import { parseFrontmatter, extractOneSentenceInsight, extractAntiCommonSense, extractSummary } from './parser.ts';

export interface IndexResult {
  scanned: number;
  indexed: number;
  updated: number;
  unchanged: number;
  errors: Array<{ file: string; error: string }>;
}

export interface IndexOptions {
  vaultPath?: string;
  watch?: boolean;
}

/**
 * 索引单个 .md 文件，返回是否需要更新数据库
 */
export function indexFile(filePath: string) {
  const db = getDb();
  const content = readFileSync(filePath, 'utf-8');
  const stat = statSync(filePath);
  const mtime = Math.floor(stat.mtimeMs / 1000);
  const hash = createHash('sha256').update(content).digest('hex');

  // 查询数据库中是否已存在
  const existing = db.select().from(assets).where(eq(assets.filePath, filePath)).get();

  if (existing && existing.fileHash === hash) {
    return { action: 'unchanged' as const, record: existing };
  }

  // 解析 frontmatter
  const fm = parseFrontmatter(content);
  const type = normalizeType(typeof fm.type === 'string' ? fm.type : null);
  const evidenceLevel = normalizeEvidenceLevel(typeof fm.evidence_level === 'string' ? fm.evidence_level : null);
  const tags = normalizeTags(fm.tags);
  const source = typeof fm.source === 'string' ? fm.source : undefined;
  const sourceType = inferSourceType(source);
  const title = typeof fm.title === 'string' ? fm.title : basename(filePath, '.md');
  const oneSentenceInsight = extractOneSentenceInsight(content);
  const antiCommonSense = extractAntiCommonSense(content);
  const summary = extractSummary(fm, content);

  const now = Math.floor(Date.now() / 1000);

  if (existing) {
    // 更新
    db.update(assets)
      .set({
        type,
        title,
        evidenceLevel,
        tagsJson: JSON.stringify(tags),
        source: source ?? null,
        sourceType,
        oneSentenceInsight: oneSentenceInsight ?? null,
        antiCommonSense: antiCommonSense ?? null,
        fileMtime: mtime,
        fileHash: hash,
        updatedAt: now,
        // 保留 status（不因为文件 mtime 变化就重置工作流状态）
        // 保留 evidenceLevel 的人工调整
        // 但如果文件的 evidenceLevel 升级了，且数据库没手动改过，则同步
      } as any)  // drizzle 0.36.4 .set() 类型签名只显 required 字段
      .where(eq(assets.id, existing.id))
      .run();
    return { action: 'updated' as const, record: { ...existing, type, title, evidenceLevel, tagsJson: JSON.stringify(tags) } };
  } else {
    // 新增
    const id = `asset_${randomUUID().slice(0, 8)}`;
    // 现有 .md 文件已经是被 OpenClaw 加工过的资产卡，全部默认 in_use
    const status: 'in_use' | 'candidate' = type === 'asset' ? 'in_use' : 'candidate';
    const priority: 'A' | 'B' | 'C' = 'C'; // 用户后续手动调整

    db.insert(assets)
      .values({
        id,
        type,
        status,
        title,
        evidenceLevel,
        priority,
        tagsJson: JSON.stringify(tags),
        source: source ?? null,
        sourceType,
        oneSentenceInsight: oneSentenceInsight ?? null,
        antiCommonSense: antiCommonSense ?? null,
        filePath,
        fileMtime: mtime,
        fileHash: hash,
        feedbackCount: 0,
        createdAt: now,
        updatedAt: now,
      } as any)  // drizzle 0.36.4 .values() 类型签名只显 required 字段
      .run();
    return { action: 'indexed' as const, record: { id, type, title } };
  }
}

/**
 * 扫描 vault 目录下所有 资产卡_*.md 并索引
 */
export function indexVault(options: IndexOptions = {}): IndexResult {
  const vaultPath = options.vaultPath ?? process.env.INSIGHT_VAULT_PATH ?? '/Users/vincent/Documents/knowledge_base';
  const insightDir = resolve(vaultPath, '04_管理洞察');

  if (!existsSync(insightDir)) {
    return {
      scanned: 0,
      indexed: 0,
      updated: 0,
      unchanged: 0,
      errors: [{ file: insightDir, error: '目录不存在' }],
    };
  }

  const files = readdirSync(insightDir)
    .filter(f => f.endsWith('.md') && f.startsWith('资产卡_'))
    .map(f => join(insightDir, f));

  const result: IndexResult = {
    scanned: files.length,
    indexed: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
  };

  for (const file of files) {
    try {
      const r = indexFile(file);
      if (r.action === 'indexed') result.indexed++;
      else if (r.action === 'updated') result.updated++;
      else result.unchanged++;
    } catch (e: any) {
      result.errors.push({ file, error: e.message ?? String(e) });
    }
  }

  // 第二轮：解析 related 字段，把 `[[卡片_xxx]]` / `[资产卡_xxx, ...]` 解析为 asset ID
  try {
    resolveRelatedLinks(insightDir);
  } catch (e: any) {
    result.errors.push({ file: '<resolveRelatedLinks>', error: e.message ?? String(e) });
  }

  return result;
}

/**
 * 解析所有资产卡的 `related` 字段，写回 relatedIdsJson
 *
 * related 字段两种格式：
 *   1. `[[卡片_AI时代最稀缺的是判断力_2026-05-10]]` — 指向观察卡
 *   2. `[资产卡_缓冲层消失, 资产卡_组织竞争力公式]` — 指向资产卡
 *
 * 资产卡短名（不带 .md）通过 prefix 匹配 04_管理洞察/资产卡_<name>*.md
 * 观察卡 / 找不到的引用：不建边（资产图谱只显示资产卡之间的关系）
 */
function resolveRelatedLinks(insightDir: string) {
  const db = getDb();

  // 1. 从 db 拿所有 (id, title) 索引
  const allAssets = db.select({ id: assets.id, title: assets.title }).from(assets).all();
  const titleToId = new Map<string, string>();
  for (const a of allAssets) {
    const t = (a.title ?? '').trim();
    if (!t) continue;
    titleToId.set(t, a.id);                          // stripped（与 db 一致）
    titleToId.set(`资产卡_${t}`, a.id);                // 带前缀（与 related/filename 一致）
  }

  // 在 titleToId 里找 needle 对应的 id（精确 / 去除前缀 / 前缀匹配）
  function resolveId(needle: string): string | undefined {
    if (!needle) return undefined;
    // 1. 精确
    let id = titleToId.get(needle);
    if (id) return id;
    // 2. stripped 前缀
    const stripped = needle.replace(/^资产卡_/, '');
    id = titleToId.get(stripped);
    if (id) return id;
    // 3. prefix 匹配：找 titleToId 里 key 是 needle 开头的（最长）
    let bestKey: string | null = null;
    for (const k of titleToId.keys()) {
      if (k.startsWith(needle) || k.startsWith(stripped)) {
        if (!bestKey || k.length > bestKey.length) bestKey = k;
      }
    }
    if (bestKey) return titleToId.get(bestKey!);
    return undefined;
  }

  // 2. 扫所有 资产卡_*.md
  const files = readdirSync(insightDir)
    .filter(f => f.endsWith('.md') && f.startsWith('资产卡_'));

  for (const file of files) {
    const filePath = join(insightDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const fm = parseFrontmatter(content);
    const relatedRaw = fm.related;

    // 找当前卡自己的 id（用 filePath）
    const self = db.select().from(assets).where(eq(assets.filePath, filePath)).get();
    if (!self) continue;

    const relatedIds: string[] = [];
    if (typeof relatedRaw === 'string') {
      // 抽取所有 [[xxx]] 或裸名（去掉方括号、引号、空白）
      const names = relatedRaw
        .replace(/[\[\]]/g, ' ')
        .replace(/[【】]/g, ' ')
        .split(/[,,，、\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && (s.startsWith('资产卡_') || s.startsWith('卡片_')));
      for (const n of names) {
        const id = resolveId(n);
        if (id && id !== self.id && !relatedIds.includes(id)) {
          relatedIds.push(id);
        }
      }
    } else if (Array.isArray(relatedRaw)) {
      // YAML 数组格式: [资产卡_xxx, 资产卡_yyy]
      // YAML 数组格式: [资产卡_xxx, 资产卡_yyy]
      for (const item of relatedRaw) {
        if (typeof item !== 'string') continue;
        const id = resolveId(item.trim());
        if (id && id !== self.id && !relatedIds.includes(id)) {
          relatedIds.push(id);
        } else if (process.env.RELATED_DEBUG) {
          console.log(`[MISS] ${self.title} → ${item} (id=${id})`);
        }
      }
    }

    // 3. 写回 db
    db.update(assets)
      .set({ relatedIdsJson: JSON.stringify(relatedIds) } as any)
      .where(eq(assets.id, self.id))
      .run();
  }
}

