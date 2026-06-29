/**
 * POST /api/config/test-rsshub
 *
 * 输入: { rsshubBase }
 * 输出: { ok, itemCount?, error? }
 *
 * 用 elonmusk 做样例测试 RSSHub 实例是否可用
 */

import { NextRequest, NextResponse } from 'next/server';
import { testRSSHubConnection } from '@/lib/rsshub-fetcher';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rsshubBase = (body.rsshubBase || '').trim().replace(/\/+$/, '');

    if (!rsshubBase || !/^https?:\/\//.test(rsshubBase)) {
      return NextResponse.json({ ok: false, error: '请填写有效的 URL（http/https）' }, { status: 400 });
    }

    const result = await testRSSHubConnection(rsshubBase);
    if (result.ok) {
      return NextResponse.json({ ok: true, itemCount: result.itemCount });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}