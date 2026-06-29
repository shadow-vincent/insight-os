// packages/indexer/src/indexer.ts
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { getDb, assets } from "@insight-os/db";
import { eq } from "drizzle-orm";
import {
  normalizeType,
  normalizeTags,
  normalizeEvidenceLevel,
  inferSourceType
} from "@insight-os/core";

// packages/indexer/src/parser.ts
function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return {};
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return {};
  const fmText = content.slice(4, end);
  const result = {};
  let currentKey = null;
  let currentList = null;
  for (const rawLine of fmText.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const listMatch = line.match(/^\s+-\s+(.*)$/);
    if (listMatch && currentList) {
      const item = listMatch[1].trim().replace(/^["']|["']$/g, "");
      currentList.push(item);
      continue;
    }
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      if (currentKey && currentList) {
        result[currentKey] = currentList;
      }
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val.startsWith("[") && val.endsWith("]")) {
        const inner = val.slice(1, -1);
        result[currentKey] = parseInlineArray(inner);
        currentList = null;
      } else if (val === "" || val === "|" || val === ">") {
        currentList = [];
      } else {
        result[currentKey] = val.replace(/^["']|["']$/g, "");
        currentList = null;
      }
    }
  }
  if (currentKey && currentList) {
    result[currentKey] = currentList;
  }
  return result;
}
function parseInlineArray(s) {
  return s.split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}
function extractOneSentenceInsight(content) {
  const tableMatch = content.match(/\|\s*\*\*一句话洞察\*\*\s*\|\s*([^|]+?)\s*\|/);
  if (tableMatch) return cleanText(tableMatch[1]);
  const headingMatch = content.match(/(?:#{1,4}\s*)?(?:\*\*)?一句话洞察(?:\*\*)?[：:]?\s*\n?\s*(.+?)(?:\n|$)/);
  if (headingMatch) return cleanText(headingMatch[1]);
  return void 0;
}
function extractAntiCommonSense(content) {
  const tableMatch = content.match(/\|\s*\*\*反常识判断\*\*\s*\|\s*([^|]+?)\s*\|/);
  if (tableMatch) return cleanText(tableMatch[1]);
  const headingMatch = content.match(/(?:#{1,4}\s*)?(?:\*\*)?反常识判断(?:\*\*)?[：:]?\s*\n?\s*(.+?)(?:\n|$)/);
  if (headingMatch) return cleanText(headingMatch[1]);
  return void 0;
}
function cleanText(s) {
  return s.trim().replace(/\*\*/g, "").replace(/\s+/g, " ");
}
function extractSummary(fm, content) {
  if (typeof fm.summary === "string" && fm.summary.trim()) {
    return fm.summary.trim();
  }
  const bodyStart = content.indexOf("\n---\n");
  if (bodyStart === -1) return void 0;
  const body = content.slice(bodyStart + 5);
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#")) continue;
    if (t.startsWith(">")) continue;
    if (t.startsWith("|")) continue;
    if (t.startsWith("```")) continue;
    if (t.startsWith("---")) continue;
    return cleanText(t);
  }
  return void 0;
}

// packages/indexer/src/indexer.ts
function indexFile(filePath) {
  const db = getDb();
  const content = readFileSync(filePath, "utf-8");
  const stat = statSync(filePath);
  const mtime = Math.floor(stat.mtimeMs / 1e3);
  const hash = createHash("sha256").update(content).digest("hex");
  const existing = db.select().from(assets).where(eq(assets.filePath, filePath)).get();
  if (existing && existing.fileHash === hash) {
    return { action: "unchanged", record: existing };
  }
  const fm = parseFrontmatter(content);
  const type = normalizeType(typeof fm.type === "string" ? fm.type : null);
  const evidenceLevel = normalizeEvidenceLevel(typeof fm.evidence_level === "string" ? fm.evidence_level : null);
  const tags = normalizeTags(fm.tags);
  const source = typeof fm.source === "string" ? fm.source : void 0;
  const sourceType = inferSourceType(source);
  const title = typeof fm.title === "string" ? fm.title : basename(filePath, ".md");
  const oneSentenceInsight = extractOneSentenceInsight(content);
  const antiCommonSense = extractAntiCommonSense(content);
  const summary = extractSummary(fm, content);
  const now = Math.floor(Date.now() / 1e3);
  if (existing) {
    db.update(assets).set({
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
      updatedAt: now
      // 保留 status（不因为文件 mtime 变化就重置工作流状态）
      // 保留 evidenceLevel 的人工调整
      // 但如果文件的 evidenceLevel 升级了，且数据库没手动改过，则同步
    }).where(eq(assets.id, existing.id)).run();
    return { action: "updated", record: { ...existing, type, title, evidenceLevel, tagsJson: JSON.stringify(tags) } };
  } else {
    const id = `asset_${randomUUID().slice(0, 8)}`;
    const status = type === "asset" ? "in_use" : "candidate";
    const priority = "C";
    db.insert(assets).values({
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
      updatedAt: now
    }).run();
    return { action: "indexed", record: { id, type, title } };
  }
}
function indexVault(options = {}) {
  const vaultPath = options.vaultPath ?? process.env.INSIGHT_VAULT_PATH ?? "/Users/vincent/Documents/knowledge_base";
  const insightDir = resolve(vaultPath, "04_\u7BA1\u7406\u6D1E\u5BDF");
  if (!existsSync(insightDir)) {
    return {
      scanned: 0,
      indexed: 0,
      updated: 0,
      unchanged: 0,
      errors: [{ file: insightDir, error: "\u76EE\u5F55\u4E0D\u5B58\u5728" }]
    };
  }
  const files = readdirSync(insightDir).filter((f) => f.endsWith(".md") && f.startsWith("\u8D44\u4EA7\u5361_")).map((f) => join(insightDir, f));
  const result = {
    scanned: files.length,
    indexed: 0,
    updated: 0,
    unchanged: 0,
    errors: []
  };
  for (const file of files) {
    try {
      const r = indexFile(file);
      if (r.action === "indexed") result.indexed++;
      else if (r.action === "updated") result.updated++;
      else result.unchanged++;
    } catch (e) {
      result.errors.push({ file, error: e.message ?? String(e) });
    }
  }
  try {
    resolveRelatedLinks(insightDir);
  } catch (e) {
    result.errors.push({ file: "<resolveRelatedLinks>", error: e.message ?? String(e) });
  }
  return result;
}
function resolveRelatedLinks(insightDir) {
  const db = getDb();
  const allAssets = db.select({ id: assets.id, title: assets.title }).from(assets).all();
  const titleToId = /* @__PURE__ */ new Map();
  for (const a of allAssets) {
    const t = (a.title ?? "").trim();
    if (!t) continue;
    titleToId.set(t, a.id);
    titleToId.set(`\u8D44\u4EA7\u5361_${t}`, a.id);
  }
  function resolveId(needle) {
    if (!needle) return void 0;
    let id = titleToId.get(needle);
    if (id) return id;
    const stripped = needle.replace(/^资产卡_/, "");
    id = titleToId.get(stripped);
    if (id) return id;
    let bestKey = null;
    for (const k of titleToId.keys()) {
      if (k.startsWith(needle) || k.startsWith(stripped)) {
        if (!bestKey || k.length > bestKey.length) bestKey = k;
      }
    }
    if (bestKey) return titleToId.get(bestKey);
    return void 0;
  }
  const files = readdirSync(insightDir).filter((f) => f.endsWith(".md") && f.startsWith("\u8D44\u4EA7\u5361_"));
  for (const file of files) {
    const filePath = join(insightDir, file);
    const content = readFileSync(filePath, "utf-8");
    const fm = parseFrontmatter(content);
    const relatedRaw = fm.related;
    const self = db.select().from(assets).where(eq(assets.filePath, filePath)).get();
    if (!self) continue;
    const relatedIds = [];
    if (typeof relatedRaw === "string") {
      const names = relatedRaw.replace(/[\[\]]/g, " ").replace(/[【】]/g, " ").split(/[,,，、\n]/).map((s) => s.trim()).filter((s) => s.length > 0 && (s.startsWith("\u8D44\u4EA7\u5361_") || s.startsWith("\u5361\u7247_")));
      for (const n of names) {
        const id = resolveId(n);
        if (id && id !== self.id && !relatedIds.includes(id)) {
          relatedIds.push(id);
        }
      }
    } else if (Array.isArray(relatedRaw)) {
      for (const item of relatedRaw) {
        if (typeof item !== "string") continue;
        const id = resolveId(item.trim());
        if (id && id !== self.id && !relatedIds.includes(id)) {
          relatedIds.push(id);
        } else if (process.env.RELATED_DEBUG) {
          console.log(`[MISS] ${self.title} \u2192 ${item} (id=${id})`);
        }
      }
    }
    db.update(assets).set({ relatedIdsJson: JSON.stringify(relatedIds) }).where(eq(assets.id, self.id)).run();
  }
}
export {
  extractAntiCommonSense,
  extractOneSentenceInsight,
  extractSummary,
  indexFile,
  indexVault,
  parseFrontmatter
};
