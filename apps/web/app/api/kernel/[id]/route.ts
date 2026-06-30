/**
 * /api/kernel/[id] · 单条 CRUD
 *
 * GET     读一条
 * PATCH   更新（部分字段）
 * DELETE  归档（status → archived，不物理删除）
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserKernel,
  updateUserKernel,
  archiveUserKernel,
  reactivateUserKernel,
  type NewUserKernelInput,
} from '@insight-os/db';

export const dynamic = 'force-dynamic';

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const k = getUserKernel(id);
    if (!k) return NextResponse.json({ ok: false, error: 'Kernel not found' }, { status: 404 });
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

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const patch: Partial<NewUserKernelInput> = {};
    if (body.category !== undefined) patch.category = body.category;
    if (body.kind !== undefined) patch.kind = body.kind;
    if (body.content !== undefined) patch.content = String(body.content);
    if (body.confidence !== undefined) {
      const c = Number(body.confidence);
      if (Number.isFinite(c)) patch.confidence = Math.max(0, Math.min(100, c));
    }
    if (body.counterExample !== undefined) {
      patch.counterExample = body.counterExample ? String(body.counterExample) : null;
    }
    if (body.scope !== undefined) {
      patch.scope = body.scope ? String(body.scope) : null;
    }
    if (body.evidenceAssetIds !== undefined) {
      patch.evidenceAssetIds = Array.isArray(body.evidenceAssetIds) ? body.evidenceAssetIds : [];
    }
    if (body.sortOrder !== undefined) {
      const so = Number(body.sortOrder);
      if (Number.isFinite(so)) patch.sortOrder = so;
    }

    updateUserKernel(id, patch);
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

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const url = new URL(_req.url);
    // 支持 ?hard=true 真删（默认 archive）
    if (url.searchParams.get('hard') === 'true') {
      const k = getUserKernel(id);
      if (!k) return NextResponse.json({ ok: false, error: 'Kernel not found' }, { status: 404 });
      // 没有 hard delete SQL — 用 archive 然后从 UI 提示
    }
    archiveUserKernel(id);
    return NextResponse.json({ ok: true, archived: id });
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

export async function POST(req: NextRequest, ctx: RouteCtx) {
  // POST /api/kernel/[id] 用于 reactivate（恢复归档的）
  try {
    const { id } = await ctx.params;
    reactivateUserKernel(id);
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
