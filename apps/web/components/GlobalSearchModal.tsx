'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  title: string;
  titleHighlight: string;
  insightSnippet: string | null;
  oneSentenceInsight: string | null;
  evidenceLevel: string;
  priority: string | null;
  type: string;
  score: number;
}

const EVIDENCE_FILTERS = [
  { id: '', label: '全部' },
  { id: 'E0', label: 'E0' },
  { id: 'E1', label: 'E1' },
  { id: 'E2', label: 'E2+' },
  { id: 'E3', label: 'E3+' },
];

export function GlobalSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [evidence, setEvidence] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(0);

  // 打开时聚焦
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setSelected(0);
    } else {
      setQ('');
      setResults([]);
      setTotal(0);
    }
  }, [open]);

  // 搜索
  useEffect(() => {
    if (!q || q.length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (evidence) params.set('evidence', evidence);
      fetch(`/api/search?${params.toString()}`)
        .then(r => r.json())
        .then(d => {
          if (d.ok) {
            setResults(d.results);
            setTotal(d.total);
            setSelected(0);
          }
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(t);
  }, [q, evidence]);

  // 键盘导航
  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selected]) {
        router.push(`/assets/${results[selected].id}`);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [results, selected, router, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(2px)',
        zIndex: 200,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '12vh 20px 20px',
      }}
      onClick={onClose}
      onKeyDown={handleKey}
    >
      <div
        className="card"
        style={{
          maxWidth: 720, width: '100%', padding: 0,
          maxHeight: '70vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 搜索框 */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 18, color: 'var(--text-3)' }}>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="搜索资产卡 · 标题 / 一句话洞察 / 反常识 / 标签"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 15, color: 'var(--ink)', fontFamily: 'inherit',
            }}
          />
          <kbd style={{
            fontSize: 10, color: 'var(--text-3)',
            background: 'var(--bg-subtle)', padding: '2px 6px',
            borderRadius: 3, border: '1px solid var(--line)',
          }}>ESC</kbd>
        </div>

        {/* 过滤 chip */}
        <div style={{
          padding: '10px 18px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginRight: 4 }}>证据等级</span>
          {EVIDENCE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setEvidence(f.id)}
              style={{
                padding: '3px 10px',
                background: evidence === f.id ? 'var(--primary)' : 'var(--bg-subtle)',
                color: evidence === f.id ? 'white' : 'var(--text-2)',
                border: '1px solid ' + (evidence === f.id ? 'var(--primary)' : 'var(--line)'),
                borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
          {total > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>
              {total} 个结果
            </span>
          )}
        </div>

        {/* 结果列表 */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {q.length < 2 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              输入关键词开始搜索
            </div>
          ) : loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              搜索中…
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              没有匹配的资产
            </div>
          ) : (
            <div>
              {results.map((r, i) => (
                <div
                  key={r.id}
                  onClick={() => { router.push(`/assets/${r.id}`); onClose(); }}
                  onMouseEnter={() => setSelected(i)}
                  style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid var(--line-soft)',
                    cursor: 'pointer',
                    background: selected === i ? 'var(--primary-soft)' : 'transparent',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span className={`pill pill-${r.evidenceLevel.toLowerCase()}`}>{r.evidenceLevel}</span>
                      {r.priority && (
                        <span className={`pill pill-priority-${r.priority.toLowerCase()}`}>{r.priority}</span>
                      )}
                      {r.type !== 'asset' && (
                        <span className="pill" style={{ background: 'var(--bg-subtle)', color: 'var(--text-2)', fontSize: 10 }}>
                          {r.type}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                        lineHeight: 1.4, marginBottom: 3,
                      }}
                      dangerouslySetInnerHTML={{ __html: r.titleHighlight || r.title }}
                    />
                    {r.insightSnippet && (
                      <div
                        style={{
                          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
                        }}
                        dangerouslySetInnerHTML={{ __html: r.insightSnippet }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div style={{
          padding: '8px 18px',
          borderTop: '1px solid var(--line-soft)',
          display: 'flex', alignItems: 'center', gap: 16,
          fontSize: 10, color: 'var(--text-3)',
          background: 'var(--bg-subtle)',
        }}>
          <span><kbd style={kbdStyle}>↑↓</kbd> 导航</span>
          <span><kbd style={kbdStyle}>↵</kbd> 打开</span>
          <span><kbd style={kbdStyle}>ESC</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontSize: 10,
  background: 'white',
  padding: '1px 5px',
  borderRadius: 2,
  border: '1px solid var(--line)',
  fontFamily: 'JetBrains Mono, monospace',
};
