/**
 * 写作风格配置系统 (L3 User Config Layer)
 *
 * 设计原则:
 *   - 配置文件: ~/.insight-os/writing-configs/{name}.yaml (YAML 格式,人类可读)
 *   - active preset 存到 AppConfig.writing.activePreset
 *   - 原子写: 写 .tmp → 备份 .bak → rename
 *   - 失败容错: 读 YAML 解析失败不抛异常,返回 null + log warn
 *
 * V1.1 阶段 A: MVP 版本,只支持 YAML 文件存储 + 5 维度 CRUD
 * V1.2 阶段 B: 加 UI(prototype/writing-config.html)+ L2 模板 + few-shot
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { getUserDataDir } from './config.js';

// ============================================
// 类型定义
// ============================================

export type OutputType = 'article_full' | 'speech' | 'book_note' | 'email';

export type Stance = 'neutral' | 'advisory' | 'critical' | 'coach';
export type Viewpoint = 'first' | 'second' | 'third' | 'mixed';
export type TermDensity = 'low' | 'medium' | 'high';
export type Rhythm = 'short' | 'mixed' | 'long';
export type RhetoricType = 'metaphor' | 'analogy' | 'rhetorical' | 'story' | 'data';
export type HeadingStyle = 'numbered-question' | 'question' | 'statement' | 'parallel';
export type CorePosition = 'title' | 'opening' | 'middle' | 'ending';
export type ArgumentPattern = 'total-detail-total' | 'progressive' | 'parallel' | 'contrast';
export type Ending = 'call-to-action' | 'quote' | 'open' | 'summary';
export type DataFidelity = 'strict' | 'loose' | 'none';

export interface StyleDimension {
  tone: number;                    // 0-100, 冷峻→温暖
  stance: Stance;
  persona: string;                 // 自由文本,如 "资深独立顾问"
  viewpoint: Viewpoint;
  termDensity: TermDensity;
  temperature: number;             // 0.0-1.0, LLM 采样温度
}

export interface SentenceDimension {
  rhythm: Rhythm;
  shortRatio: number;              // 0.0-1.0
  paragraphLength: number;         // 中文字数 40-400
  rhetoric: RhetoricType[];        // 多选
}

export interface StructureDimension {
  headingStyle: HeadingStyle;
  corePosition: CorePosition;
  argumentPattern: ArgumentPattern;
  sectionCount: number;            // 2-8
  ending: Ending;
}

export interface LengthDimension {
  targetWords: number;             // 300-10000
  sectionCount: number;            // 2-8, 与 structure.sectionCount 联动
  perSectionWords: number;         // 100-1500
  variants: number;                // 1-5
  keyQuotes: number;               // 0-10
}

export interface QualityDimension {
  citationLimit: number;           // 0-20
  bannedWords: string[];           // 禁用词列表
  dataFidelity: DataFidelity;
  aiTasteCheck: boolean;
  fewShotRefs: string[];           // 引用 outputs 表 id (V1.2 阶段)
}

export interface LLMParams {
  model: string;
  temperature: number;             // 0.0-1.0
  topP: number;                    // 0.0-1.0
}

export interface WritingConfig {
  name: string;
  outputType: OutputType;
  description?: string;
  forkedFrom: string | null;
  updatedAt: number;               // unix ms
  tags?: string[];                 // V1.2 D4: 标签（如 ["学术","短文","邮件"]）
  category?: string;               // V1.2 D4: 分类（如 "工作" / "个人" / "客户"）
  dimensions: {
    style: StyleDimension;
    sentence: SentenceDimension;
    structure: StructureDimension;
    length: LengthDimension;
    quality: QualityDimension;
  };
  llmParams: LLMParams;
}

export interface WritingConfigMeta {
  name: string;
  outputType: OutputType;
  description?: string;
  updatedAt: number;
  isSystem: boolean;               // 是否 ship-ready
  active: boolean;                 // 是否当前激活
  tags?: string[];                 // V1.2 D4
  category?: string;               // V1.2 D4
}

// ============================================
// 文件路径
// ============================================

/** 写作配置目录: ~/.insight-os/writing-configs/ */
export function getWritingConfigDir(): string {
  return join(getUserDataDir(), 'writing-configs');
}

/** 单个 preset 文件路径 */
function getPresetPath(name: string): string {
  return join(getWritingConfigDir(), `${name}.yaml`);
}

// ============================================
// 8 个核心 API
// ============================================

/**
 * 列所有 preset 的元信息（不读全文，减小 payload）
 */
export function listPresets(): WritingConfigMeta[] {
  const dir = getWritingConfigDir();
  if (!existsSync(dir)) return [];

  const activeName = getActivePresetName();
  const files = readdirSync(dir).filter(f => f.endsWith('.yaml'));

  const metas: WritingConfigMeta[] = [];
  for (const file of files) {
    const name = file.replace(/\.yaml$/, '');
    try {
      const content = readFileSync(join(dir, file), 'utf-8');
      const config = parseYaml(content) as WritingConfig;
      metas.push({
        name: config.name || name,
        outputType: config.outputType,
        description: config.description,
        updatedAt: config.updatedAt || 0,
        isSystem: name === 'vincent-standard' || name === 'client-comm' || name === 'academic',
        active: name === activeName,
        tags: config.tags,
        category: config.category,
      });
    } catch (e) {
      console.warn(`[writing-config] Failed to parse ${file}:`, e);
    }
  }
  // 按 updatedAt 倒序
  return metas.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 读单个 preset 全文
 */
export function readPreset(name: string): WritingConfig | null {
  const path = getPresetPath(name);
  if (!existsSync(path)) return null;
  try {
    const content = readFileSync(path, 'utf-8');
    return parseYaml(content) as WritingConfig;
  } catch (e) {
    console.warn(`[writing-config] Failed to read ${name}:`, e);
    return null;
  }
}

/**
 * 写 preset（原子写）
 */
export function writePreset(name: string, config: WritingConfig): { ok: boolean; warnings?: string[] } {
  const dir = getWritingConfigDir();
  mkdirSync(dir, { recursive: true });

  const filepath = getPresetPath(name);
  const tmpPath = `${filepath}.tmp`;
  const bakPath = `${filepath}.bak`;

  // 校验 + 冲突检测
  const warnings = validateConfig(config);

  // 1. 写 .tmp
  const yamlStr = stringifyYaml(config);
  writeFileSync(tmpPath, yamlStr, 'utf-8');

  // 2. 备份旧文件
  if (existsSync(filepath)) {
    try {
      copyFileSync(filepath, bakPath);
    } catch (e) {
      // 备份失败不阻塞主流程
    }
  }

  // 3. 原子重命名
  try {
    const { renameSync } = require('node:fs');
    renameSync(tmpPath, filepath);
  } catch (e: any) {
    return { ok: false, warnings: [...(warnings ?? []), `原子重命名失败: ${e.message}`] };
  }

  return warnings && warnings.length > 0 ? { ok: true, warnings } : { ok: true };
}

/**
 * 删除 preset（不能删 active 的）
 */
export function deletePreset(name: string): { ok: boolean; error?: string } {
  const activeName = getActivePresetName();
  if (name === activeName) {
    return { ok: false, error: '不能删除当前激活的 preset，请先切换到其他 preset' };
  }
  const filepath = getPresetPath(name);
  if (!existsSync(filepath)) {
    return { ok: false, error: `preset 不存在: ${name}` };
  }
  try {
    unlinkSync(filepath);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * 复制 preset
 */
export function duplicatePreset(srcName: string, newName: string): WritingConfig | null {
  const src = readPreset(srcName);
  if (!src) return null;
  const dup: WritingConfig = {
    ...src,
    name: newName,
    forkedFrom: srcName,
    updatedAt: Date.now(),
  };
  const result = writePreset(newName, dup);
  if (!result.ok) return null;
  return dup;
}

// ============================================
// Active preset（从 AppConfig 读）
// ============================================

import { readConfig, writeConfig } from './config.js';

/** 读 active preset 名（从 AppConfig.writing.activePreset） */
export function getActivePresetName(): string {
  const cfg = readConfig();
  return cfg.writing?.activePreset ?? 'vincent-standard';
}

/** 设 active preset */
export function setActivePreset(name: string): { ok: boolean; error?: string } {
  // 检查 preset 是否存在
  if (!existsSync(getPresetPath(name))) {
    return { ok: false, error: `preset 不存在: ${name}` };
  }
  const cfg = readConfig();
  writeConfig({ ...cfg, writing: { ...cfg.writing, activePreset: name }, lastUpdated: Date.now() });
  return { ok: true };
}

/** 读 active preset 全文（fallback 到 ship-ready） */
export function getActivePreset(): WritingConfig {
  const name = getActivePresetName();
  const config = readPreset(name);
  if (config) return config;
  // Fallback: 不存在时返回 vincent-standard 副本
  return getShippedPreset('vincent-standard');
}

// ============================================
// 导入 / 导出
// ============================================

/**
 * 导入 YAML 字符串
 */
export function importPreset(yamlStr: string, desiredName?: string): { ok: boolean; name?: string; warnings?: string[]; error?: string } {
  let config: WritingConfig;
  try {
    config = parseYaml(yamlStr) as WritingConfig;
  } catch (e: any) {
    return { ok: false, error: `YAML 解析失败: ${e.message}` };
  }

  if (!config.name) {
    return { ok: false, error: 'YAML 缺少 name 字段' };
  }

  // 重名检测
  let name = desiredName ?? config.name;
  if (existsSync(getPresetPath(name))) {
    let counter = 2;
    while (existsSync(getPresetPath(`${name}_${counter}`))) {
      counter += 1;
      if (counter > 100) {
        return { ok: false, error: `重名自动加后缀失败: ${name}` };
      }
    }
    name = `${name}_${counter}`;
  }

  config.name = name;
  config.updatedAt = Date.now();

  const result = writePreset(name, config);
  if (!result.ok) {
    return { ok: false, error: '写入失败' };
  }
  return { ok: true, name, warnings: result.warnings };
}

/**
 * 导出为 YAML 字符串
 */
export function exportPreset(name: string, options: { includeLLMParams?: boolean; includeFewShot?: boolean } = {}): { yaml?: string; filename?: string; error?: string } {
  const config = readPreset(name);
  if (!config) return { error: `preset 不存在: ${name}` };

  const out: any = { ...config };
  if (options.includeLLMParams === false) {
    delete out.llmParams;
  }
  if (options.includeFewShot === false) {
    out.dimensions.quality = { ...out.dimensions.quality, fewShotRefs: [] };
  }

  return {
    yaml: stringifyYaml(out),
    filename: `${name}.yaml`,
  };
}

// ============================================
// 校验 + 冲突检测
// ============================================

/**
 * 校验 config + 返回 warnings（非阻塞）
 */
export function validateConfig(config: WritingConfig): string[] {
  const warnings: string[] = [];

  // 基础范围
  if (config.dimensions.style.tone < 0 || config.dimensions.style.tone > 100) {
    warnings.push('tone 必须在 0-100 之间');
  }
  if (config.dimensions.sentence.shortRatio < 0 || config.dimensions.sentence.shortRatio > 1) {
    warnings.push('shortRatio 必须在 0-1 之间');
  }
  if (config.dimensions.length.targetWords < 300 || config.dimensions.length.targetWords > 10000) {
    warnings.push('targetWords 建议 300-10000 字');
  }

  // 冲突检测
  if (config.dimensions.sentence.shortRatio > 0.7 && config.dimensions.sentence.paragraphLength > 200) {
    warnings.push('短句比 > 70% 与段落 > 200 字难以同时满足，建议调整其一');
  }
  if (config.dimensions.style.stance === 'critical' && config.dimensions.style.tone < 30) {
    warnings.push('批判立场 + 冷峻语气可能让文章过于尖刻，建议至少提到 30+ 温暖');
  }
  if (config.dimensions.length.targetWords < config.dimensions.length.perSectionWords * config.dimensions.length.sectionCount * 0.5) {
    warnings.push('总字数 < 章节数 × 单章字数 × 50%，LLM 可能写不满');
  }

  return warnings;
}

// ============================================
// Ship-Ready 预设 (内置)
// ============================================

import { PRESET_VINCENT_STANDARD, PRESET_CLIENT_COMM, PRESET_ACADEMIC } from './writing-presets.js';

/**
 * 拿一个 ship-ready preset 副本（深拷贝，不写盘）
 */
export function getShippedPreset(name: 'vincent-standard' | 'client-comm' | 'academic'): WritingConfig {
  const preset = name === 'vincent-standard' ? PRESET_VINCENT_STANDARD
               : name === 'client-comm' ? PRESET_CLIENT_COMM
               : PRESET_ACADEMIC;
  return JSON.parse(JSON.stringify(preset)) as WritingConfig;
}

/**
 * 首次启动：把 3 套 ship-ready preset 写入磁盘（如果不存在）
 */
export function ensureShippedPresets(): void {
  const dir = getWritingConfigDir();
  mkdirSync(dir, { recursive: true });

  const shipReady = [
    { name: 'vincent-standard', preset: PRESET_VINCENT_STANDARD },
    { name: 'client-comm', preset: PRESET_CLIENT_COMM },
    { name: 'academic', preset: PRESET_ACADEMIC },
  ] as const;

  for (const { name, preset } of shipReady) {
    const path = getPresetPath(name);
    if (!existsSync(path)) {
      try {
        writeFileSync(path, stringifyYaml(preset), 'utf-8');
        console.log(`[writing-config] Shipped preset created: ${name}`);
      } catch (e: any) {
        console.error(`[writing-config] Failed to write ${name}:`, e.message);
      }
    }
  }
}

// ============================================
// V1.2 阶段 B：风格迁移 + 版本控制 / diff
// ============================================

/**
 * 风格迁移（深度版）：从多个 src preset 拉取维度
 *
 * 用法：
 *   const newConfig = migrateDimensionsMulti({
 *     dst: 'vincent-standard',
 *     sources: {
 *       'academic': { style: true, sentence: true },
 *       'client-comm': { quality: ['bannedWords', 'citationLimit'] },
 *     }
 *   });
 */
export function migrateDimensionsMulti(input: {
  dst: string;
  sources: Record<string, {
    style?: boolean | string[];
    sentence?: boolean | string[];
    structure?: boolean | string[];
    length?: boolean | string[];
    quality?: boolean | string[];
  }>;
}): WritingConfig | null {
  const dst = readPreset(input.dst);
  if (!dst) return null;

  const merged: WritingConfig = JSON.parse(JSON.stringify(dst));
  const sourceContributions: Record<string, string[]> = {};

  for (const [srcName, fields] of Object.entries(input.sources)) {
    const src = readPreset(srcName);
    if (!src) continue;

    sourceContributions[srcName] = [];

    for (const dim of ['style', 'sentence', 'structure', 'length', 'quality'] as const) {
      const field = fields[dim];
      if (!field) continue;

      if (field === true) {
        // 拉取整个维度
        (merged.dimensions as any)[dim] = JSON.parse(JSON.stringify((src.dimensions as any)[dim]));
        sourceContributions[srcName].push(`${dim}(full)`);
      } else if (Array.isArray(field)) {
        // 拉取指定字段
        const srcDim = (src.dimensions as any)[dim];
        const dstDim = (merged.dimensions as any)[dim];
        for (const f of field) {
          if (f in srcDim) {
            dstDim[f] = JSON.parse(JSON.stringify(srcDim[f]));
            sourceContributions[srcName].push(`${dim}.${f}`);
          }
        }
      }
    }
  }

  merged.updatedAt = Date.now();
  merged.forkedFrom = input.dst;
  // 把贡献信息写到 description
  const sourcesDesc = Object.entries(sourceContributions)
    .map(([name, contribs]) => `${name}：${contribs.join(', ')}`)
    .join(' | ');
  merged.description = `混合自 [${input.dst}] + ${sourcesDesc}`;

  return merged;
}

/**
 * 风格迁移：从 src preset 拉取某些维度，覆盖到 dst preset（向后兼容旧 API）
 *
 * 用法：
 *   const newConfig = migrateDimensions(srcName, dstName, {
 *     style: true,           // 拉取 src 的整个 style 维度
 *     sentence: ['rhythm', 'shortRatio'],  // 拉取 src 的 sentence 维度部分字段
 *   });
 */
export function migrateDimensions(
  srcName: string,
  dstName: string,
  fields: {
    style?: boolean | string[];
    sentence?: boolean | string[];
    structure?: boolean | string[];
    length?: boolean | string[];
    quality?: boolean | string[];
  }
): WritingConfig | null {
  return migrateDimensionsMulti({
    dst: dstName,
    sources: { [srcName]: fields },
  });
}

/**
 * 列出 preset 的所有历史版本（.bak 文件）
 */
export function listPresetHistory(name: string): Array<{
  version: number;          // 自增版本号（按时间排序）
  timestamp: number;        // 备份时间（用文件 mtime）
  size: number;             // 字节数
}> {
  const dir = getWritingConfigDir();
  const currentPath = getPresetPath(name);
  if (!existsSync(currentPath)) return [];

  // 匹配 {name}.yaml.bak 或 {name}.yaml.bak.{timestamp}
  const bakPattern = new RegExp(`^${escapeRegex(name)}\\.yaml\\.bak(\\.\\d+)?$`);
  const files = readdirSync(dir).filter(f => bakPattern.test(f));

  const history = files.map(f => {
    const match = f.match(bakPattern);
    const tsPart = match?.[1]?.replace(/^\./, '') ?? '';
    const ts = tsPart ? parseInt(tsPart) : 0;
    const path = join(dir, f);
    const stat = existsSync(path) ? require('node:fs').statSync(path) : null;
    // 没 timestamp 后缀的（无后缀 .bak）用文件 mtime
    const finalTs = ts || stat?.mtimeMs || 0;
    return {
      timestamp: finalTs,
      size: stat?.size ?? 0,
      filePath: path,
    };
  }).sort((a, b) => b.timestamp - a.timestamp);

  // 加当前版本（最新）
  const currentStat = require('node:fs').statSync(currentPath);
  history.unshift({
    timestamp: currentStat.mtimeMs,
    size: currentStat.size,
    filePath: currentPath,
  });

  // 加 version 编号（1 = 最新）
  return history.map((h, i) => ({
    version: i + 1,
    timestamp: h.timestamp,
    size: h.size,
  }));
}

/**
 * 读指定版本的内容（用时间戳定位）
 */
export function readPresetVersion(name: string, timestamp: number): WritingConfig | null {
  const dir = getWritingConfigDir();
  const currentPath = getPresetPath(name);

  if (!existsSync(currentPath)) return null;

  // 匹配 {name}.yaml.bak 或 {name}.yaml.bak.{timestamp}
  const bakPattern = new RegExp(`^${escapeRegex(name)}\\.yaml\\.bak(\\.\\d+)?$`);
  const files = readdirSync(dir).filter(f => bakPattern.test(f));

  // 当前版本
  const currentStat = require('node:fs').statSync(currentPath);
  if (Math.abs(currentStat.mtimeMs - timestamp) < 1000) {
    const content = readFileSync(currentPath, 'utf-8');
    return parseYaml(content) as WritingConfig;
  }

  // 找 .bak 中 mtime 最接近的
  let bestPath: string | null = null;
  let bestDiff = Infinity;
  for (const f of files) {
    const path = join(dir, f);
    const stat = require('node:fs').statSync(path);
    const diff = Math.abs(stat.mtimeMs - timestamp);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestPath = path;
    }
  }

  if (bestPath) {
    const content = readFileSync(bestPath, 'utf-8');
    return parseYaml(content) as WritingConfig;
  }
  return null;
}

/**
 * 列出文件系统中所有 preset 的所有 .bak 文件路径
 * (内部 helper)
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// V1.2 阶段 B：每次写入都保留 .bak（覆盖原 writePreset）
// ============================================

/** 增强版 writePreset：自动保留历史版本 .bak（最近 5 个） */
export function writePresetWithHistory(name: string, config: WritingConfig): { ok: boolean; warnings?: string[]; bakCreated?: string } {
  const filepath = getPresetPath(name);

  // 1. 备份现有文件（如果有）→ .bak.{timestamp}
  if (existsSync(filepath)) {
    try {
      const timestamp = Date.now();
      const bakPath = `${filepath}.bak.${timestamp}`;
      copyFileSync(filepath, bakPath);

      // 清理旧 .bak：只保留最近 5 个
      cleanupOldBackups(name);
    } catch (e) {
      // 备份失败不阻塞
    }
  }

  // 2. 调用原 writePreset
  const result = writePreset(name, config);
  return result;
}

/** 清理旧 .bak，只保留最近 5 个 */
function cleanupOldBackups(name: string): void {
  const dir = getWritingConfigDir();
  const pattern = new RegExp(`^${escapeRegex(name)}\\.yaml\\.bak(\\.\\d+)?$`);
  const files = readdirSync(dir)
    .filter(f => pattern.test(f))
    .map(f => {
      const match = f.match(pattern);
      const tsPart = match?.[1]?.replace(/^\./, '') ?? '';
      const ts = tsPart ? parseInt(tsPart) : 0;
      return { name: f, ts, path: join(dir, f) };
    })
    .sort((a, b) => b.ts - a.ts);

  // 保留前 5，删剩下的
  for (const f of files.slice(5)) {
    try {
      unlinkSync(f.path);
    } catch { /* ignore */ }
  }
}
