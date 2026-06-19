/**
 * Seed 默认主题
 *
 * 用法: node scripts/seed-topics.mjs
 *
 * 只在 topics 表为空时插入，避免重复
 */

import { getDb, topics } from '@insight-os/db';
import { randomUUID } from 'node:crypto';

const DEFAULT_TOPICS = [
  {
    name: '财务数字化',
    slug: 'finance-digital',
    description: '集团财务规则治理、业财一体化、凭证自动化',
    coreBeliefs: [
      '凭证自动化是结果，规则治理才是核心',
      '预算不是控制花钱，而是资源配置',
      '财务数字化不是做账更快，而是规则更清楚',
    ],
    sortOrder: 1,
  },
  {
    name: 'AI 落地',
    slug: 'ai-landing',
    description: '企业 AI 转型、组织吸收力、人机权责',
    coreBeliefs: [
      'AI 落地不是工具上线，而是权责重构',
      '企业 AI 差距不在模型，而在知识管理',
      'Agent 不是万能员工，而是被授权的业务角色',
    ],
    sortOrder: 2,
  },
  {
    name: '组织治理',
    slug: 'org-governance',
    description: '条块均衡、激励错位、好人文化、承诺',
    coreBeliefs: [
      '激励错位让好人做出坏决策',
      '条条与块块的动态平衡决定组织效率',
      '承诺是组织修复的第一杠杆',
    ],
    sortOrder: 3,
  },
  {
    name: '数字化转型',
    slug: 'digital-transformation',
    description: '信息透明、权力分配、技术 vs 政治',
    coreBeliefs: [
      '系统上线不是终点，规则在线才是能力',
      '信息透明带来分权，信息封闭导向集权',
      '数字化转型是技术工程，也是政治工程',
    ],
    sortOrder: 4,
  },
  {
    name: '经营能力',
    slug: 'business-capability',
    description: '管理者有效性、决策力、判断力',
    coreBeliefs: [
      '判断力是 AI 时代最稀缺的资源',
      '有效决策比快速决策更重要',
      '管理者的有效性是可以学会的',
    ],
    sortOrder: 5,
  },
  {
    name: '客户沟通',
    slug: 'client-comm',
    description: '咨询话术、需求诊断、方案呈现',
    coreBeliefs: [
      '客户买的不是方案，是判断',
      '诊断比方案更值钱',
      '客户沟通要"轻"，要"准"',
    ],
    sortOrder: 6,
  },
  {
    name: '课程开发',
    slug: 'course-dev',
    description: '管理培训、卓有成效、贡献导向',
    coreBeliefs: [
      '课程的核心是观点，不是知识',
      '要事优先比时间管理更底层',
      '管理者的产出是训练他人',
    ],
    sortOrder: 7,
  },
];

const db = getDb();
const existing = db.select().from(topics).all();

if (existing.length > 0) {
  console.log(`topics 表已有 ${existing.length} 条记录，跳过 seed`);
  process.exit(0);
}

const now = Math.floor(Date.now() / 1000);
for (const t of DEFAULT_TOPICS) {
  db.insert(topics)
    .values({
      id: `topic_${randomUUID().slice(0, 8)}`,
      name: t.name,
      slug: t.slug,
      description: t.description,
      coreBeliefsJson: JSON.stringify(t.coreBeliefs),
      sortOrder: t.sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  console.log(`  ✓ ${t.name}`);
}

console.log(`\n已 seed ${DEFAULT_TOPICS.length} 个默认主题`);
