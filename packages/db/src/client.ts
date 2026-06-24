/**
 * SQLite 客户端（better-sqlite3 + Drizzle）
 *
 * 数据库位置：./storage/insight.db（相对于 apps/web 运行时）
 * v0.1 用同步的 better-sqlite3，单用户本地使用够用
 *
 * 启动时自动建表（如果表不存在）—— 单用户本地应用不需要 migrate
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.ts';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;
let _initialized = false;

/**
 * 解析数据库路径
 * 优先级：
 *   1. 环境变量 DATABASE_URL (file:xxx)
 *   2. 环境变量 INSIGHT_APP_DATA_DIR/insight.db（v1.1.1+ 桌面 app，强制写到 userData）
 *   3. 已有 db 文件位置（apps/web/storage 或 ./storage）— 兼容 web dev
 *   4. fallback：app userData（packaged 模式）或 apps/web/storage（web dev）
 *
 * v1.1.1 修复：
 * v1.0 / v1.1.0 packaged 模式 fall back 到 cwd 下，结果 db 写到 .app bundle 内，
 * 升级 .app 时老 bundle 被删，老 db 跟着没。
 * 修法：packaged 模式 fallback 用 process.env.HOME（macOS 兜底到 ~/Library/Application Support/），
 * 实际由 main.js 设的 INSIGHT_APP_DATA_DIR 决定。
 */
function resolveDbPath(): string {
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith('file:')) {
    return resolve(url.slice(5));
  }

  // v1.1.1+ 桌面 app 模式：app data 目录（userData）
  if (process.env.INSIGHT_APP_DATA_DIR) {
    return resolve(process.env.INSIGHT_APP_DATA_DIR, 'insight.db');
  }

  const cwd = process.cwd();
  // 检查 cwd 下的候选（兼容 web dev / 脚本 / 旧 v1.0-v1.1.0 packaged 残留）
  const candidates = [
    resolve(cwd, 'apps/web/storage/insight.db'),      // 脚本环境：cwd=根，要走 apps/web
    resolve(cwd, 'storage/insight.db'),               // Next.js dev：cwd=apps/web，走 ./storage
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // 兜底：packaged 模式用 userData（Electron app.getPath('userData')），
  // 其他场景（web dev / 脚本）用第一个候选（apps/web/storage/）
  if (process.env.NODE_ENV === 'production' && process.resourcesPath) {
    // packaged Electron：cwd 在 .app bundle 内，绝对不能写 .app bundle
    // 兜底到 HOME（实际由 main.js 设 INSIGHT_APP_DATA_DIR 决定）
    const home = process.env.HOME || '/tmp';
    return resolve(home, 'Library', 'Application Support', 'insight-os-desktop', 'storage', 'insight.db');
  }

  return candidates[0];
}

/**
 * 建表 SQL（手写，不用 drizzle-kit）
 * 这样省一个构建步骤，应用启动自动建表
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'light',
  status TEXT NOT NULL DEFAULT 'inbox',
  title TEXT NOT NULL,
  evidence_level TEXT NOT NULL DEFAULT 'E0',
  priority TEXT DEFAULT 'C',
  tags_json TEXT NOT NULL DEFAULT '[]',
  source TEXT,
  source_type TEXT DEFAULT 'unknown',
  one_sentence_insight TEXT,
  anti_common_sense TEXT,
  file_path TEXT NOT NULL,
  file_mtime INTEGER NOT NULL,
  file_hash TEXT NOT NULL,
  feedback_count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  related_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS assets_status_idx ON assets(status);
CREATE INDEX IF NOT EXISTS assets_type_idx ON assets(type);
CREATE INDEX IF NOT EXISTS assets_evidence_idx ON assets(evidence_level);
CREATE INDEX IF NOT EXISTS assets_updated_idx ON assets(updated_at);

CREATE TABLE IF NOT EXISTS outputs (
  id TEXT PRIMARY KEY,
  asset_ids_json TEXT NOT NULL,
  output_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scaffold_json TEXT,
  template_type TEXT,
  source_url TEXT,
  topic_id TEXT,
  writing_status TEXT DEFAULT 'published',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS outputs_asset_ids_idx ON outputs(asset_ids_json);
CREATE INDEX IF NOT EXISTS outputs_created_idx ON outputs(created_at);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  output_id TEXT,
  asset_id TEXT NOT NULL,
  scene TEXT NOT NULL,
  reaction TEXT,
  most_touched_point TEXT,
  follow_up_questions TEXT,
  evidence_level_before TEXT,
  evidence_level_after TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_asset_idx ON feedback(asset_id);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON feedback(created_at);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  core_beliefs_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS topics_slug_idx ON topics(slug);

CREATE TABLE IF NOT EXISTS asset_topics (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 100,
  assigned_by TEXT NOT NULL DEFAULT 'human',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS asset_topics_asset_idx ON asset_topics(asset_id);
CREATE INDEX IF NOT EXISTS asset_topics_topic_idx ON asset_topics(topic_id);

-- ===== v0.8 主题思想内核 =====
-- 一主题一 kernel：LLM 从主题下所有资产卡总结 headline + summary + 3-5 个核心判断
CREATE TABLE IF NOT EXISTS topic_kernels (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL UNIQUE,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  core_beliefs_json TEXT NOT NULL DEFAULT '[]',
  source_asset_ids_json TEXT NOT NULL DEFAULT '[]',
  generated_at INTEGER NOT NULL,
  generation_model TEXT
);

CREATE INDEX IF NOT EXISTS topic_kernels_topic_idx ON topic_kernels(topic_id);

-- ===== v1.4 Insight Kernel 用户判断协议 =====
-- 用户级的「判断宪法」：每次 LLM 调用自动注入 system prompt
-- 4 类别（belief/contrarian/expertise/challenge）+ 4 字段（content/confidence/counterExample/scope）
-- 6 条 ship-ready 默认由 /api/kernel/seed-default 种子
CREATE TABLE IF NOT EXISTS user_kernels (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('belief','contrarian','expertise','challenge')),
  kind TEXT NOT NULL DEFAULT 'belief' CHECK(kind IN ('belief','hypothesis','experience','contrarian')),
  content TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 70,
  counter_example TEXT,
  scope TEXT,
  evidence_asset_ids_json TEXT NOT NULL DEFAULT '[]',
  referenced_count INTEGER NOT NULL DEFAULT 0,
  last_verified_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS user_kernels_category_idx ON user_kernels(category);
CREATE INDEX IF NOT EXISTS user_kernels_status_idx ON user_kernels(status);

-- ===== writing_drafts + writing_versions v1.5 写作草稿自动恢复 + 版本历史 =====
CREATE TABLE IF NOT EXISTS writing_drafts (
  id TEXT PRIMARY KEY,
  writing_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  title TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS writing_drafts_writing_idx ON writing_drafts(writing_id);

CREATE TABLE IF NOT EXISTS writing_versions (
  id TEXT PRIMARY KEY,
  writing_id TEXT NOT NULL,
  content TEXT NOT NULL,
  title TEXT,
  note TEXT,
  created_by TEXT NOT NULL DEFAULT 'manual',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS writing_versions_writing_idx ON writing_versions(writing_id, created_at);

-- ===== 全文搜索（FTS5）v0.3 =====
-- 同步 assets 的 title / insight / anti / tags
-- 客户端写时不需要手动调 FTS，trigger 自动同步
CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
  asset_id UNINDEXED,
  title,
  one_sentence_insight,
  anti_common_sense,
  tags,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- 插入同步
CREATE TRIGGER IF NOT EXISTS assets_ai_fts AFTER INSERT ON assets BEGIN
  INSERT INTO assets_fts(asset_id, title, one_sentence_insight, anti_common_sense, tags)
  VALUES (NEW.id, COALESCE(NEW.title, ''), COALESCE(NEW.one_sentence_insight, ''), COALESCE(NEW.anti_common_sense, ''), COALESCE(NEW.tags_json, ''));
END;

-- 更新同步
CREATE TRIGGER IF NOT EXISTS assets_au_fts AFTER UPDATE ON assets BEGIN
  UPDATE assets_fts SET
    title = COALESCE(NEW.title, ''),
    one_sentence_insight = COALESCE(NEW.one_sentence_insight, ''),
    anti_common_sense = COALESCE(NEW.anti_common_sense, ''),
    tags = COALESCE(NEW.tags_json, '')
  WHERE asset_id = OLD.id;
END;

-- 删除同步
CREATE TRIGGER IF NOT EXISTS assets_ad_fts AFTER DELETE ON assets BEGIN
  DELETE FROM assets_fts WHERE asset_id = OLD.id;
END;
`;

/**
 * 初始化数据库（建表 + 索引）
 * 只跑一次，后续调用 noop
 */
function initSchema(sqlite: Database.Database) {
  if (_initialized) return;
  sqlite.exec(SCHEMA_SQL);

  // 兼容旧库：补加 v0.5 + v0.9 的新字段（如果不存在）
  try {
    const assetsCols = sqlite.prepare("PRAGMA table_info(assets)").all() as { name: string }[];
    if (!assetsCols.some(c => c.name === 'related_ids_json')) {
      sqlite.exec("ALTER TABLE assets ADD COLUMN related_ids_json TEXT NOT NULL DEFAULT '[]'");
    }
    // v0.9 写作场景：outputs 表加 5 个字段
    const outputsCols = sqlite.prepare("PRAGMA table_info(outputs)").all() as { name: string }[];
    const addCol = (col: string, def: string) => {
      if (!outputsCols.some(c => c.name === col)) {
        sqlite.exec(`ALTER TABLE outputs ADD COLUMN ${col} ${def}`);
      }
    };
    addCol('scaffold_json', 'TEXT');
    addCol('template_type', 'TEXT');
    addCol('source_url', 'TEXT');
    addCol('topic_id', 'TEXT');
    addCol('writing_status', "TEXT DEFAULT 'published'");
    // writing 输出索引
    sqlite.exec("CREATE INDEX IF NOT EXISTS outputs_topic_idx ON outputs(topic_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS outputs_writing_status_idx ON outputs(writing_status)");
  } catch (e) {
    // 表刚建好，PRAGMA 也读不到，忽略
  }

  // FTS backfill：如果 FTS 表空但 assets 有数据 → 重建
  const ftsCount = sqlite.prepare('SELECT count(*) as n FROM assets_fts').get() as { n: number };
  const assetCount = sqlite.prepare('SELECT count(*) as n FROM assets').get() as { n: number };
  if (ftsCount.n === 0 && assetCount.n > 0) {
    sqlite.exec(`
      INSERT INTO assets_fts(asset_id, title, one_sentence_insight, anti_common_sense, tags)
      SELECT id, COALESCE(title, ''), COALESCE(one_sentence_insight, ''), COALESCE(anti_common_sense, ''), COALESCE(tags_json, '')
      FROM assets;
    `);
  }

  _initialized = true;
}

export function getDb() {
  if (_db) return _db;

  const dbPath = resolveDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  _sqlite = new Database(dbPath);
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.pragma('foreign_keys = ON');

  // 自动建表（首次启动时执行）
  initSchema(_sqlite);

  _db = drizzle(_sqlite, { schema });
  return _db;
}

export function getRawSqlite(): Database.Database {
  if (!_sqlite) {
    getDb();
  }
  return _sqlite!;
}

/**
 * 关闭连接（测试用）
 */
export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
    _initialized = false;
  }
}
