'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { readSource, writeSource } from '@/lib/data-source';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

interface KernelData {
  headline: string;
  summary: string;
  coreBeliefs: Array<{ text: string; sourceCardIds: string[] }>;
}

interface TopicLite {
  id: string;
  name: string;
  description: string | null;
  assetCount: number;
  kernel: KernelData | null;
}

type TemplateType = 'wechat_article' | 'speech' | 'book_note';

const TEMPLATES: Array<{ id: TemplateType; label: string; sub: string; icon: React.ReactNode }> = [
  {
    id: 'wechat_article', label: '公众号长文', sub: '1500-2500 字 · 4 节',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    ),
  },
  {
    id: 'speech', label: '演讲稿', sub: '30-60 min · 5-6 节',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
  {
    id: 'book_note', label: '读书笔记', sub: '结构化复盘 · 5 节',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
];

function NewWritingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetTopicId = searchParams.get('topicId') ?? '';
  const presetAssetId = searchParams.get('assetId') ?? '';
  const toast = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [topics, setTopics] = useState<TopicLite[]>([]);
  const [topicId, setTopicId] = useState<string>(presetTopicId);
  const [selectedBeliefIdx, setSelectedBeliefIdx] = useState<number | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [templateType, setTemplateType] = useState<TemplateType>('wechat_article');
  const [generating, setGenerating] = useState(false);
  const [availableCards, setAvailableCards] = useState<Array<{ id: string; title: string; oneSentenceInsight: string | null; evidenceLevel: string }>>([]);

  // "基于此卡创作" 模式：fetch 该资产 + 它所属的主题
  const [presetAsset, setPresetAsset] = useState<{ id: string; title: string; topicIds: string[] } | null>(null);
  useEffect(() => {
    if (!presetAssetId) return;
    (async () => {
      try {
        const [aRes, tRes] = await Promise.all([
          fetch(`/api/assets/${presetAssetId}`),
          fetch(`/api/assets/${presetAssetId}/topics`),
        ]);
        const a = await aRes.json();
        const t = await tRes.json();
        if (a.ok && a.asset) {
          setPresetAsset({
            id: a.asset.id,
            title: a.asset.title ?? '（无标题）',
            topicIds: t.ok ? (t.topics as Array<{ topicId: string }>).map(x => x.topicId) : [],
          });
          toast.info(`已带入资产：${a.asset.title ?? '（无标题）'}`);
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetAssetId]);

  // 加载主题
  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setTopics(d.topics.filter((t: TopicLite) => t.kernel));
          if (presetTopicId) {
            setTopicId(presetTopicId);
            setStep(2);
          }
        }
      });
  }, [presetTopicId]);

  // presetAsset 模式：选好主题后自动跳 step 2，并把 presetAsset id 加到 selectedCards
  useEffect(() => {
    if (!presetAsset || topics.length === 0) return;
    // 优先选该资产所属的主题（且该主题必须有 kernel），否则选第一个含 kernel 的主题
    const tid =
      topics.find(t => presetAsset.topicIds.includes(t.id) && t.kernel)?.id ??
      topics.find(t => t.kernel)?.id ??
      '';
    if (!tid) return;
    setTopicId(tid);
    setSelectedCards(prev => prev.includes(presetAsset.id) ? prev : [presetAsset.id, ...prev]);
    setStep(2);
    // 只在 presetAsset/topicId 就绪时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetAsset, topics]);

  // 选了主题后，加载主题 kernel 提到的卡（presetAsset 模式下不覆盖 selectedCards）
  useEffect(() => {
    if (!topicId) return;
    if (presetAsset) return; // presetAsset 模式：selectedCards 已手动设置（仅含此卡）
    const t = topics.find(x => x.id === topicId);
    if (!t?.kernel) return;
    // 收集所有 belief 引用过的卡（去重）
    const ids = Array.from(new Set(t.kernel.coreBeliefs.flatMap(b => b.sourceCardIds)));
    setSelectedCards(ids);
    setSelectedBeliefIdx(null);
  }, [topicId, topics, presetAsset]);

  // 加载主题下的所有卡（备选列表用）
  useEffect(() => {
    if (!topicId) return;
    fetch(`/api/topics/${topicId}/kernel`).catch(() => null);
    // 拿主题卡片走 /api/assets?topic=xxx（后端走 assetTopics join）
    fetch(`/api/assets?topic=${topicId}&limit=30`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setAvailableCards((d.items ?? []).map((a: any) => ({
            id: a.id, title: a.title, oneSentenceInsight: a.oneSentenceInsight, evidenceLevel: a.evidenceLevel,
          })));
        }
      })
      .catch(() => setAvailableCards([]));
  }, [topicId]);

  const selectedTopic = topics.find(t => t.id === topicId);
  const selectedBelief = selectedBeliefIdx != null && selectedTopic?.kernel
    ? selectedTopic.kernel.coreBeliefs[selectedBeliefIdx] : null;

  const handleGenerate = async () => {
    if (!selectedBelief) {
      toast.error('请先选 1 条核心判断');
      return;
    }
    if (selectedCards.length === 0) {
      toast.error('请至少选 1 张支撑卡');
      return;
    }
    setGenerating(true);
    try {
      // V1.12 统一 helper：本地 dev 走 server SQLite，Vercel 走 IDB
      const { addOutput, getAsset } = await import('@/lib/idb/operations');
      const { writeSource } = await import('@/lib/data-source');
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const cardTitles: string[] = [];
      for (const aid of selectedCards) {
        const a = await getAsset(aid);
        if (a?.title) cardTitles.push(a.title);
      }
      const title = `${selectedBelief.text.slice(0, 30)} · 基于 ${cardTitles.length} 张卡`;
      const payload = {
        id,
        outputType: 'article',
        status: 'draft',
        writingStatus: 'scaffold',
        title,
        topicId: topicId ?? null,
        templateType,
        assetIdsJson: JSON.stringify(selectedCards),
        content: `# ${title}\n\n> 基于核心判断: ${selectedBelief.text}\n> 来自 ${cardTitles.length} 张资产卡：\n${cardTitles.map(t => `- ${t}`).join('\n')}\n\n（待生成）\n`,
        createdAt: now,
        updatedAt: now,
      };
      await writeSource('/api/writing/scaffold', payload, {
        fallback: async (p: any) => {
          await addOutput(p);
          return { ok: true, writingId: p.id };
        },
      });
      toast.success('已创建草稿，去写作页面继续');
      router.push(`/writing/${id}`);
    } catch (e: any) {
      toast.error(`创建失败：${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">✍️ 开始写作</h1>
        <p className="page-subtitle">从你的判断库里挑 1 条核心 + 几张支撑卡，3 分钟拿到写作骨架</p>
      </div>

      {/* 步骤指示 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 13, color: 'var(--text-3)' }}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step >= n ? 'var(--primary)' : 'var(--bg-subtle)',
              color: step >= n ? 'white' : 'var(--text-3)',
              fontSize: 12, fontWeight: 600,
            }}>{n}</div>
            <span style={{ color: step === n ? 'var(--ink)' : 'var(--text-3)', fontWeight: step === n ? 600 : 400 }}>
              {n === 1 ? '选主题' : n === 2 ? '选判断' : n === 3 ? '选卡' : '选模板'}
            </span>
            {n < 4 && <span style={{ color: 'var(--text-3)' }}>→</span>}
          </div>
        ))}
      </div>

      {/* Step 1: 选主题 */}
      {step === 1 && (
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {topics.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 16, marginBottom: 8 }}>还没有主题有内核</div>
                <div style={{ fontSize: 13 }}>先去 <Link href="/map" style={{ color: 'var(--primary)' }}>资产地图</Link> 给主题生成内核</div>
              </div>
            ) : (
              <div>
                {topics.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTopicId(t.id); setStep(2); }}
                    style={{
                      width: '100%', padding: '16px 20px',
                      background: topicId === t.id ? 'var(--bg-subtle)' : 'transparent',
                      border: 'none', borderBottom: '1px solid var(--line-soft)',
                      cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>📂</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                        {t.assetCount} 张卡 · {t.kernel ? `${t.kernel.coreBeliefs.length} 条判断` : '无内核'}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>→</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: 选核心判断 */}
      {step === 2 && selectedTopic?.kernel && (
        <div>
          {presetAsset && (
            <div
              style={{
                marginBottom: 16, padding: '10px 14px',
                background: 'var(--primary-soft, #eef2ff)',
                borderLeft: '3px solid var(--primary)',
                borderRadius: '0 6px 6px 0',
                display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
              }}
            >
              <span style={{ fontSize: 16 }}>📌</span>
              <span style={{ flex: 1, color: 'var(--text-2)' }}>
                基于此卡创作：<strong style={{ color: 'var(--ink)' }}>{presetAsset.title}</strong>
              </span>
              <button
                onClick={() => { setPresetAsset(null); setSelectedCards([]); setStep(1); }}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--primary)', fontSize: 12, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 600,
                }}
              >
                ← 换主题
              </button>
            </div>
          )}
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-3)' }}>
            {selectedTopic.name} · kernel: <strong style={{ color: 'var(--ink)' }}>{selectedTopic.kernel.headline}</strong>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {selectedTopic.kernel.coreBeliefs.map((b, i) => (
              <button
                key={i}
                onClick={() => { setSelectedBeliefIdx(i); setStep(3); }}
                style={{
                  width: '100%', padding: '16px 20px',
                  background: selectedBeliefIdx === i ? 'var(--bg-subtle)' : 'transparent',
                  border: 'none', borderBottom: i < selectedTopic.kernel!.coreBeliefs.length - 1 ? '1px solid var(--line-soft)' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 4, flexShrink: 0, marginTop: 2,
                  background: selectedBeliefIdx === i ? 'var(--primary)' : 'transparent',
                  border: selectedBeliefIdx === i ? 'none' : '1.5px solid var(--line-strong)',
                  color: 'white', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selectedBeliefIdx === i ? '✓' : ''}
                </div>
                <div style={{ flex: 1, fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{b.text}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>
                  引用 {b.sourceCardIds.length} 张
                </div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => setStep(1)} className="btn btn-ghost btn-sm">← 重新选主题</button>
          </div>
        </div>
      )}

      {/* Step 3: 选支撑卡 */}
      {step === 3 && selectedBelief && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-3)' }}>
            核心判断: <strong style={{ color: 'var(--ink)' }}>{selectedBelief.text}</strong>
            <br />
            <span style={{ fontSize: 12 }}>已默认勾上 kernel 提到的 {selectedCards.length} 张，可增删</span>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {availableCards.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                这个主题下还没有卡，去资产库加几张
              </div>
            ) : (
              availableCards.map(c => {
                const checked = selectedCards.includes(c.id);
                return (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 18px',
                      borderBottom: '1px solid var(--line-soft)',
                      cursor: 'pointer',
                      background: checked ? 'var(--bg-subtle)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCards([...selectedCards, c.id]);
                        else setSelectedCards(selectedCards.filter(x => x !== c.id));
                      }}
                      style={{ marginTop: 4, cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{c.title}</div>
                      {c.oneSentenceInsight && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.5 }}>
                          {c.oneSentenceInsight}
                        </div>
                      )}
                    </div>
                    <span className={`pill pill-${c.evidenceLevel.toLowerCase()}`} style={{ flexShrink: 0 }}>{c.evidenceLevel}</span>
                  </label>
                );
              })
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between' }}>
            <button onClick={() => setStep(2)} className="btn btn-ghost btn-sm">← 重选判断</button>
            <button
              onClick={() => setStep(4)}
              disabled={selectedCards.length === 0}
              className="btn btn-sm"
              style={{ background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }}
            >
              下一步 →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: 选模板 + 生成 */}
      {step === 4 && selectedBelief && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-3)' }}>
            {selectedCards.length} 张支撑卡 · 核心判断: <strong style={{ color: 'var(--ink)' }}>{selectedBelief.text.slice(0, 30)}…</strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => setTemplateType(t.id)}
                style={{
                  padding: '20px 18px',
                  background: templateType === t.id ? 'var(--bg-subtle)' : 'var(--bg-panel)',
                  border: templateType === t.id ? '2px solid var(--primary)' : '1px solid var(--line)',
                  borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ color: 'var(--primary)', marginBottom: 8 }}>{t.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{t.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{t.sub}</div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button onClick={() => setStep(3)} className="btn btn-ghost btn-sm" disabled={generating}>← 重选卡</button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn"
              style={{
                background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)',
                fontWeight: 600, fontSize: 14, padding: '10px 24px',
                cursor: generating ? 'wait' : 'pointer',
              }}
            >
              {generating ? '生成中…（约 10-15s）' : '⚡ 生成写作骨架'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewWritingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>}>
      <NewWritingInner />
    </Suspense>
  );
}
