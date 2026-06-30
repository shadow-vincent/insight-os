'use client';

/**
 * V1.11.9 ClientAssetLoader (升级版)
 *
 * 当 server-side SQLite 不可用时（Vercel serverless / demo 模式），
 * 从用户浏览器 IndexedDB 读取 asset + feedback + outputs + kernels，渲染完整详情页
 *
 * 跟本地版 /assets/[id] 一样展示：
 * - 5 阶段 timeline (来源/升级/输出/反馈/Kernel)
 * - body markdown（按行渲染 + ## 标题）
 * - outputs 引用列表
 * - feedback 列表
 *
 * 不包含：AssetDetailClient 编辑器（编辑/评分校准/校准 prompt）
 *   demo 用户只需"看"，不一定要在 Vercel 改（改了下次清缓存就没了）
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

type TimelineItem = {
  stage: 'source' | 'upgrade' | 'output' | 'feedback' | 'kernel';
  ts: number;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
  stageLabel: string;
  stageColor: string;
};

const STAGE_COLOR: Record<string, string> = {
  source: '#6366f1',
  upgrade: '#f59e0b',
  output: '#10b981',
  feedback: '#f43f5e',
  kernel: '#a78bfa',
};

export function ClientAssetLoader({ id }: { id: string }) {
  const [asset, setAsset] = useState<any>(null);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [kernels, setKernels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      try {
        const DexieModule = await import('dexie');
        const Dexie = (DexieModule as any).default || DexieModule;
        const db = new Dexie('insight-os');
        // V1.10: 完整 11 table schema
        db.version(1).stores({
          assets: 'id, type, status, evidenceLevel, updatedAt, scoreTotal, isKernelCandidate, isKernelApproved, sourceMaterialId, createdAt',
          outputs: 'id, status, writingStatus, topicId, createdAt, updatedAt',
          feedback: 'id, assetId, scene, outputId, createdAt',
          topics: 'id, slug, sortOrder, updatedAt',
          assetTopics: 'id, assetId, topicId, [assetId+topicId]',
          sources: 'id, url, enabled, lastFetchedAt, type, createdAt',
          sourceItems: 'id, sourceId, status, fetchedAt, publishedAt, [sourceId+guid]',
          topicKernels: 'id, topicId, generatedAt',
          userKernels: 'id, category, status, sortOrder, updatedAt',
          writingDrafts: 'id, writingId, updatedAt',
          writingVersions: 'id, writingId, createdAt, [writingId+createdAt]',
        });

        const [a, fb, ops, krs] = await Promise.all([
          db.assets.get(id),
          db.feedback.where('assetId').equals(id).reverse().sortBy('createdAt'),
          db.outputs.toArray(),
          db.userKernels.where('status').equals('active').toArray(),
        ]);

        setAsset(a);
        setFeedback(fb);
        // 找引用了本资产的 outputs（assetIdsJson 包含本 id）
        const myOutputs = ops.filter((o: any) => {
          try {
            const ids = JSON.parse(o.assetIdsJson || '[]');
            return Array.isArray(ids) && ids.includes(id);
          } catch { return false; }
        }).sort((a: any, b: any) => b.createdAt - a.createdAt);
        setOutputs(myOutputs);
        // 找 active kernel 把本资产作为 evidence
        const myKernels = krs.filter((k: any) => {
          try {
            const ids = JSON.parse(k.evidenceAssetIdsJson || '[]');
            return Array.isArray(ids) && ids.includes(id);
          } catch { return false; }
        });
        setKernels(myKernels);
      } catch (e) {
        console.error('[ClientAssetLoader] failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div style={{padding: 64, textAlign: 'center', color: 'var(--text-3)'}}>加载中...</div>;
  }

  if (!asset) {
    return (
      <div style={{padding: 64, textAlign: 'center'}}>
        <div style={{fontSize: 18, marginBottom: 12}}>资产未找到</div>
        <div style={{fontSize: 13, color: 'var(--text-3)'}}>
          访问 <code style={{padding: '2px 8px', background: 'var(--canvas)', borderRadius: 4}}>/?demo=1</code> 加载示例数据后重试
        </div>
      </div>
    );
  }

  let tags: string[] = [];
  try {
    const parsed = JSON.parse(asset.tagsJson || '[]');
    if (Array.isArray(parsed)) tags = parsed;
  } catch {}

  // 构造 body markdown（light 卡：拼 oneSentenceInsight + antiCommonSense + tags）
  const bodySections: string[] = [];
  if (asset.oneSentenceInsight) {
    bodySections.push(`## 一句话洞察\n\n${asset.oneSentenceInsight}`);
  }
  if (asset.antiCommonSense) {
    bodySections.push(`## 反常识\n\n${asset.antiCommonSense}`);
  }
  if (tags.length > 0) {
    bodySections.push(`## 标签\n\n${tags.map(t => `\`${t}\``).join(' · ')}`);
  }
  if (asset.type === 'light') {
    bodySections.push(`\n> 💡 这是一条轻量卡（仅 LLM 整理结果，未校准）。到「开始写作」基于此卡创作，或去详情校准后即可升级为正式资产卡。`);
  }
  const body = bodySections.join('\n\n');

  // ===== 5 阶段 timeline =====
  const timeline: TimelineItem[] = [];

  // 来源
  timeline.push({
    stage: 'source',
    ts: asset.createdAt,
    title: '原始素材入库',
    subtitle: asset.sourceType && asset.sourceType !== 'unknown' ? `来源类型：${asset.sourceType}` : '手动添加',
    meta: `从 ${asset.source ?? '未指定来源'} 整理`,
    stageLabel: '📥 来源',
    stageColor: STAGE_COLOR.source,
  });

  // 升级
  if (asset.status === 'candidate') {
    timeline.push({
      stage: 'upgrade',
      ts: asset.createdAt + 60_000,
      title: '升级为候选判断',
      subtitle: 'AI 校准完成，等待人工确认',
      meta: `当前等级：${asset.evidenceLevel}`,
      stageLabel: '⬆️ 升级',
      stageColor: STAGE_COLOR.upgrade,
    });
  } else if (asset.status === 'in_use') {
    timeline.push({
      stage: 'upgrade',
      ts: asset.createdAt + 3_600_000,
      title: '升级为正式资产',
      subtitle: '人工确认后入库资产库',
      meta: `当前等级：${asset.evidenceLevel}`,
      stageLabel: '⬆️ 升级',
      stageColor: STAGE_COLOR.upgrade,
    });
  }

  // 被引用
  for (const o of outputs) {
    timeline.push({
      stage: 'output',
      ts: o.createdAt,
      title: `被「${o.title}」引用`,
      subtitle: `输出类型：${o.outputType}`,
      meta: o.templateType ?? '',
      href: o.outputType === 'writing' ? `/writing/${o.id}` : '/output',
      stageLabel: '✍️ 被引用',
      stageColor: STAGE_COLOR.output,
    });
  }

  // 反馈
  for (const f of feedback) {
    const before = f.evidenceLevelBefore ?? '?';
    const after = f.evidenceLevelAfter ?? '?';
    timeline.push({
      stage: 'feedback',
      ts: f.createdAt,
      title: `${f.scene} 反馈`,
      subtitle: f.mostTouchedPoint ?? f.reaction ?? '',
      meta: f.evidenceLevelBefore || f.evidenceLevelAfter ? `证据等级：${before} → ${after}` : '',
      stageLabel: '💬 反馈',
      stageColor: STAGE_COLOR.feedback,
    });
  }

  // Kernel 引用
  for (const k of kernels) {
    timeline.push({
      stage: 'kernel',
      ts: k.updatedAt,
      title: `进入 Kernel：${k.content.slice(0, 40)}…`,
      subtitle: `置信度 ${k.confidence}/100 · ${k.category}`,
      meta: '',
      href: '/kernel',
      stageLabel: '🧠 进入 Kernel',
      stageColor: STAGE_COLOR.kernel,
    });
  }

  // 按时间倒序
  timeline.sort((a, b) => b.ts - a.ts);

  // 简单 markdown 渲染（按行处理 ## 标题 + 段落）
  const renderBody = () => {
    return body.split('\n\n').map((section, i) => {
      if (section.startsWith('## ')) {
        return (
          <div key={i} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              {section.replace(/^## /, '')}
            </h3>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text)' }}>
              {section.split('\n').slice(1).join('\n').split(/`([^`]+)`/).map((part, j) =>
                j % 2 === 1
                  ? <code key={j} style={{ padding: '1px 6px', background: 'var(--canvas)', borderRadius: 3, fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>{part}</code>
                  : <span key={j}>{part}</span>
              )}
            </div>
          </div>
        );
      }
      if (section.startsWith('> ')) {
        return (
          <div key={i} style={{ padding: 14, background: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.2)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {section.slice(2)}
          </div>
        );
      }
      return <p key={i} style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text)', marginBottom: 12 }}>{section}</p>;
    });
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      {/* meta 行 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 12, color: 'var(--text-3)' }}>
        <span style={{ padding: '2px 8px', background: 'var(--canvas)', borderRadius: 4 }}>{asset.evidenceLevel}</span>
        <span style={{ padding: '2px 8px', background: 'var(--canvas)', borderRadius: 4 }}>{asset.status}</span>
        <span style={{ padding: '2px 8px', background: 'var(--canvas)', borderRadius: 4 }}>{asset.type}</span>
        {asset.isKernelApproved === 1 && <span style={{ padding: '2px 8px', background: '#a78bfa', color: 'white', borderRadius: 4 }}>🧠 Kernel</span>}
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.3, marginBottom: 24, color: 'var(--ink)' }}>
        {asset.title}
      </h1>

      {/* body markdown（按行） */}
      {body && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          {renderBody()}
        </div>
      )}

      {/* 标签 */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {tags.map(t => (
            <span key={t} style={{ padding: '4px 12px', background: 'var(--canvas)', borderRadius: 999, fontSize: 13, color: 'var(--text-2)' }}>#{t}</span>
          ))}
        </div>
      )}

      {/* 统计 */}
      <div style={{ padding: 16, background: 'var(--canvas)', borderRadius: 10, fontSize: 13, color: 'var(--text-2)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div><span style={{ color: 'var(--text-3)' }}>来源：</span>{asset.source ?? '未指定'}</div>
          <div><span style={{ color: 'var(--text-3)' }}>评分：</span><strong>{asset.scoreTotal}</strong></div>
          <div><span style={{ color: 'var(--text-3)' }}>引用：</span>{outputs.length} 次</div>
          <div><span style={{ color: 'var(--text-3)' }}>反馈：</span>{feedback.length} 次</div>
        </div>
      </div>

      {/* 5 阶段 timeline */}
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>🕐 进化时间线</h2>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        {timeline.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>暂无时间线事件</div>
        ) : (
          <div style={{ position: 'relative' }}>
            {timeline.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: i < timeline.length - 1 ? 20 : 0, position: 'relative' }}>
                {/* 时间线竖线 */}
                {i < timeline.length - 1 && (
                  <div style={{ position: 'absolute', left: 11, top: 24, bottom: 0, width: 2, background: 'var(--line)' }} />
                )}
                {/* 圆点 */}
                <div style={{
                  width: 24, height: 24, borderRadius: 12, flexShrink: 0,
                  background: 'white', border: `2px solid ${t.stageColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: t.stageColor,
                  zIndex: 1,
                }}>
                  {i + 1}
                </div>
                {/* 内容 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: t.stageColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {t.stageLabel}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {new Date(t.ts).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                    {t.href ? <Link href={t.href} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{t.title}</Link> : t.title}
                  </div>
                  {t.subtitle && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>{t.subtitle}</div>}
                  {t.meta && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{t.meta}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 输出引用列表 */}
      {outputs.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>✍️ 输出引用 ({outputs.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {outputs.map((o: any) => (
              <Link key={o.id} href={o.outputType === 'writing' ? `/writing/${o.id}` : '/output'} className="card card-hover" style={{ padding: 14, textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 50 }}>{o.outputType}</div>
                  <div style={{ flex: 1, fontSize: 14, color: 'var(--ink)' }}>{o.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(o.createdAt).toLocaleDateString('zh-CN')}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* 反馈列表 */}
      {feedback.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>💬 反馈记录 ({feedback.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {feedback.map((f: any) => (
              <div key={f.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#f43f5e', fontWeight: 600, textTransform: 'uppercase' }}>{f.scene}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(f.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                {f.mostTouchedPoint && <div style={{ fontSize: 13, color: 'var(--text)' }}>📌 {f.mostTouchedPoint}</div>}
                {f.reaction && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>💭 {f.reaction}</div>}
                {(f.evidenceLevelBefore || f.evidenceLevelAfter) && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    证据等级：{f.evidenceLevelBefore ?? '?'} → {f.evidenceLevelAfter ?? '?'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}