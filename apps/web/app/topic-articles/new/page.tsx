/**
 * v1.7.1 兼容重定向：/topic-articles/new → /write
 *
 * 老路由不再使用，统一入口改为 /write（合并列提纲 + 写全文 tab）
 */

import { redirect } from 'next/navigation';

export default function TopicArticlesNewRedirect() {
  redirect('/write');
}