'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';
import { useAssets } from '@/lib/idb/hooks';

interface AssetItem {
  id: string;
  title: string;
  oneSentenceInsight: string | null;
  evidenceLevel: string;
  priority: string | null;
  tagsJson: string;
  filePath?: string | null;  // intake 来源的卡没 .md
}

export default function AssetsPageClient({ all }: { all: AssetItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; hasFile: boolean } | null>(null);
  const toast = useToast();

  // V1.10: 从 IndexedDB 优先读（demo / Vercel 上 server 没数据时）
  const { data: idbAssets } = useAssets({ type: 'asset' });
  const [list, setList] = useState<AssetItem[]>(all);

  useEffect(() => {
    // V1.11.11: 合并 IDB + server SQLite（去重 by id）
    // 修 Vincent bug：之前 IDB 优先把 server SQLite 老数据清掉，导致"显示 5 张然后没了"
    // 现在：两路数据合并，IDB 更新覆盖 server 副本（IDB 是新数据来源）
    if (idbAssets === null) {
      // 还在加载，不动 list（保留 server 初始值）
      return;
    }
    const mappedIdb: AssetItem[] = idbAssets.map(a => ({
      id: a.id,
      title: a.title,
      oneSentenceInsight: a.oneSentenceInsight ?? null,
      evidenceLevel: a.evidenceLevel,
      priority: a.priority ?? null,
      tagsJson: a.tagsJson,
      filePath: a.filePath,
    }));
    // 合并：IDB 优先（用 IDB 数据填入 server 副本缺失的 title/insight 等）
    const idbIds = new Set(mappedIdb.map(a => a.id));
    const serverOnly = all.filter(a => !idbIds.has(a.id));
    // 去重 + IDB 优先排序
    const merged: AssetItem[] = [
      ...mappedIdb,
      ...serverOnly.map(a => ({
        id: a.id,
        title: a.title,
        oneSentenceInsight: a.oneSentenceInsight ?? null,
        evidenceLevel: a.evidenceLevel,
        priority: a.priority ?? null,
        tagsJson: a.tagsJson,
        filePath: a.filePath,
      })),
    ];
    setList(merged);
  }, [idbAssets, all]);

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
    () => list.filter(a => selected.has(a.id)),
    [list, selected]
  );

  const requestDelete = (id: string, title: string, hasFile: boolean) => {
    setPendingDelete({ id, title, hasFile });
  };

  const cancelDelete = () => setPendingDelete(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id, title, hasFile } = pendingDelete;
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        setList(prev => prev.filter(a => a.id !== id));
        setSelected(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success(`已删除「${title}」`);
      } else {
        toast.error('删除失败: ' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      toast.error('删除失败: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">判断资产</h1>
          <p className="page-subtitle">
            {list.length} 张判断资产 · 来源：OpenClaw 加工 + 本应用整理
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
            联合输出建议 2-5 张（最多 7 张）· 合并建议 2-5 张
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={clearSelection}>清空</button>
          <button
            className="btn btn-sm"
            onClick={() => setShowMergeModal(true)}
            disabled={selected.size < 2}
            style={selected.size < 2 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            合并 →
          </button>
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

      {list.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">📑</div>
          <p>还没有资产</p>
          <Link href="/inbox" className="btn btn-primary" style={{ marginTop: 14 }}>去收集箱</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {list.map(a => {
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

                {/* 删除按钮（左上角） */}
                <button
                  onClick={(e) => { e.stopPropagation(); requestDelete(a.id, a.title, !!a.filePath); }}
                  title="删除此资产"
                  style={{
                    position: 'absolute', top: 14, left: 14,
                    width: 26, height: 26, borderRadius: 4,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-3)',
                    fontSize: 16, lineHeight: 1, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 120ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; }}
                >
                  ✕
                </button>

                {/* 卡片内容（点击进详情） */}
                <Link
                  href={`/assets/${a.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingLeft: 30, paddingRight: 36 }}>
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

      {showMergeModal && (
        <MergeModal
          assets={selectedAssets}
          onClose={() => setShowMergeModal(false)}
          onComplete={async () => {
            setShowMergeModal(false);
            clearSelection();
            // 不 reload：fetch 拉新列表
            try {
              const res = await fetch('/api/assets?all=1');
              const data = await res.json();
              if (data.ok) setList(data.items);
              toast.success('合并成功');
            } catch {
              toast.error('刷新列表失败，请手动刷新');
            }
          }}
        />
      )}

      {/* 删除确认 modal（轻量 inline confirm） */}
      {pendingDelete && (
        <div
          onClick={cancelDelete}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 420, width: '100%', background: 'var(--bg-card)',
              borderRadius: 8, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px', color: 'var(--ink)' }}>
              确认删除资产？
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 8px', lineHeight: 1.6 }}>
              「{pendingDelete.title}」
            </p>
            {pendingDelete.hasFile ? (
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.6 }}>
                关联的 .md 文件也会一并删除（不可恢复）
              </p>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.6 }}>
                这张卡没有 .md 文件（仅删除数据库记录）
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={cancelDelete}>取消</button>
              <button
                className="btn"
                onClick={confirmDelete}
                style={{
                  background: '#dc2626', color: '#fff', borderColor: '#dc2626',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'}
                onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 合并 Modal
 * 选 2-5 张资产 → 填合并后标题/洞察/反常识/tags → 提交
 * 旧资产 archived，新卡入库 in_use
 */
function MergeModal({
  assets,
  onClose,
  onComplete,
}: {
  assets: AssetItem[];
  onClose: () => void;
  onComplete: () => void;
}) {
  // 默认合并内容：从第一张取 title / insight，tags 合并去重
  const initialTags = Array.from(new Set(
    assets.flatMap(a => JSON.parse(a.tagsJson || '[]'))
  ));

  const [title, setTitle] = useState(assets.map(a => a.title).join(' + ').slice(0, 80));
  const [insight, setInsight] = useState(
    assets.map(a => a.oneSentenceInsight).filter(Boolean).join('；').slice(0, 200)
  );
  const [antiCommonSense, setAntiCommonSense] = useState('');
  const [tagsText, setTagsText] = useState(initialTags.join(', '));
  const [evidenceLevel, setEvidenceLevel] = useState('E1');
  const [priority, setPriority] = useState('B');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMerge = async () => {
    if (!title.trim() || !insight.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const tags = tagsText.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/assets/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetIds: assets.map(a => a.id),
          mergedData: {
            title: title.trim(),
            oneSentenceInsight: insight.trim(),
            antiCommonSense: antiCommonSense.trim() || undefined,
            tags,
            evidenceLevel,
            priority,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onComplete();
      } else {
        setError(data.error || '合并失败');
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
        style={{ maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 28px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              合并资产
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
              合并 {assets.length} 张资产 → 1 张入库卡（旧资产自动归档）
            </p>
          </div>
          <button onClick={onClose} className="btn" style={{ padding: '4px 12px' }}>×</button>
        </div>

        {/* 已选预览 */}
        <div style={{ padding: '16px 28px 0' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
            合并来源（{assets.length} 张）
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {assets.map((a, i) => (
              <div key={a.id} style={{
                padding: '6px 10px', background: 'var(--bg-subtle)',
                borderRadius: 5, fontSize: 12, color: 'var(--text)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ color: 'var(--text-3)' }}>{i + 1}.</span>
                <span style={{ flex: 1, color: 'var(--ink)' }}>{a.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 表单 */}
        <div style={{ padding: '0 28px 28px' }}>
          {/* 标题 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              合并后标题 *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="form-input"
              style={{
                width: '100%', padding: '8px 12px',
                background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                borderRadius: 6, fontSize: 13, color: 'var(--ink)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 洞察 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              合并后一句话洞察 *
            </label>
            <textarea
              value={insight}
              onChange={e => setInsight(e.target.value)}
              rows={3}
              style={{
                width: '100%', padding: '8px 12px',
                background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                borderRadius: 6, fontSize: 13, color: 'var(--ink)',
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
          </div>

          {/* 反常识 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              反常识（可选）
            </label>
            <textarea
              value={antiCommonSense}
              onChange={e => setAntiCommonSense(e.target.value)}
              rows={2}
              placeholder="如果新卡有反常识洞察，填这里"
              style={{
                width: '100%', padding: '8px 12px',
                background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                borderRadius: 6, fontSize: 13, color: 'var(--ink)',
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              标签（逗号分隔，已自动合并去重）
            </label>
            <input
              value={tagsText}
              onChange={e => setTagsText(e.target.value)}
              className="form-input"
              style={{
                width: '100%', padding: '8px 12px',
                background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                borderRadius: 6, fontSize: 13, color: 'var(--ink)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Evidence + Priority */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                证据等级
              </label>
              <select
                value={evidenceLevel}
                onChange={e => setEvidenceLevel(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px',
                  background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                  borderRadius: 6, fontSize: 13, color: 'var(--ink)',
                  fontFamily: 'inherit',
                }}
              >
                <option value="E0">E0 · 经验</option>
                <option value="E1">E1 · 案例</option>
                <option value="E2">E2 · 多案例</option>
                <option value="E3">E3 · 研究</option>
                <option value="E4">E4 · 实证</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                优先级
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px',
                  background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                  borderRadius: 6, fontSize: 13, color: 'var(--ink)',
                  fontFamily: 'inherit',
                }}
              >
                <option value="A">A · 高</option>
                <option value="B">B · 中</option>
                <option value="C">C · 低</option>
              </select>
            </div>
          </div>

          {error && <div className="callout callout-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} className="btn">取消</button>
            <button
              onClick={handleMerge}
              disabled={!title.trim() || !insight.trim() || busy}
              className="btn btn-primary"
            >
              {busy ? '合并中…' : `合并 ${assets.length} 张 →`}
            </button>
          </div>
        </div>
      </div>
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
  const [outputType, setOutputType] = useState<string>('article_outline');
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={() => setOutputType('article_full')}
                  className={outputType === 'article_full' ? 'btn btn-primary' : 'btn'}
                  style={{ textAlign: 'left', padding: '10px 14px' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>联合完整文章（3-5 张最合适）</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    1500-2500 字 · Vincent 直接可发 · 公众号长文
                  </div>
                </button>
                <button
                  onClick={() => setOutputType('article_outline')}
                  className={outputType === 'article_outline' ? 'btn btn-primary' : 'btn'}
                  style={{ textAlign: 'left', padding: '10px 14px' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>联合文章大纲（3-5 张最合适）</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    5 段骨架 + 钩子 + 收尾，写作前先看大纲
                  </div>
                </button>
                <button
                  onClick={() => setOutputType('talk_script')}
                  className={outputType === 'talk_script' ? 'btn btn-primary' : 'btn'}
                  style={{ textAlign: 'left', padding: '10px 14px' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>客户沟通话术（2-3 张最合适）</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    500-800 字 · 3-5 分钟 · 客户现场开口用
                  </div>
                </button>
                <button
                  onClick={() => setOutputType('speech')}
                  className={outputType === 'speech' ? 'btn btn-primary' : 'btn'}
                  style={{ textAlign: 'left', padding: '10px 14px' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>演讲稿（3-5 张最合适）🆕</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    3000-5000 字口语化 · 15-25 分钟 · 客户分享会/行业大会
                  </div>
                </button>
                <button
                  onClick={() => setOutputType('book_note')}
                  className={outputType === 'book_note' ? 'btn btn-primary' : 'btn'}
                  style={{ textAlign: 'left', padding: '10px 14px' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>读书笔记（2-3 张最合适）🆕</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    1000-1500 字 · 作者原话 + 你的延展 · 卡片化资产
                  </div>
                </button>
                <button
                  onClick={() => setOutputType('email')}
                  className={outputType === 'email' ? 'btn btn-primary' : 'btn'}
                  style={{ textAlign: 'left', padding: '10px 14px' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>邮件（2-3 张最合适）🆕</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    500-1000 字 · 3 段结构 + 明确 CTA · 客户沟通/项目汇报
                  </div>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.05em' }}>
            主版本
          </div>
          <button
            className="btn btn-sm"
            onClick={() => {
              navigator.clipboard.writeText(data.primary_version);
              // 不阻塞弹 toast
              setTimeout(() => {
                const ev = new CustomEvent('toast-success', { detail: '已复制全文' });
                window.dispatchEvent(ev);
              }, 0);
            }}
            style={{ fontSize: 11, padding: '3px 10px' }}
          >
            复制全文
          </button>
        </div>
        <RenderedContent content={data.primary_version} />
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

/**
 * 轻量 markdown 渲染（不引第三方库）
 * 支持：
 *   - ## 二级标题
 *   - **xxx** 加粗
 *   - > 引用块
 *   - [来源: 卡N] 来源标注（蓝色小标）
 */
function RenderedContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  function renderInline(text: string, key: string): React.ReactNode {
    // 处理加粗 + 来源标注
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let partKey = 0;

    while (remaining.length > 0) {
      // 优先匹配 [来源: ...]
      const sourceMatch = remaining.match(/\[来源:[^\]]+\]/);
      // 然后匹配 **xxx**
      const boldMatch = remaining.match(/\*\*[^*]+\*\*/);

      let firstMatch: { idx: number; len: number; type: 'source' | 'bold'; text: string } | null = null;
      if (sourceMatch && sourceMatch.index !== undefined) {
        firstMatch = { idx: sourceMatch.index, len: sourceMatch[0].length, type: 'source', text: sourceMatch[0] };
      }
      if (boldMatch && boldMatch.index !== undefined) {
        if (!firstMatch || boldMatch.index < firstMatch.idx) {
          firstMatch = { idx: boldMatch.index, len: boldMatch[0].length, type: 'bold', text: boldMatch[0] };
        }
      }

      if (!firstMatch) {
        parts.push(remaining);
        break;
      }

      if (firstMatch.idx > 0) {
        parts.push(remaining.slice(0, firstMatch.idx));
      }

      if (firstMatch.type === 'source') {
        parts.push(
          <span key={`${key}-s${partKey++}`} style={{
            fontSize: 10, color: 'var(--primary)', fontWeight: 600,
            background: 'var(--primary-soft)', padding: '1px 5px',
            borderRadius: 3, marginLeft: 4, verticalAlign: 'middle',
          }}>
            {firstMatch.text}
          </span>
        );
      } else {
        parts.push(<strong key={`${key}-b${partKey++}`}>{firstMatch.text.slice(2, -2)}</strong>);
      }

      remaining = remaining.slice(firstMatch.idx + firstMatch.len);
    }

    return <span key={key}>{parts}</span>;
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={i} style={{
          fontSize: 17, fontWeight: 600, color: 'var(--ink)',
          margin: '20px 0 10px', paddingBottom: 6,
          borderBottom: '1px solid var(--line-soft)',
        }}>
          {renderInline(trimmed.slice(3), `h${i}`)}
        </h3>
      );
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <div key={i} style={{
          padding: '10px 14px', margin: '8px 0',
          background: 'var(--bg-subtle)', borderLeft: '3px solid var(--primary)',
          fontStyle: 'italic', color: 'var(--text)', fontSize: 13, lineHeight: 1.7,
        }}>
          {renderInline(trimmed.slice(2), `q${i}`)}
        </div>
      );
    } else if (trimmed.length === 0) {
      // 空行：跳过（保持自然间距）
    } else {
      elements.push(
        <p key={i} style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--text)', lineHeight: 1.85 }}>
          {renderInline(trimmed, `p${i}`)}
        </p>
      );
    }
    i += 1;
  }

  return (
    <div style={{
      padding: 18, background: 'var(--bg-subtle)',
      borderRadius: 6, border: '1px solid var(--line-soft)',
    }}>
      {elements}
    </div>
  );
}
