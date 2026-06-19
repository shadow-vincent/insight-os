'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

interface Candidate {
  id: string;
  title: string;
  status: string;
  type: string;
  evidenceLevel: string;
  priority: string | null;
  source: string | null;
  sourceType: string | null;
  oneSentenceInsight: string | null;
  antiCommonSense: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

const STATUS_LABEL: Record<string, string> = {
  candidate: '待确认',
  in_use: '已入库',
  archived: '已归档',
};

const STATUS_TONE: Record<string, 'accent' | 'success' | 'muted'> = {
  candidate: 'accent',
  in_use: 'success',
  archived: 'muted',
};

export default function CandidatesPage() {
  const [list, setList] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'candidate' | 'in_use' | 'archived'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetch('/api/candidates')
      .then(r => r.json())
      .then(data => {
        if (data.ok) setList(data.candidates);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = list.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const counts = {
    all: list.length,
    candidate: list.filter(c => c.status === 'candidate').length,
    in_use: list.filter(c => c.status === 'in_use').length,
    archived: list.filter(c => c.status === 'archived').length,
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">候选池</h1>
          <p className="page-subtitle">
            {list.length} 张轻量卡 · 待确认 / 已入库 / 已归档
          </p>
        </div>
        <Link href="/inbox" className="btn btn-primary">+ 新增</Link>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--line)' }}>
        {(['all', 'candidate', 'in_use', 'archived'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${filter === f ? 'var(--primary)' : 'transparent'}`,
              color: filter === f ? 'var(--primary)' : 'var(--text-2)',
              fontSize: 14,
              fontWeight: filter === f ? 600 : 500,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {f === 'all' ? '全部' : f === 'candidate' ? '待确认' : f === 'in_use' ? '已入库' : '已归档'}
            <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-3)' }}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">📥</div>
          <p>没有候选</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => (
            <CandidateRow
              key={c.id}
              c={c}
              expanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              toast={toast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateRow({ c, expanded, onToggle, toast }: {
  c: Candidate; expanded: boolean; onToggle: () => void;
  toast: { error: (m: string) => void; success: (m: string) => void; info: (m: string) => void };
}) {
  const date = new Date(c.createdAt * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const statusLabel = STATUS_LABEL[c.status] || c.status;
  const statusTone = STATUS_TONE[c.status] || 'muted';
  const statusColor = statusTone === 'success' ? 'var(--success)'
    : statusTone === 'accent' ? 'var(--accent)'
    : 'var(--text-3)';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        onClick={onToggle}
        style={{
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 11,
              color: statusColor,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {statusLabel}
            </span>
            <span className={`pill pill-${c.evidenceLevel.toLowerCase()}`}>{c.evidenceLevel}</span>
            {c.priority && <span className={`pill pill-priority-${c.priority.toLowerCase()}`}>{c.priority}</span>}
            {c.source && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>· {c.source}</span>}
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>· {date}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>
            {c.title}
          </div>
          {!expanded && c.oneSentenceInsight && (
            <div style={{ fontSize: 13, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.oneSentenceInsight.slice(0, 100)}
            </div>
          )}
        </div>
        <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--line-soft)' }}>
          {c.oneSentenceInsight && (
            <div className="callout" style={{ margin: '16px 0 14px' }}>
              <strong style={{ color: 'var(--primary)' }}>一句话洞察：</strong>
              <span style={{ color: 'var(--text)' }}> {c.oneSentenceInsight}</span>
            </div>
          )}

          {c.antiCommonSense && (
            <div className="callout callout-accent" style={{ marginBottom: 14 }}>
              <strong style={{ color: 'var(--accent)' }}>反常识：</strong>
              <span style={{ color: 'var(--text)' }}> {c.antiCommonSense}</span>
            </div>
          )}

          {c.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {c.tags.map((t, i) => (
                <span key={i} className="pill" style={{ background: 'var(--bg-subtle)', color: 'var(--text-2)' }}>{t}</span>
              ))}
            </div>
          )}

          {c.status === 'in_use' ? (
            <Link href={`/assets/${c.id}`} className="btn btn-primary" style={{ marginTop: 8 }}>
              查看资产详情 →
            </Link>
          ) : c.status === 'candidate' ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--line-soft)' }}>
              <Link href={`/assets/${c.id}`} className="btn">查看详情</Link>
              <Link href="/inbox" className="btn">继续完善</Link>
              <button
                className="btn btn-primary"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm(`确认将「${c.title}」入库为正式资产？`)) return;
                  const res = await fetch(`/api/candidates/${c.id}/promote`, { method: 'POST' });
                  const data = await res.json();
                  if (data.ok) {
                    window.location.reload();
                  } else {
                    toast.error('入库失败: ' + (data.error || '未知错误'));
                  }
                }}
              >
                确认入库 →
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-3)', paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              状态：{statusLabel} · 不可编辑
            </div>
          )}
        </div>
      )}
    </div>
  );
}
