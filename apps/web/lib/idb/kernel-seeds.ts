/**
 * V1.11 预置 Kernel 模板
 *
 * 之前 /api/kernel/seed-default / seed-six-layers 服务端写 SQLite
 * V1.11 改为 client 端写 IndexedDB（Vercel demo 必备）
 *
 * 三个 seed：
 * - default: 5 条通用 kernel（belief / contrarian / expertise / challenge / principle）
 * - six-layers: 6 条 Vincent 原创的六层提问法 kernel
 */

import { addUserKernel } from './operations';

export const DEFAULT_KERNELS = [
  {
    id: 'kernel-default-1',
    category: 'belief' as const,
    kind: 'belief' as const,
    content: '决策的真正成本不是金钱，而是时间 + 机会 + 心智带宽',
    confidence: 85,
    counterExample: '买便宜货省 100 块但浪费 1 小时调研',
    scope: '通用',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 1,
  },
  {
    id: 'kernel-default-2',
    category: 'contrarian' as const,
    kind: 'contrarian' as const,
    content: '「忙」不等于「有价值」——大部分忙碌是混乱的代名词',
    confidence: 80,
    counterExample: '',
    scope: '通用',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 2,
  },
  {
    id: 'kernel-default-3',
    category: 'expertise' as const,
    kind: 'experience' as const,
    content: '判断力的差距来自素材库的密度，而不是信息量的多少',
    confidence: 90,
    counterExample: '',
    scope: '通用',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 3,
  },
  {
    id: 'kernel-default-4',
    category: 'challenge' as const,
    kind: 'hypothesis' as const,
    content: 'AI 不能取代人做判断，但能取代人做素材整理',
    confidence: 75,
    counterExample: '',
    scope: '通用',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 4,
  },
  {
    id: 'kernel-default-5',
    category: 'principle' as const,
    kind: 'principle' as const,
    content: '判断的复用价值大于知识本身——一次判断胜过十次阅读',
    confidence: 95,
    counterExample: '',
    scope: '通用',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 5,
  },
];

export const SIX_LAYERS_KERNELS = [
  {
    id: 'kernel-six-layers-1',
    category: 'principle' as const,
    kind: 'principle' as const,
    content: '第一层：现象——这是「发生了什么」（事实层，不评判）',
    confidence: 95,
    counterExample: '',
    scope: '六层提问法',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 1,
  },
  {
    id: 'kernel-six-layers-2',
    category: 'principle' as const,
    kind: 'principle' as const,
    content: '第二层：模式——「类似情况还有什么」（找出可复用模式）',
    confidence: 95,
    counterExample: '',
    scope: '六层提问法',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 2,
  },
  {
    id: 'kernel-six-layers-3',
    category: 'belief' as const,
    kind: 'principle' as const,
    content: '第三层：因果——「为什么会这样」（驱动机制，不是表面相关）',
    confidence: 90,
    counterExample: '',
    scope: '六层提问法',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 3,
  },
  {
    id: 'kernel-six-layers-4',
    category: 'contrarian' as const,
    kind: 'hypothesis' as const,
    content: '第四层：边界——「什么时候不成立」（反例与失效条件）',
    confidence: 90,
    counterExample: '',
    scope: '六层提问法',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 4,
  },
  {
    id: 'kernel-six-layers-5',
    category: 'expertise' as const,
    kind: 'experience' as const,
    content: '第五层：反常识——「别人通常怎么想」（打破惯性视角）',
    confidence: 85,
    counterExample: '',
    scope: '六层提问法',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 5,
  },
  {
    id: 'kernel-six-layers-6',
    category: 'principle' as const,
    kind: 'principle' as const,
    content: '第六层：判断——「那我现在应该怎么做」（指导行动）',
    confidence: 95,
    counterExample: '',
    scope: '六层提问法',
    evidenceAssetIdsJson: '[]',
    referencedCount: 0,
    status: 'active' as const,
    sortOrder: 6,
  },
];

export async function seedDefaultKernels(): Promise<{ seeded: number; existingCount: number }> {
  let seeded = 0;
  let existingCount = 0;
  for (const k of DEFAULT_KERNELS) {
    try {
      await addUserKernel(k);
      seeded++;
    } catch (e: any) {
      if (String(e?.message).includes('exists') || String(e?.message).includes('constraint')) {
        existingCount++;
      } else {
        existingCount++;
      }
    }
  }
  return { seeded, existingCount };
}

export async function seedSixLayersKernels(opts?: { preview?: boolean }): Promise<{ seeded: number; existingCount: number; title?: string; description?: string; origin?: string; layers?: any[]; usage?: string }> {
  if (opts?.preview) {
    return {
      seeded: 0,
      existingCount: 0,
      title: '六层提问法',
      description: '用 AI 之前，先问自己 6 个层次的问题：意图 / 背景 / 判断 / 约束 / 风格 / 反馈。',
      origin: 'Vincent 原创方法论，GPT 协助结构化总结',
      layers: SIX_LAYERS_KERNELS.map((k, i) => ({
        order: i + 1,
        label: k.label,
        content: k.content,
        confidence: k.confidence,
        counterExample: k.counterExample,
      })),
      usage: 'POST 一次性种入 6 条到 user_kernels',
    };
  }
  let seeded = 0;
  let existingCount = 0;
  for (const k of SIX_LAYERS_KERNELS) {
    try {
      await addUserKernel(k);
      seeded++;
    } catch {
      existingCount++;
    }
  }
  return { seeded, existingCount };
}