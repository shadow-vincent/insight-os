/**
 * GET /api/kernel          — 列出所有 Insight Kernel（默认 active）
 * POST /api/kernel         — 新增一条
 *
 * v1.4 Insight Kernel · 用户判断协议
 *
 * GET query params:
 *   status?: 'active' | 'archived' | 'all'   默认 active
 *   category?: 'belief' | 'contrarian' | 'expertise' | 'challenge'
 *
 * POST body: NewUserKernelInput
 *   { category, content, confidence?, counterExample?, scope?, evidenceAssetIds? }
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
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
