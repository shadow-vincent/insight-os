import { getDb, getRawSqlite, assets, feedback } from '@insight-os/db';
import { eq, desc } from 'drizzle-orm';
import { readFileSync, existsSync } from 'node:fs';
import { notFound } from 'next/navigation';
import { isLLMConfigured } from '@insight-os/core';
import { AssetDetailClient } from './AssetDetailClient';

export const dynamic = 'force-dynamic';

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const sqlite = getRawSqlite();
  const asset = db.select().from(assets).where(eq(assets.id, id)).get();

  if (!asset) {
    return notFound();
  }

  const tags: string[] = JSON.parse(asset.tagsJson || '[]');
  const llmEnabled = isLLMConfigured();

  // 读 .md 文件全文（仅当文件存在时）
  let body = '';
  const fileExists = existsSync(asset.filePath);
  if (fileExists) {
    try {
      const content = readFileSync(asset.filePath, 'utf-8');
      const bodyStart = content.indexOf('\n---\n');
      body = bodyStart !== -1 ? content.slice(bodyStart + 5) : content;
    } catch (e) {
      body = '';
    }
  }

  // light 卡：文件可能不存在，用 db 字段构造 markdown body
  if (!body && asset.type === 'light') {
    const sections: string[] = [];
    if (asset.oneSentenceInsight) {
      sections.push(`## 一句话洞察\n\n${asset.oneSentenceInsight}`);
    }
    if (asset.antiCommonSense) {
      sections.push(`## 反常识\n\n${asset.antiCommonSense}`);
    }
    if (tags.length > 0) {
      sections.push(`## 标签\n\n${tags.map(t => `\`${t}\``).join(' · ')}`);
    }
    sections.push(`\n> 💡 这是一条轻量卡（仅 LLM 整理结果，未校准）。到「开始写作」基于此卡创作，或去详情校准后即可升级为正式资产卡。`);
    body = sections.join('\n\n');
  }

  // ===== v0.10.3 进化时间线 =====
  // 1) 反馈事件（按时间倒序）
  const feedbackRows = db.select().from(feedback)
    .where(eq(feedback.assetId, id))
    .orderBy(desc(feedback.createdAt))
    .all();
  // 2) 输出事件：output 关联到本资产（LIKE 包含本 id 字符串）
  const allOutputs = sqlite.prepare(`
    SELECT id, title, output_type as outputType, template_type as templateType,
           source_url as sourceUrl, created_at as createdAt
    FROM outputs
    WHERE asset_ids_json LIKE ?
    ORDER BY created_at DESC
  `).all(`%"${id}"%`) as any[];

  return (
    <AssetDetailClient
      asset={{
        id: asset.id,
        type: asset.type,
        status: asset.status,
        title: asset.title,
        evidenceLevel: asset.evidenceLevel,
        priority: asset.priority,
        tagsJson: asset.tagsJson,
        oneSentenceInsight: asset.oneSentenceInsight,
        antiCommonSense: asset.antiCommonSense,
        filePath: asset.filePath,
        body,
        feedbackCount: asset.feedbackCount ?? 0,
        fileExists,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      }}
      initialBody={body}
      tags={tags}
      llmEnabled={llmEnabled}
      timeline={{
        feedback: feedbackRows.map(f => ({
          id: f.id,
          scene: f.scene,
          reaction: f.reaction,
          mostTouchedPoint: f.mostTouchedPoint,
          evidenceLevelBefore: f.evidenceLevelBefore,
          evidenceLevelAfter: f.evidenceLevelAfter,
          createdAt: f.createdAt,
        })),
        outputs: allOutputs,
      }}
    />
  );
}
