'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface AssetItem {
  id: string;
  title: string;
  oneSentenceInsight: string | null;
  evidenceLevel: string;
  priority: string | null;
  tagsJson: string;
}

export default function AssetsPageClient({ all }: { all: AssetItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMultiModal, setShowMultiModal] = useState(false);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 7) next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const selectedAssets = useMemo(
    () => all.filter(a => selected.has(a.id)),
    [all, selected]
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">资产库</h1>
          <p className="page-subtitle">
            {all.length} 张资产 · 来源：OpenClaw 加工 + 本应用整理
            {selected.size > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--primary)', fontWeight: 600 }}>
                · 已选 {selected.size} 张
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn">筛选</button>
          <button className="btn">排序</button>
          <Link href="/inbox" className="btn btn-primary">+ 新建</Link>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card" style={{
          marginBottom: 18, padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--primary-soft)', borderColor: 'var(--primary-line)',
        }}>
          <span style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>
            已选 {selected.size} 张资产
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            联合输出建议 2-5 张（最多 7 张）
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={clearSelection}>清空</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowMultiModal(true)}
            disabled={selected.size < 2}
            style={selected.size < 2 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            联合输出 →
          </button>
        </div>
      )}

      {all.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">📑</div>
          <p>还没有资产</p>
          <Link href="/inbox" className="btn btn-primary" style={{ marginTop: 14 }}>去收集箱</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {all.map(a => {
            const tags: string[] = JSON.parse(a.tagsJson || '[]');
            const isSelected = selected.has(a.id);
            return (
              <div
                key={a.id}
                className="card card-hover"
                style={{
                  position: 'relative',
                  padding: 20,
                  borderColor: isSelected ? 'var(--primary)' : undefined,
                  boxShadow: isSelected ? '0 0 0 2px var(--primary)' : undefined,
                  cursor: 'pointer',
                  transition: 'all 120ms',
                }}
                onClick={() => {/* 让 checkbox 控制，不跳转 */}}
              >
                {/* 复选框 */}
                <div
                  onClick={(e) => toggleSelect(a.id, e)}
                  style={{
                    position: 'absolute', top: 14, right: 14,
                    width: 22, height: 22, borderRadius: 4,
                    border: isSelected ? 'none' : '2px solid var(--line-strong)',
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', transition: 'all 120ms',
                  }}
                >
                  {isSelected && '✓'}
                </div>

                {/* 卡片内容（点击进详情） */}
                <Link
                  href={`/assets/${a.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingRight: 36 }}>
                    <span className={`pill pill-${a.evidenceLevel.toLowerCase()}`}>{a.evidenceLevel}</span>
                    {a.priority && <span className={`pill pill-priority-${a.priority.toLowerCase()}`}>{a.priority}</span>}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.4 }}>
                    {a.title}
                  </h3>
                  {a.oneSentenceInsight && (
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, margin: '0 0 14px' }}>
                      {a.oneSentenceInsight.length > 80 ? a.oneSentenceInsight.slice(0, 80) + '…' : a.oneSentenceInsight}
                    </p>
                  )}
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
                      {tags.slice(0, 4).map((t, i) => (
                        <span key={i} className="pill" style={{ background: 'var(--bg-subtle)', color: 'var(--text-2)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {showMultiModal && (
        <MultiOutputModal
          assets={selectedAssets}
          onClose={() => setShowMultiModal(false)}
          onComplete={() => {
            setShowMultiModal(false);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}

function MultiOutputModal({
  assets,
  onClose,
  onComplete,
}: {
  assets: AssetItem[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const [outputType, setOutputType] = useState<'talk_script' | 'article_outline'>('article_outline');
  const [audience, setAudience] = useState('');
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!audience.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/output/multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetIds: assets.map(a => a.id),
          outputType,
          audience,
          context: context.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data);
      } else {
        setError(data.error || '生成失败');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }} onClick={onClose}>
      <div
        className="card"
        style={{
          maxWidth: 880, width: '100%', maxHeight: '90vh',
          overflow: 'auto', padding: 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div style={{
          padding: '20px 28px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              联合输出
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
              基于 {assets.length} 张资产卡组织一份结构化输出
            </p>
          </div>
          <button onClick={onClose} className="btn" style={{ padding: '4px 12px' }}>×</button>
        </div>

        {!result ? (
          <div style={{ padding: 28 }}>
            {/* 已选资产预览 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                已选 {assets.length} 张资产（按顺序）
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {assets.map((a, i) => (
                  <div key={a.id} style={{
                    padding: '8px 12px', background: 'var(--bg-subtle)',
                    borderRadius: 5, fontSize: 12, color: 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 11 }}>卡 {i + 1}</span>
                    <span className={`pill pill-${a.evidenceLevel.toLowerCase()}`}>{a.evidenceLevel}</span>
                    <span style={{ flex: 1, color: 'var(--ink)' }}>{a.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 输出类型 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                输出类型
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setOutputType('article_outline')}
                  className={outputType === 'article_outline' ? 'btn btn-primary' : 'btn'}
                >
                  联合文章大纲（3-5 张最合适）
                </button>
                <button
                  onClick={() => setOutputType('talk_script')}
                  className={outputType === 'talk_script' ? 'btn btn-primary' : 'btn'}
                >
                  客户沟通话术（2-3 张最合适）
                </button>
              </div>
            </div>

            {/* Audience */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                使用对象 *
              </label>
              <input
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="例：制造业 CFO、HR 负责人、刚晋升的中层"
                className="form-input"
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                  borderRadius: 6, fontSize: 13, color: 'var(--ink)',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Context（可选） */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                背景（可选）
              </label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="例：客户刚完成 ERP 选型，下周要给他们做 30 分钟分享"
                rows={2}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                  borderRadius: 6, fontSize: 13, color: 'var(--ink)',
                  fontFamily: 'inherit', resize: 'vertical',
                }}
              />
            </div>

            {error && <div className="callout callout-error" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose} className="btn">取消</button>
              <button
                onClick={handleGenerate}
                disabled={!audience.trim() || busy}
                className="btn btn-primary"
              >
                {busy ? '生成中…' : 'AI 联合输出 →'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 28 }}>
            <ResultView result={result} assets={assets} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--line-soft)' }}>
              <Link href="/output" className="btn" onClick={onComplete}>
                查看输出历史 →
              </Link>
              <button onClick={onComplete} className="btn btn-primary">完成</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultView({ result, assets }: { result: any; assets: AssetItem[] }) {
  const data = result.data;
  const refs: any[] = data.assetReferences || [];

  return (
    <div>
      {/* 标题 */}
      <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.4 }}>
        {data.title}
      </h2>

      {/* 组织逻辑 */}
      {data.structure_rationale && (
        <div className="callout callout-accent" style={{ marginBottom: 18 }}>
          <strong style={{ color: 'var(--accent)', fontSize: 12 }}>组织逻辑：</strong>
          <span style={{ fontSize: 13 }}> {data.structure_rationale}</span>
        </div>
      )}

      {/* 来源卡片分布 */}
      <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg-subtle)', borderRadius: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, letterSpacing: '0.05em' }}>
          引用分布
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {refs.map((ref, i) => {
            const asset = assets[i];
            if (!asset) return null;
            return (
              <div key={ref.assetId} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ color: 'var(--primary)', fontWeight: 700, minWidth: 32 }}>卡 {i + 1}</span>
                <span className={`pill pill-${asset.evidenceLevel.toLowerCase()}`}>{asset.evidenceLevel}</span>
                <span style={{ flex: 1, color: 'var(--ink)' }}>{asset.title}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                  引用 {ref.referencedIn.length} 处
                  {ref.coreInsightUsed && ' · 核心洞察已用'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 主版本 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>
          主版本
        </div>
        <pre style={{
          margin: 0, padding: 16, background: 'var(--bg-subtle)',
          borderRadius: 6, fontSize: 13, lineHeight: 1.7, color: 'var(--text)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
        }}>
          {data.primary_version}
        </pre>
      </div>

      {/* 变体 */}
      {data.variants && data.variants.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>
            开场变体（3 个）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.variants.map((v: any, i: number) => (
              <div key={i} className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>
                  {v.label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{v.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 金句 */}
      {data.key_quotes && data.key_quotes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>
            关键金句
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: 'var(--text)' }}>
            {data.key_quotes.map((q: string, i: number) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 使用建议 */}
      {data.usage_suggestion && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <strong style={{ color: 'var(--primary)' }}>使用建议：</strong> {data.usage_suggestion}
        </div>
      )}
    </div>
  );
}
