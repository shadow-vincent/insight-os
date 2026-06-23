/**
 * POST /api/kernel/seed-default
 *
 * 种入 6 条 ship-ready 默认内核（Vincent 风格通用版）。
 *
 * 行为：
 * - 如果 user_kernels 表里**已经有任意 active 内核** → 拒绝（避免覆盖）
 * - 否则插入 6 条
 *
 * 用户路径：
 * 1. onboarding 时调用（首次启动 + LLM 配置完后）
 * 2. 用户手动调（在 settings 重新种子）
 */

import { NextResponse } from 'next/server';
import { addUserKernel, listUserKernels } from '@insight-os/db';

export const dynamic = 'force-dynamic';

const DEFAULT_KERNELS = [
  {
    category: 'belief' as const,
    kind: 'belief' as const,
    content: '管理的本质是激发人的善意和潜能，而不是控制',
    confidence: 95,
    counterExample: '合规高压场景（金融/医疗），前期需要强约束 + 后期再激发',
    scope: '客户咨询 · 团队管理 · 公众号',
  },
  {
    category: 'belief' as const,
    kind: 'belief' as const,
    content: '判断力比知识稀缺，AI 时代尤其如此',
    confidence: 90,
    counterExample: '执行型工作（数据录入、流水线操作）知识依然重要',
    scope: '通用',
  },
  {
    category: 'contrarian' as const,
    kind: 'contrarian' as const,
    content: 'AI 不会让所有人变强，只让强者更强',
    confidence: 85,
    counterExample: '教育普惠场景下 AI 可能缩小差距（但要看设计）',
    scope: '通用 · 战略讨论',
  },
  {
    category: 'contrarian' as const,
    kind: 'experience' as const,
    content: '组织变革的瓶颈从来不是技术，是组织吸收力',
    confidence: 85,
    counterExample: '从 0 到 1 的全新业务，技术确实是瓶颈',
    scope: '客户咨询 · 大企业变革',
  },
  {
    category: 'expertise' as const,
    kind: 'experience' as const,
    content: '战略定位：找到用户非买不可的理由（不是「我们能做什么」）',
    confidence: 90,
    counterExample: '政策驱动型采购（如某些合规项目）理由是「不得不买」而非「非买不可」',
    scope: '客户咨询 · 战略',
  },
  {
    category: 'challenge' as const,
    kind: 'hypothesis' as const,
    content: '"AI 让所有人变强" 是 AI 厂商营销叙事，不是事实',
    confidence: 55,
    counterExample: '学习能力 + 自律强的用户，AI 确实能放大其能力',
    scope: '通用 · 反对套话',
  },
];

export async function POST() {
  try {
    const existing = listUserKernels({ status: 'active' });
    if (existing.length > 0) {
      return NextResponse.json({
        ok: false,
        error: '已有激活的内核，不再种子',
        existingCount: existing.length,
      }, { status: 409 });
    }

    const ids: string[] = [];
    DEFAULT_KERNELS.forEach((k, i) => {
      const id = addUserKernel({ ...k, sortOrder: i });
      ids.push(id);
    });

    return NextResponse.json({
      ok: true,
      seeded: ids.length,
      ids,
      message: '已种入 6 条 ship-ready 默认内核',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
