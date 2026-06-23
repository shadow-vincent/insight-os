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

import { eq, desc, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from './client.ts';
import { userKernels } from './schema.ts';

/**
 * 给 LLM 注入用的精简结构（避免把数据库 row 全部序列化）
 */
export interface KernelForLLM {
  category: 'belief' | 'contrarian' | 'expertise' | 'challenge';
  content: string;
  confidence: number;       // 0-100
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
 * row → 业务对象（解 JSON 字段）
 */
function rowToKernel(row: typeof userKernels.$inferSelect): UserKernelRow {
  let evidenceAssetIds: string[] = [];
  try {
    evidenceAssetIds = JSON.parse(row.evidenceAssetIdsJson ?? '[]');
    if (!Array.isArray(evidenceAssetIds)) evidenceAssetIds = [];
  } catch {
    evidenceAssetIds = [];
  }
  return {
    id: row.id,
    category: row.category as UserKernelRow['category'],
    kind: row.kind as UserKernelRow['kind'],
    content: row.content,
    confidence: row.confidence,
    counterExample: row.counterExample,
    scope: row.scope,
    evidenceAssetIds,
    referencedCount: row.referencedCount,
    lastVerifiedAt: row.lastVerifiedAt,
    status: row.status as UserKernelRow['status'],
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * 列出所有内核（按 sortOrder + confidence desc）
 */
export function listUserKernels(opts: {
  status?: 'active' | 'archived' | 'all';
  category?: UserKernelRow['category'];
} = {}): UserKernelRow[] {
  const db = getDb();
  const status = opts.status ?? 'active';
  let q = db.select().from(userKernels);
  if (status !== 'all') {
    q = q.where(eq(userKernels.status, status)) as any;
  }
  const rows = q.orderBy(userKernels.sortOrder, desc(userKernels.confidence)).all();
  let result = rows.map(rowToKernel);
  if (opts.category) {
    result = result.filter(r => r.category === opts.category);
  }
  return result;
}

/**
 * 读一条
 */
export function getUserKernel(id: string): UserKernelRow | null {
  const db = getDb();
  const row = db.select().from(userKernels).where(eq(userKernels.id, id)).get();
  return row ? rowToKernel(row) : null;
}

/**
 * 新增一条
 */
export function addUserKernel(input: NewUserKernelInput): string {
  const db = getDb();
  const id = `kernel_${randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  db.insert(userKernels).values({
    id,
    category: input.category,
    kind: input.kind ?? (input.category === 'contrarian' ? 'contrarian' : 'belief'),
    content: input.content,
    confidence: input.confidence ?? 70,
    counterExample: input.counterExample ?? null,
    scope: input.scope ?? null,
    evidenceAssetIdsJson: JSON.stringify(input.evidenceAssetIds ?? []),
    referencedCount: 0,
    lastVerifiedAt: null,
    status: 'active',
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  } as any).run();
  return id;
}

/**
 * 更新（部分字段）
 */
export function updateUserKernel(
  id: string,
  patch: Partial<NewUserKernelInput>
): void {
  const db = getDb();
  const existing = db.select().from(userKernels).where(eq(userKernels.id, id)).get();
  if (!existing) throw new Error(`Kernel ${id} not found`);

  const now = Math.floor(Date.now() / 1000);
  const updates: any = { updatedAt: now };
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.kind !== undefined) updates.kind = patch.kind;
  if (patch.content !== undefined) updates.content = patch.content;
  if (patch.confidence !== undefined) updates.confidence = patch.confidence;
  if (patch.counterExample !== undefined) updates.counterExample = patch.counterExample;
  if (patch.scope !== undefined) updates.scope = patch.scope;
  if (patch.evidenceAssetIds !== undefined) {
    updates.evidenceAssetIdsJson = JSON.stringify(patch.evidenceAssetIds);
  }
  if (patch.sortOrder !== undefined) updates.sortOrder = patch.sortOrder;

  db.update(userKernels).set(updates).where(eq(userKernels.id, id)).run();
}

/**
 * 归档（不物理删除）
 */
export function archiveUserKernel(id: string): void {
  const db = getDb();
  db.update(userKernels)
    .set({ status: 'archived', updatedAt: Math.floor(Date.now() / 1000) } as any)
    .where(eq(userKernels.id, id))
    .run();
}

/**
 * 激活归档的
 */
export function reactivateUserKernel(id: string): void {
  const db = getDb();
  db.update(userKernels)
    .set({ status: 'active', updatedAt: Math.floor(Date.now() / 1000) } as any)
    .where(eq(userKernels.id, id))
    .run();
}

/**
 * 增加引用计数（LLM 注入时调用，可选）
 */
export function bumpReferencedCount(id: string, delta = 1): void {
  const db = getDb();
  const current = db.select({ c: userKernels.referencedCount }).from(userKernels).where(eq(userKernels.id, id)).get();
  const newCount = (current?.c ?? 0) + delta;
  db.update(userKernels)
    .set({ referencedCount: newCount } as any)
    .where(eq(userKernels.id, id))
    .run();
}

/**
 * 标记已验证（防教条化：3 个月未验证的内核应在 LLM 提示中标注"过期"）
 */
export function verifyUserKernel(id: string): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.update(userKernels)
    .set({ lastVerifiedAt: now, updatedAt: now } as any)
    .where(eq(userKernels.id, id))
    .run();
}

/**
 * 当前激活的所有内核（按 sortOrder asc, confidence desc）
 * LLM 注入用 —— 转成精简 KernelForLLM 结构
 */
export function getActiveKernelsForInjection(): KernelForLLM[] {
  return listUserKernels({ status: 'active' }).map(r => ({
    category: r.category,
    content: r.content,
    confidence: r.confidence,
    counterExample: r.counterExample,
    scope: r.scope,
  }));
}

/**
 * 统计：分类分布 + 平均置信度 + 总引用次数
 */
export function getUserKernelStats(): {
  total: number;
  active: number;
  archived: number;
  byCategory: Record<string, number>;
  avgConfidence: number;
  totalReferenced: number;
} {
  const all = listUserKernels({ status: 'all' });
  const active = all.filter(r => r.status === 'active');
  const byCategory: Record<string, number> = { belief: 0, contrarian: 0, expertise: 0, challenge: 0 };
  for (const r of active) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  const avgConfidence = active.length > 0
    ? Math.round(active.reduce((s, r) => s + r.confidence, 0) / active.length)
    : 0;
  const totalReferenced = active.reduce((s, r) => s + r.referencedCount, 0);
  return {
    total: all.length,
    active: active.length,
    archived: all.length - active.length,
    byCategory,
    avgConfidence,
    totalReferenced,
  };
}
