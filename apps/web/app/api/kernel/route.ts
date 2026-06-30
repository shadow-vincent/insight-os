/**
 * GET /api/kernel          — 列出所有 Insight Kernel（默认 active）
 * POST /api/kernel         — 新增一条
 *
 * v1.4 Insight Kernel · 用户判断协议
 *
 * V1.11.15: Vercel 兼容（@insight-os/db SQLite-only，包内没 NO_SQLITE 兜底）
 * - 加 try/catch 返 NO_SQLITE 错误码（V1.10 Vercel IDB-first 后 client 已走 IDB，
 *   server 端 fallback 是给旧 client / 直接调 server 的情况）
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  addUserKernel,
  listUserKernels,
  type NewUserKernelInput,
} from '@insight-os/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = (url.searchParams.get('status') ?? 'active') as
      'active' | 'archived' | 'all';
    const category = url.searchParams.get('category') as
      | 'belief' | 'contrarian' | 'expertise' | 'challenge'
      | null;

    const opts: { status?: 'active' | 'archived' | 'all'; category?: NewUserKernelInput['category'] } = { status };
    if (category) opts.category = category;

    const kernels = listUserKernels(opts);
    return NextResponse.json({ ok: true, kernels, count: kernels.length });
  } catch (e: any) {
    // V1.11.15: Vercel NO_SQLITE 兜底（@insight-os/db SQLite-only）
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, kind, content, confidence, counterExample, scope, evidenceAssetIds } = body;
    if (!category || !['belief', 'contrarian', 'expertise', 'challenge'].includes(category)) {
      return NextResponse.json({ ok: false, error: 'category 必填且必须是 belief/contrarian/expertise/challenge' }, { status: 400 });
    }
    if (!content || content.trim().length < 5) {
      return NextResponse.json({ ok: false, error: 'content 必填且至少 5 字' }, { status: 400 });
    }
    const id = addUserKernel({
      category,
      kind,
      content: content.trim(),
      confidence: typeof confidence === 'number' ? Math.max(0, Math.min(100, confidence)) : undefined,
      counterExample: counterExample ?? null,
      scope: scope ?? null,
      evidenceAssetIds: Array.isArray(evidenceAssetIds) ? evidenceAssetIds : [],
    });
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
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