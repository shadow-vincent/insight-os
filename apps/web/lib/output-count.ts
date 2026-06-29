/**
 * v1.8.0 引用计数自动维护
 *
 * 用途：
 *   - output 引用 asset 时：assets.output_count + 1
 *   - output 删除时：assets.output_count - 1（防 0）
 *   - 当 output_count >= 5：自动推荐 is_kernel_candidate = 1
 *
 * 设计原则：
 *   - 用 db transaction 保证一致性
 *   - 不在 LLM 调用里维护（避免副作用污染主流程）
 *   - V1.8.0 暂时只 +1，-1 留 V1.8.1 后做
 */

import { getDb, assets } from '@insight-os/db';
import { sql, inArray, eq } from 'drizzle-orm';

const KERNEL_RECOMMEND_THRESHOLD = 5;

/**
 * 当 output 引用 assetIds 时，自动 +1 output_count
 *
 * @param assetIds 引用的资产 ID 数组
 */
export function incrementOutputCount(assetIds: string[]): void {
  if (assetIds.length === 0) return;
  const db = getDb();

  // 1. 批量 +1 output_count
  db.update(assets)
    .set({
      outputCount: sql`${assets.outputCount} + 1`,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(inArray(assets.id, assetIds))
    .run();

  // 2. 检查是否需要标 is_kernel_candidate（output_count >= 5）
  const eligibleIds = db.select({ id: assets.id, outputCount: assets.outputCount, feedbackCount: assets.feedbackCount })
    .from(assets)
    .where(inArray(assets.id, assetIds))
    .all()
    .filter((a: any) =>
      a.outputCount >= KERNEL_RECOMMEND_THRESHOLD &&
      a.feedbackCount >= 1 &&
      a.isKernelCandidate === 0
    )
    .map((a: any) => a.id);

  if (eligibleIds.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    for (const id of eligibleIds) {
      db.update(assets)
        .set({ isKernelCandidate: 1, updatedAt: now })
        .where(eq(assets.id, id))
        .run();
    }
  }
}

/**
 * 当 output 删除时，引用计数 -1
 *
 * V1.8.0 暂时不实现，留 V1.8.1 后做（output 删除场景少）
 */
export function decrementOutputCount(assetIds: string[]): void {
  // V1.8.1 之后再做
}

/**
 * 当 feedback 记录时，feedback_count +1
 */
export function incrementFeedbackCount(assetId: string): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  db.update(assets)
    .set({
      feedbackCount: sql`${assets.feedbackCount} + 1`,
      lastUsedAt: now,
      updatedAt: now,
    })
    .where(eq(assets.id, assetId))
    .run();
}