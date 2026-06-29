/**
 * 应用层适配器
 *
 * 核心规则：原始 .md 文件永远不动，应用层读进来自己做映射。
 * 你 OpenClaw 怎么写就怎么写，你 Obsidian 怎么改就怎么改，
 * 应用层做适配。
 */
export declare const TYPE_MAP: Record<string, 'light' | 'asset' | 'kernel'>;
export type CardType = 'light' | 'asset' | 'kernel';
export declare function normalizeType(raw: string | undefined | null): CardType;
export declare function normalizeTags(raw: unknown): string[];
export type EvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5';
export declare const EVIDENCE_LEVELS: EvidenceLevel[];
export declare function normalizeEvidenceLevel(raw: string | undefined | null): EvidenceLevel;
export type Maturity = 'available' | 'pending' | 'draft' | 'unknown';
export declare const MATURITY_MAP: Record<string, Maturity>;
export declare function normalizeMaturity(raw: string | undefined | null): Maturity;
export type SourceType = 'book' | 'knowledge_card' | 'project' | 'article' | 'original' | 'unknown';
export declare function inferSourceType(raw: string | undefined | null): SourceType;
