'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';
import { AssetThreeSections } from './AssetThreeSections';

interface AssetDetailClientProps {
  asset: {
    id: string;
    type: string;
    status: string;
    title: string;
    evidenceLevel: string;
    priority: string | null;
    tagsJson: string;
    fileExists: boolean;
    oneSentenceInsight: string | null;
    antiCommonSense: string | null;
    filePath: string;
    body: string;
    feedbackCount: number;
    createdAt: number;
    updatedAt: number;
    // v1.8.0 新字段
    isKernelCandidate?: number;
    isKernelApproved?: number;
  };
  initialBody: string;
  tags: string[];
  llmEnabled: boolean;
  timeline: {
    feedback: Array<{
      id: string;
      scene: string;
      reaction: string | null;
      mostTouchedPoint: string | null;
      evidenceLevelBefore: string | null;
      evidenceLevelAfter: string | null;
      createdAt: number;
    }>;
    outputs: Array<{
      id: string;
      title: string;
      outputType: string;
      templateType: string | null;
      sourceUrl: string | null;
      createdAt: number;
    }>;
  };
  enhancedTimeline: Array<{
    stage: 'source' | 'upgrade' | 'output' | 'feedback' | 'kernel';
    ts: number;
    title: string;
    subtitle?: string;
    meta?: string;
    href?: string;
    stageLabel: string;
    stageColor: string;
  }>;
}

export function AssetDetailClient({ asset, initialBody, tags, llmEnabled, timeline, enhancedTimeline }: AssetDetailClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [showFeedback, setShowFeedback] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [assetTopics, setAssetTopics] = useState<Array<{ id: string; topicId: string; topicName: string; topicSlug: string; confidence: number; assignedBy: string }>>([]);

  useEffect(() => {
    fetch(`/api/assets/${asset.id}/topics`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setAssetTopics(data.topics);
      })
      .catch(() => {});
  }, [asset.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFeedback(false);
      }
    };
    if (showFeedback) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFeedback]);

  return (
    <>
      <div className="page-container">
        {/* 顶部工具条（返回 / tags）— 全宽，不受两列影响 */}
        <div style={{ maxWidth: 1440, margin: '0 auto 20px' }}>
          <Link href="/assets" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
            ← 返回判断资产
          </Link>
        </div>

        {/* 主区：宽屏左主内容 + 右 sticky 操作面板 / 窄屏单列堆叠 */}
        <div className="detail-layout" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 28,
          maxWidth: 1440,
          margin: '0 auto',
          alignItems: 'start',
        }}>
          {/* 左主内容 */}
          <div className="detail-main">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              <span className={`pill pill-${asset.evidenceLevel.toLowerCase()}`}>{asset.evidenceLevel}</span>
              <span className={`pill pill-priority-${(asset.priority ?? 'c').toLowerCase()}`}>
                优先级 {asset.priority ?? '-'}
              </span>
              {tags.map((t, i) => (
                <span key={i} className="pill" style={{ background: 'var(--bg-subtle)', color: 'var(--text-2)' }}>{t}</span>
              ))}
            </div>

            <h1 style={{
              fontSize: 32,
              fontWeight: 700,
              color: 'var(--ink)',
              lineHeight: 1.25,
              margin: '0 0 18px',
              letterSpacing: '-0.015em',
            }}>
              {asset.title}
            </h1>

            {asset.oneSentenceInsight && (
              <div className="callout" style={{ marginBottom: 14, fontSize: 15, lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--primary)' }}>一句话洞察：</strong>
                {asset.oneSentenceInsight}
              </div>
            )}

            {asset.antiCommonSense && (
              <div className="callout callout-accent" style={{ marginBottom: 24, fontSize: 14, lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--accent)' }}>反常识：</strong>
                {asset.antiCommonSense}
              </div>
            )}

            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: simpleMd(initialBody) }} />

            {/* v1.8.2 3 段卡片：帮你产出了 / 下一步还能变强 / 完整进化线（折叠） */}
            <AssetThreeSections
              asset={asset}
              outputs={timeline.outputs}
              feedbackCount={asset.feedbackCount}
              feedbackRows={timeline.feedback}
              kernelCandidates={asset.isKernelCandidate}
              kernelApproved={asset.isKernelApproved}
            />

            {/* 相关资产 */}
            <RelatedAssetsSection assetId={asset.id} />
          </div>

          {/* 右 sticky 操作面板（宽屏） / 窄屏时移动到下方 */}
          <div className="detail-side">
            <div className="card detail-side-card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* 单一输出口子：跳到 /writing/new 并预填 assetId + audience */}
              <div style={{ padding: '24px 24px', borderBottom: '1px solid var(--line)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
                  ✍️ 基于此卡创作
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 14px', lineHeight: 1.5 }}>
                  统一从「开始写作」走，会自动带入主题与 Kernel（你的判断协议）。
                </p>
                <Link
                  href={`/writing/new?assetId=${asset.id}`}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  → 在「开始写作」中打开
                </Link>
                {!llmEnabled && (
                  <div style={{ marginTop: 12 }}>
                    <Link href="/settings" className="btn btn-sm btn-accent" style={{ width: '100%', justifyContent: 'center' }}>
                      ⚠️ LLM 未配置
                    </Link>
                  </div>
                )}
              </div>

              {/* 所属主题 */}
              <TopicsPanel
                assetId={asset.id}
                topics={assetTopics}
                onTopicsChange={setAssetTopics}
                classifying={classifying}
                setClassifying={setClassifying}
                router={router}
              />

              {/* 资产操作 */}
              <div style={{ padding: '14px 24px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  资产操作
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    className="btn"
                    onClick={() => setShowFeedback(true)}
                    style={{ justifyContent: 'center', fontSize: 12 }}
                  >
                    📈 反馈 ({asset.feedbackCount})
                  </button>
                  <button className="btn" style={{ justifyContent: 'center', fontSize: 12 }}>
                    ⭐ 升级
                  </button>
                  <button className="btn" style={{ justifyContent: 'center', fontSize: 12, gridColumn: 'span 2' }}>
                    🔗 复制 Markdown
                  </button>
                </div>

                <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-3)' }}>
                  <div style={{ marginBottom: 4, fontWeight: 600 }}>文件位置</div>
                  <code style={{ fontSize: 10, color: 'var(--text-2)', wordBreak: 'break-all', lineHeight: 1.5 }}>
                    {asset.filePath.replace(/^.*\/knowledge_base\//, 'knowledge_base/')}
                  </code>
                  {!asset.fileExists && (
                    <div className="callout callout-warning" style={{ marginTop: 8, fontSize: 11 }}>
                      <strong>轻量卡：</strong> 暂无独立 .md 文件，详情页内容由数据库字段组装。
                    </div>
                  )}
                </div>
              </div>

              {/* v1.6 强化进化线 5 阶段（来源→升级→被引用→反馈→Kernel） */}
              <EnhancedEvolutionTimeline items={enhancedTimeline} />
              {/* v0.10.3 进化时间线（保留兼容） */}
              <EvolutionTimeline
                feedback={timeline.feedback}
                outputs={timeline.outputs}
                createdAt={asset.createdAt}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 反馈 modal */}
      {showFeedback && (
        <FeedbackModal
          assetId={asset.id}
          currentLevel={asset.evidenceLevel}
          onClose={() => setShowFeedback(false)}
          onSaved={() => {
            setShowFeedback(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/**
 * 主题面板
 */
function TopicsPanel({ assetId, topics, onTopicsChange, classifying, setClassifying, router }: {
  assetId: string;
  topics: Array<{ id: string; topicId: string; topicName: string; topicSlug: string; confidence: number; assignedBy: string }>;
  onTopicsChange: (t: any[]) => void;
  classifying: boolean;
  setClassifying: (b: boolean) => void;
  router: any;
}) {
  const toast = useToast();
  const [allTopics, setAllTopics] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editConfidence, setEditConfidence] = useState(100);

  useEffect(() => {
    fetch('/api/topics/list')
      .then(r => r.json())
      .then(data => {
        if (data.ok) setAllTopics(data.topics);
      });
  }, []);

  const handleReclassify = async () => {
    setClassifying(true);
    try {
      const res = await fetch('/api/topics/classify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId }),
      });
      const data = await res.json();
      if (data.ok) {
        onTopicsChange(data.topics);
        router.refresh();
      } else {
        toast.error(`归类失败: ${data.error}`);
      }
    } finally {
      setClassifying(false);
    }
  };

  const handleAdd = async (topicId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/topics`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topicId, confidence: 100 }),
      });
      const data = await res.json();
      if (data.ok) {
        const r2 = await fetch(`/api/assets/${assetId}/topics`);
        const d2 = await r2.json();
        if (d2.ok) onTopicsChange(d2.topics);
        setShowAdd(false);
        router.refresh();
      } else {
        toast.error(`添加失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCreate = async () => {
    if (!newTopicName.trim()) {
      toast.error('主题名不能为空');
      return;
    }
    setCreatingTopic(true);
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newTopicName.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(`创建失败: ${data.error}`);
        return;
      }
      const newTopic = data.topic;

      const res2 = await fetch(`/api/assets/${assetId}/topics`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topicId: newTopic.id, confidence: 100 }),
      });
      const data2 = await res2.json();
      if (!data2.ok) {
        toast.error(`关联失败: ${data2.error}`);
        return;
      }

      const r2 = await fetch('/api/topics/list');
      const d2 = await r2.json();
      if (d2.ok) setAllTopics(d2.topics);
      const r3 = await fetch(`/api/assets/${assetId}/topics`);
      const d3 = await r3.json();
      if (d3.ok) onTopicsChange(d3.topics);
      setNewTopicName('');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingTopic(false);
    }
  };

  const handleRemove = async (topicId: string) => {
    if (!confirm('确定移除该主题关联？')) return;
    try {
      const res = await fetch(`/api/assets/${assetId}/topics?topicId=${topicId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        onTopicsChange(topics.filter(t => t.topicId !== topicId));
        router.refresh();
      } else {
        toast.error(`移除失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUpdateConfidence = async (topicId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/topics`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topicId, confidence: editConfidence }),
      });
      const data = await res.json();
      if (data.ok) {
        const r2 = await fetch(`/api/assets/${assetId}/topics`);
        const d2 = await r2.json();
        if (d2.ok) onTopicsChange(d2.topics);
        setEditingTopicId(null);
        router.refresh();
      } else {
        toast.error(`更新失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const availableToAdd = allTopics.filter(at => !topics.find(t => t.topicId === at.id));

  return (
    <div style={{ padding: '18px 24px', borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          🏷️ 所属主题
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="btn btn-sm"
            style={{ padding: '4px 10px', fontSize: 12 }}
            title="手动添加主题"
          >
            {showAdd ? '× 关闭' : '+ 添加'}
          </button>
          <button
            onClick={handleReclassify}
            disabled={classifying}
            className="btn btn-sm"
            style={{ padding: '4px 10px', fontSize: 12 }}
            title="重新调 LLM 归类"
          >
            {classifying ? '⏳' : '🤖'} 重新归类
          </button>
        </div>
      </div>

      {/* 添加主题面板 */}
      {showAdd && (
        <div style={{
          marginBottom: 14,
          padding: 14,
          background: 'var(--bg-subtle)',
          borderRadius: 6,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600 }}>
            + 新建自定义主题
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input
              type="text"
              value={newTopicName}
              onChange={e => setNewTopicName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="例：咨询方法论 / 客户成功 / AI 治理"
              className="input"
              style={{ fontSize: 13, padding: '7px 12px' }}
            />
            <button
              onClick={handleCreate}
              disabled={creatingTopic || !newTopicName.trim()}
              className="btn btn-primary btn-sm"
              style={{ padding: '7px 14px' }}
            >
              {creatingTopic ? '...' : '创建'}
            </button>
          </div>

          {availableToAdd.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                或选择已有主题
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {availableToAdd.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleAdd(t.id)}
                    className="btn btn-sm"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    + {t.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 现有主题 */}
      {topics.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {topics.map(t => (
            <div
              key={t.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 4px 4px 12px',
                background: editingTopicId === t.topicId ? 'var(--accent-soft)' : 'var(--primary-soft)',
                color: editingTopicId === t.topicId ? 'var(--accent)' : 'var(--primary)',
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {editingTopicId === t.topicId ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editConfidence}
                    onChange={e => setEditConfidence(Number(e.target.value))}
                    style={{ width: 40, fontSize: 12, padding: '2px 6px', border: '1px solid var(--accent)', borderRadius: 3, background: 'white' }}
                  />
                  <button
                    onClick={() => handleUpdateConfidence(t.topicId)}
                    className="btn btn-sm"
                    style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)', padding: '2px 8px' }}
                  >✓</button>
                  <button
                    onClick={() => setEditingTopicId(null)}
                    className="btn btn-sm btn-ghost"
                    style={{ padding: '2px 8px' }}
                  >×</button>
                </span>
              ) : (
                <>
                  <Link href={`/map#${t.topicSlug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {t.topicName}
                    {t.confidence < 100 && <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 11 }}>{t.confidence}</span>}
                    {t.assignedBy === 'human' && <span style={{ marginLeft: 4, fontSize: 10 }}>✋</span>}
                  </Link>
                  <button
                    onClick={() => { setEditingTopicId(t.topicId); setEditConfidence(t.confidence); }}
                    title="修改置信度"
                    style={{ fontSize: 11, padding: '0 4px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.5 }}
                  >✎</button>
                  <button
                    onClick={() => handleRemove(t.topicId)}
                    title="移除"
                    style={{ fontSize: 12, padding: '0 4px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.5 }}
                  >×</button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showAdd && (
          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '10px 0' }}>
            还未归类，点 + 添加 或 🤖 重新归类
          </div>
        )
      )}
    </div>
  );
}

/**
 * 反馈 Modal
 */
function FeedbackModal({ assetId, currentLevel, onClose, onSaved }: {
  assetId: string;
  currentLevel: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scene, setScene] = useState('client_talk');
  const [reaction, setReaction] = useState('');
  const [mostTouchedPoint, setMostTouchedPoint] = useState('');
  const [followUpQuestions, setFollowUpQuestions] = useState('');
  const [evidenceLevelAfter, setEvidenceLevelAfter] = useState(currentLevel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // v1.6: 反向校准状态
  const [suggesting, setSuggesting] = useState(false);
  const [reverseCalibrationResults, setReverseCalibrationResults] = useState<{
    suggestions: Array<{
      kernelId: string;
      kernelCategory: string;
      kernelContent: string;
      kernelCounterExample: string | null;
      hasCounter: boolean;
      score: number;
      matchedWords: string[];
      reason: string;
      suggestedCounterExample: string;
    }>;
  } | null>(null);
  const [applyingCounter, setApplyingCounter] = useState<string | null>(null);

  const handleSuggestReverseCalibration = async () => {
    setSuggesting(true);
    setReverseCalibrationResults(null);
    try {
      const res = await fetch('/api/kernel/feedback-suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId, reaction: `${reaction} ${mostTouchedPoint} ${followUpQuestions}`.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setReverseCalibrationResults({ suggestions: data.suggestions });
        if (data.suggestions.length === 0) {
          alert('没找到与本资产强相关的 Kernel —— 可能这条判断目前不需要反例。');
        }
      } else {
        alert(`分析失败：${data.error}`);
      }
    } catch (e: any) {
      alert(`分析失败：${e.message}`);
    } finally {
      setSuggesting(false);
    }
  };

  const handleApplyCounter = async (kernelId: string, counterExample: string) => {
    setApplyingCounter(kernelId);
    try {
      const res = await fetch(`/api/kernel/${kernelId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ counterExample }),
      });
      const data = await res.json();
      if (data.ok) {
        // 更新本地结果
        if (reverseCalibrationResults) {
          setReverseCalibrationResults({
            suggestions: reverseCalibrationResults.suggestions.map(s =>
              s.kernelId === kernelId
                ? { ...s, hasCounter: true, kernelCounterExample: counterExample }
                : s
            ),
          });
        }
        alert('反例已加为反例（也更新了 lastVerifiedAt）');
      } else {
        alert(`添加失败：${data.error}`);
      }
    } catch (e: any) {
      alert(`添加失败：${e.message}`);
    } finally {
      setApplyingCounter(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // V1.11.16: IDB-first 写反馈（Vercel NO_SQLITE 兼容）
      const { addFeedback } = await import('@/lib/idb/operations');
      await addFeedback({
        id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        assetId,
        scene: scene || null,
        outputId: null,
        rating: 0,
        reaction: reaction || null,
        mostTouchedPoint: mostTouchedPoint || null,
        followUpQuestions: followUpQuestions || null,
        evidenceLevelAfter: evidenceLevelAfter || null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-panel)', borderRadius: 10, maxWidth: 600, width: '100%', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(15, 23, 42, 0.25)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              📈 记录使用反馈
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>客户/读者对这条洞察的反应</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 24, color: 'var(--text-3)', cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
          <FormField label="使用场景">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { v: 'client_talk', l: '客户沟通' },
                { v: 'article', l: '公众号' },
                { v: 'course', l: '课程' },
                { v: 'colleague', l: '同行' },
                { v: 'archive', l: '归档' },
                { v: 'other', l: '其他' },
              ].map(s => (
                <button
                  key={s.v}
                  onClick={() => setScene(s.v)}
                  className={`btn btn-sm ${scene === s.v ? 'btn-primary' : ''}`}
                  style={{ padding: '5px 10px' }}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="对方反应" hint="原话优先（保留口语气）">
            <textarea
              value={reaction}
              onChange={e => setReaction(e.target.value)}
              placeholder="客户说：&#10;'你们说的'判断力稀缺'我第一次听到这么直接的说法。'"
              className="textarea"
            />
          </FormField>

          <FormField label="最触动点" hint="客户主动提的部分">
            <input value={mostTouchedPoint} onChange={e => setMostTouchedPoint(e.target.value)} placeholder="'判断力 × AI = 你之前做不到的事' 这个公式" className="input" />
          </FormField>

          <FormField label="产生追问">
            <input value={followUpQuestions} onChange={e => setFollowUpQuestions(e.target.value)} placeholder="'那我们怎么判断自己团队的判断力水平？'" className="input" />
          </FormField>

          <FormField label="证据等级（手动调整）">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['E0', 'E1', 'E2', 'E3', 'E4', 'E5'].map(l => (
                <button
                  key={l}
                  onClick={() => setEvidenceLevelAfter(l)}
                  className={`btn btn-sm ${evidenceLevelAfter === l ? 'btn-primary' : ''}`}
                  style={{ padding: '5px 10px' }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              当前 {currentLevel} · E3+ 需要客户沟通共鸣，E4+ 需要被方案/文章采用
            </div>
          </FormField>

          {error && (
            <div className="callout callout-danger" style={{ marginTop: 12, fontSize: 12 }}>✗ {error}</div>
          )}

          {/* v1.6: 反向校准建议按钮 */}
          <div style={{
            marginTop: 16, padding: 12, background: 'var(--primary-soft)',
            borderRadius: 6, border: '1px solid var(--primary)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.5 }}>
              💡 <strong>反向校准</strong>：写完反馈后，看看哪条 Insight Kernel 应该加反例
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleSuggestReverseCalibration}
              disabled={suggesting || !reaction}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {suggesting ? '分析中…' : '🔍 找需要加反例的 Kernel'}
            </button>
            {!reaction && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, textAlign: 'center' }}>
                先在"客户/读者反应"里写点内容
              </div>
            )}
          </div>

          {reverseCalibrationResults && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                🎯 建议加反例的 Kernel（{reverseCalibrationResults.suggestions.length}）
              </div>
              {reverseCalibrationResults.suggestions.length === 0 ? (
                <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 12, color: 'var(--text-3)' }}>
                  没找到与本资产强相关的 Kernel
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reverseCalibrationResults.suggestions.map(s => (
                    <div key={s.kernelId} style={{
                      padding: 10, background: 'var(--bg-panel)', borderRadius: 6,
                      border: '1px solid var(--line)', fontSize: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 10, padding: '2px 6px', borderRadius: 6,
                          background: 'var(--primary-soft)', color: 'var(--primary)',
                          fontWeight: 600, flexShrink: 0,
                        }}>{s.kernelCategory}</span>
                        <span style={{ color: 'var(--ink)', flex: 1, fontWeight: 500 }}>{s.kernelContent}</span>
                      </div>
                      {s.suggestedCounterExample && (
                        <div style={{
                          padding: 8, background: 'var(--bg-subtle)', borderRadius: 4,
                          fontSize: 11, color: 'var(--text-2)', marginBottom: 6,
                          borderLeft: '2px solid var(--accent)',
                        }}>
                          <strong>建议反例：</strong> {s.suggestedCounterExample}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {s.hasCounter && (
                          <span style={{ fontSize: 10, color: 'var(--warning)', alignSelf: 'center' }}>⚠️ 已加过反例</span>
                        )}
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleApplyCounter(s.kernelId, s.suggestedCounterExample)}
                          disabled={applyingCounter === s.kernelId}
                        >
                          {applyingCounter === s.kernelId ? '应用…' : s.hasCounter ? '更新反例' : '✓ 加为反例'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '💾 保存反馈'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="label">{label}</label>
      {hint && <div className="label-hint">{hint}</div>}
      {children}
    </div>
  );
}

/* ===== Markdown 渲染工具（仅资产正文用） ===== */
function simpleMd(md: string): string {
  let html = md;
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _l, c) => `<pre><code>${escapeHtml(c.trim())}</code></pre>`);
  html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  html = html.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/((?:\|.*\|\n)+)/g, (m) => {
    const lines = m.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return m;
    if (!/^\|[\s\-:|]+\|$/.test(lines[1].trim())) return m;
    const headers = lines[0].split('|').map(s => s.trim()).filter(Boolean);
    const rows = lines.slice(2).map(l => l.split('|').map(s => s.trim()).filter(Boolean));
    let t = '<table><thead><tr>';
    headers.forEach(h => t += `<th>${h}</th>`);
    t += '</tr></thead><tbody>';
    rows.forEach(r => { t += '<tr>'; r.forEach(c => t += `<td>${c}</td>`); t += '</tr>'; });
    return t + '</tbody></table>';
  });
  html = html.replace(/^- (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.split(/\n\n+/).map(p => {
    p = p.trim(); if (!p) return ''; if (p.startsWith('<')) return p; return `<p>${p}</p>`;
  }).join('\n');
  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function RelatedAssetsSection({ assetId }: { assetId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/assets/${assetId}/related`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setItems(d.related || []);
          setReason(d.reason || '');
        }
      })
      .finally(() => setLoading(false));
  }, [assetId]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
          相关资产
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {reason === 'topic_overlap' ? '基于共同主题推荐' : '基于证据等级 + 最近更新推荐'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {items.length} 张
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {items.map(a => (
          <Link
            key={a.id}
            href={`/assets/${a.id}`}
            className="card card-hover"
            style={{
              textDecoration: 'none', color: 'inherit', display: 'block',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span className={`pill pill-${a.evidenceLevel.toLowerCase()}`}>{a.evidenceLevel}</span>
              {a.sharedTopics && a.sharedTopics.length > 0 && (
                <span style={{
                  fontSize: 10, color: 'var(--primary)', fontWeight: 600,
                  padding: '2px 6px', background: 'var(--primary-soft)',
                  borderRadius: 3,
                }}>
                  🤝 {a.sharedTopics[0]}{a.sharedTopics.length > 1 ? ` +${a.sharedTopics.length - 1}` : ''}
                </span>
              )}
            </div>
            <h3 style={{
              fontSize: 13, fontWeight: 600, color: 'var(--ink)',
              margin: '0 0 6px', lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {a.title}
            </h3>
            {a.oneSentenceInsight && (
              <p style={{
                fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55,
                margin: 0,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {a.oneSentenceInsight}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * v0.10.3 进化时间线
 *
 * 资产视角的"成长史"：
 * - 🟢 创建：资产入库
 * - ⬆️ 反馈：客户/同事/写作场景的反馈，evidenceLevel 升级
 * - 📤 输出：被 outputs 表关联到（讲过/写过/做过）
 */
function EvolutionTimeline({
  feedback, outputs, createdAt,
}: {
  feedback: Array<{
    id: string;
    scene: string;
    reaction: string | null;
    mostTouchedPoint: string | null;
    evidenceLevelBefore: string | null;
    evidenceLevelAfter: string | null;
    createdAt: number;
  }>;
  outputs: Array<{
    id: string;
    title: string;
    outputType: string;
    templateType: string | null;
    sourceUrl: string | null;
    createdAt: number;
  }>;
  createdAt: number;
}) {
  // 合并并按时间倒序
  type Ev = {
    type: 'created' | 'feedback' | 'output';
    at: number;
    payload: any;
  };
  const events: Ev[] = [
    { type: 'created' as const, at: createdAt, payload: { title: '资产入库' } },
    ...feedback.map(f => ({ type: 'feedback' as const, at: f.createdAt, payload: f })),
    ...outputs.map(o => ({ type: 'output' as const, at: o.createdAt, payload: o })),
  ].sort((a, b) => b.at - a.at);

  if (events.length <= 1 && feedback.length === 0 && outputs.length === 0) {
    return (
      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--line)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          进化时间线
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 16 }}>
          📜 这张卡还没有被用过 — 等第一次写稿 / 客户反馈后会自动出现
        </div>
      </div>
    );
  }

  const SCENE_LABEL: Record<string, string> = {
    client_talk: '客户对话', article: '写作', course: '课程', colleague: '同事讨论', archive: '归档', other: '其他',
  };
  const OUTPUT_TYPE_LABEL: Record<string, string> = {
    talk_script: '话术', article_outline: '大纲', writing: '写作',
  };

  return (
    <div style={{ padding: '20px 24px', borderTop: '1px solid var(--line)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
        进化时间线 <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>· {events.length} 个事件</span>
      </div>
      <div style={{ position: 'relative', paddingLeft: 16 }}>
        {/* 竖线 */}
        <div style={{
          position: 'absolute', left: 5, top: 6, bottom: 6, width: 1.5,
          background: 'var(--line)',
        }} />
        {events.map((ev, i) => {
          if (ev.type === 'created') {
            return (
              <div key={`c-${i}`} style={{ position: 'relative', marginBottom: 12, fontSize: 12, color: 'var(--text-3)' }}>
                <span style={{
                  position: 'absolute', left: -16, top: 4, width: 12, height: 12,
                  borderRadius: 6, background: 'var(--bg-panel)', border: '2px solid var(--text-3)',
                }} />
                资产入库 · {new Date(ev.at * 1000).toLocaleDateString('zh-CN')}
              </div>
            );
          }
          if (ev.type === 'feedback') {
            const f = ev.payload;
            const hasUpgrade = f.evidenceLevelBefore && f.evidenceLevelAfter && f.evidenceLevelBefore !== f.evidenceLevelAfter;
            return (
              <div key={f.id} style={{ position: 'relative', marginBottom: 14 }}>
                <span style={{
                  position: 'absolute', left: -16, top: 4, width: 12, height: 12,
                  borderRadius: 6,
                  background: hasUpgrade ? 'var(--primary)' : 'var(--bg-panel)',
                  border: hasUpgrade ? 'none' : '2px solid var(--primary)',
                }} />
                <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', marginRight: 6 }}>{SCENE_LABEL[f.scene] ?? f.scene}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{new Date(f.at * 1000).toLocaleDateString('zh-CN')}</span>
                </div>
                {hasUpgrade && (
                  <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 2 }}>
                    ⬆️ {f.evidenceLevelBefore} → {f.evidenceLevelAfter}
                  </div>
                )}
                {f.mostTouchedPoint && (
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>
                    最触动: {f.mostTouchedPoint}
                  </div>
                )}
                {f.reaction && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontStyle: 'italic' }}>
                    「{f.reaction}」
                  </div>
                )}
              </div>
            );
          }
          // output
          const o = ev.payload;
          return (
            <div key={o.id} style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{
                position: 'absolute', left: -16, top: 4, width: 12, height: 12,
                borderRadius: 6, background: 'var(--bg-panel)', border: '2px solid #16a34a',
              }} />
              <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
                <span style={{ fontSize: 10, color: 'var(--text-3)', marginRight: 6 }}>
                  {OUTPUT_TYPE_LABEL[o.outputType] ?? o.outputType}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{new Date(ev.at * 1000).toLocaleDateString('zh-CN')}</span>
              </div>
              <Link
                href={o.outputType === 'writing' ? `/writing/${o.id}` : `/output`}
                style={{
                  display: 'block', fontSize: 12, color: 'var(--ink)', marginTop: 2,
                  textDecoration: 'none', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {o.title}
              </Link>
              {o.sourceUrl && (
                <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--text-3)', textDecoration: 'none', marginTop: 2, display: 'inline-block' }}>
                  🔗 原文
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


/**
 * v1.6 强化进化线（5 阶段）
 *
 * 来源 → 升级 → 被引用 → 反馈 → Kernel
 * 让用户看到「我的专业资产在变强」
 *
 * 跟 v0.10.3 EvolutionTimeline 区别：多了"升级"和"进入 Kernel" 2 个阶段
 */
function EnhancedEvolutionTimeline({
  items,
}: {
  items: Array<{
    stage: 'source' | 'upgrade' | 'output' | 'feedback' | 'kernel';
    ts: number;
    title: string;
    subtitle?: string;
    meta?: string;
    href?: string;
    stageLabel: string;
    stageColor: string;
  }>;
}) {
  // 每阶段默认显示前 3 条，>3 的折叠到「+N 更多」
  const PER_STAGE = 3;
  const stageOrder: Array<'source' | 'upgrade' | 'output' | 'feedback' | 'kernel'> = [
    'source', 'upgrade', 'output', 'feedback', 'kernel',
  ];

  // 按阶段分组
  const grouped: Record<string, typeof items> = {};
  for (const s of stageOrder) grouped[s] = [];
  for (const it of items) grouped[it.stage].push(it);

  // 每阶段截断到 PER_STAGE
  const truncatedItems: Array<typeof items[number] & { _totalInStage?: number; _stageIndex?: number }> = [];
  for (const s of stageOrder) {
    const list = grouped[s];
    list.forEach((it, idx) => {
      truncatedItems.push({
        ...it,
        _totalInStage: list.length,
        _stageIndex: idx,
      });
    });
  }

  if (items.length <= 1) {
    return (
      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--line)' }}>
        <div style={{
          fontSize: 11, color: 'var(--text-3)', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          🧬 进化线 <span style={{ color: 'var(--text-2)', fontWeight: 400, marginLeft: 'auto' }}>· 1 个阶段</span>
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 16,
          background: 'var(--bg-subtle)', borderRadius: 8,
          border: '1px dashed var(--line)',
        }}>
          📜 这张卡还在「来源」阶段。<br />
          <span style={{ fontSize: 11 }}>
            跑一次 12 章节升级 + 引用到一次输出 + 记一次反馈，就会自动出现完整的 5 阶段进化线。
          </span>
        </div>
      </div>
    );
  }

  // 阶段统计
  const stageCount: Record<string, number> = {};
  for (const it of items) {
    stageCount[it.stage] = (stageCount[it.stage] ?? 0) + 1;
  }

  return (
    <div style={{ padding: '20px 24px', borderTop: '1px solid var(--line)' }}>
      {/* 头部：标题 + 5 阶段 pill */}
      <div style={{
        fontSize: 11, color: 'var(--text-3)', fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: 'var(--primary)', fontSize: 14 }}>🧬</span>
        进化线
        <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>· {items.length} 个事件</span>
        <span style={{ flex: 1 }} />
        {/* 5 阶段小条 */}
        {(['source', 'upgrade', 'output', 'feedback', 'kernel'] as const).map((s) => {
          const c = stageCount[s] ?? 0;
          if (c === 0) return null;
          const meta: Record<typeof s, { color: string; label: string }> = {
            source: { color: '#6366f1', label: '来源' },
            upgrade: { color: '#f59e0b', label: '升级' },
            output: { color: '#10b981', label: '引用' },
            feedback: { color: '#f43f5e', label: '反馈' },
            kernel: { color: '#a78bfa', label: 'Kernel' },
          };
          return (
            <span
              key={s}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 7px',
                background: meta[s].color + '15',
                color: meta[s].color,
                fontSize: 10, fontWeight: 600,
                borderRadius: 10,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {meta[s].label} {c}
            </span>
          );
        })}
      </div>

      {/* 时间线：按 5 阶段顺序，每阶段前 PER_STAGE 条 + 折叠 */}
      <div style={{ position: 'relative', paddingLeft: 18 }}>
        <div style={{
          position: 'absolute', left: 6, top: 6, bottom: 6, width: 1.5,
          background: 'linear-gradient(to bottom, #6366f1 0%, #f59e0b 20%, #10b981 50%, #f43f5e 80%, #a78bfa 100%)',
        }} />
        {stageOrder.map((s) => {
          const list = grouped[s];
          if (list.length === 0) return null;
          const shown = list.slice(0, PER_STAGE);
          const hidden = list.length - shown.length;
          return (
            <StageBlock
              key={s}
              stageKey={s}
              shown={shown}
              hidden={hidden > 0 ? list.slice(PER_STAGE) : []}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * 单个阶段块：前 N 条 + 「+M 更多」折叠按钮
 */
function StageBlock({
  stageKey,
  shown,
  hidden,
}: {
  stageKey: 'source' | 'upgrade' | 'output' | 'feedback' | 'kernel';
  shown: Array<{
    stage: 'source' | 'upgrade' | 'output' | 'feedback' | 'kernel';
    ts: number;
    title: string;
    subtitle?: string;
    meta?: string;
    href?: string;
    stageLabel: string;
    stageColor: string;
  }>;
  hidden: Array<{
    stage: 'source' | 'upgrade' | 'output' | 'feedback' | 'kernel';
    ts: number;
    title: string;
    subtitle?: string;
    meta?: string;
    href?: string;
    stageLabel: string;
    stageColor: string;
  }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const stageColor = shown[0]?.stageColor ?? '#999';
  const stageWord = shown[0]?.stageLabel?.replace(/^[^\s]+\s/, '') ?? '事件';
  const visible = expanded ? [...shown, ...hidden] : shown;

  return (
    <>
      {visible.map((ev, i) => {
        const dot = ev.href ? (
          <Link href={ev.href} style={{
            position: 'absolute', left: -18, top: 4, width: 14, height: 14,
            borderRadius: 7,
            background: ev.stageColor,
            border: '2px solid var(--bg-panel)',
            display: 'block',
            textDecoration: 'none',
          }} />
        ) : (
          <span style={{
            position: 'absolute', left: -18, top: 4, width: 14, height: 14,
            borderRadius: 7,
            background: ev.stageColor,
            border: '2px solid var(--bg-panel)',
            display: 'block',
          }} />
        );
        return (
          <div key={`${stageKey}-${i}`} style={{ position: 'relative', marginBottom: 10 }}>
            {dot}
            <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
              <span style={{
                fontSize: 10, color: ev.stageColor, fontWeight: 600,
                marginRight: 6,
              }}>
                {ev.stageLabel}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                {new Date(ev.ts * 1000).toLocaleDateString('zh-CN')}
              </span>
            </div>
            <div style={{
              fontSize: 13, color: 'var(--ink)', marginTop: 2,
              fontWeight: 500,
            }}>
              {ev.title}
            </div>
            {ev.subtitle && (
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3, lineHeight: 1.5 }}>
                {ev.subtitle}
              </div>
            )}
            {ev.meta && (
              <div style={{
                fontSize: 10, color: 'var(--text-3)', marginTop: 2,
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {ev.meta}
              </div>
            )}
          </div>
        );
      })}
      {hidden.length > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 4,
            marginBottom: 12,
            padding: '6px 12px',
            background: stageColor + '10',
            color: stageColor,
            border: `1px dashed ${stageColor}40`,
            borderRadius: 6,
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          + 还有 {hidden.length} 个{stageWord}（展开）
        </button>
      )}
      {hidden.length > 0 && expanded && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 4,
            marginBottom: 12,
            padding: '4px 12px',
            background: 'transparent',
            color: 'var(--text-3)',
            border: 'none',
            fontSize: 11, fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          ↑ 收起 {hidden.length} 条
        </button>
      )}
    </>
  );
}
