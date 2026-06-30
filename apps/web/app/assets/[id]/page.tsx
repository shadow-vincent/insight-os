import { getDb, getRawSqlite, assets, feedback, userKernels, outputs } from '@insight-os/db';
import { eq, desc, and, like } from 'drizzle-orm';
import { readFileSync, existsSync } from 'node:fs';
import { isLLMConfigured } from '@insight-os/core';
import { AssetDetailClient } from './AssetDetailClient';
import { ClientAssetLoader } from '@/components/ClientAssetLoader';

export const dynamic = 'force-dynamic';

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  // V1.10: server 没 SQLite（Vercel serverless / demo 模式）→ 让 client 从 IndexedDB 读
  if (!db) return <ClientAssetLoader id={id} />;
  const sqlite = getRawSqlite();
  const asset = db.select().from(assets).where(eq(assets.id, id)).get();

  // V1.11.10: SQLite 找不到时 fallback 到 client IDB（V1.10 后用户更多在 IDB 写卡）
  // 避免 Vercel 用户导回本地版后 /assets/[id] 跳出来空白
  if (!asset) {
    return <ClientAssetLoader id={id} />;
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

  // ===== v1.6 强化进化线 - 5 阶段 =====
  // 3) Kernel 引用：active kernel 把此资产作为 evidence
  const activeKernels = db.select().from(userKernels)
    .where(eq(userKernels.status, 'active'))
    .all();
  const referencedKernels = activeKernels.filter((k) => {
    try {
      const ids = JSON.parse(k.evidenceAssetIdsJson ?? '[]') as string[];
      return ids.includes(id);
    } catch {
      return false;
    }
  });

  // 构造 5 阶段 timeline items
  const enhancedTimelineItems: Array<{
    stage: 'source' | 'upgrade' | 'output' | 'feedback' | 'kernel';
    ts: number;
    title: string;
    subtitle?: string;
    meta?: string;
    href?: string;
    stageLabel: string;
    stageColor: string;
  }> = [];

  // 来源
  enhancedTimelineItems.push({
    stage: 'source',
    ts: asset.createdAt,
    title: '原始素材入库',
    subtitle: asset.sourceType && asset.sourceType !== 'unknown' ? `来源类型：${asset.sourceType}` : '手动添加',
    meta: `从 ${asset.source ?? '未指定来源'} 整理`,
    stageLabel: '📥 来源',
    stageColor: '#6366f1',
  });

  // 升级
  if (asset.status === 'candidate') {
    enhancedTimelineItems.push({
      stage: 'upgrade',
      ts: asset.createdAt + 60,
      title: '升级为候选判断',
      subtitle: 'AI 校准完成，等待人工确认',
      meta: `当前等级：${asset.evidenceLevel}`,
      stageLabel: '⬆️ 升级',
      stageColor: '#f59e0b',
    });
  } else if (asset.status === 'in_use') {
    enhancedTimelineItems.push({
      stage: 'upgrade',
      ts: asset.createdAt + 3600,
      title: '升级为正式资产',
      subtitle: '人工确认后入库资产库',
      meta: `当前等级：${asset.evidenceLevel}`,
      stageLabel: '⬆️ 升级',
      stageColor: '#f59e0b',
    });
  }

  // 被引用
  for (const o of allOutputs) {
    enhancedTimelineItems.push({
      stage: 'output',
      ts: o.createdAt,
      title: `被「${o.title}」引用`,
      subtitle: `输出类型：${o.outputType}`,
      meta: o.templateType ?? '',
      href: o.outputType === 'writing' ? `/writing/${o.id}` : `/output`,
      stageLabel: '✍️ 被引用',
      stageColor: '#10b981',
    });
  }

  // 反馈
  for (const f of feedbackRows) {
    const before = f.evidenceLevelBefore ?? '?';
    const after = f.evidenceLevelAfter ?? '?';
    enhancedTimelineItems.push({
      stage: 'feedback',
      ts: f.createdAt,
      title: `${f.scene} 反馈`,
      subtitle: f.mostTouchedPoint ?? f.reaction ?? '',
      meta: f.evidenceLevelBefore || f.evidenceLevelAfter ? `证据等级：${before} → ${after}` : '',
      stageLabel: '💬 反馈',
      stageColor: '#f43f5e',
    });
  }

  // Kernel 引用
  for (const k of referencedKernels) {
    enhancedTimelineItems.push({
      stage: 'kernel',
      ts: k.updatedAt,
      title: `进入 Kernel：${k.content.slice(0, 40)}…`,
      subtitle: `置信度 ${k.confidence}/100 · ${k.category}`,
      meta: '',
      href: '/kernel',
      stageLabel: '🧠 进入 Kernel',
      stageColor: '#a78bfa',
    });
  }

  // 按时间倒序
  enhancedTimelineItems.sort((a, b) => b.ts - a.ts);

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
      // v1.8.0 新字段
      isKernelCandidate: asset.isKernelCandidate ?? 0,
      isKernelApproved: asset.isKernelApproved ?? 0,
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
      enhancedTimeline={enhancedTimelineItems}
    />
  );
}
