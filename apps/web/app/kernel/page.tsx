/**
 * /kernel
 *
 * Insight Kernel 列表页（v1.4 + v1.6 六层接入）
 *
 * 功能：
 * - 列出所有 Insight Kernel
 * - 按 4 类筛选
 * - 新建 / 编辑 / 归档 / 重新激活 / 验证
 * - 一键获取系统预置（seed-default + seed-six-layers）
 *
 * 用户路径：
 * 1. Sidebar "六层提问法" → /learn/six-layers → 一键沉淀 → 跳到这里看
 * 2. 公众号链接 → /learn/six-layers → 一键沉淀 → 跳到这里看
 * 3. Settings → 判断协议 → 跳到这里编辑
 */

import KernelListClient from './KernelListClient';

export const dynamic = 'force-dynamic';

export default function KernelListPage() {
  return <KernelListClient />;
}
