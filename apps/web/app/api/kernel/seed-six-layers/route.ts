/**
 * POST /api/kernel/seed-six-layers
 *
 * 种入 6 条「六层提问法」预置内核（Vincent 原创方法论 + GPT 结构化总结）。
 *
 * 设计：
 * - 跟 seed-default（6 条 ship-ready 默认内核）**不冲突**——两个 API 独立
 * - seed-default 给所有新用户（Vincent 自己的方法论）
 * - seed-six-layers 给训练营学员（六层提问法教学示范）
 * - 学员可以同时拥有 12 条
 *
 * 行为：
 * - 6 条都用 category='belief' + kind='experience'（方法论性质）
 * - 6 条都标 scope='六层提问法'（方便筛选 / 训练营学员识别）
 * - 6 条都有 counterExample（什么时候不适用）
 * - 已存在六层（scope 匹配）→ 拒绝（避免重复种子）
 *
 * 用户路径：
 * 1. 训练营学员 onboarding 时调用
 * 2. 用户手动调（在 settings 重新种子）
 */

import { NextResponse } from 'next/server';
import { addUserKernel, listUserKernels } from '@insight-os/db';

export const dynamic = 'force-dynamic';

const SIX_LAYERS = [
  {
    label: '意图',
    content: '用 AI 之前先问自己：我到底想解决什么具体问题？',
    confidence: 95,
    counterExample: '开放性探索（"帮我想想有什么可能"）不需要先定意图',
    scope: '六层提问法 · AI 提问 · 写 prompt · 委托任务',
  },
  {
    label: '背景',
    content: '用 AI 之前先问自己：为什么现在要解决？之前试过什么？',
    confidence: 90,
    counterExample: '完全陌生的全新问题可能没有"之前试过什么"',
    scope: '六层提问法 · AI 提问 · 写 prompt · 委托任务',
  },
  {
    label: '判断',
    content: '用 AI 之前先问自己：什么结果算好？我用什么标准筛方案？',
    confidence: 95,
    counterExample: '没有清晰标准的"开放性探索"可以跳过这层',
    scope: '六层提问法 · AI 提问 · 写 prompt · 委托任务',
  },
  {
    label: '约束',
    content: '用 AI 之前先问自己：哪些边界不能突破？哪些词不能用？',
    confidence: 90,
    counterExample: '完全开放性 brainstorming 可以暂时不设约束',
    scope: '六层提问法 · AI 提问 · 写 prompt · 委托任务',
  },
  {
    label: '风格',
    content: '用 AI 之前先问自己：我要用什么方式表达？给谁看？什么语气？',
    confidence: 85,
    counterExample: '技术性内容（如代码、SQL）风格相对固定，可以不强调',
    scope: '六层提问法 · AI 提问 · 写 prompt · 委托任务',
  },
  {
    label: '反馈',
    content: '用 AI 之前先问自己：哪里不对？为什么不对？怎么改？',
    confidence: 90,
    counterExample: '一次性输出（如快速回答问题）不需要严格的反馈机制',
    scope: '六层提问法 · AI 提问 · 写 prompt · 委托任务',
  },
];

export async function POST() {
  try {
    // 检查是否已存在六层（避免重复种子）
    const existing = listUserKernels({ status: 'active' });
    const existingSixLayers = existing.filter((k) =>
      (k.scope ?? '').includes('六层提问法')
    );
    if (existingSixLayers.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: '已存在六层提问法内核，不再种子',
          existingCount: existingSixLayers.length,
        },
        { status: 409 }
      );
    }

    // 排序：取已有最大 sortOrder + 1
    const maxSort = existing.reduce((m, k) => Math.max(m, k.sortOrder), -1);
    const baseSort = maxSort + 1;

    const ids: { label: string; id: string }[] = [];
    SIX_LAYERS.forEach((k, i) => {
      const id = addUserKernel({
        category: 'belief',
        kind: 'experience',
        content: k.content,
        confidence: k.confidence,
        counterExample: k.counterExample,
        scope: k.scope,
        sortOrder: baseSort + i,
      });
      ids.push({ label: k.label, id });
    });

    return NextResponse.json({
      ok: true,
      seeded: ids.length,
      ids,
      message: '已种入 6 条六层提问法预置内核',
    });
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
    return NextResponse.json(
      { ok: false, error: e.message ?? String(e) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/kernel/seed-six-layers
 *
 * 返回六层提问法的元数据（不写入 db，只读）
 * - 用于 onboarding 展示 / preview
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    title: '六层提问法',
    description: '用 AI 之前，先问自己 6 个层次的问题：意图 / 背景 / 判断 / 约束 / 风格 / 反馈。',
    origin: 'Vincent 原创方法论，GPT 协助结构化总结',
    layers: SIX_LAYERS.map((k, i) => ({
      order: i + 1,
      label: k.label,
      content: k.content,
      confidence: k.confidence,
      counterExample: k.counterExample,
    })),
    usage: 'POST /api/kernel/seed-six-layers 一次性种入 6 条到 user_kernels',
  });
}
