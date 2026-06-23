/**
 * GET /api/kernel/stats · 统计
 *
 * 返：总数 / 激活数 / 归档数 / 4 类分布 / 平均置信度 / 总引用次数
 */

import { NextResponse } from 'next/server';
import { getUserKernelStats } from '@insight-os/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = getUserKernelStats();
    return NextResponse.json({ ok: true, ...stats });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
