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
    tone: number;
    stance: Stance;
    persona: string;
    viewpoint: Viewpoint;
    termDensity: TermDensity;
    temperature: number;
}
export interface SentenceDimension {
    rhythm: Rhythm;
    shortRatio: number;
    paragraphLength: number;
    rhetoric: RhetoricType[];
}
export interface StructureDimension {
    headingStyle: HeadingStyle;
    corePosition: CorePosition;
    argumentPattern: ArgumentPattern;
    sectionCount: number;
    ending: Ending;
}
export interface LengthDimension {
    targetWords: number;
    sectionCount: number;
    perSectionWords: number;
    variants: number;
    keyQuotes: number;
}
export interface QualityDimension {
    citationLimit: number;
    bannedWords: string[];
    dataFidelity: DataFidelity;
    aiTasteCheck: boolean;
    fewShotRefs: string[];
}
export interface LLMParams {
    model: string;
    temperature: number;
    topP: number;
}
export interface WritingConfig {
    name: string;
    outputType: OutputType;
    description?: string;
    forkedFrom: string | null;
    updatedAt: number;
    tags?: string[];
    category?: string;
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
    isSystem: boolean;
    active: boolean;
    tags?: string[];
    category?: string;
}
/** 写作配置目录: ~/.insight-os/writing-configs/ */
export declare function getWritingConfigDir(): string;
/**
 * 列所有 preset 的元信息（不读全文，减小 payload）
 */
export declare function listPresets(): WritingConfigMeta[];
/**
 * 读单个 preset 全文
 */
export declare function readPreset(name: string): WritingConfig | null;
/**
 * 写 preset（原子写）
 */
export declare function writePreset(name: string, config: WritingConfig): {
    ok: boolean;
    warnings?: string[];
};
/**
 * 删除 preset（不能删 active 的）
 */
export declare function deletePreset(name: string): {
    ok: boolean;
    error?: string;
};
/**
 * 复制 preset
 */
export declare function duplicatePreset(srcName: string, newName: string): WritingConfig | null;
/** 读 active preset 名（从 AppConfig.writing.activePreset） */
export declare function getActivePresetName(): string;
/** 设 active preset */
export declare function setActivePreset(name: string): {
    ok: boolean;
    error?: string;
};
/** 读 active preset 全文（fallback 到 ship-ready） */
export declare function getActivePreset(): WritingConfig;
/**
 * 导入 YAML 字符串
 */
export declare function importPreset(yamlStr: string, desiredName?: string): {
    ok: boolean;
    name?: string;
    warnings?: string[];
    error?: string;
};
/**
 * 导出为 YAML 字符串
 */
export declare function exportPreset(name: string, options?: {
    includeLLMParams?: boolean;
    includeFewShot?: boolean;
}): {
    yaml?: string;
    filename?: string;
    error?: string;
};
/**
 * 校验 config + 返回 warnings（非阻塞）
 */
export declare function validateConfig(config: WritingConfig): string[];
/**
 * 拿一个 ship-ready preset 副本（深拷贝，不写盘）
 */
export declare function getShippedPreset(name: 'vincent-standard' | 'client-comm' | 'academic'): WritingConfig;
/**
 * 首次启动：把 3 套 ship-ready preset 写入磁盘（如果不存在）
 */
export declare function ensureShippedPresets(): void;
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
export declare function migrateDimensionsMulti(input: {
    dst: string;
    sources: Record<string, {
        style?: boolean | string[];
        sentence?: boolean | string[];
        structure?: boolean | string[];
        length?: boolean | string[];
        quality?: boolean | string[];
    }>;
}): WritingConfig | null;
/**
 * 风格迁移：从 src preset 拉取某些维度，覆盖到 dst preset（向后兼容旧 API）
 *
 * 用法：
 *   const newConfig = migrateDimensions(srcName, dstName, {
 *     style: true,           // 拉取 src 的整个 style 维度
 *     sentence: ['rhythm', 'shortRatio'],  // 拉取 src 的 sentence 维度部分字段
 *   });
 */
export declare function migrateDimensions(srcName: string, dstName: string, fields: {
    style?: boolean | string[];
    sentence?: boolean | string[];
    structure?: boolean | string[];
    length?: boolean | string[];
    quality?: boolean | string[];
}): WritingConfig | null;
/**
 * 列出 preset 的所有历史版本（.bak 文件）
 */
export declare function listPresetHistory(name: string): Array<{
    version: number;
    timestamp: number;
    size: number;
}>;
/**
 * 读指定版本的内容（用时间戳定位）
 */
export declare function readPresetVersion(name: string, timestamp: number): WritingConfig | null;
/** 增强版 writePreset：自动保留历史版本 .bak（最近 5 个） */
export declare function writePresetWithHistory(name: string, config: WritingConfig): {
    ok: boolean;
    warnings?: string[];
    bakCreated?: string;
};
