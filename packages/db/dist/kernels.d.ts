/**
 * user_kernels CRUD helpers（v1.4 Insight Kernel）
 *
 * 跟 topic_kernels（主题级 LLM 总结）不同，这是**用户级**判断协议：
 * - 每次 LLM 调用自动注入 system prompt
 * - 用户自己写 / 改 / 删 / 归档
 * - 6 条 ship-ready 默认 + onboarding 种子
 *
 * 设计原则：
 * - 每次读 db（user_kernels 很小，< 100 条，开销 < 1ms，不做内存缓存）
 * - 序列化器在 packages/llm/kernel-injector.ts（DDL 与逻辑分离）
 * - 不写迁移：v1.4 之前用户没 user_kernels 表，启动自动 CREATE TABLE IF NOT EXISTS
 */
/**
 * 给 LLM 注入用的精简结构（避免把数据库 row 全部序列化）
 */
export interface KernelForLLM {
    category: 'belief' | 'contrarian' | 'expertise' | 'challenge';
    content: string;
    confidence: number;
    counterExample?: string | null;
    scope?: string | null;
}
export interface UserKernelRow {
    id: string;
    category: 'belief' | 'contrarian' | 'expertise' | 'challenge';
    kind: 'belief' | 'hypothesis' | 'experience' | 'contrarian';
    content: string;
    confidence: number;
    counterExample: string | null;
    scope: string | null;
    evidenceAssetIds: string[];
    referencedCount: number;
    lastVerifiedAt: number | null;
    status: 'active' | 'archived';
    sortOrder: number;
    createdAt: number;
    updatedAt: number;
}
export interface NewUserKernelInput {
    category: 'belief' | 'contrarian' | 'expertise' | 'challenge';
    kind?: 'belief' | 'hypothesis' | 'experience' | 'contrarian';
    content: string;
    confidence?: number;
    counterExample?: string | null;
    scope?: string | null;
    evidenceAssetIds?: string[];
    sortOrder?: number;
}
/**
 * 列出所有内核（按 sortOrder + confidence desc）
 */
export declare function listUserKernels(opts?: {
    status?: 'active' | 'archived' | 'all';
    category?: UserKernelRow['category'];
}): UserKernelRow[];
/**
 * 读一条
 */
export declare function getUserKernel(id: string): UserKernelRow | null;
/**
 * 新增一条
 */
export declare function addUserKernel(input: NewUserKernelInput): string;
/**
 * 更新（部分字段）
 */
export declare function updateUserKernel(id: string, patch: Partial<NewUserKernelInput>): void;
/**
 * 归档（不物理删除）
 */
export declare function archiveUserKernel(id: string): void;
/**
 * 激活归档的
 */
export declare function reactivateUserKernel(id: string): void;
/**
 * 增加引用计数（LLM 注入时调用，可选）
 */
export declare function bumpReferencedCount(id: string, delta?: number): void;
/**
 * 标记已验证（防教条化：3 个月未验证的内核应在 LLM 提示中标注"过期"）
 */
export declare function verifyUserKernel(id: string): void;
/**
 * 当前激活的所有内核（按 sortOrder asc, confidence desc）
 * LLM 注入用 —— 转成精简 KernelForLLM 结构
 */
export declare function getActiveKernelsForInjection(): KernelForLLM[];
/**
 * 统计：分类分布 + 平均置信度 + 总引用次数
 */
export declare function getUserKernelStats(): {
    total: number;
    active: number;
    archived: number;
    byCategory: Record<string, number>;
    avgConfidence: number;
    totalReferenced: number;
};
