/**
 * /output
 *
 * v1.8.3 输出包（重命名为"输出包"，按 Vincent v3 评价）
 *
 * 4 类型（公众号 / 客户沟通 / 演讲 / 读书笔记 / 邮件 / 文章大纲）
 * 4 格式导出（Markdown / HTML / 公众号 / PDF）
 * Pro 能力区克制版（v3 评价第 5 条：不放大橙色购买框）
 */

import { OutputPackageClient } from './OutputPackageClient';

export const dynamic = 'force-dynamic';

export default function OutputPage() {
  return <OutputPackageClient />;
}