'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

interface Output {
  id: string;
  title: string;
  content: string;
  outputType: 'talk_script' | 'article_outline';
  audience: string | null;
  status: string;
  createdAt: number;
  assetIds: string[];
  assetCount: number;
  primaryAssetTitle: string;
  primaryAssetId: string | null;
  isMulti: boolean;
  rating: number | null;
}

const TYPE_LABEL: Record<string, string> = {
  talk_script: '客户沟通话术',
  article_outline: '文章大纲',
};

export default function OutputsPage() {
  const [list, setList] = useState<Output[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const toast = useToast();

  useEffect(() => {
    fetch('/api/outputs')
      .then(r => r.json())
      .then(data => {
        if (data.ok) setList(data.outputs);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filterType === 'all' ? list : list.filter(o => o.outputType === filterType);
  const types = Array.from(new Set(list.map(o => o.outputType)));

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">输出历史</h1>
          <p className="page-subtitle">
            {list.length} 个生成结果 · 按时间倒序
            {list.filter(o => o.isMulti).length > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--primary)' }}>
                · 联合输出 {list.filter(o => o.isMulti).length} 条
              </span>
            )}
          </p>
        </div>
        <Link href="/assets" className="btn">+ 新建输出</Link>
      </div>

      {list.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">📤</div>
          <p>还没有输出</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>去资产库选一张资产生成话术或大纲</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--line)' }}>
            <button
              onClick={() => setFilterType('all')}
              style={{
                padding: '10px 18px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${filterType === 'all' ? 'var(--primary)' : 'transparent'}`,
                color: filterType === 'all' ? 'var(--primary)' : 'var(--text-2)',
                fontSize: 14, fontWeight: filterType === 'all' ? 600 : 500,
                cursor: 'pointer', marginBottom: -1,
              }}
            >
              全部 <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--text-3)' }}>{list.length}</span>
            </button>
            <button
              onClick={() => setFilterType('multi')}
              style={{
                padding: '10px 18px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${filterType === 'multi' ? 'var(--primary)' : 'transparent'}`,
                color: filterType === 'multi' ? 'var(--primary)' : 'var(--text-2)',
                fontSize: 14, fontWeight: filterType === 'multi' ? 600 : 500,
                cursor: 'pointer', marginBottom: -1,
              }}
            >
              联合 <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--text-3)' }}>{list.filter(o => o.isMulti).length}</span>
            </button>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                style={{
                  padding: '10px 18px', background: 'transparent', border: 'none',
                  borderBottom: `2px solid ${filterType === t ? 'var(--primary)' : 'transparent'}`,
                  color: filterType === t ? 'var(--primary)' : 'var(--text-2)',
                  fontSize: 14, fontWeight: filterType === t ? 600 : 500,
                  cursor: 'pointer', marginBottom: -1,
                }}
              >
                {TYPE_LABEL[t] || t}
                <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--text-3)' }}>{list.filter(o => o.outputType === t).length}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filterType === 'multi'
              ? filtered.map(o => <MultiOutputRow key={o.id} o={o} expanded={expandedId === o.id} onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)} toast={toast} />)
              : filtered.map(o => <OutputRow key={o.id} o={o} expanded={expandedId === o.id} onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)} toast={toast} />)
            }
          </div>
        </>
      )}
    </div>
  );
}

function OutputRow({ o, expanded, onToggle, toast }: {
  o: Output; expanded: boolean; onToggle: () => void;
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
}) {
  const date = new Date(o.createdAt * 1000).toLocaleString('zh-CN');
  let parsed: any = {};
  try { parsed = JSON.parse(o.content || '{}'); } catch { /* */ }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="pill" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 600 }}>
          {TYPE_LABEL[o.outputType] || o.outputType}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{o.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            来自「{o.primaryAssetTitle}」 · {date}
          </div>
        </div>
        <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--line-soft)' }}>
          <div style={{ padding: '18px 0' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 12, letterSpacing: '0.05em' }}>输出内容</div>
            <pre style={{
              margin: 0, padding: 18, background: 'var(--bg-subtle)', borderRadius: 6,
              fontSize: 14, lineHeight: 1.8, color: 'var(--text)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
            }}>
              {parsed.primary_version || o.content}
            </pre>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--line-soft)' }}>
            {o.primaryAssetId ? (
              <Link href={`/assets/${o.primaryAssetId}`} className="btn" style={{ fontSize: 13 }}>查看源资产 →</Link>
            ) : <span />}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await navigator.clipboard.writeText(parsed.primary_version || o.content);
                toast.success('已复制到剪贴板');
              }}
              className="btn"
              style={{ fontSize: 13 }}
            >📋 复制</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MultiOutputRow({ o, expanded, onToggle, toast }: {
  o: Output; expanded: boolean; onToggle: () => void;
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
}) {
  const date = new Date(o.createdAt * 1000).toLocaleString('zh-CN');
  let parsed: any = {};
  try { parsed = JSON.parse(o.content || '{}'); } catch { /* */ }
  const refs: any[] = parsed.assetReferences || [];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="pill" style={{ background: 'var(--primary)', color: 'white', fontWeight: 600 }}>
          联合 ×{o.assetCount}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{o.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            来自 {o.assetCount} 张资产 · {date}
          </div>
        </div>
        <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--line-soft)' }}>
          {/* 组织逻辑 */}
          {parsed.structure_rationale && (
            <div className="callout callout-accent" style={{ margin: '18px 0 16px' }}>
              <strong style={{ color: 'var(--accent)', fontSize: 13 }}>组织逻辑：</strong>
              <span style={{ fontSize: 14 }}> {parsed.structure_rationale}</span>
            </div>
          )}

          {/* 引用分布 */}
          {refs.length > 0 && (
            <div style={{ marginBottom: 18, padding: '14px 16px', background: 'var(--bg-subtle)', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, letterSpacing: '0.05em' }}>
                引用分布
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {refs.map((ref, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 700, minWidth: 30, fontSize: 12 }}>卡 {i + 1}</span>
                    <span style={{ flex: 1, color: 'var(--ink)' }}>{ref.assetTitle}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 12 }}>引用 {ref.referencedIn.length} 处</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 主版本 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, letterSpacing: '0.05em' }}>主版本</div>
            <pre style={{
              margin: 0, padding: 18, background: 'var(--bg-subtle)', borderRadius: 6,
              fontSize: 14, lineHeight: 1.8, color: 'var(--text)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
            }}>
              {parsed.primary_version || ''}
            </pre>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--line-soft)' }}>
            <Link href="/assets" className="btn" style={{ fontSize: 13 }}>查看源资产 →</Link>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await navigator.clipboard.writeText(parsed.primary_version || o.content);
                toast.success('已复制到剪贴板');
              }}
              className="btn"
              style={{ fontSize: 13 }}
            >📋 复制主版本</button>
          </div>
        </div>
      )}
    </div>
  );
}
