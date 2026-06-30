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
        // V1.11.15: Vercel NO_SQLITE 兜底
    const isVercelNoDb = process.env.VERCEL === '1' ||
      e.message?.includes('Cannot find module') ||
      e.message?.includes('better-sqlite3') ||
      e.message?.includes('_sqlite') ||
      e.message?.includes('getDb is not a function');
        if (isVercelNoDb) {
      return NextResponse.json({ ok: true, kernels: [], count: 0, code: 'NO_SQLITE' });
    }
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
