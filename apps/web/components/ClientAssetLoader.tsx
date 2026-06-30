'use client';

/**
 * V1.11.12 ClientAssetLoader (跟本地版 /assets/[id] 功能一致)
 *
 * 当 server-side SQLite 不可用时（Vercel serverless / demo 模式），
 * 从用户浏览器 IndexedDB 读取 asset + 关联数据，渲染完整详情页 + 编辑能力
 *
 * 功能（跟本地版 AssetDetailClient 一致）：
 * - 5 阶段 timeline (来源/升级/输出/反馈/Kernel)
 * - body markdown（按行渲染 + ## 标题）
 * - 主题归属（读 assetTopics + topics）
 * - outputs 引用列表
 * - feedback 列表
 * - 顶部按钮组：升级状态 / 评分校准 / 写
 * - 评分校准：调 LLM 评分 → 升级 E 等级（client fetch 走 CORS 允许的 LLM）
 *
 * 写操作全部走 IDB（不依赖 server API / SQLite）
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
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // 评分校准 modal
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState<{ newEvidenceLevel: string; reasoning: string; confidence: number } | null>(null);

  const reload = async () => {
    try {
      const DexieModule = await import('dexie');
      const Dexie = (DexieModule as any).default || DexieModule;
      const db = new Dexie('insight-os');
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
      db.version(2).stores({ preferences: 'key' });

      const [a, fb, ops, krs, tps, assetTopicRows] = await Promise.all([
        db.assets.get(id),
        db.feedback.where('assetId').equals(id).reverse().sortBy('createdAt'),
        db.outputs.toArray(),
        db.userKernels.where('status').equals('active').toArray(),
        db.topics.toArray(),
        db.assetTopics.where('assetId').equals(id).toArray(),
      ]);

      setAsset(a);
      setFeedback(fb);
      const myOutputs = ops.filter((o: any) => {
        try {
          const ids = JSON.parse(o.assetIdsJson || '[]');
          return Array.isArray(ids) && ids.includes(id);
        } catch { return false; }
      }).sort((a: any, b: any) => b.createdAt - a.createdAt);
      setOutputs(myOutputs);
      setKernels(krs.filter((k: any) => {
        try {
          const ids = JSON.parse(k.evidenceAssetIdsJson || '[]');
          return Array.isArray(ids) && ids.includes(id);
        } catch { return false; }
      }));
      const myTopicIds = new Set(assetTopicRows.map((at: any) => at.topicId));
      setTopics(tps.filter((t: any) => myTopicIds.has(t.id)));
    } catch (e) {
      console.error('[ClientAssetLoader] failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ===== Actions =====

  const handleStatusChange = async (newStatus: string) => {
    setActionMessage(null);
    try {
      const { updateAsset } = await import('@/lib/idb/operations');
      await updateAsset(id, { status: newStatus });
      setActionMessage({ type: 'success', text: `✓ 状态已更新为「${newStatus}」` });
      await reload();
    } catch (e: any) {
      setActionMessage({ type: 'error', text: `更新失败: ${e.message}` });
    }
  };

  const handleCalibrate = async () => {
    setCalibrating(true);
    setCalibrationResult(null);
    setActionMessage(null);
    try {
      const { callLLMDirect, updateAsset, getLLMConfig } = await import('@/lib/idb/operations');
      const cfg = await getLLMConfig();
      if (!cfg) {
        setActionMessage({ type: 'info', text: 'ℹ️ LLM 未配置，去 /settings/integrations 配 API key 后可调' });
        setCalibrating(false);
        return;
      }
      // 调 LLM 评估当前资产
      const tags = (() => {
        try { return JSON.parse(asset.tagsJson || '[]'); } catch { return []; }
      })();
      const system = `你是判断力校准助手。给定一张资产卡的当前信息，输出 1) 建议新证据等级 E0-E5 2) 校准理由 3) 置信度 0-100。
证据等级定义：
- E0: 无证据，纯假设
- E1: 个人观察
- E2: 1 个案例
- E3: 多案例
- E4: 实践验证
- E5: 反复实践

只输出 JSON: { "newEvidenceLevel": "E0-E5", "reasoning": "50-100 字理由", "confidence": 0-100 }`;
      const user = `资产卡：
- 标题: ${asset.title}
- 当前等级: ${asset.evidenceLevel}
- 一句话洞察: ${asset.oneSentenceInsight ?? '(无)'}
- 反常识: ${asset.antiCommonSense ?? '(无)'}
- 标签: ${tags.join(', ') || '(无)'}
- 当前评分: ${asset.scoreTotal}

评估后给建议：`;

      const result = await callLLMDirect<{ newEvidenceLevel: string; reasoning: string; confidence: number }>(system, user, { temperature: 0.3, jsonMode: true });
      if (!result.ok || !result.data) {
        setActionMessage({ type: 'error', text: `✗ LLM 失败: ${result.error || '未知错误'}` });
        return;
      }
      const { newEvidenceLevel, reasoning, confidence } = result.data;
      if (!['E0','E1','E2','E3','E4','E5'].includes(newEvidenceLevel)) {
        setActionMessage({ type: 'error', text: `✗ LLM 返回等级不合法: ${newEvidenceLevel}` });
        return;
      }
      setCalibrationResult({ newEvidenceLevel, reasoning, confidence });
    } catch (e: any) {
      setActionMessage({ type: 'error', text: `✗ 校准失败: ${e.message}` });
    } finally {
      setCalibrating(false);
    }
  };

  const applyCalibration = async () => {
    if (!calibrationResult) return;
    try {
      const { updateAsset, addFeedback } = await import('@/lib/idb/operations');
      const fromLevel = asset.evidenceLevel;
      const toLevel = calibrationResult.newEvidenceLevel;
      await updateAsset(id, {
        evidenceLevel: toLevel,
        scoreTotal: calibrationResult.confidence,
      });
      // 写一条 feedback 记录这次校准
      await addFeedback({
        id: `fb_cal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        assetId: id,
        scene: 'other',
        reaction: `LLM 校准: ${calibrationResult.reasoning}`,
        mostTouchedPoint: `证据等级 ${fromLevel} → ${toLevel} (置信度 ${calibrationResult.confidence})`,
        evidenceLevelBefore: fromLevel,
        evidenceLevelAfter: toLevel,
        createdAt: Date.now(),
      });
      setActionMessage({ type: 'success', text: `✓ 校准应用: ${fromLevel} → ${toLevel}` });
      setCalibrationResult(null);
      await reload();
    } catch (e: any) {
      setActionMessage({ type: 'error', text: `应用失败: ${e.message}` });
    }
  };

  // ===== Render =====

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

  // 5 阶段 timeline
  const timeline: TimelineItem[] = [];
  timeline.push({
    stage: 'source',
    ts: asset.createdAt,
    title: '原始素材入库',
    subtitle: asset.sourceType && asset.sourceType !== 'unknown' ? `来源类型：${asset.sourceType}` : '手动添加',
    meta: `从 ${asset.source ?? '未指定来源'} 整理`,
    stageLabel: '📥 来源',
    stageColor: STAGE_COLOR.source,
  });

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

  timeline.sort((a, b) => b.ts - a.ts);

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

      <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.3, marginBottom: 16, color: 'var(--ink)' }}>
        {asset.title}
      </h1>

      {/* 顶部按钮组（跟本地版 AssetDetailClient 一致）*/}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {asset.status === 'candidate' && (
          <button onClick={() => handleStatusChange('in_use')} className="btn btn-primary" style={{ fontSize: 13 }}>
            ⬆️ 升为正式资产
          </button>
        )}
        {asset.status === 'in_use' && (
          <button onClick={() => handleStatusChange('archived')} className="btn" style={{ fontSize: 13 }}>
            📦 归档
          </button>
        )}
        {asset.status === 'archived' && (
          <button onClick={() => handleStatusChange('in_use')} className="btn" style={{ fontSize: 13 }}>
            ♻️ 恢复
          </button>
        )}
        {asset.status !== 'candidate' && (
          <button onClick={() => handleStatusChange('candidate')} className="btn" style={{ fontSize: 13 }}>
            ⏪ 退回候选
          </button>
        )}
        <button
          onClick={handleCalibrate}
          disabled={calibrating}
          className="btn"
          style={{ fontSize: 13, opacity: calibrating ? 0.5 : 1 }}
        >
          {calibrating ? '校准中…' : '🤖 LLM 校准'}
        </button>
        <Link href={`/writing?seed=${asset.id}`} className="btn" style={{ fontSize: 13, textDecoration: 'none' }}>
          ✍️ 基于此卡写作
        </Link>
      </div>

      {actionMessage && (
        <div className={`callout ${actionMessage.type === 'success' ? 'callout-success' : actionMessage.type === 'info' ? 'callout-info' : 'callout-error'}`} style={{ marginBottom: 16 }}>
          {actionMessage.text}
        </div>
      )}

      {/* 评分校准 modal */}
      {calibrationResult && (
        <div style={{ padding: 20, background: 'rgba(99, 102, 241, 0.05)', border: '1.5px solid rgba(99, 102, 241, 0.3)', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#4f46e5', marginBottom: 12 }}>🤖 LLM 校准建议</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: 16, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>当前</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{asset.evidenceLevel}</div>
            </div>
            <div style={{ fontSize: 20, color: 'var(--text-3)' }}>→</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>建议</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#4f46e5' }}>{calibrationResult.newEvidenceLevel}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.6 }}>
            <strong>理由：</strong>{calibrationResult.reasoning}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
            <strong>置信度：</strong>{calibrationResult.confidence}/100
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={applyCalibration} className="btn btn-primary" style={{ fontSize: 13 }}>
              ✓ 应用
            </button>
            <button onClick={() => setCalibrationResult(null)} className="btn" style={{ fontSize: 13 }}>
              ✕ 取消
            </button>
          </div>
        </div>
      )}

      {/* body markdown */}
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

      {/* 主题归属（V1.11.12 新增）*/}
      {topics.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>📚 所属主题 ({topics.length})</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {topics.map((t: any) => (
              <Link key={t.id} href={`/topics`} className="card card-hover" style={{ padding: '8px 14px', textDecoration: 'none', color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>📖</span>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>{t.name}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* 5 阶段 timeline */}
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>🕐 进化时间线</h2>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        {timeline.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>暂无时间线事件</div>
        ) : (
          <div style={{ position: 'relative' }}>
            {timeline.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: i < timeline.length - 1 ? 20 : 0, position: 'relative' }}>
                {i < timeline.length - 1 && (
                  <div style={{ position: 'absolute', left: 11, top: 24, bottom: 0, width: 2, background: 'var(--line)' }} />
                )}
                <div style={{
                  width: 24, height: 24, borderRadius: 12, flexShrink: 0,
                  background: 'white', border: `2px solid ${t.stageColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: t.stageColor,
                  zIndex: 1,
                }}>
                  {i + 1}
                </div>
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

      {/* outputs */}
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

      {/* feedback */}
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