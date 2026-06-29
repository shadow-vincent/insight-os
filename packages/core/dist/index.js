var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// packages/core/src/normalize.ts
var TYPE_MAP = {
  // 当前主用（也兼容历史）
  management_insight: "asset",
  \u7BA1\u7406\u6D1E\u5BDF\u8D44\u4EA7\u5361: "asset",
  "insight-card": "asset",
  management_insight_asset: "asset",
  insight: "asset",
  // 未来扩展
  light_card: "light",
  light: "light",
  kernel: "kernel",
  "core_belief": "kernel"
};
function normalizeType(raw) {
  if (!raw) return "asset";
  const key = raw.trim().toLowerCase();
  if (TYPE_MAP[key]) return TYPE_MAP[key];
  return "asset";
}
function normalizeTags(raw) {
  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
var EVIDENCE_LEVELS = ["E0", "E1", "E2", "E3", "E4", "E5"];
function normalizeEvidenceLevel(raw) {
  if (!raw) return "E0";
  const upper = raw.trim().toUpperCase();
  if (EVIDENCE_LEVELS.includes(upper)) {
    return upper;
  }
  return "E0";
}
var MATURITY_MAP = {
  \u53EF\u7528: "available",
  \u5F85\u9A8C\u8BC1: "pending",
  \u8349\u7A3F: "draft",
  available: "available",
  pending: "pending",
  draft: "draft"
};
function normalizeMaturity(raw) {
  if (!raw) return "unknown";
  return MATURITY_MAP[raw.trim()] ?? "unknown";
}
function inferSourceType(raw) {
  if (!raw) return "unknown";
  const s = raw.trim();
  if (s.includes("insight-pipeline") || s.includes("\u2192") || s.startsWith("\u77E5\u8BC6\u5361\u7247")) {
    return "knowledge_card";
  }
  if (s.startsWith("\u539F\u521B")) return "original";
  if (s.endsWith(".pdf") || s.includes("\u65B9\u6848") || s.includes("\u62A5\u544A")) {
    return "project";
  }
  if (s.startsWith("http") || s.includes("\u516C\u4F17\u53F7") || s.includes("blog")) {
    return "article";
  }
  return "book";
}

// packages/core/src/config.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
var DEFAULT_CONFIG = {
  llm: {
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.minimax.chat/v1",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "MiniMax-M2.7",
    enabled: false
  },
  paths: {
    vaultPath: process.env.INSIGHT_VAULT_PATH ?? `${process.env.HOME ?? ""}/Documents/knowledge_base`
  },
  writing: {
    activePreset: "vincent-standard"
  },
  lastUpdated: 0
};
function getUserDataDir() {
  if (process.env.INSIGHT_USER_DATA_DIR) {
    return process.env.INSIGHT_USER_DATA_DIR;
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";
  if (process.platform === "darwin") {
    return `${home}/Library/Application Support/InsightOS`;
  } else if (process.platform === "win32") {
    return `${process.env.APPDATA ?? home}\\InsightOS`;
  } else {
    return `${home}/.local/share/insightos`;
  }
}
function getLegacyConfigPaths() {
  return [
    // 旧 Tauri 时代的 config
    `${process.env.HOME ?? ""}/Library/Application Support/com.vincent.enterprise-insight/config.json`,
    // web dev 默认路径
    resolve(process.cwd(), "storage/config.json"),
    // packaged .app 内部路径
    resolve(process.cwd(), "../storage/config.json")
  ];
}
function resolveConfigPath() {
  if (process.env.INSIGHT_CONFIG_PATH) {
    return resolve(process.env.INSIGHT_CONFIG_PATH);
  }
  return resolve(getUserDataDir(), "config.json");
}
function migrateLegacyConfigIfNeeded(targetPath) {
  if (existsSync(targetPath)) return;
  for (const legacyPath of getLegacyConfigPaths()) {
    if (existsSync(legacyPath)) {
      try {
        mkdirSync(dirname(targetPath), { recursive: true });
        copyFileSync(legacyPath, targetPath);
        console.log(`[config] Migrated legacy config from ${legacyPath} to ${targetPath}`);
        return;
      } catch (e) {
        console.warn(`[config] Failed to migrate from ${legacyPath}: ${e.message}`);
      }
    }
  }
}
function readConfig() {
  const path = resolveConfigPath();
  migrateLegacyConfigIfNeeded(path);
  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      llm: { ...DEFAULT_CONFIG.llm, ...parsed.llm },
      paths: { ...DEFAULT_CONFIG.paths, ...parsed.paths },
      writing: { ...DEFAULT_CONFIG.writing, ...parsed.writing ?? {} },
      userGoal: parsed.userGoal ?? null,
      preferences: {
        llmTemperature: parsed.preferences?.llmTemperature ?? 0.5,
        articleLength: parsed.preferences?.articleLength ?? "deep",
        rsshubBase: parsed.preferences?.rsshubBase ?? "https://rsshub.app"
      },
      lastUpdated: parsed.lastUpdated ?? 0
    };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}
function writeConfig(config) {
  const path = resolveConfigPath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  config.lastUpdated = Date.now();
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}
function updateConfig(partial) {
  const current = readConfig();
  const updated = {
    llm: { ...current.llm, ...partial.llm ?? {} },
    paths: { ...current.paths, ...partial.paths ?? {} },
    writing: { ...current.writing, ...partial.writing ?? {} },
    userGoal: partial.userGoal !== void 0 ? partial.userGoal : current.userGoal ?? null,
    preferences: {
      ...current.preferences ?? { llmTemperature: 0.5, articleLength: "deep" },
      ...partial.preferences ?? {}
    },
    lastUpdated: Date.now()
  };
  writeConfig(updated);
  return updated;
}
function isPlaceholderApiKey(key) {
  if (!key) return true;
  const PLACEHOLDERS = ["sk-placeholder", "sk-test-demo", "sk-demo", "sk-xxx"];
  return PLACEHOLDERS.includes(key) || key.startsWith("sk-xxx");
}
function maskApiKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}
function sanitize(config) {
  const isConfigured = !!config.llm.apiKey && !isPlaceholderApiKey(config.llm.apiKey);
  return {
    llm: {
      baseUrl: config.llm.baseUrl,
      apiKeyMasked: maskApiKey(config.llm.apiKey),
      apiKeyConfigured: isConfigured,
      model: config.llm.model,
      enabled: config.llm.enabled
    },
    paths: {
      vaultPath: config.paths.vaultPath
    },
    writing: config.writing,
    userGoal: config.userGoal ?? null,
    preferences: {
      llmTemperature: config.preferences?.llmTemperature ?? 0.5,
      articleLength: config.preferences?.articleLength ?? "deep",
      rsshubBase: config.preferences?.rsshubBase ?? "https://rsshub.app"
    },
    lastUpdated: config.lastUpdated
  };
}
function isLLMConfigured() {
  const c = readConfig();
  return !!c.llm.apiKey;
}
function getDefaultAppDataDir() {
  return getUserDataDir();
}

// packages/core/src/writing-config.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, existsSync as existsSync2, mkdirSync as mkdirSync2, copyFileSync as copyFileSync2, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

// packages/core/src/writing-presets.ts
var PRESET_VINCENT_STANDARD = {
  name: "vincent-standard",
  outputType: "article_full",
  description: "\u4E13\u4E1A\u987E\u95EE\u7684\u5BF9\u5916\u53D1\u58F0 \xB7 \u516C\u4F17\u53F7\u957F\u6587 \xB7 \u504F\u89C2\u70B9\u8F93\u51FA",
  forkedFrom: null,
  updatedAt: 1719e9,
  // 首次 ship 时间
  dimensions: {
    style: {
      tone: 70,
      stance: "advisory",
      persona: "\u8D44\u6DF1\u72EC\u7ACB\u987E\u95EE",
      viewpoint: "second",
      termDensity: "medium",
      temperature: 0.6
    },
    sentence: {
      rhythm: "mixed",
      shortRatio: 0.4,
      paragraphLength: 120,
      rhetoric: ["analogy", "rhetorical"]
    },
    structure: {
      headingStyle: "numbered-question",
      corePosition: "opening",
      argumentPattern: "total-detail-total",
      sectionCount: 5,
      ending: "call-to-action"
    },
    length: {
      targetWords: 2500,
      sectionCount: 5,
      perSectionWords: 500,
      variants: 1,
      keyQuotes: 3
    },
    quality: {
      citationLimit: 5,
      bannedWords: ["\u8D4B\u80FD", "\u6293\u624B", "\u95ED\u73AF", "\u5BF9\u9F50", "\u6253\u901A", "\u9897\u7C92\u5EA6", "\u5E95\u5C42\u903B\u8F91"],
      dataFidelity: "strict",
      aiTasteCheck: true,
      fewShotRefs: []
    }
  },
  llmParams: {
    model: "deepseek-chat",
    temperature: 0.6,
    topP: 0.9
  }
};
var PRESET_CLIENT_COMM = {
  name: "client-comm",
  outputType: "email",
  description: "\u6E29\u548C\xB7\u53D9\u4E8B\u5316\xB7\u90AE\u4EF6 / \u7B80\u77ED\u62A5\u544A",
  forkedFrom: "vincent-standard",
  updatedAt: 1719e9,
  dimensions: {
    style: {
      tone: 80,
      stance: "advisory",
      persona: "\u8D44\u6DF1\u72EC\u7ACB\u987E\u95EE",
      viewpoint: "second",
      termDensity: "low",
      temperature: 0.5
    },
    sentence: {
      rhythm: "short",
      shortRatio: 0.7,
      paragraphLength: 80,
      rhetoric: ["analogy", "story"]
    },
    structure: {
      headingStyle: "statement",
      corePosition: "opening",
      argumentPattern: "total-detail-total",
      sectionCount: 3,
      ending: "summary"
    },
    length: {
      targetWords: 800,
      sectionCount: 3,
      perSectionWords: 250,
      variants: 1,
      keyQuotes: 1
    },
    quality: {
      citationLimit: 2,
      bannedWords: ["\u8D4B\u80FD", "\u6293\u624B", "\u95ED\u73AF"],
      dataFidelity: "loose",
      aiTasteCheck: true,
      fewShotRefs: []
    }
  },
  llmParams: {
    model: "deepseek-chat",
    temperature: 0.5,
    topP: 0.9
  }
};
var PRESET_ACADEMIC = {
  name: "academic",
  outputType: "article_full",
  description: "\u4E25\u8C28\xB7\u6570\u636E\u9A71\u52A8\xB7\u8BBA\u6587 / \u7814\u7A76\u62A5\u544A",
  forkedFrom: "vincent-standard",
  updatedAt: 1719e9,
  dimensions: {
    style: {
      tone: 30,
      stance: "neutral",
      persona: "\u7814\u7A76\u5458",
      viewpoint: "third",
      termDensity: "high",
      temperature: 0.3
    },
    sentence: {
      rhythm: "long",
      shortRatio: 0.2,
      paragraphLength: 200,
      rhetoric: ["data", "metaphor"]
    },
    structure: {
      headingStyle: "numbered-question",
      corePosition: "opening",
      argumentPattern: "progressive",
      sectionCount: 6,
      ending: "summary"
    },
    length: {
      targetWords: 4e3,
      sectionCount: 6,
      perSectionWords: 650,
      variants: 1,
      keyQuotes: 2
    },
    quality: {
      citationLimit: 15,
      bannedWords: ["\u8D4B\u80FD", "\u6293\u624B"],
      dataFidelity: "strict",
      aiTasteCheck: true,
      fewShotRefs: []
    }
  },
  llmParams: {
    model: "deepseek-chat",
    temperature: 0.3,
    topP: 0.85
  }
};
var SHIP_READY_PRESETS = [
  PRESET_VINCENT_STANDARD,
  PRESET_CLIENT_COMM,
  PRESET_ACADEMIC
];

// packages/core/src/writing-config.ts
function getWritingConfigDir() {
  return join(getUserDataDir(), "writing-configs");
}
function getPresetPath(name) {
  return join(getWritingConfigDir(), `${name}.yaml`);
}
function listPresets() {
  const dir = getWritingConfigDir();
  if (!existsSync2(dir)) return [];
  const activeName = getActivePresetName();
  const files = readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  const metas = [];
  for (const file of files) {
    const name = file.replace(/\.yaml$/, "");
    try {
      const content = readFileSync2(join(dir, file), "utf-8");
      const config = parseYaml(content);
      metas.push({
        name: config.name || name,
        outputType: config.outputType,
        description: config.description,
        updatedAt: config.updatedAt || 0,
        isSystem: name === "vincent-standard" || name === "client-comm" || name === "academic",
        active: name === activeName,
        tags: config.tags,
        category: config.category
      });
    } catch (e) {
      console.warn(`[writing-config] Failed to parse ${file}:`, e);
    }
  }
  return metas.sort((a, b) => b.updatedAt - a.updatedAt);
}
function readPreset(name) {
  const path = getPresetPath(name);
  if (!existsSync2(path)) return null;
  try {
    const content = readFileSync2(path, "utf-8");
    return parseYaml(content);
  } catch (e) {
    console.warn(`[writing-config] Failed to read ${name}:`, e);
    return null;
  }
}
function writePreset(name, config) {
  const dir = getWritingConfigDir();
  mkdirSync2(dir, { recursive: true });
  const filepath = getPresetPath(name);
  const tmpPath = `${filepath}.tmp`;
  const bakPath = `${filepath}.bak`;
  const warnings = validateConfig(config);
  const yamlStr = stringifyYaml(config);
  writeFileSync2(tmpPath, yamlStr, "utf-8");
  if (existsSync2(filepath)) {
    try {
      copyFileSync2(filepath, bakPath);
    } catch (e) {
    }
  }
  try {
    const { renameSync } = __require("node:fs");
    renameSync(tmpPath, filepath);
  } catch (e) {
    return { ok: false, warnings: [...warnings ?? [], `\u539F\u5B50\u91CD\u547D\u540D\u5931\u8D25: ${e.message}`] };
  }
  return warnings && warnings.length > 0 ? { ok: true, warnings } : { ok: true };
}
function deletePreset(name) {
  const activeName = getActivePresetName();
  if (name === activeName) {
    return { ok: false, error: "\u4E0D\u80FD\u5220\u9664\u5F53\u524D\u6FC0\u6D3B\u7684 preset\uFF0C\u8BF7\u5148\u5207\u6362\u5230\u5176\u4ED6 preset" };
  }
  const filepath = getPresetPath(name);
  if (!existsSync2(filepath)) {
    return { ok: false, error: `preset \u4E0D\u5B58\u5728: ${name}` };
  }
  try {
    unlinkSync(filepath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
function duplicatePreset(srcName, newName) {
  const src = readPreset(srcName);
  if (!src) return null;
  const dup = {
    ...src,
    name: newName,
    forkedFrom: srcName,
    updatedAt: Date.now()
  };
  const result = writePreset(newName, dup);
  if (!result.ok) return null;
  return dup;
}
function getActivePresetName() {
  const cfg = readConfig();
  return cfg.writing?.activePreset ?? "vincent-standard";
}
function setActivePreset(name) {
  if (!existsSync2(getPresetPath(name))) {
    return { ok: false, error: `preset \u4E0D\u5B58\u5728: ${name}` };
  }
  const cfg = readConfig();
  writeConfig({ ...cfg, writing: { ...cfg.writing, activePreset: name }, lastUpdated: Date.now() });
  return { ok: true };
}
function getActivePreset() {
  const name = getActivePresetName();
  const config = readPreset(name);
  if (config) return config;
  return getShippedPreset("vincent-standard");
}
function importPreset(yamlStr, desiredName) {
  let config;
  try {
    config = parseYaml(yamlStr);
  } catch (e) {
    return { ok: false, error: `YAML \u89E3\u6790\u5931\u8D25: ${e.message}` };
  }
  if (!config.name) {
    return { ok: false, error: "YAML \u7F3A\u5C11 name \u5B57\u6BB5" };
  }
  let name = desiredName ?? config.name;
  if (existsSync2(getPresetPath(name))) {
    let counter = 2;
    while (existsSync2(getPresetPath(`${name}_${counter}`))) {
      counter += 1;
      if (counter > 100) {
        return { ok: false, error: `\u91CD\u540D\u81EA\u52A8\u52A0\u540E\u7F00\u5931\u8D25: ${name}` };
      }
    }
    name = `${name}_${counter}`;
  }
  config.name = name;
  config.updatedAt = Date.now();
  const result = writePreset(name, config);
  if (!result.ok) {
    return { ok: false, error: "\u5199\u5165\u5931\u8D25" };
  }
  return { ok: true, name, warnings: result.warnings };
}
function exportPreset(name, options = {}) {
  const config = readPreset(name);
  if (!config) return { error: `preset \u4E0D\u5B58\u5728: ${name}` };
  const out = { ...config };
  if (options.includeLLMParams === false) {
    delete out.llmParams;
  }
  if (options.includeFewShot === false) {
    out.dimensions.quality = { ...out.dimensions.quality, fewShotRefs: [] };
  }
  return {
    yaml: stringifyYaml(out),
    filename: `${name}.yaml`
  };
}
function validateConfig(config) {
  const warnings = [];
  if (config.dimensions.style.tone < 0 || config.dimensions.style.tone > 100) {
    warnings.push("tone \u5FC5\u987B\u5728 0-100 \u4E4B\u95F4");
  }
  if (config.dimensions.sentence.shortRatio < 0 || config.dimensions.sentence.shortRatio > 1) {
    warnings.push("shortRatio \u5FC5\u987B\u5728 0-1 \u4E4B\u95F4");
  }
  if (config.dimensions.length.targetWords < 300 || config.dimensions.length.targetWords > 1e4) {
    warnings.push("targetWords \u5EFA\u8BAE 300-10000 \u5B57");
  }
  if (config.dimensions.sentence.shortRatio > 0.7 && config.dimensions.sentence.paragraphLength > 200) {
    warnings.push("\u77ED\u53E5\u6BD4 > 70% \u4E0E\u6BB5\u843D > 200 \u5B57\u96BE\u4EE5\u540C\u65F6\u6EE1\u8DB3\uFF0C\u5EFA\u8BAE\u8C03\u6574\u5176\u4E00");
  }
  if (config.dimensions.style.stance === "critical" && config.dimensions.style.tone < 30) {
    warnings.push("\u6279\u5224\u7ACB\u573A + \u51B7\u5CFB\u8BED\u6C14\u53EF\u80FD\u8BA9\u6587\u7AE0\u8FC7\u4E8E\u5C16\u523B\uFF0C\u5EFA\u8BAE\u81F3\u5C11\u63D0\u5230 30+ \u6E29\u6696");
  }
  if (config.dimensions.length.targetWords < config.dimensions.length.perSectionWords * config.dimensions.length.sectionCount * 0.5) {
    warnings.push("\u603B\u5B57\u6570 < \u7AE0\u8282\u6570 \xD7 \u5355\u7AE0\u5B57\u6570 \xD7 50%\uFF0CLLM \u53EF\u80FD\u5199\u4E0D\u6EE1");
  }
  return warnings;
}
function getShippedPreset(name) {
  const preset = name === "vincent-standard" ? PRESET_VINCENT_STANDARD : name === "client-comm" ? PRESET_CLIENT_COMM : PRESET_ACADEMIC;
  return JSON.parse(JSON.stringify(preset));
}
function ensureShippedPresets() {
  const dir = getWritingConfigDir();
  mkdirSync2(dir, { recursive: true });
  const shipReady = [
    { name: "vincent-standard", preset: PRESET_VINCENT_STANDARD },
    { name: "client-comm", preset: PRESET_CLIENT_COMM },
    { name: "academic", preset: PRESET_ACADEMIC }
  ];
  for (const { name, preset } of shipReady) {
    const path = getPresetPath(name);
    if (!existsSync2(path)) {
      try {
        writeFileSync2(path, stringifyYaml(preset), "utf-8");
        console.log(`[writing-config] Shipped preset created: ${name}`);
      } catch (e) {
        console.error(`[writing-config] Failed to write ${name}:`, e.message);
      }
    }
  }
}
function migrateDimensionsMulti(input) {
  const dst = readPreset(input.dst);
  if (!dst) return null;
  const merged = JSON.parse(JSON.stringify(dst));
  const sourceContributions = {};
  for (const [srcName, fields] of Object.entries(input.sources)) {
    const src = readPreset(srcName);
    if (!src) continue;
    sourceContributions[srcName] = [];
    for (const dim of ["style", "sentence", "structure", "length", "quality"]) {
      const field = fields[dim];
      if (!field) continue;
      if (field === true) {
        merged.dimensions[dim] = JSON.parse(JSON.stringify(src.dimensions[dim]));
        sourceContributions[srcName].push(`${dim}(full)`);
      } else if (Array.isArray(field)) {
        const srcDim = src.dimensions[dim];
        const dstDim = merged.dimensions[dim];
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
  const sourcesDesc = Object.entries(sourceContributions).map(([name, contribs]) => `${name}\uFF1A${contribs.join(", ")}`).join(" | ");
  merged.description = `\u6DF7\u5408\u81EA [${input.dst}] + ${sourcesDesc}`;
  return merged;
}
function migrateDimensions(srcName, dstName, fields) {
  return migrateDimensionsMulti({
    dst: dstName,
    sources: { [srcName]: fields }
  });
}
function listPresetHistory(name) {
  const dir = getWritingConfigDir();
  const currentPath = getPresetPath(name);
  if (!existsSync2(currentPath)) return [];
  const bakPattern = new RegExp(`^${escapeRegex(name)}\\.yaml\\.bak(\\.\\d+)?$`);
  const files = readdirSync(dir).filter((f) => bakPattern.test(f));
  const history = files.map((f) => {
    const match = f.match(bakPattern);
    const tsPart = match?.[1]?.replace(/^\./, "") ?? "";
    const ts = tsPart ? parseInt(tsPart) : 0;
    const path = join(dir, f);
    const stat = existsSync2(path) ? __require("node:fs").statSync(path) : null;
    const finalTs = ts || stat?.mtimeMs || 0;
    return {
      timestamp: finalTs,
      size: stat?.size ?? 0,
      filePath: path
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
  const currentStat = __require("node:fs").statSync(currentPath);
  history.unshift({
    timestamp: currentStat.mtimeMs,
    size: currentStat.size,
    filePath: currentPath
  });
  return history.map((h, i) => ({
    version: i + 1,
    timestamp: h.timestamp,
    size: h.size
  }));
}
function readPresetVersion(name, timestamp) {
  const dir = getWritingConfigDir();
  const currentPath = getPresetPath(name);
  if (!existsSync2(currentPath)) return null;
  const bakPattern = new RegExp(`^${escapeRegex(name)}\\.yaml\\.bak(\\.\\d+)?$`);
  const files = readdirSync(dir).filter((f) => bakPattern.test(f));
  const currentStat = __require("node:fs").statSync(currentPath);
  if (Math.abs(currentStat.mtimeMs - timestamp) < 1e3) {
    const content = readFileSync2(currentPath, "utf-8");
    return parseYaml(content);
  }
  let bestPath = null;
  let bestDiff = Infinity;
  for (const f of files) {
    const path = join(dir, f);
    const stat = __require("node:fs").statSync(path);
    const diff = Math.abs(stat.mtimeMs - timestamp);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestPath = path;
    }
  }
  if (bestPath) {
    const content = readFileSync2(bestPath, "utf-8");
    return parseYaml(content);
  }
  return null;
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function writePresetWithHistory(name, config) {
  const filepath = getPresetPath(name);
  if (existsSync2(filepath)) {
    try {
      const timestamp = Date.now();
      const bakPath = `${filepath}.bak.${timestamp}`;
      copyFileSync2(filepath, bakPath);
      cleanupOldBackups(name);
    } catch (e) {
    }
  }
  const result = writePreset(name, config);
  return result;
}
function cleanupOldBackups(name) {
  const dir = getWritingConfigDir();
  const pattern = new RegExp(`^${escapeRegex(name)}\\.yaml\\.bak(\\.\\d+)?$`);
  const files = readdirSync(dir).filter((f) => pattern.test(f)).map((f) => {
    const match = f.match(pattern);
    const tsPart = match?.[1]?.replace(/^\./, "") ?? "";
    const ts = tsPart ? parseInt(tsPart) : 0;
    return { name: f, ts, path: join(dir, f) };
  }).sort((a, b) => b.ts - a.ts);
  for (const f of files.slice(5)) {
    try {
      unlinkSync(f.path);
    } catch {
    }
  }
}
export {
  EVIDENCE_LEVELS,
  MATURITY_MAP,
  PRESET_ACADEMIC,
  PRESET_CLIENT_COMM,
  PRESET_VINCENT_STANDARD,
  SHIP_READY_PRESETS,
  TYPE_MAP,
  deletePreset,
  duplicatePreset,
  ensureShippedPresets,
  exportPreset,
  getActivePreset,
  getActivePresetName,
  getDefaultAppDataDir,
  getShippedPreset,
  getUserDataDir,
  getWritingConfigDir,
  importPreset,
  inferSourceType,
  isLLMConfigured,
  isPlaceholderApiKey,
  listPresetHistory,
  listPresets,
  maskApiKey,
  migrateDimensions,
  migrateDimensionsMulti,
  normalizeEvidenceLevel,
  normalizeMaturity,
  normalizeTags,
  normalizeType,
  readConfig,
  readPreset,
  readPresetVersion,
  sanitize,
  setActivePreset,
  updateConfig,
  validateConfig,
  writeConfig,
  writePreset,
  writePresetWithHistory
};
