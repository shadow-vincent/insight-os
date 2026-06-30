/**
 * GET /api/kernel/export-md · 导出 beliefs.md
 *
 * 输出 markdown 文件，按 4 类别分组 + 每条带置信度/反例/适用场景
 * 用户可下载走 git 版本控制
 */

import { NextResponse } from 'next/server';
import { listUserKernels } from '@insight-os/db';

export const dynamic = 'force-dynamic';

function categoryHeader(cat: string): string {
  switch (cat) {
    case 'belief':     return '# 底层信念 (Belief)\n\n长期价值主张 / 哲学立场。\n\n';
    case 'contrarian': return '# 反常识判断 (Contrarian)\n\n反对主流叙事的判断。\n\n';
    case 'expertise':  return '# 擅长问题域 (Expertise)\n\n被验证过能力的领域。\n\n';
    case 'challenge':  return '# 想挑战的常识 (Challenge)\n\n想消灭 / 重塑的行业套话。\n\n';
    default:           return `# ${cat}\n\n`;
  }
}

function formatKernel(k: any, idx: number): string {
  let s = `## ${idx + 1}. ${k.content}\n\n`;
  s += `- **类别**: ${k.category}\n`;
  s += `- **kind**: ${k.kind}\n`;
  s += `- **置信度**: ${k.confidence}/100\n`;
  if (k.scope) s += `- **适用**: ${k.scope}\n`;
  if (k.counterExample) s += `- **不适用**: ${k.counterExample}\n`;
  if (k.evidenceAssetIds && k.evidenceAssetIds.length > 0) {
    s += `- **关联证据**: ${k.evidenceAssetIds.join(', ')}\n`;
  }
  s += `\n`;
  return s;
}

export async function GET() {
  try {
    const kernels = listUserKernels({ status: 'active' });

    const groups: Record<string, any[]> = {
      belief: [],
      contrarian: [],
      expertise: [],
      challenge: [],
    };
    for (const k of kernels) {
      if (groups[k.category]) groups[k.category].push(k);
    }

    let md = `# Beliefs · Insight Kernel\n\n`;
    md += `> 用户判断协议 · 由 Insight Asset OS 自动生成 · ${kernels.length} 条\n\n`;
    md += `**生成时间**: ${new Date().toISOString()}\n\n`;
    md += `---\n\n`;

    for (const cat of ['belief', 'contrarian', 'expertise', 'challenge'] as const) {
      const list = groups[cat];
      if (list.length === 0) continue;
      md += categoryHeader(cat);
      list.forEach((k, i) => { md += formatKernel(k, i); });
      md += `---\n\n`;
    }

    // 元数据
    md += `\n<!-- metadata\n`;
    md += `total: ${kernels.length}\n`;
    md += `generated_by: insight-os v1.4\n`;
    md += `-->\n`;

    return new NextResponse(md, {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="beliefs-${new Date().toISOString().slice(0, 10)}.md"`,
      },
    });
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
