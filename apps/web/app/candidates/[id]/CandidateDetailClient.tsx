/**
 * CandidateDetailClient · v1.8.0 候选详情
 *
 * 4 个动作：
 * - 加工（process）→ /api/candidates/[id]/promote（升级为正式资产）
 * - 稍后（signal）→ PATCH status='sorting'（暂存为素材信号）
 * - 忽略（ignore）→ /api/candidates/[id]/ignore（降级为原始素材）
 * - 合并（merge）→ /api/candidates/[id]/merge（合并到目标资产）
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Candidate {
  id: string;
  title: string;
  type: string;
  status: string;
  source: string | null;
  sourceType: string | null;
  oneSentenceInsight: string | null;
  antiCommonSense: string | null;
  evidenceLevel: string;
  priority: string | null;
  tags: string[];
  relatedIds: string[];
  relatedAssets: Array<{ id: string; title: string; evidenceLevel: string }>;
  scoreTotal: number;
  scoreBreakdown: {
    clear?: number;
    evidence?: number;
    contrarian?: number;
    reusable?: number;
    output?: number;
    kernel?: number;
    novelty?: number;
  };
  outputCount: number;
  feedbackCount: number;
  processedAt: number | null;
  isKernelCandidate: number;
  isKernelApproved: number;
  createdAt: number;
  updatedAt: number;
}

export function CandidateDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [mergeTargets, setMergeTargets] = useState<Array<{ id: string; title: string }>>([]);

  // 加载候选（V1.11.15: IDB-first，server 端 Vercel NO_SQLITE 兜底）
  useEffect(() => {
    const load = async () => {
      try {
        const { getAsset, getAssetTopicsByAsset, getTopics } = await import('@/lib/idb/operations');
        // 1) 从 IDB 读 asset
        const asset = await getAsset(id);
        if (asset) {
          // 从 IDB 拿主题标签
          const [assetTopics, allTopics] = await Promise.all([
            getAssetTopicsByAsset(id),
            getTopics(),
          ]);
          const topicNames = assetTopics
            .map(at => allTopics.find(t => t.id === at.topicId)?.name)
            .filter(Boolean) as string[];

          setCandidate({
            id: asset.id,
            title: asset.title,
            statement: asset.oneSentenceInsight || '',
            scoreTotal: asset.scoreTotal,
            evidenceLevel: asset.evidenceLevel,
            recommendedAction: asset.scoreTotal >= 80 ? 'process' : asset.scoreTotal >= 65 ? 'candidate' : asset.scoreTotal >= 50 ? 'signal' : 'ignore',
            reasoning: '',
            breakdown: { clear: 0, evidence: 0, contrarian: 0, reusable: 0, output: 0, kernel: 0, novelty: 0 },
            topics: topicNames,
            tags: [],  // V1.11.15: 详情页 candidate.tags.length 用，给个空数组防 undefined throw
            scenarios: [],
            createdAt: asset.createdAt,
            evidenceType: [],
            relatedAssets: [],  // 同上
          });
          return;
        }

        // 2) Fallback server API（本地 SQLite 模式）
        const res = await fetch(`/api/candidates/${id}`);
        const data = await res.json();
        if (data.ok && data.candidate) {
          setCandidate(data.candidate);
          return;
        }
        setError(data.error || '候选卡不存在');
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--text-3)' }}>加载中...</div>
    );
  }
  if (error || !candidate) {
    return (
      <div style={{ padding: 32 }}>
        <Link href="/candidates" style={{ fontSize: 13, color: 'var(--text-3)' }}>← 返回候选判断</Link>
        <div className="card" style={{ padding: 40, textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>😕</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>{error || '候选卡不存在'}</div>
        </div>
      </div>
    );
  }

  // 推荐动作
  const action = candidate.scoreTotal >= 80 ? 'process' : candidate.scoreTotal >= 65 ? 'candidate' : candidate.scoreTotal >= 50 ? 'signal' : 'ignore';
  const style = actionStyle(action);

  // 加载合并目标（用于合并 modal）
  const loadMergeTargets = async () => {
    try {
      const res = await fetch('/api/candidates?status=in_use');
      const data = await res.json();
      if (data.ok) {
        setMergeTargets((data.candidates || []).map((c: any) => ({ id: c.id, title: c.title })));
      }
    } catch { /* noop */ }
    setShowMergePicker(true);
  };

  // 4 个动作
  const handleProcess = async () => {
    setActionLoading('process');
    try {
      const res = await fetch(`/api/candidates/${id}/promote`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(`加工失败: ${data.error}`);
        return;
      }
      router.push('/assets');
    } catch (e: any) {
      alert(`加工失败: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSignal = async () => {
    setActionLoading('signal');
    try {
      const res = await fetch(`/api/candidates/${id}/signal`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(`操作失败: ${data.error}`);
        return;
      }
      router.push('/candidates');
    } catch (e: any) {
      alert(`操作失败: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleIgnore = async () => {
    if (!confirm('确定忽略这条候选判断？它会回到素材库。')) return;
    setActionLoading('ignore');
    try {
      const res = await fetch(`/api/candidates/${id}/ignore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(`忽略失败: ${data.error}`);
        return;
      }
      router.push('/candidates');
    } catch (e: any) {
      alert(`忽略失败: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMerge = async (targetId: string) => {
    if (!confirm(`合并到目标资产？此操作不可撤销。`)) return;
    setActionLoading('merge');
    try {
      const res = await fetch(`/api/candidates/${id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(`合并失败: ${data.error}`);
        return;
      }
      router.push(`/assets/${targetId}`);
    } catch (e: any) {
      alert(`合并失败: ${e.message}`);
    } finally {
      setActionLoading(null);
      setShowMergePicker(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, padding: '0 0 40px' }}>
      <Link href="/candidates" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
        ← 返回候选判断
      </Link>

      {/* 标题区 */}
      <div style={{ marginTop: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
            background: style.bg, color: style.color, border: `2px solid ${style.border}`,
            flexShrink: 0,
          }}>
            {candidate.scoreTotal}
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="page-title" style={{ fontSize: 22, marginBottom: 4 }}>{candidate.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
              <span style={{
                padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 500,
                background: style.bg, color: style.color,
              }}>
                {actionLabel(action)}
              </span>
              <span>·</span>
              <span>来源: {candidate.source || 'manual'}</span>
              <span>·</span>
              <span>创建 {formatDate(candidate.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 核心判断 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          核心判断
        </div>
        <p style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>
          {candidate.oneSentenceInsight || '（未填写）'}
        </p>
      </div>

      {/* 反常识点（如果有） */}
      {candidate.antiCommonSense && (
        <div className="card" style={{ padding: 20, marginBottom: 16, borderColor: '#ea580c' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            反常识点
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>
            {candidate.antiCommonSense}
          </p>
        </div>
      )}

      {/* 主题标签 + 适用场景 */}
      {candidate.tags.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            主题
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {candidate.tags.map(t => (
              <span key={t} className="pill" style={{ fontSize: 12, background: 'var(--bg-subtle)', color: 'var(--text-2)', padding: '4px 10px', borderRadius: 4 }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* 7 维度评分（默认展开，详情页要让人看到依据） */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            7 维度评分
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            总分 {candidate.scoreTotal} · 加权
          </div>
        </div>
        <ScoreBars breakdown={candidate.scoreBreakdown} />
      </div>

      {/* 关联资产（如果有） */}
      {candidate.relatedAssets.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            与已加工资产相似
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {candidate.relatedAssets.map(a => (
              <Link key={a.id} href={`/assets/${a.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                color: 'var(--text-2)', textDecoration: 'none', padding: 4,
              }}>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 600,
                  fontFamily: 'JetBrains Mono, monospace',
                  background: a.evidenceLevel === 'E3' ? '#bfdbfe' : '#e0e7ff',
                  color: '#1e40af',
                }}>{a.evidenceLevel}</span>
                <span>{a.title}</span>
                <span style={{ color: 'var(--text-3)', marginLeft: 'auto' }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 4 个动作按钮（底部 sticky） */}
      <div style={{
        position: 'sticky', bottom: 0, marginTop: 24,
        background: 'var(--bg-panel)', border: '1px solid var(--line)',
        borderRadius: 10, padding: 12,
        display: 'flex', gap: 8, justifyContent: 'space-between',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
      }}>
        <button
          onClick={handleProcess}
          className="btn"
          style={{
            flex: 1, background: 'var(--primary)', color: 'white', borderColor: 'transparent',
            fontWeight: 500, padding: '10px 16px', fontSize: 14,
          }}
          disabled={actionLoading !== null}
        >
          {actionLoading === 'process' ? '加工中...' : '✓ 加工为正式判断'}
        </button>
        <button
          onClick={handleSignal}
          className="btn"
          style={{
            background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--line)',
            fontSize: 13, padding: '10px 14px',
          }}
          disabled={actionLoading !== null}
        >
          {actionLoading === 'signal' ? '保存中...' : '⏰ 稍后'}
        </button>
        <button
          onClick={handleIgnore}
          className="btn"
          style={{
            background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--line)',
            fontSize: 13, padding: '10px 14px',
          }}
          disabled={actionLoading !== null}
        >
          {actionLoading === 'ignore' ? '忽略中...' : '✗ 忽略'}
        </button>
        <button
          onClick={loadMergeTargets}
          className="btn"
          style={{
            background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--line)',
            fontSize: 13, padding: '10px 14px',
          }}
          disabled={actionLoading !== null}
        >
          {actionLoading === 'merge' ? '合并中...' : '🔗 合并'}
        </button>
      </div>

      {/* 合并目标选择（modal） */}
      {showMergePicker && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setShowMergePicker(false)}>
          <div className="card" style={{ width: 480, maxHeight: '70vh', overflow: 'auto', padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>合并到哪个资产？</div>
              <button onClick={() => setShowMergePicker(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-3)' }}>×</button>
            </div>
            <div style={{ padding: 8 }}>
              {mergeTargets.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                  没有可合并的资产（需要先加工过至少一张）
                </div>
              ) : (
                mergeTargets.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleMerge(t.id)}
                    style={{
                      display: 'block', width: '100%', padding: 10, textAlign: 'left',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      borderRadius: 6, fontSize: 13, color: 'var(--ink)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {t.title}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBars({ breakdown }: { breakdown: NonNullable<Candidate['scoreBreakdown']> }) {
  const items: Array<[string, number, number]> = [
    ['判断清晰度', breakdown.clear ?? 0, 20],
    ['证据强度', breakdown.evidence ?? 0, 20],
    ['反常识', breakdown.contrarian ?? 0, 15],
    ['可复用', breakdown.reusable ?? 0, 15],
    ['输出潜力', breakdown.output ?? 0, 15],
    ['方法论相关', breakdown.kernel ?? 0, 10],
    ['新颖度', breakdown.novelty ?? 0, 5],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(([label, score, weight]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <span style={{ color: 'var(--text-3)', minWidth: 80 }}>{label}</span>
          <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${score * 100}%`, height: '100%',
              background: score >= 0.7 ? '#16a34a' : score >= 0.4 ? '#d97706' : '#dc2626',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{
            color: 'var(--text-2)', minWidth: 60, textAlign: 'right',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
          }}>
            {(score * weight).toFixed(1)}/{weight}
          </span>
        </div>
      ))}
    </div>
  );
}

function actionStyle(action: string) {
  switch (action) {
    case 'process': return { bg: '#f0fdf4', color: '#16a34a', border: '#16a34a' };
    case 'candidate': return { bg: '#fffbeb', color: '#d97706', border: '#d97706' };
    case 'signal': return { bg: '#fef2f2', color: '#dc2626', border: '#dc2626' };
    default: return { bg: '#f1f5f9', color: '#94a3b8', border: '#cbd5e1' };
  }
}

function actionLabel(action: string): string {
  switch (action) {
    case 'process': return '建议加工';
    case 'candidate': return '候选判断';
    case 'signal': return '素材信号';
    default: return '忽略';
  }
}

function formatDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}