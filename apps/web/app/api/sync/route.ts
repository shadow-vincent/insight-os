/**
 * POST /api/sync
 * 触发批量索引（手动同步）
 */

import { NextResponse } from 'next/server';
import { indexVault } from '@insight-os/indexer';

export async function POST() {
  try {
    const result = indexVault();
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      indexed: result.indexed,
      updated: result.updated,
      unchanged: result.unchanged,
      errors: result.errors,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET() {
  // GET 也允许（方便命令行 curl 触发）
  return POST();
}
