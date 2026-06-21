/**
 * POST /api/writing-config/migrate
 * 风格迁移（深度版）：从多个 src preset 拉取维度
 *
 * Request: {
 *   dst: string,
 *   sources: Record<string, {
 *     style?: boolean | string[],
 *     sentence?: boolean | string[],
 *     structure?: boolean | string[],
 *     length?: boolean | string[],
 *     quality?: boolean | string[],
 *   }>
 * }
 *
 * 也支持旧的单 src API：
 *   { src: string, dst: string, fields: { ... } }
 *
 * Response: { ok, config: WritingConfig (合并后的草稿，不自动保存) }
 */

import { NextRequest, NextResponse } from 'next/server';
import { migrateDimensions, migrateDimensionsMulti } from '@insight-os/core';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 新 API（多 src 混合）
    if (body.sources && body.dst) {
      const merged = migrateDimensionsMulti({
        dst: body.dst,
        sources: body.sources,
      });
      if (!merged) {
        return NextResponse.json({ ok: false, error: `dst preset 不存在: ${body.dst}` }, { status: 404 });
      }
      return NextResponse.json({ ok: true, config: merged });
    }

    // 旧 API（单 src）
    const { src, dst, fields } = body;
    if (!src || !dst || !fields) {
      return NextResponse.json({ ok: false, error: '缺少 src/dst/fields 或 sources/dst' }, { status: 400 });
    }

    const merged = migrateDimensions(src, dst, fields);
    if (!merged) {
      return NextResponse.json({ ok: false, error: `src 或 dst preset 不存在` }, { status: 404 });
    }

    return NextResponse.json({ ok: true, config: merged });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}