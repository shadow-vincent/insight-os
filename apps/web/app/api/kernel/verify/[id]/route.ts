/**
 * POST /api/kernel/verify/[id] · 标记已验证
 *
 * 触发：用户在 settings 点"我重新想过了，确认这条"按钮
 * 作用：刷新 lastVerifiedAt（防 3 个月过期）
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserKernel, getUserKernel } from '@insight-os/db';

export const dynamic = 'force-dynamic';

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    verifyUserKernel(id);
    const k = getUserKernel(id);
    return NextResponse.json({ ok: true, kernel: k });
  } catch (e: any) {
        // V1.11.15: Vercel NO_SQLITE 兜底
    const isVercelNoDb = process.env.VERCEL === '1' ||
      e.message?.includes('Cannot find module') ||
      e.message?.includes('better-sqlite3') ||
      e.message?.includes('_sqlite') ||
      e.message?.includes('getDb is not a function');
        if (isVercelNoDb) {
      return NextResponse.json({ ok: false, code: 'NO_SQLITE', error: 'Vercel 部署版不支持此操作，请用浏览器 IndexedDB' });
    }
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
