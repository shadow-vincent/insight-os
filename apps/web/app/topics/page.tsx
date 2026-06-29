/**
 * /topics
 *
 * 主题资产包 · v1.8.0 主动判断加工系统
 *
 * 不是项目管理，而是围绕一个主题聚合所有判断资产。
 * 每个主题包含：核心判断、支撑资产、证据缺口、可输出内容、商业用途。
 *
 * V1.8.0 用户化设计（按 Vincent v3 评价第 4 条）：
 * - 不写"值多少钱"（无真实数据时不强加估算）
 * - 不暴露"主题战役"等系统术语
 * - 强调"这个主题能输出什么 / 还差什么 / 商业用途是什么"
 */

import { getDb, topics, assets, assetTopics, topicKernels } from '@insight-os/db';
import { eq, sql } from 'drizzle-orm';
import { TopicAssetPackageClient } from './TopicAssetPackageClient';

export const dynamic = 'force-dynamic';

interface TopicAsset {
  id: string;
  title: string;
  evidenceLevel: string;
  outputCount: number;
}

interface TopicOutput {
  id: string;
  title: string;
  outputType: string;
  createdAt: number;
}

interface TopicKernelInfo {
  headline: string;
  summary: string;
  coreBeliefs: string[];
}

export default function TopicsPage() {
  const db = getDb();
  if (!db) return null;

  // 1. 加载所有主题
  const allTopics = db.select().from(topics).orderBy(topics.sortOrder).all();
  if (allTopics.length === 0) {
    return (
      <div style={{ padding: 32 }}>
        <h1 className="page-title">主题资产包</h1>
        <p className="page-subtitle">围绕一个主题聚合所有判断资产，告诉你「这个主题能输出什么、还差什么、商业用途是什么」。</p>
        <div className="card" style={{ padding: 40, textAlign: 'center', marginTop: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>还没有主题</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            在「判断资产」里把资产归到主题，主题资产包就会自动汇总。
          </div>
        </div>
      </div>
    );
  }

  // 2. 用 raw SQL 一次性加载每个主题的 assets + outputs + kernel
  // （避免 Drizzle 嵌套 join 的复杂 SQL）
  const topicData = allTopics.map(t => {
    // 资产清单
    const assetsRows = db.all(sql`
      SELECT a.id, a.title, a.evidence_level as evidenceLevel, a.output_count as outputCount
      FROM assets a
      INNER JOIN asset_topics at ON at.asset_id = a.id
      WHERE at.topic_id = ${t.id}
      ORDER BY a.evidence_level DESC, a.updated_at DESC
    `) as TopicAsset[];

    // 输出清单（通过 outputs.topic_id 关联）
    const outputsRows = db.all(sql`
      SELECT id, title, output_type as outputType, created_at as createdAt
      FROM outputs
      WHERE topic_id = ${t.id}
      ORDER BY created_at DESC
      LIMIT 5
    `) as TopicOutput[];

    // Kernel 摘要
    const kernelRow = db.select().from(topicKernels).where(eq(topicKernels.topicId, t.id)).get();
    let kernel: TopicKernelInfo | null = null;
    if (kernelRow) {
      let coreBeliefs: string[] = [];
      try { coreBeliefs = JSON.parse(kernelRow.coreBeliefsJson || '[]'); } catch { /* noop */ }
      kernel = {
        headline: kernelRow.headline,
        summary: kernelRow.summary,
        coreBeliefs,
      };
    }

    // 质量统计
    const total = assetsRows.length;
    const e3Plus = assetsRows.filter(a => ['E3', 'E4', 'E5'].includes(a.evidenceLevel)).length;

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      assets: assetsRows,
      outputs: outputsRows,
      kernel,
      quality: { total, e3Plus },
    };
  });

  return <TopicAssetPackageClient topics={topicData} />;
}