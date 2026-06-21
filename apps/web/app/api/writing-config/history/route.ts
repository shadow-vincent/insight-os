/**
 * GET /api/writing-config/history?name=X&timestamp=T
 * 读 preset 的历史版本
 *
 * 不带 timestamp: 返回历史版本列表
 * 带 timestamp: 返回该版本的完整内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { listPresetHistory, readPresetVersion } from '@insight-os/core';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get('name');
    const timestamp = url.searchParams.get('timestamp');

    if (!name) {
      return NextResponse.json({ ok: false, error: '缺少 name' }, { status: 400 });
    }

    if (timestamp) {
      const config = readPresetVersion(name, parseInt(timestamp));
      if (!config) {
        return NextResponse.json({ ok: false, error: '版本不存在' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, config });
    }

    const history = listPresetHistory(name);
    return NextResponse.json({ ok: true, history });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}