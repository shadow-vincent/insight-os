'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface KernelData {
  headline: string;
  summary: string;
  coreBeliefs: Array<{ text: string; sourceCardIds: string[] }>;
  sourceAssetIds: string[];
  generatedAt: number;
  generationModel: string | null;
}

interface TopicData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coreBeliefs: string[];
  sortOrder: number;
  assetCount: number;
  avgEvidence: number;
  lastUsedAt: number | null;
  topAssets: Array<{
    id: string;
    title: string;
    evidenceLevel: string;
    oneSentenceInsight: string | null;
    feedbackCount: number;
  }>;
  kernel: KernelData | null;
}

export default function MapPage() {
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const loadTopics = () => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(data => {
        if (data.ok) setTopics(data.topics);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTopics(); }, []);

  const generateKernel = async (topicId: string) => {
    setGeneratingTopicId(topicId);
    setGenError(null);
    try {
      const res = await fetch(`/api/topics/${topicId}/kernel`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        // 重新拉一次 list
        loadTopics();
      } else {
        setGenError(data.error ?? '生成失败');
      }
    } catch (e: any) {
      setGenError(e.message ?? '网络错误');
    } finally {
      setGeneratingTopicId(null);
    }
  };

  const clearKernel = async (topicId: string) => {
    if (!confirm('清空思想内核？')) return;
    try {
      await fetch(`/api/topics/${topicId}/kernel`, { method: 'DELETE' });
      loadTopics();
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  const totalAssets = topics.reduce((s, t) => s + t.assetCount, 0);
  const topTopic = topics.reduce((max, t) => t.assetCount > max.assetCount ? t : max, topics[0] ?? { assetCount: 0, name: '-' });
  const highEvTopic = topics.reduce((max, t) => t.avgEvidence > max.avgEvidence ? t : max, topics[0] ?? { avgEvidence: 0, name: '-' });

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">资产地图</h1>
        <p className="page-subtitle">{topics.length} 个主题 · {totalAssets} 张已分类资产</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <OverviewCard label="主题数" value={topics.length} />
        <OverviewCard label="已分类资产" value={totalAssets} />
        <OverviewCard label="最丰富主题" value={topTopic.name} hint={`${topTopic.assetCount} 张`} />
        <OverviewCard label="最高 E 等级" value={highEvTopic.name} hint={`平均 E${highEvTopic.avgEvidence}`} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {topics.map(t => (
          <TopicCard
            key={t.id}
            topic={t}
            generatingTopicId={generatingTopicId}
            onGenerate={generateKernel}
            onClear={clearKernel}
          />
        ))}
      </div>

      {topics.length === 0 && (
        <div className="card empty-state">
          <div className="icon">🗺️</div>
          <p>还没有主题</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>运行 <code>node scripts/seed-topics.mjs</code></p>
        </div>
      )}

      {genError && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '12px 18px', color: '#991b1b', fontSize: 13, zIndex: 9999,
          maxWidth: 400,
        }}>
          ❌ {genError}
          <button onClick={() => setGenError(null)} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>×</button>
        </div>
      )}
    </div>
  );
}

function KernelBlock({ kernel, onClear }: { kernel: KernelData; onClear: () => void }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{
      marginBottom: 18,
      background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.06) 0%, rgba(2, 132, 199, 0.04) 100%)',
      border: '1px solid rgba(29, 78, 216, 0.15)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 18px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: expanded ? '1px solid rgba(29, 78, 216, 0.1)' : 'none',
      }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.05em' }}>
            思想内核
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginTop: 2, lineHeight: 1.4 }}>
            {kernel.headline}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--text-3)' }}
        >
          {expanded ? '收起' : '展开'}
        </button>
        <button
          onClick={onClear}
          title="清空内核"
          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
        >
          ×
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '14px 18px' }}>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0, marginBottom: 12 }}>
            {kernel.summary}
          </p>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>
            核心判断 ({kernel.coreBeliefs.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {kernel.coreBeliefs.map((b, i) => (
              <li key={i} style={{
                fontSize: 13, color: 'var(--ink)', lineHeight: 1.6,
                padding: '8px 12px',
                background: 'white',
                borderLeft: '3px solid var(--primary)',
                borderRadius: '0 4px 4px 0',
                marginBottom: 6,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <span style={{ flex: 1 }}>{b.text}</span>
                {b.sourceCardIds.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }}>
                    引用 {b.sourceCardIds.length} 张
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 8, textAlign: 'right' }}>
            由 {kernel.generationModel ?? 'LLM'} 生成于 {new Date(kernel.generatedAt * 1000).toLocaleString('zh-CN')}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.015em' }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function TopicCard({
  topic, generatingTopicId, onGenerate, onClear,
}: {
  topic: TopicData;
  generatingTopicId: string | null;
  onGenerate: (id: string) => void;
  onClear: (id: string) => void;
}) {
  const evLabel = topic.avgEvidence >= 2 ? 'E2+' : topic.avgEvidence >= 1 ? 'E1' : 'E0';
  const lastUsed = topic.lastUsedAt
    ? new Date(topic.lastUsedAt * 1000).toLocaleDateString('zh-CN')
    : '未使用';

  return (
    <div className="card" id={topic.slug} style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '18px 24px',
        background: 'var(--bg-subtle)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{
          fontSize: 12,
          color: 'var(--text-3)',
          fontWeight: 600,
          letterSpacing: '0.08em',
        }}>
          #{topic.sortOrder}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{topic.name}</div>
          {topic.description && (
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>{topic.description}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: 'var(--text-2)' }}>
          <span><strong style={{ color: 'var(--ink)' }}>{topic.assetCount}</strong> 张</span>
          <span>平均 <strong style={{ color: 'var(--ink)' }}>{evLabel}</strong></span>
          <span style={{ color: 'var(--text-3)' }}>最近 {lastUsed}</span>
        </div>
      </div>

      <div style={{ padding: 22 }}>
        {/* v0.8 思想内核 */}
        {topic.kernel ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <Link
                href={`/writing/new?topicId=${topic.id}`}
                className="btn btn-sm"
                style={{
                  background: 'var(--primary)', color: 'white',
                  borderColor: 'var(--primary)',
                  fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                ✍️ 以此写一篇
              </Link>
            </div>
            <KernelBlock kernel={topic.kernel} onClear={() => onClear(topic.id)} />
          </>
        ) : (
          <div style={{
            marginBottom: 18, padding: '14px 18px',
            background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.04) 0%, rgba(2, 132, 199, 0.04) 100%)',
            border: '1px dashed var(--line)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>还没有思想内核</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                LLM 会从 {topic.assetCount} 张卡里提炼 3-5 条核心判断
              </div>
            </div>
            <button
              onClick={() => onGenerate(topic.id)}
              disabled={generatingTopicId === topic.id || topic.assetCount === 0}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                background: generatingTopicId === topic.id ? 'var(--bg-subtle)' : 'var(--primary)',
                color: generatingTopicId === topic.id ? 'var(--text-3)' : 'white',
                border: 'none', borderRadius: 6, cursor: generatingTopicId === topic.id ? 'wait' : 'pointer',
                opacity: topic.assetCount === 0 ? 0.4 : 1,
              }}
            >
              {generatingTopicId === topic.id ? '提炼中…' : '生成内核'}
            </button>
          </div>
        )}

        {topic.coreBeliefs && topic.coreBeliefs.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, letterSpacing: '0.05em' }}>
              核心判断
            </div>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
              {topic.coreBeliefs.map((b, i) => (
                <li key={i} style={{
                  fontSize: 14,
                  color: 'var(--text)',
                  lineHeight: 1.7,
                  padding: '10px 14px',
                  background: 'var(--bg-subtle)',
                  borderLeft: '3px solid var(--accent)',
                  borderRadius: '0 4px 4px 0',
                  marginBottom: 6,
                }}>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {topic.topAssets.length > 0 ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, letterSpacing: '0.05em' }}>
              Top 资产（按 E 等级 + 反馈数）
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topic.topAssets.map(a => (
                <Link
                  key={a.id}
                  href={`/assets/${a.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 5,
                    textDecoration: 'none',
                    color: 'inherit',
                    fontSize: 14,
                  }}
                >
                  <span className={`pill pill-${a.evidenceLevel.toLowerCase()}`}>{a.evidenceLevel}</span>
                  <span style={{ flex: 1, color: 'var(--ink)' }}>{a.title}</span>
                  {a.feedbackCount > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>💬 {a.feedbackCount}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>
            还没有资产归入这个主题
          </div>
        )}
      </div>
    </div>
  );
}
