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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const toast = useToast();

  const handleDeleted = (id: string) => {
    setList(list.filter(c2 => c2.id !== id));
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handlePromoteClick = async (c: Candidate) => {
    if (!confirm(`确认将「${c.title}」入库为正式资产？`)) return;
    const res = await fetch(`/api/candidates/${c.id}/promote`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      const next = list.map(c2 => c2.id === c.id ? { ...c2, status: 'in_use' } : c2);
      setList(next);
      toast.success(`「${c.title}」已入库`);
    } else {
      toast.error('入库失败: ' + (data.error || '未知错误'));
    }
  };

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

  // 多选：只对 candidate 状态可选
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableFiltered = filtered.filter(c => c.status === 'candidate');
  const allSelectableSelected = selectableFiltered.length > 0
    && selectableFiltered.every(c => selected.has(c.id));

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableFiltered.map(c => c.id)));
    }
  };

  const clearSelection = () => setSelected(new Set());

  const handleBatchPromote = async () => {
    if (selected.size === 0 || batchBusy) return;
    if (!confirm(`确认批量入库 ${selected.size} 张候选卡？\n（每张会调 LLM 生成 12 章节，5 张约 30 秒）`)) return;
    setBatchBusy(true);
    try {
      const res = await fetch('/api/candidates/promote-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`批量入库完成：成功 ${data.promoted}/${selected.size} 张${data.failed > 0 ? `，失败 ${data.failed} 张` : ''}`);
        clearSelection();
        // 刷新列表
        const refresh = await fetch('/api/candidates');
        const refreshData = await refresh.json();
        if (refreshData.ok) setList(refreshData.candidates);
      } else {
        toast.error('批量入库失败: ' + (data.error || '未知错误'));
      }
    } catch (e: any) {
      toast.error('批量入库失败: ' + e.message);
    } finally {
      setBatchBusy(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">候选判断</h1>
          <p className="page-subtitle">
            {list.length} 张候选 · 待确认 / 已入库 / 已归档
          </p>
        </div>
        <Link href="/" className="btn btn-primary">+ 去粘贴</Link>
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

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <div className="card" style={{
          marginBottom: 18, padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--primary-soft)', borderColor: 'var(--primary-line)',
        }}>
          <span style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>
            已选 {selected.size} 张候选
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            批量入库：每张调 LLM 生成 12 章节
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={clearSelection} disabled={batchBusy}>清空</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleBatchPromote}
            disabled={batchBusy}
            style={batchBusy ? { opacity: 0.6, cursor: 'wait' } : {}}
          >
            {batchBusy ? '批量入库中…' : `批量入库 ${selected.size} 张 →`}
          </button>
        </div>
      )}

      {/* 全选行（仅 candidate 状态可批量入库） */}
      {selectableFiltered.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4,
        }}>
          <input
            type="checkbox"
            checked={allSelectableSelected}
            onChange={toggleSelectAll}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            全选 {selectableFiltered.length} 张可入库（仅 candidate 状态）
          </span>
        </div>
      )}

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
              isSelected={selected.has(c.id)}
              selectable={c.status === 'candidate'}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onSelect={(e) => toggleSelect(c.id, e)}
              toast={toast}
              onDeleted={handleDeleted}
              onPromote={handlePromoteClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateRow({ c, expanded, isSelected, selectable, onToggle, onSelect, toast, onDeleted, onPromote }: {
  c: Candidate;
  expanded: boolean;
  isSelected?: boolean;
  selectable?: boolean;
  onToggle: () => void;
  onSelect?: (e: React.MouseEvent) => void;
  toast: { error: (m: string) => void; success: (m: string) => void; info: (m: string) => void };
  onDeleted: (id: string) => void;
  onPromote: (c: Candidate) => void;
}) {
  const date = new Date(c.createdAt * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const statusLabel = STATUS_LABEL[c.status] || c.status;
  const statusTone = STATUS_TONE[c.status] || 'muted';
  const statusColor = statusTone === 'success' ? 'var(--success)'
    : statusTone === 'accent' ? 'var(--accent)'
    : 'var(--text-3)';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确认删除「${c.title}」？\n（关联的 .md 文件也会被删除）`)) return;
    try {
      const res = await fetch(`/api/candidates/${c.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        toast.success(`已删除「${c.title}」`);
        onDeleted(c.id);
      } else {
        toast.error('删除失败: ' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      toast.error('删除失败: ' + err.message);
    }
  };

  return (
    <div className="card" style={{
      padding: 0, overflow: 'hidden',
      borderColor: isSelected ? 'var(--primary)' : undefined,
      boxShadow: isSelected ? '0 0 0 2px var(--primary)' : undefined,
    }}>
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
        {/* 复选框（仅 candidate 可选） */}
        {selectable && (
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={() => {}}
            onClick={onSelect}
            style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
          />
        )}
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
                onClick={() => onPromote(c)}
              >
                确认入库 →
              </button>
              <div style={{ flex: 1 }} />
              <button
                onClick={handleDelete}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  border: '1px solid var(--line)',
                  borderRadius: 5, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#dc2626';
                  e.currentTarget.style.borderColor = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-3)';
                  e.currentTarget.style.borderColor = 'var(--line)';
                }}
              >
                删除
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-3)', paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              <span>状态：{statusLabel} · 不可编辑</span>
              <div style={{ flex: 1 }} />
              <button
                onClick={handleDelete}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  border: '1px solid var(--line)',
                  borderRadius: 5, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#dc2626';
                  e.currentTarget.style.borderColor = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-3)';
                  e.currentTarget.style.borderColor = 'var(--line)';
                }}
              >
                删除
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
