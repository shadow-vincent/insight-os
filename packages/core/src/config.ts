/**
 * 本地配置文件存储
 *
 * 设计：配置存 storage/config.json，不进数据库
 * - 敏感字段（API key）只返回脱敏后的值
 * - 写入立即生效（不需重启）
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface AppConfig {
  llm: {
    baseUrl: string;
    apiKey: string;     // 明文存储在本地，不返回给前端
    model: string;
    enabled: boolean;
  };
  paths: {
    vaultPath: string;  // 指向 knowledge_base 根目录
    appDataDir?: string; // v1.0 桌面 app 专用：Tauri app data 目录
  };
  lastUpdated: number;
}

const DEFAULT_CONFIG: AppConfig = {
  llm: {
    baseUrl: process.env.LLM_BASE_URL ?? 'https://api.deepseek.com/v1',
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'deepseek-v4-flash',
    enabled: false,
  },
  paths: {
    vaultPath: process.env.INSIGHT_VAULT_PATH ?? `${process.env.HOME ?? ''}/Documents/knowledge_base`,
    appDataDir: process.env.INSIGHT_APP_DATA_DIR,
  },
  lastUpdated: 0,
};

/**
 * v1.0 桌面 app 数据目录（OS-aware）
 *   macOS:  ~/Library/Application Support/InsightOS/
 *   Linux:  ~/.local/share/insightos/
 *   Windows: %APPDATA%/InsightOS/
 */
export function getDefaultAppDataDir(): string {
  if (process.env.INSIGHT_APP_DATA_DIR) return process.env.INSIGHT_APP_DATA_DIR;
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp';
  if (process.platform === 'darwin') {
    return `${home}/Library/Application Support/InsightOS`;
  } else if (process.platform === 'win32') {
    return `${process.env.APPDATA ?? home}\\InsightOS`;
  } else {
    return `${home}/.local/share/insightos`;
  }
}

function resolveConfigPath(): string {
  // 优先环境变量
  if (process.env.INSIGHT_CONFIG_PATH) {
    return resolve(process.env.INSIGHT_CONFIG_PATH);
  }
  // v1.0: 桌面 app 模式（app data 目录有 config.json）— 优先用
  const appDataDir = getDefaultAppDataDir();
  const appDataConfig = resolve(appDataDir, 'config.json');
  if (existsSync(appDataConfig)) {
    return appDataConfig;
  }
  // 1) 优先 apps/web/storage/config.json（Next.js 运行时）
  const appPath = resolve(process.cwd(), 'storage/config.json');
  if (existsSync(appPath)) {
    return appPath;
  }
  // 2) fallback 到 monorepo 根 /storage/config.json
  return resolve(process.cwd(), '../storage/config.json');
}

/**
 * 读取配置（如果不存在返回默认值，但不会自动写入）
 */
export function readConfig(): AppConfig {
  const path = resolveConfigPath();
  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    // 合并默认值（防止新版本加字段时旧配置缺字段）
    return {
      llm: { ...DEFAULT_CONFIG.llm, ...parsed.llm },
      paths: { ...DEFAULT_CONFIG.paths, ...parsed.paths },
      lastUpdated: parsed.lastUpdated ?? 0,
    };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 写入配置
 */
export function writeConfig(config: AppConfig): void {
  const path = resolveConfigPath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  config.lastUpdated = Date.now();
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 更新单个字段
 */
export function updateConfig(partial: Partial<AppConfig>): AppConfig {
  const current = readConfig();
  const updated: AppConfig = {
    llm: { ...current.llm, ...(partial.llm ?? {}) },
    paths: { ...current.paths, ...(partial.paths ?? {}) },
    lastUpdated: Date.now(),
  };
  writeConfig(updated);
  return updated;
}

/**
 * 脱敏后的配置（API key 只显示前 4 位 + ****）
 * 用于返回给前端展示
 */
export interface SanitizedConfig {
  llm: {
    baseUrl: string;
    apiKeyMasked: string;  // 永远不返回完整 key
    apiKeyConfigured: boolean;
    model: string;
    enabled: boolean;
  };
  paths: {
    vaultPath: string;
  };
  lastUpdated: number;
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

export function sanitize(config: AppConfig): SanitizedConfig {
  return {
    llm: {
      baseUrl: config.llm.baseUrl,
      apiKeyMasked: maskApiKey(config.llm.apiKey),
      apiKeyConfigured: !!config.llm.apiKey && config.llm.apiKey !== 'sk-placeholder',
      model: config.llm.model,
      enabled: config.llm.enabled,
    },
    paths: {
      vaultPath: config.paths.vaultPath,
    },
    lastUpdated: config.lastUpdated,
  };
}

/**
 * 检查 LLM 是否已配置（用于前端状态指示）
 */
export function isLLMConfigured(): boolean {
  const c = readConfig();
  return !!c.llm.apiKey && c.llm.apiKey !== 'sk-placeholder';
}
