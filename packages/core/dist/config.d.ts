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
export interface AppConfig {
    llm: {
        baseUrl: string;
        apiKey: string;
        model: string;
        enabled: boolean;
    };
    paths: {
        vaultPath: string;
    };
    writing: {
        activePreset: string;
    };
    userGoal?: UserGoal | null;
    preferences?: {
        llmTemperature?: number;
        articleLength?: ArticleLength;
        rsshubBase?: string;
    };
    lastUpdated: number;
}
export type ArticleLength = 'short' | 'medium' | 'deep' | 'ultra';
export type UserGoal = 'write' | 'client' | 'experience' | 'methodology' | 'extract';
/**
 * OS-aware user data dir（dev / packaged 统一用）
 */
export declare function getUserDataDir(): string;
/**
 * 读取配置（如果不存在返回默认值，但不会自动写入）
 */
export declare function readConfig(): AppConfig;
/**
 * 写入配置
 */
export declare function writeConfig(config: AppConfig): void;
/**
 * 更新单个字段
 */
export declare function updateConfig(partial: Partial<AppConfig>): AppConfig;
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
export declare function isPlaceholderApiKey(key: string | undefined | null): boolean;
export declare function maskApiKey(key: string): string;
export declare function sanitize(config: AppConfig): SanitizedConfig;
/**
 * 检查 LLM 是否已配置
 */
export declare function isLLMConfigured(): boolean;
/**
 * 旧 API 兼容（保留 getDefaultAppDataDir 别名）
 * @deprecated Use getUserDataDir instead
 */
export declare function getDefaultAppDataDir(): string;
