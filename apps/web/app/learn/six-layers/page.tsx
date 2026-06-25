/**
 * /learn/six-layers
 *
 * 「六层提问法」教学页 —— 训练营第一节课的教学示范。
 *
 * 用户路径：
 * 1. 公众号文章 / 训练营链接 → 打开这个页面
 * 2. 看 6 层说明（每层 = 问题 / 目的 / 反例 / 适用场景）
 * 3. 点「沉淀到我的 Insight OS」→ 调 POST /api/kernel/seed-six-layers
 * 4. 成功 → 跳到 /kernel 页面看
 *
 * Vincent 原创方法论，GPT 协助结构化总结。
 */

import SixLayersClient from './SixLayersClient';

export const dynamic = 'force-dynamic';

export default function SixLayersPage() {
  return <SixLayersClient />;
}
