'use client';

import { useEffect, useState, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

interface Scaffold {
  title: string;
  openingHook: string;
  sections: Array<{
    heading: string;
    keyPoints: string[];
    refAssetIds: string[];
    contentHint: string;
  }>;
  closingAction: string;
}

interface CardData {
  id: string;
  title: string;
  evidenceLevel: string;
  oneSentenceInsight: string | null;
  antiCommonSense: string | null;
  feedbackCount: number;
}

interface KernelData {
  headline: string;
  summary: string;
  coreBeliefs: Array<{ text: string; sourceCardIds: string[] }>;
}

interface WritingData {
  id: string;
  title: string;
  content: string;
  templateType: string | null;
  writingStatus: 'scaffold' | 'draft' | 'published';
  sourceUrl: string | null;
  topicId: string | null;
  audience: string | null;
  scaffold: Scaffold | null;
  createdAt: number;
  updatedAt: number;
  cards: CardData[];
  kernel: KernelData | null;
}

type CompanionResponse = {
  // counter_argument
  questions?: string[];
  // recommend_cards
  assetIds?: string[];
  reasoning?: string;
  // duplicate_check
  previousOutputs?: Array<{ title: string; date: string; overlap: string }>;
};

export default function WritingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<WritingData | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCompanion, setShowCompanion] = useState(false);
  const [companionLoading, setCompanionLoading] = useState<string | null>(null);
  const [companionResult, setCompanionResult] = useState<{ action: string; response: CompanionResponse } | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/writing/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setData(d.writing);
          setContent(d.writing.content ?? '');
          setTitle(d.writing.title ?? '');
        } else {
          toast.error('加载失败：' + d.error);
          router.push('/writing/new');
        }
      });
  }, [id, router, toast]);

  // 自动保存：内容变化 2s 后保存
  useEffect(() => {
    if (!data) return;
    if (content === (data.content ?? '') && title === data.title) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await fetch(`/api/writing/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content, title, writingStatus: content.length > 100 ? 'draft' : 'scaffold' }),
      });
      setSaving(false);
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [content, title, data, id]);

  const callCompanion = async (action: string) => {
    if (!data?.kernel || data.kernel.coreBeliefs.length === 0) {
      toast.error('需要先有核心判断才能用陪练');
      return;
    }
    setCompanionLoading(action);
    setCompanionResult(null);
    try {
      const res = await fetch('/api/writing/companion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          writingId: id,
          action,
          currentText: content.slice(0, 1500) || data.scaffold?.openingHook || '',
          coreBelief: data.kernel.coreBeliefs[0].text,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setCompanionResult({ action, response: d.response });
        setShowCompanion(true);
      } else {
        toast.error(d.error ?? '陪练失败');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCompanionLoading(null);
    }
  };

  const handlePublish = async (sourceUrl: string) => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/writing/${id}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceUrl: sourceUrl || undefined }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(d.alreadyPublished ? '已经发布过了' : `发布成功！${d.bumpedAssetCount} 张卡 feedback_count +1`);
        setShowPublishModal(false);
        // 重新拉取
        const r2 = await fetch(`/api/writing/${id}`);
        const d2 = await r2.json();
        if (d2.ok) setData(d2.writing);
      } else {
        toast.error(d.error ?? '发布失败');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPublishing(false);
    }
  };

  if (!data) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  const isPublished = data.writingStatus === 'published';
  const wordCount = content.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* 顶部 bar */}
      <div style={{
        padding: '12px 28px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-panel)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <Link href="/writing/new" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← 写作</Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          disabled={isPublished}
          style={{
            flex: 1, fontSize: 17, fontWeight: 600, color: 'var(--ink)',
            background: 'transparent', border: 'none', outline: 'none', padding: 4,
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{wordCount} 字</span>
        {saving && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>保存中…</span>}
        <span style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 10,
          background: isPublished ? '#dcfce7' : '#fef3c7',
          color: isPublished ? '#15803d' : '#b45309',
          fontWeight: 600,
        }}>
          {isPublished ? '✓ 已发布' : data.writingStatus === 'draft' ? '草稿' : '骨架'}
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左：骨架 + 资产卡 */}
        <div style={{
          width: 360, flexShrink: 0,
          borderRight: '1px solid var(--line)',
          background: 'var(--bg-subtle)',
          overflowY: 'auto',
        }}>
          {data.scaffold && (
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>
                📐 写作骨架
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, padding: '8px 12px', background: 'var(--bg-panel)', borderRadius: 4, borderLeft: '3px solid var(--primary)', marginBottom: 16 }}>
                {data.scaffold.openingHook}
              </div>
              {data.scaffold.sections.map((s, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>§{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.heading}</span>
                  </div>
                  {s.keyPoints.length > 0 && (
                    <ul style={{ margin: '6px 0 4px 18px', padding: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                      {s.keyPoints.map((kp, j) => <li key={j}>{kp}</li>)}
                    </ul>
                  )}
                  {s.contentHint && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '4px 8px', background: 'var(--bg-panel)', borderRadius: 3, marginTop: 4 }}>
                      💡 {s.contentHint}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-panel)', borderRadius: 4, fontSize: 12, color: 'var(--text)', borderLeft: '3px solid #16a34a' }}>
                🎯 收尾行动: {data.scaffold.closingAction}
              </div>
            </div>
          )}

          {data.cards.length > 0 && (
            <div style={{ padding: 20, borderTop: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>
                📚 引用卡 ({data.cards.length})
              </div>
              {data.cards.map(c => (
                <Link
                  key={c.id}
                  href={`/assets/${c.id}`}
                  target="_blank"
                  style={{
                    display: 'block', padding: '8px 10px', marginBottom: 6,
                    background: 'var(--bg-panel)', borderRadius: 4,
                    textDecoration: 'none', color: 'inherit',
                    borderLeft: '2px solid var(--primary)',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.5 }}>{c.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                    {c.evidenceLevel} · 💬 {c.feedbackCount}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 右：编辑器 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isPublished}
            placeholder="开始写吧…  引用卡会出现在左侧的'引用卡'区，写完后点下方'发布并反哺'。"
            style={{
              flex: 1, padding: '32px 40px',
              fontSize: 15, lineHeight: 1.7,
              color: 'var(--ink)', background: 'var(--bg-panel)',
              border: 'none', outline: 'none', resize: 'none',
              fontFamily: 'var(--font-serif, "Source Han Serif", "Songti SC", serif)',
            }}
          />

          {/* 底部：陪练 + 发布 */}
          <div style={{
            padding: '12px 28px', borderTop: '1px solid var(--line)',
            background: 'var(--bg-panel)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>🧠 陪练:</span>
            <button
              onClick={() => callCompanion('counter_argument')}
              disabled={!!companionLoading || content.length < 20}
              className="btn btn-sm btn-ghost"
            >
              {companionLoading === 'counter_argument' ? '思考中…' : '反方'}
            </button>
            <button
              onClick={() => callCompanion('recommend_cards')}
              disabled={!!companionLoading || content.length < 20}
              className="btn btn-sm btn-ghost"
            >
              {companionLoading === 'recommend_cards' ? '思考中…' : '推荐卡'}
            </button>
            <button
              onClick={() => callCompanion('duplicate_check')}
              disabled={!!companionLoading || content.length < 20}
              className="btn btn-sm btn-ghost"
            >
              {companionLoading === 'duplicate_check' ? '检索中…' : '查重'}
            </button>
            <span style={{ flex: 1 }} />
            <button
              onClick={() => {
                navigator.clipboard.writeText(content);
                toast.success('已复制全文');
              }}
              className="btn btn-sm"
            >
              📋 复制全文
            </button>
            <button
              onClick={() => setShowPublishModal(true)}
              disabled={isPublished || content.length < 100}
              className="btn btn-sm"
              style={{
                background: isPublished ? '#d1d5db' : 'var(--primary)',
                color: 'white', borderColor: isPublished ? '#d1d5db' : 'var(--primary)',
                fontWeight: 600,
              }}
            >
              {isPublished ? '已发布' : '🚀 发布并反哺'}
            </button>
          </div>
        </div>
      </div>

      {/* 陪练结果抽屉 */}
      {showCompanion && companionResult && (
        <CompanionPanel
          result={companionResult}
          onClose={() => setShowCompanion(false)}
        />
      )}

      {/* 发布弹窗 */}
      {showPublishModal && (
        <PublishModal
          onClose={() => setShowPublishModal(false)}
          onPublish={handlePublish}
          publishing={publishing}
        />
      )}
    </div>
  );
}

function CompanionPanel({ result, onClose }: { result: { action: string; response: CompanionResponse }; onClose: () => void }) {
  const title = {
    counter_argument: '🛡 反方观点 — 读者会挑战你的 3 个问题',
    recommend_cards: '🎯 推荐能引用的卡',
    duplicate_check: '🔍 重复论点检测 — 过去 6 个月',
  }[result.action as string] || '陪练结果';

  return (
    <div style={{
      position: 'fixed', bottom: 60, right: 28,
      width: 420, maxHeight: '60vh',
      background: 'var(--bg-panel)', border: '1px solid var(--line)',
      borderRadius: 8, padding: 20,
      boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
      overflowY: 'auto', zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18 }}>×</button>
      </div>

      {result.action === 'counter_argument' && result.response.questions && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {result.response.questions.map((q, i) => (
            <li key={i} style={{
              fontSize: 13, color: 'var(--ink)', lineHeight: 1.6,
              padding: '10px 12px', background: 'var(--bg-subtle)',
              borderLeft: '3px solid #dc2626', borderRadius: '0 4px 4px 0',
              marginBottom: 8,
            }}>
              <strong style={{ color: '#dc2626' }}>Q{i + 1}.</strong> {q}
            </li>
          ))}
        </ul>
      )}

      {result.action === 'recommend_cards' && result.response.assetIds && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
            {result.response.reasoning}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            引用 asset ID：{result.response.assetIds.join(', ')}
          </div>
        </div>
      )}

      {result.action === 'duplicate_check' && result.response.previousOutputs && (
        <div>
          {result.response.previousOutputs.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>
              ✓ 没有找到高度重叠的历史文章
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {result.response.previousOutputs.map((o, i) => (
                <li key={i} style={{
                  fontSize: 13, color: 'var(--ink)', lineHeight: 1.6,
                  padding: '10px 12px', background: 'var(--bg-subtle)',
                  borderLeft: '3px solid #f59e0b', borderRadius: '0 4px 4px 0',
                  marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 600 }}>{o.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{o.date}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>重叠: {o.overlap}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PublishModal({ onClose, onPublish, publishing }: { onClose: () => void; onPublish: (url: string) => void; publishing: boolean }) {
  const [sourceUrl, setSourceUrl] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.4)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-panel)', padding: 24, borderRadius: 10,
        width: 440, maxWidth: '90vw',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>🚀 发布并反哺</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.5 }}>
          发布后会自动给本文引用的卡 +1 feedback_count，作为"我用过这张卡"的痕迹
        </div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
          公众号 URL（可选）
        </label>
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://mp.weixin.qq.com/s/..."
          style={{
            width: '100%', padding: '8px 12px', fontSize: 13,
            border: '1px solid var(--line)', borderRadius: 4,
            background: 'var(--bg-panel)', color: 'var(--ink)',
            outline: 'none', marginBottom: 18,
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={publishing} className="btn btn-sm btn-ghost">取消</button>
          <button
            onClick={() => onPublish(sourceUrl)}
            disabled={publishing}
            className="btn btn-sm"
            style={{ background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)', fontWeight: 600 }}
          >
            {publishing ? '发布中…' : '确认发布'}
          </button>
        </div>
      </div>
    </div>
  );
}
