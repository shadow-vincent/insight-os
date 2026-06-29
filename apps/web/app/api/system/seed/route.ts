/**
 * POST /api/system/seed   插入示例数据（v1.0 Onboarding）
 *
 * 幂等：如果检测到已有 sample- 前缀的资产，直接返回不重复插入
 *
 * 数据设计：
 *   - 8 张示例资产：跨 E0/E1/E2 三个等级，跨 2 个示例主题
 *   - 2 个示例主题：sample-product（产品判断）/ sample-management（管理判断）
 *   - 1 个示例 kernel：手动预生成（不调 LLM，避免种子过程依赖 LLM）
 *   - 1 个示例写作：用 sample-001/002/003 3 张卡组合成的骨架 + 草稿
 *
 * 别人装上后能立刻看到：
 *   - 仪表盘"今日待办"有内容（可输出 3 张 / 待反馈 1 个）
 *   - 资产库有 8 张卡
 *   - 主题地图有 2 个主题 + 1 个 kernel
 *   - 输出历史有 1 个示例写作
 */

import { NextRequest } from 'next/server';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, getRawSqlite, assets, topics, topicKernels, outputs, assetTopics } from '@insight-os/db';
import { readConfig } from '@insight-os/core';

export const dynamic = 'force-dynamic';

interface SampleCard {
  id: string;
  title: string;
  oneSentenceInsight: string;
  antiCommonSense: string;
  evidenceLevel: 'E0' | 'E1' | 'E2';
  priority: 'A' | 'B' | 'C';
  tags: string[];
  body: string;
}

const SAMPLE_CARDS: SampleCard[] = [
  {
    id: 'sample-001',
    title: '判断力比知识更稀缺',
    oneSentenceInsight: 'AI 时代最稀缺的不是"会用 AI 的人"，是"知道什么不该让 AI 做的人"。',
    antiCommonSense: '大多数人以为 AI 时代缺的是 prompt 技巧，实际上缺的是判断该不该用、用在哪的价值感。',
    evidenceLevel: 'E0',
    priority: 'A',
    tags: ['AI', '判断力'],
    body: '## 一句话洞察\n\nAI 时代最稀缺的不是"会用 AI 的人"，是"知道什么不该让 AI 做的人"。\n\n## 反常识\n\n大多数人以为 AI 时代缺的是 prompt 技巧，实际上缺的是判断该不该用、用在哪的价值感。\n\n## 行动建议\n\n每天问自己：这周做的决策里，哪些是 AI 替代不了的？',
  },
  {
    id: 'sample-002',
    title: '激励错位让好人做出坏决策',
    oneSentenceInsight: '好人在"正确逻辑"下推出错误行为，方向比强度重要。',
    antiCommonSense: '大多数管理者以为"激励不够"才出问题，但"激励对准了错误方向"比没激励更糟。',
    evidenceLevel: 'E2',
    priority: 'A',
    tags: ['组织', '激励'],
    body: '## 一句话洞察\n\n好人在"正确逻辑"下推出错误行为，方向比强度重要。\n\n## 反常识\n\n大多数管理者以为"激励不够"才出问题，但"激励对准了错误方向"比没激励更糟。\n\n## 案例\n\n销售团队按"处理工单数"考核 → 客服学会"快速关单" → 客户问题没解决但工单关了。',
  },
  {
    id: 'sample-003',
    title: '决策传递损耗的根源',
    oneSentenceInsight: '把"一把手工程"变"甩手工程"的结构性根源，是中间层把"转化"做成了"转述"。',
    antiCommonSense: '多数人以为是中层执行力问题，实质是"信息密度的传递衰减" + "责任稀释"。',
    evidenceLevel: 'E2',
    priority: 'A',
    tags: ['组织', '决策'],
    body: '## 一句话洞察\n\n把"一把手工程"变"甩手工程"的结构性根源，是中间层把"转化"做成了"转述"。\n\n## 反常识\n\n多数人以为是中层执行力问题，实质是"信息密度的传递衰减" + "责任稀释"。',
  },
  {
    id: 'sample-004',
    title: 'AI 是组织问题的放大器',
    oneSentenceInsight: 'AI 不是解决组织问题的工具，而是组织问题的放大器，会暴露问题但不会解决问题。',
    antiCommonSense: '管理者常以为引入 AI 能自动修复流程缺陷，实质 AI 只让既有矛盾更可见。',
    evidenceLevel: 'E1',
    priority: 'A',
    tags: ['AI', '组织'],
    body: '## 一句话洞察\n\nAI 不是解决组织问题的工具，而是组织问题的放大器，会暴露问题但不会解决问题。',
  },
  {
    id: 'sample-005',
    title: '信息即权力',
    oneSentenceInsight: '数字化变革的本质是政治工程，不是技术工程——信息壁垒被打破，决策权必然重构。',
    antiCommonSense: '把数字化当成"上系统"是常见误区；本质上信息透明会重新分配权力。',
    evidenceLevel: 'E2',
    priority: 'A',
    tags: ['数字化', '组织'],
    body: '## 一句话洞察\n\n数字化变革的本质是政治工程，不是技术工程——信息壁垒被打破，决策权必然重构。',
  },
  {
    id: 'sample-006',
    title: '承诺真空是新组织失效的形态',
    oneSentenceInsight: '当 AI 把执行权下放，原本的"承诺链"断裂，组织会进入"无主地带"。',
    antiCommonSense: '委托代理关系在 AI 时代正在失效，主因不是 AI 智能，而是承诺传递机制没跟上。',
    evidenceLevel: 'E1',
    priority: 'B',
    tags: ['AI', '组织'],
    body: '## 一句话洞察\n\n当 AI 把执行权下放，原本的"承诺链"断裂，组织会进入"无主地带"。',
  },
  {
    id: 'sample-007',
    title: '数字化转型的八大系统陷阱',
    oneSentenceInsight: '系统上线不是终点，规则在线才是能力——八大陷阱是管理层最容易忽视的部分。',
    antiCommonSense: '大多数数字化失败不是因为技术不成熟，而是"流程固化"+"人的工具化"+"系统间不联通" 等 8 个陷阱。',
    evidenceLevel: 'E1',
    priority: 'B',
    tags: ['数字化'],
    body: '## 一句话洞察\n\n系统上线不是终点，规则在线才是能力——八大陷阱是管理层最容易忽视的部分。',
  },
  {
    id: 'sample-008',
    title: '判断力需要摩擦才能生长',
    oneSentenceInsight: '自动化陷阱：把所有判断外包给 AI = 切断判断力生长的"摩擦"。',
    antiCommonSense: '把判断外包给 AI 看似提高效率，长期会让人的判断肌肉萎缩。',
    evidenceLevel: 'E1',
    priority: 'B',
    tags: ['AI', '判断力'],
    body: '## 一句话洞察\n\n自动化陷阱：把所有判断外包给 AI = 切断判断力生长的"摩擦"。',
  },
];

const SAMPLE_TOPICS = [
  {
    id: 'sample-topic-001',
    name: 'AI 时代的判断力',
    slug: 'sample-judgment',
    description: 'AI 不替代判断，反而放大了判断力稀缺——这是 Insight OS 的核心主题之一。',
    coreBeliefs: [
      '判断力比知识更稀缺，且在摩擦中淬炼成长',
      'AI 是组织问题的放大器，不是解决方案',
      '知道什么不该让 AI 做，比会用 AI 更重要',
    ],
  },
  {
    id: 'sample-topic-002',
    name: '组织治理示例',
    slug: 'sample-governance',
    description: '组织设计与激励错位——条块均衡、激励错位、好人文化。',
    coreBeliefs: [
      '激励错位让好人做出坏决策',
      '信息透明带来分权，信息封闭导向集权',
      '数字化转型是技术工程，也是政治工程',
    ],
  },
];

export async function POST(_req: NextRequest) {
  try {
    const db = getDb();

    if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });
    const sqlite = getRawSqlite();

    // 幂等检查
    const existing = sqlite.prepare(`SELECT count(*) as c FROM assets WHERE id LIKE 'sample-%'`).get() as any;
    if ((existing?.c ?? 0) > 0) {
      return Response.json({ ok: true, skipped: true, sampleAssetsCount: existing.c, message: '已 seed 过，跳过' });
    }

    const now = Math.floor(Date.now() / 1000);
    const cfg = readConfig();
    const vaultDir = resolve(cfg.paths.vaultPath, '04_管理洞察');

    // 1) 写 .md 文件（如果 vault 路径有效）
    const writeFiles = existsSync(vaultDir);
    if (!writeFiles && existsSync(cfg.paths.vaultPath)) {
      try { mkdirSync(vaultDir, { recursive: true }); } catch { /* noop */ }
    }

    // 2) 插入 8 张资产
    for (const c of SAMPLE_CARDS) {
      db.insert(assets).values({
        id: c.id,
        type: 'asset',
        status: 'in_use',
        title: c.title,
        oneSentenceInsight: c.oneSentenceInsight,
        antiCommonSense: c.antiCommonSense,
        evidenceLevel: c.evidenceLevel,
        priority: c.priority,
        tagsJson: JSON.stringify(c.tags),
        filePath: resolve(vaultDir, `资产卡_sample_${c.id}.md`),
        fileMtime: now,
        fileHash: '',
        relatedIdsJson: '[]',
        createdAt: now,
        updatedAt: now,
        feedbackCount: 0,
      }).onConflictDoNothing().run();

      // 写 .md 文件
      if (existsSync(vaultDir)) {
        const frontmatter = [
          '---',
          `title: ${c.title}`,
          `type: asset`,
          `evidence_level: ${c.evidenceLevel}`,
          `priority: ${c.priority}`,
          `tags: [${c.tags.map(t => `"${t}"`).join(', ')}]`,
          '---',
          '',
        ].join('\n');
        try {
          writeFileSync(resolve(vaultDir, `资产卡_sample_${c.id}.md`), frontmatter + c.body, 'utf-8');
        } catch { /* skip */ }
      }
    }

    // 3) 插入 2 个主题
    for (const t of SAMPLE_TOPICS) {
      db.insert(topics).values({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        coreBeliefsJson: JSON.stringify(t.coreBeliefs),
        sortOrder: 999,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing().run();
    }

    // 4) 资产-主题关联
    const topicMap: Record<string, string[]> = {
      'sample-topic-001': ['sample-001', 'sample-004', 'sample-006', 'sample-008'],
      'sample-topic-002': ['sample-002', 'sample-003', 'sample-005', 'sample-007'],
    };
    for (const [tid, aids] of Object.entries(topicMap)) {
      for (const aid of aids) {
        db.insert(assetTopics).values({
          id: randomUUID(),
          assetId: aid,
          topicId: tid,
          confidence: 100,
          assignedBy: 'human',
          createdAt: now,
        }).onConflictDoNothing().run();
      }
    }

    // 5) 主题 kernel（手写预生成，不调 LLM）
    db.insert(topicKernels).values({
      id: randomUUID(),
      topicId: 'sample-topic-001',
      headline: 'AI 放大判断力稀缺，不替代判断。',
      summary: 'AI 时代最稀缺的资源是判断力——能用 AI 做事的人很多，知道该不该让 AI 做的人很少。AI 不是组织问题的解药，而是放大器；自动化陷阱会让人的判断肌肉萎缩；承诺链断裂会创造新的"无主地带"。',
      coreBeliefsJson: JSON.stringify([
        { text: '判断力比知识更稀缺，且在摩擦中淬炼成长', sourceCardIds: ['sample-001', 'sample-008'] },
        { text: 'AI 是组织问题的放大器，不是解决方案', sourceCardIds: ['sample-004'] },
        { text: '知道什么不该让 AI 做，比会用 AI 更重要', sourceCardIds: ['sample-001'] },
        { text: '承诺真空是新组织失效的形态', sourceCardIds: ['sample-006'] },
      ]),
      sourceAssetIdsJson: JSON.stringify(['sample-001', 'sample-004', 'sample-006', 'sample-008']),
      generatedAt: now,
      generationModel: 'manual',
    }).onConflictDoNothing().run();

    // 6) 1 个示例写作
    const writingId = `sample-writing-${randomUUID().slice(0, 8)}`;
    const scaffold = {
      title: 'AI 时代最稀缺的不是会用 AI',
      openingHook: '你可能会惊讶：那些最会写 prompt 的人，往往正在用 AI 做不该做的事。',
      sections: [
        { heading: '判断力比知识更稀缺', keyPoints: ['能用 AI 的人多', '知道什么不该 AI 做的人少'], refAssetIds: ['sample-001'], contentHint: '举一个公司让 AI 自动批准小额支出，结果出现批量异常的例子' },
        { heading: 'AI 是放大器，不是解药', keyPoints: ['暴露问题不解决问题', '加速矛盾而非修复'], refAssetIds: ['sample-004'], contentHint: '说明 AI 时代组织失效会被加速' },
        { heading: '自动化陷阱', keyPoints: ['判断力需要摩擦', '外包判断 = 切断生长'], refAssetIds: ['sample-008'], contentHint: '把判断外包给 AI 看似提效，长期萎缩' },
      ],
      closingAction: '这周关掉 1 个 AI 自动化工具，自己手动做一次那个决策',
    };
    db.insert(outputs).values({
      id: writingId,
      assetIdsJson: JSON.stringify(['sample-001', 'sample-004', 'sample-008']),
      outputType: 'writing',
      title: scaffold.title,
      content: `## ${scaffold.openingHook}\n\n这是一篇用 Insight OS 自动生成的示例写作。\n\n目的：让你打开 Insight OS 就能看到完整的"主题 → 选判断 → 选卡 → 生成骨架 → 编辑 → 发布"闭环。\n\n你可以：\n- 直接编辑这篇内容\n- 在写作详情页查看左边的骨架 + 右边的内容\n- 用底部的"陪练"测试反方 / 推荐卡 / 查重\n- 点"发布并反哺"（先改成 draft 状态才能发布）`,
      audience: 'wechat_article',
      status: 'used',
      templateType: '公众号长文',
      topicId: 'sample-topic-001',
      writingStatus: 'published',
      scaffoldJson: JSON.stringify(scaffold),
      sourceUrl: 'https://example.com/sample-writing',
      createdAt: now,
      updatedAt: now,
    }).run();

    return Response.json({
      ok: true,
      skipped: false,
      sampleAssetsCount: SAMPLE_CARDS.length,
      sampleTopicsCount: SAMPLE_TOPICS.length,
      writingId,
    });
  } catch (e: any) {
    console.error('[system/seed]', e);
    return Response.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
