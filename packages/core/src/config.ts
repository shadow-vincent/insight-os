/**
 * 本地配置文件存储
 *
 * 设计：配置存统一 user data dir（OS-aware）
 *   macOS:   ~/Library/Application Support/InsightOS/config.json
 *   Linux:   ~/.local/share/insightos/config.json
 *   Windows: %APPDATA%/InsightOS/config.json
 *
 * 这样 web dev 和 packaged .app 共享同一份配置，不会出现 "桌面配了 web 看不到" 问题。
 *
 * - 敏感字段（API key）只返回脱敏后的值
 * - 写入立即生效（不需重启）
 * - 自动迁移：从旧的 apps/web/storage/config.json 升级
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
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
  };
  writing: {
    activePreset: string;  // 当前激活的写作风格预设名（默认 'vincent-standard'）
  };
  // v1.6: 用户目标场景（onboarding 5 选 1 的结果）
  // write / client / experience / methodology / extract
  userGoal?: UserGoal | null;
  // v1.7: 写作偏好（settings 配置）
  preferences?: {
    llmTemperature?: number;       // 0-1, 默认 0.5（稳定 vs 创意）
    articleLength?: ArticleLength; // 短文/中等/深度长文/超深度，默认 'deep'
    rsshubBase?: string;           // v1.9.1: RSSHub 实例 URL，默认 'https://rsshub.app'
  };
  lastUpdated: number;
}

export type ArticleLength = 'short' | 'medium' | 'deep' | 'ultra';

export type UserGoal =
  | 'write'         // A. 写文章
  | 'client'        // B. 做客户方案
  | 'experience'    // C. 沉淀项目经验
  | 'methodology'   // D. 管理方法论
  | 'extract';      // E. 提炼已有知识

const DEFAULT_CONFIG: AppConfig = {
  llm: {
    baseUrl: process.env.LLM_BASE_URL ?? 'https://api.minimax.chat/v1',
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'MiniMax-M2.7',
    enabled: false,
  },
  paths: {
    vaultPath: process.env.INSIGHT_VAULT_PATH ?? `${process.env.HOME ?? ''}/Documents/knowledge_base`,
  },
  writing: {
    activePreset: 'vincent-standard',
  },
  lastUpdated: 0,
};

/**
 * OS-aware user data dir（dev / packaged 统一用）
 */
export function getUserDataDir(): string {
  // env 优先（packaged .app 可以自己 override）
  if (process.env.INSIGHT_USER_DATA_DIR) {
    return process.env.INSIGHT_USER_DATA_DIR;
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp';
  if (process.platform === 'darwin') {
    return `${home}/Library/Application Support/InsightOS`;
  } else if (process.platform === 'win32') {
    return `${process.env.APPDATA ?? home}\\InsightOS`;
  } else {
    return `${home}/.local/share/insightos`;
  }
}

/**
 * 旧的 config 路径（用于自动迁移）
 */
function getLegacyConfigPaths(): string[] {
  return [
    // 旧 Tauri 时代的 config
    `${process.env.HOME ?? ''}/Library/Application Support/com.vincent.enterprise-insight/config.json`,
    // web dev 默认路径
    resolve(process.cwd(), 'storage/config.json'),
    // packaged .app 内部路径
    resolve(process.cwd(), '../storage/config.json'),
  ];
}

/**
 * 解析 config 路径（统一到 user data dir）
 */
function resolveConfigPath(): string {
  // env 优先
  if (process.env.INSIGHT_CONFIG_PATH) {
    return resolve(process.env.INSIGHT_CONFIG_PATH);
  }
  return resolve(getUserDataDir(), 'config.json');
}

/**
 * 迁移旧 config 到新位置（只迁移一次）
 */
function migrateLegacyConfigIfNeeded(targetPath: string): void {
  if (existsSync(targetPath)) return;
  for (const legacyPath of getLegacyConfigPaths()) {
    if (existsSync(legacyPath)) {
      try {
        mkdirSync(dirname(targetPath), { recursive: true });
        copyFileSync(legacyPath, targetPath);
        console.log(`[config] Migrated legacy config from ${legacyPath} to ${targetPath}`);
        return;
      } catch (e: any) {
        console.warn(`[config] Failed to migrate from ${legacyPath}: ${e.message}`);
      }
    }
  }
}

/**
 * 读取配置（如果不存在返回默认值，但不会自动写入）
 */
export function readConfig(): AppConfig {
  const path = resolveConfigPath();
  migrateLegacyConfigIfNeeded(path);

  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      llm: { ...DEFAULT_CONFIG.llm, ...parsed.llm },
      paths: { ...DEFAULT_CONFIG.paths, ...parsed.paths },
      writing: { ...DEFAULT_CONFIG.writing, ...(parsed.writing ?? {}) },
      userGoal: parsed.userGoal ?? null,
      preferences: {
        llmTemperature: parsed.preferences?.llmTemperature ?? 0.5,
        articleLength: parsed.preferences?.articleLength ?? 'deep',
        rsshubBase: parsed.preferences?.rsshubBase ?? 'https://rsshub.app',
      },
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
    writing: { ...current.writing, ...(partial.writing ?? {}) },
    userGoal: partial.userGoal !== undefined ? partial.userGoal : current.userGoal ?? null,
    preferences: {
      ...(current.preferences ?? { llmTemperature: 0.5, articleLength: 'deep' as ArticleLength }),
      ...(partial.preferences ?? {}),
    },
    lastUpdated: Date.now(),
  };
  writeConfig(updated);
  return updated;
}

/**
 * 脱敏后的配置（API key 只显示前 4 位 + ****）
 */
export interface SanitizedConfig {
  llm: {
    baseUrl: string;
    apiKeyMasked: string;
    apiKeyConfigured: boolean;
    model: string;
    enabled: boolean;
  };
  paths: {
    vaultPath: string;
  };
  writing?: {
    activePreset: string;
  };
  userGoal: UserGoal | null;
  preferences: {
    llmTemperature: number;
    articleLength: ArticleLength;
    rsshubBase?: string;
  };
  lastUpdated: number;
}

/**
 * 判断 apiKey 是否是占位符（demo 用途，不可调通 LLM）
 */
export function isPlaceholderApiKey(key: string | undefined | null): boolean {
  if (!key) return true;
  const PLACEHOLDERS = ['sk-placeholder', 'sk-test-demo', 'sk-demo', 'sk-xxx'];
  return PLACEHOLDERS.includes(key) || key.startsWith('sk-xxx');
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

export function sanitize(config: AppConfig): SanitizedConfig {
  const isConfigured = !!config.llm.apiKey && !isPlaceholderApiKey(config.llm.apiKey);
  return {
    llm: {
      baseUrl: config.llm.baseUrl,
      apiKeyMasked: maskApiKey(config.llm.apiKey),
      apiKeyConfigured: isConfigured,
      model: config.llm.model,
      enabled: config.llm.enabled,
    },
    paths: {
      vaultPath: config.paths.vaultPath,
    },
    writing: config.writing,
    userGoal: config.userGoal ?? null,
    preferences: {
      llmTemperature: config.preferences?.llmTemperature ?? 0.5,
      articleLength: config.preferences?.articleLength ?? 'deep',
      rsshubBase: config.preferences?.rsshubBase ?? 'https://rsshub.app',
    },
    lastUpdated: config.lastUpdated,
  };
}

/**
 * 检查 LLM 是否已配置
 */
export function isLLMConfigured(): boolean {
  const c = readConfig();
  return !!c.llm.apiKey;
}

/**
 * 旧 API 兼容（保留 getDefaultAppDataDir 别名）
 * @deprecated Use getUserDataDir instead
 */
export function getDefaultAppDataDir(): string {
  return getUserDataDir();
}