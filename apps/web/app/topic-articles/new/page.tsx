/**
 * v1.7 主题文章：选主题 → 基于已有卡片生成系列文章
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coreBeliefs: string[];
  assetCount: number;
}

interface Asset {
  id: string;
  title: string;
  evidenceLevel: string;
  oneSentenceInsight: string | null;
  antiCommonSense: string | null;
}

interface Article {
  index: number;
  title: string;
  outline: string[];
  draft: string;
  citedAssetIds: string[];
}

export default function CampaignNewPage() {
  const toast = useToast();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [topicAssets, setTopicAssets] = useState<Asset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [count, setCount] = useState<number>(1);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [generatedTopicName, setGeneratedTopicName] = useState<string>('');
  // 当前选用的篇幅（从 /api/config 读用户偏好，单次可改）
  const [articleLength, setArticleLength] = useState<'short' | 'medium' | 'deep' | 'ultra'>('deep');

  // 加载主题 + 用户偏好
  useEffect(() => {
    fetch('/api/topics')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setTopics(d.topics || []);
      })
      .catch((e) => toast.error('加载主题失败：' + e.message));

    // 从 config 读用户篇幅偏好
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.config?.preferences?.articleLength) {
          setArticleLength(d.config.preferences.articleLength);
        }
      })
      .catch(() => { /* noop */ });
  }, [toast]);

  // 切换主题时加载主题下资产
  useEffect(() => {
    if (!selectedTopicId) {
      setTopicAssets([]);
      setSelectedAssetIds(new Set());
      return;
    }
    setLoading(true);
    fetch(`/api/assets?topic=${selectedTopicId}&limit=500`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const items = (d.items || []) as Asset[];
          setTopicAssets(items);
          // 默认全选前 N 张 E2/E1（按证据等级排）
          const sorted = items
            .slice()
            .sort((a, b) => {
              const order = { E2: 0, E1: 1, E0: 2, E3: 3 };
              return (order[a.evidenceLevel as keyof typeof order] ?? 9) -
                     (order[b.evidenceLevel as keyof typeof order] ?? 9);
            });
          const defaultPick = sorted.slice(0, Math.max(count, 1)).map((a) => a.id);
          setSelectedAssetIds(new Set(defaultPick));
        }
      })
      .catch((e) => toast.error('加载卡片失败：' + e.message))
      .finally(() => setLoading(false));
  }, [selectedTopicId, count, toast]);

  const toggleAsset = (id: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!selectedTopicId) return toast.error('请先选主题');
    if (selectedAssetIds.size < count) {
      return toast.error(`至少选 ${count} 张卡片（当前 ${selectedAssetIds.size} 张）`);
    }
    setGenerating(true);
    setArticles([]);
    try {
      const res = await fetch('/api/topic-articles/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topicId: selectedTopicId,
          assetIds: Array.from(selectedAssetIds),
          count,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error('生成失败：' + (data.error || '未知错误'));
        return;
      }
      setArticles(data.articles || []);
      setGeneratedTopicName(data.topic?.name || '');
      toast.success(`✓ 生成 ${data.articleCount} 篇文章`);
      // 滚到结果区
      setTimeout(() => {
        document.getElementById('topic-articles-results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      toast.error('生成失败：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerating(false);
    }
  };

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/"
          style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}
        >
          ← 仪表盘
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', margin: '8px 0 4px' }}>
          📝 主题文章
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
          选一个主题 → 勾选已有卡片 → 生成 {count} 篇系列文章大纲
        </p>
      </div>

      {/* 三栏布局：主题 | 卡片 | 结果 */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
        {/* 左栏：主题列表 */}
        <aside
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 14,
            height: 'fit-content',
            position: 'sticky',
            top: 16,
          }}
        >
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            主题
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topics.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTopicId(t.id)}
                style={{
                  padding: '8px 10px',
                  background: selectedTopicId === t.id ? 'var(--primary)' : 'var(--bg-subtle)',
                  color: selectedTopicId === t.id ? 'white' : 'var(--ink)',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: selectedTopicId === t.id ? 600 : 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  lineHeight: 1.4,
                }}
              >
                <div>{t.name}</div>
                <div style={{
                  fontSize: 10, opacity: 0.7, marginTop: 2,
                  fontWeight: 400,
                }}>
                  {t.assetCount} 张资产
                </div>
              </button>
            ))}
          </div>

          {selectedTopic && selectedTopic.description && (
            <div style={{
              marginTop: 14,
              padding: 10,
              background: 'var(--bg-subtle)',
              borderRadius: 6,
              fontSize: 11,
              color: 'var(--text-3)',
              lineHeight: 1.5,
            }}>
              {selectedTopic.description}
            </div>
          )}
        </aside>

        {/* 右栏：内容 */}
        <main>
          {!selectedTopicId ? (
            <EmptyState
              icon="👈"
              title="先选一个主题"
              sub="左侧选主题后，会自动加载该主题下的卡片"
            />
          ) : (
            <>
              {/* 卡片选择区 */}
              <section style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: 18,
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                    勾选卡片（已选 {selectedAssetIds.size} / 共 {topicAssets.length}）
                  </h2>
                  <span style={{ flex: 1 }} />
                  <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    篇幅（<Link href="/settings" style={{ color: 'var(--primary)' }}>设置</Link>）
                    <select
                      value={articleLength}
                      onChange={(e) => setArticleLength(e.target.value as any)}
                      style={{
                        padding: '4px 8px',
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--line)',
                        borderRadius: 4,
                        fontSize: 12,
                        color: 'var(--ink)',
                      }}
                    >
                      <option value="short">短文（800-1200 字）</option>
                      <option value="medium">中等（1500-2000 字）</option>
                      <option value="deep">深度长文（2500-3500 字）</option>
                      <option value="ultra">超深度（4000+ 字）</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    篇数
                    <select
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                      style={{
                        padding: '4px 8px',
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--line)',
                        borderRadius: 4,
                        fontSize: 12,
                        color: 'var(--ink)',
                      }}
                    >
                      <option value={1}>1 篇</option>
                      <option value={2}>2 篇</option>
                      <option value={3}>3 篇</option>
                      <option value={4}>4 篇</option>
                      <option value={5}>5 篇</option>
                    </select>
                  </label>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || selectedAssetIds.size < count}
                    style={{
                      padding: '8px 16px',
                      background: generating || selectedAssetIds.size < count
                        ? 'var(--bg-subtle)'
                        : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                      color: generating || selectedAssetIds.size < count ? 'var(--text-3)' : 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: generating || selectedAssetIds.size < count ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {generating ? '✨ 生成中...' : `✨ 生成 ${count} 篇文章`}
                  </button>
                </div>

                {loading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    加载卡片中...
                  </div>
                ) : topicAssets.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    该主题下暂无卡片
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {topicAssets.map((a) => (
                      <label
                        key={a.id}
                        style={{
                          display: 'flex',
                          gap: 10,
                          padding: '10px 12px',
                          background: selectedAssetIds.has(a.id) ? 'rgba(99,102,241,0.06)' : 'var(--bg-subtle)',
                          border: selectedAssetIds.has(a.id) ? '1.5px solid #6366f1' : '1px solid var(--line)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.has(a.id)}
                          onChange={() => toggleAsset(a.id)}
                          style={{ marginTop: 3 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{
                              flexShrink: 0, fontSize: 10, fontWeight: 600,
                              padding: '2px 6px', borderRadius: 3,
                              background: a.evidenceLevel === 'E2' ? '#10b981' : a.evidenceLevel === 'E1' ? '#3b82f6' : '#94a3b8',
                              color: 'white',
                            }}>
                              {a.evidenceLevel}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                              {a.title}
                            </span>
                          </div>
                          {a.oneSentenceInsight && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, marginLeft: 0 }}>
                              {a.oneSentenceInsight}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              {/* 生成结果区 */}
              <section id="topic-articles-results">
                {articles.length === 0 ? (
                  !generating && (
                    <EmptyState
                      icon="✨"
                      title="点上方「生成」按钮"
                      sub={`基于已选 ${selectedAssetIds.size} 张卡片，生成 ${count} 篇有节奏的系列文章`}
                    />
                  )
                ) : (
                  <div>
                    <div style={{
                      padding: '14px 18px',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.08) 100%)',
                      border: '1px solid rgba(99,102,241,0.30)',
                      borderRadius: 10,
                      marginBottom: 14,
                    }}>
                      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                        ✨ 已生成「{generatedTopicName}」{articles.length} 篇文章
                      </h2>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
                        点击单篇标题可复制大纲 / 草稿到写作工作台（V1.7.1 支持一键保存）
                      </p>
                    </div>

                    {articles.map((a) => (
                      <article
                        key={a.index}
                        style={{
                          background: 'var(--bg-panel)',
                          border: '1px solid var(--line)',
                          borderRadius: 10,
                          padding: 20,
                          marginBottom: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                          <span style={{
                            flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700,
                          }}>
                            {a.index}
                          </span>
                          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1.4 }}>
                            {a.title}
                          </h3>
                        </div>

                        {a.outline.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              大纲
                            </div>
                            <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--ink)', fontSize: 13, lineHeight: 1.7 }}>
                              {a.outline.map((o, i) => (
                                <li key={i}>{o}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {a.draft && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              草稿
                            </div>
                            <div style={{
                              padding: 14,
                              background: 'var(--bg-subtle)',
                              borderRadius: 6,
                              fontSize: 13, color: 'var(--ink)', lineHeight: 1.75,
                              whiteSpace: 'pre-wrap',
                            }}>
                              {a.draft}
                            </div>
                          </div>
                        )}

                        {a.citedAssetIds.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>引用卡片：</span>
                            {a.citedAssetIds.map((id) => {
                              const a2 = topicAssets.find((x) => x.id === id);
                              if (!a2) return null;
                              return (
                                <Link
                                  key={id}
                                  href={`/assets/${id}`}
                                  style={{
                                    fontSize: 11,
                                    padding: '3px 8px',
                                    background: 'rgba(99,102,241,0.08)',
                                    border: '1px solid rgba(99,102,241,0.30)',
                                    borderRadius: 4,
                                    color: '#6366f1',
                                    textDecoration: 'none',
                                  }}
                                >
                                  {a2.evidenceLevel} · {a2.title.slice(0, 20)}{a2.title.length > 20 ? '...' : ''}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{
      padding: 60,
      textAlign: 'center',
      background: 'var(--bg-panel)',
      border: '1px dashed var(--line)',
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{sub}</div>
    </div>
  );
}