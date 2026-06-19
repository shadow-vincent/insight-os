'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

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
}

interface GenerateResult {
  title: string;
  primary_version?: string;
  structured?: {
    title: string;
    hook: string;
    core_points: string[];
    counter_intuitive: string;
    closing: string;
  };
  variants: Array<{ label: string; content: string }>;
  key_quotes: string[];
  usage_suggestion: string;
}

export function AssetDetailClient({ asset, initialBody, tags, llmEnabled, timeline }: AssetDetailClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [gen, setGen] = useState<{
    loading: boolean;
    outputType: 'talk_script' | 'article_outline' | null;
    error: string | null;
    result: GenerateResult | null;
  }>({
    loading: false,
    outputType: null,
    error: null,
    result: null,
  });

  const [audience, setAudience] = useState('CIO');
  const [showOutput, setShowOutput] = useState(false);
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

  const handleGenerate = async (outputType: 'talk_script' | 'article_outline') => {
    if (!llmEnabled) {
      setGen({ ...gen, error: '请先在 /settings 配置 LLM' });
      return;
    }
    setGen({ loading: true, outputType, error: null, result: null });
    setShowOutput(true);

    try {
      const res = await fetch('/api/output/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          outputType,
          audience: buildAudienceText(outputType, audience),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setGen({ loading: false, outputType, error: null, result: data.data });
        router.refresh();
      } else {
        setGen({ loading: false, outputType, error: data.error || '生成失败', result: null });
      }
    } catch (e: any) {
      setGen({ loading: false, outputType, error: e.message, result: null });
    }
  };

  const handleCopy = (text?: string) => {
    const content = text ?? resultToText(gen.result) ?? '';
    navigator.clipboard.writeText(content);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowOutput(false);
        setShowFeedback(false);
      }
    };
    if (showOutput || showFeedback) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showOutput, showFeedback]);

  const normalizedResult = gen.result ? normalizeResult(gen.result) : null;

  return (
    <>
      <div className="page-container">
        {/* 顶部工具条（返回 / tags）— 全宽，不受两列影响 */}
        <div style={{ maxWidth: 1440, margin: '0 auto 20px' }}>
          <Link href="/assets" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
            ← 返回资产库
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

            {/* 相关资产 */}
            <RelatedAssetsSection assetId={asset.id} />
          </div>

          {/* 右 sticky 操作面板（宽屏） / 窄屏时移动到下方 */}
          <div className="detail-side">
            <div className="card detail-side-card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* 生成输出区 */}
              <div style={{ padding: '24px 24px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                    🎯 生成输出
                  </h3>
                  {!llmEnabled && (
                    <Link href="/settings" className="btn btn-sm btn-accent">
                      ⚠️ LLM 未配置
                    </Link>
                  )}
                </div>

                {/* audience 紧凑选择器 */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, fontWeight: 600 }}>面向</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['CIO', 'CEO', 'CFO', '业务负责人', '同行'].map(a => (
                      <button
                        key={a}
                        onClick={() => setAudience(a)}
                        style={{
                          fontSize: 12,
                          padding: '5px 12px',
                          borderRadius: 5,
                          border: '1px solid var(--line)',
                          background: audience === a ? 'var(--primary)' : 'var(--bg-panel)',
                          color: audience === a ? 'white' : 'var(--text-2)',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontWeight: audience === a ? 600 : 500,
                        }}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 两个生成按钮 */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleGenerate('talk_script')}
                    disabled={gen.loading}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {gen.loading && gen.outputType === 'talk_script' ? '⏳ 生成中…' : '💬 话术'}
                  </button>
                  <button
                    className="btn btn-accent"
                    onClick={() => handleGenerate('article_outline')}
                    disabled={gen.loading}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {gen.loading && gen.outputType === 'article_outline' ? '⏳ 生成中…' : '📝 大纲'}
                  </button>
                </div>

                {gen.error && (
                  <div className="callout callout-danger" style={{ marginTop: 12, fontSize: 12 }}>
                    ✗ {gen.error}
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

              {/* v0.10.3 进化时间线 */}
              <EvolutionTimeline
                feedback={timeline.feedback}
                outputs={timeline.outputs}
                createdAt={asset.createdAt}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 全屏输出 modal */}
      {showOutput && normalizedResult && (
        <OutputFullModal result={normalizedResult} onClose={() => setShowOutput(false)} onCopy={handleCopy} />
      )}

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
 * 全屏输出 Modal
 */
function OutputFullModal({ result, onClose, onCopy }: {
  result: GenerateResult;
  onClose: () => void;
  onCopy: (text?: string) => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)', borderRadius: 10, maxWidth: 880, width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              ✓ 完整结果
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{result.title}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => onCopy()}>📋 复制全部</button>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 24, color: 'var(--text-3)', cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 28, overflow: 'auto', flex: 1 }}>
          {result.structured ? (
            <StructuredContent s={result.structured} />
          ) : (
            <div style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
              {result.primary_version}
            </div>
          )}

          {result.key_quotes && result.key_quotes.length > 0 && (
            <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--line-soft)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                💎 金句
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15, color: 'var(--text)', lineHeight: 1.85 }}>
                {result.key_quotes.map((q, i) => <li key={i} style={{ marginBottom: 6 }}>{q}</li>)}
              </ul>
            </div>
          )}

          {result.variants && result.variants.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                3 种变体
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {result.variants.map((v, i) => (
                  <div key={i} style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 6, borderLeft: '3px solid var(--primary)' }}>
                    <strong style={{ fontSize: 13, color: 'var(--primary)' }}>{v.label}</strong>
                    <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginTop: 8 }}>{v.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StructuredContent({ s }: { s: NonNullable<GenerateResult['structured']> }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 18px', lineHeight: 1.3 }}>{s.title}</h2>
      {s.hook && <Section label="🪝 钩子段" content={s.hook} />}
      {s.core_points && s.core_points.length > 0 && (
        <Section label={`📌 核心观点 (${s.core_points.length})`}>
          <ol style={{ margin: 0, paddingLeft: 24, fontSize: 15, color: 'var(--text)', lineHeight: 1.85 }}>
            {s.core_points.map((p, i) => <li key={i} style={{ marginBottom: 8 }}>{p}</li>)}
          </ol>
        </Section>
      )}
      {s.counter_intuitive && <Section label="⚡ 反常识判断" content={s.counter_intuitive} highlight />}
      {s.closing && <Section label="🎯 收尾" content={s.closing} />}
    </div>
  );
}

function Section({ label, content, highlight, children }: {
  label: string;
  content?: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>{label}</div>
      <div style={{
        fontSize: 14,
        color: 'var(--text)',
        lineHeight: 1.7,
        padding: 12,
        background: highlight ? 'var(--accent-soft)' : 'var(--bg-subtle)',
        borderLeft: highlight ? '3px solid var(--accent)' : '3px solid var(--primary)',
        borderRadius: '0 6px 6px 0',
        whiteSpace: content ? 'pre-wrap' : undefined,
      }}>
        {content ?? children}
      </div>
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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId, scene, reaction, mostTouchedPoint, followUpQuestions, evidenceLevelAfter }),
      });
      const data = await res.json();
      if (data.ok) onSaved();
      else setError(data.error || '保存失败');
    } catch (e: any) {
      setError(e.message);
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

/* ===== 归一化 + 工具函数 ===== */
function buildAudienceText(outputType: string, audience: string): string {
  if (outputType === 'article_outline') {
    return `公众号读者（文章会被${audience}圈子转发）`;
  }
  return `企业 ${audience} / 决策层`;
}

function pickField(obj: any, names: string[]): any {
  if (!obj) return undefined;
  for (const n of names) {
    if (obj[n] !== undefined) return obj[n];
  }
  return undefined;
}

function normalizeResult(raw: any): GenerateResult {
  let structuredRaw: any = pickField(raw, ['structured', 'article_outline', 'outline']);
  let primaryVersionRaw: any = pickField(raw, ['primary_version', 'primaryVersion', 'content', 'main_content', '主版本', '正文']);

  const isPrimaryObj = primaryVersionRaw && typeof primaryVersionRaw === 'object' && !Array.isArray(primaryVersionRaw) && (
    'hook' in primaryVersionRaw || 'hooks' in primaryVersionRaw || 'core_points' in primaryVersionRaw ||
    'core_viewpoints' in primaryVersionRaw || 'counter_intuitive' in primaryVersionRaw ||
    'anti_intuition' in primaryVersionRaw || 'closing' in primaryVersionRaw || 'ending' in primaryVersionRaw
  );

  const rootLooksStructured = raw && (
    'hook' in raw || 'hooks' in raw || 'core_points' in raw || 'core_viewpoints' in raw ||
    'counter_intuitive' in raw || 'anti_intuition' in raw || 'closing' in raw || 'ending' in raw
  );

  const articleRoot = structuredRaw ?? (isPrimaryObj ? primaryVersionRaw : (rootLooksStructured ? raw : null));
  let structured: GenerateResult['structured'] | undefined;

  if (articleRoot) {
    const title = pickField(articleRoot, ['title', '主标题', '标题']) ?? raw.title ?? '公众号大纲';
    const hook = pickField(articleRoot, ['hook', 'hooks', '钩子段', '钩子', 'opening']) ?? '';
    const corePointsRaw = pickField(articleRoot, ['core_points', 'corePoints', 'core_viewpoints', 'coreViewpoints', '核心观点', '核心段落']);
    let core_points: string[] = [];
    if (Array.isArray(corePointsRaw)) {
      core_points = corePointsRaw.map((p: any) => {
        if (typeof p === 'string') return p;
        if (typeof p === 'object' && p) return p.summary ?? p.content ?? p.description ?? p.text ?? p.point ?? JSON.stringify(p);
        return String(p);
      });
    } else if (typeof corePointsRaw === 'string') {
      core_points = corePointsRaw.split('\n').filter(Boolean);
    }
    const counter_intuitive = pickField(articleRoot, ['counter_intuitive', 'counterIntuitive', 'anti_intuition', 'antiIntuition', '反常识判断', '反常识']) ?? '';
    const closing = pickField(articleRoot, ['closing', '结尾', '收尾', 'ending']) ?? '';
    structured = { title, hook, core_points, counter_intuitive, closing };
  }

  const variantsRaw = pickField(raw, ['variants', '变体', '开场变体']);
  const variants = Array.isArray(variantsRaw) ? variantsRaw : [];
  const quotesRaw = pickField(raw, ['key_quotes', 'keyQuotes', 'quotes', '金句']);
  const key_quotes = Array.isArray(quotesRaw) ? quotesRaw : [];
  const primary_version = typeof primaryVersionRaw === 'string' ? primaryVersionRaw : undefined;

  return {
    title: raw.title ?? '生成结果',
    ...(primary_version ? { primary_version } : {}),
    ...(structured ? { structured } : {}),
    variants,
    key_quotes,
    usage_suggestion: pickField(raw, ['usage_suggestion', 'usageSuggestion', 'usage', '使用建议', '使用方式']) ?? '',
  };
}

function resultToText(result: GenerateResult | null): string {
  if (!result) return '';
  if (result.structured) {
    const s = result.structured;
    return [
      `# ${s.title}`, '',
      '## 钩子', s.hook, '',
      '## 核心观点',
      ...s.core_points.map((p, i) => `${i + 1}. ${p}`),
      '', '## 反常识', s.counter_intuitive, '',
      '## 收尾', s.closing,
    ].join('\n');
  }
  return result.primary_version ?? '';
}

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
