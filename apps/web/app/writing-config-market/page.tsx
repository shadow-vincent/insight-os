'use client';

/**
 * Preset 市场（V1.2 D4）
 *
 * 浏览所有 preset · 按标签 / 分类筛选 · 一键 fork
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

interface PresetMeta {
  name: string;
  outputType: string;
  description?: string;
  updatedAt: number;
  isSystem: boolean;
  active: boolean;
  tags?: string[];
  category?: string;
}

export default function WritingConfigMarket() {
  const router = useRouter();
  const toast = useToast();
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [filter, setFilter] = useState<'all' | 'work' | 'personal' | 'client' | 'academic'>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/writing-config');
      const data = await res.json();
      if (data.ok) setPresets(data.presets);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const handleFork = async (srcName: string) => {
    const newName = prompt(`从 ${srcName} fork 新 preset 名（小写字母 + 数字 + 横线）:`, `${srcName}-fork`);
    if (!newName) return;
    if (!/^[a-z0-9-]+$/.test(newName)) {
      toast.error('名字必须是小写字母、数字、横线');
      return;
    }
    try {
      const res = await fetch(`/api/writing-config/${encodeURIComponent(srcName)}/duplicate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newName }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`已 fork 为「${newName}」`);
        loadList();
      } else {
        toast.error(`Fork 失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`请求失败: ${e.message}`);
    }
  };

  const handleActivate = async (name: string) => {
    const res = await fetch('/api/writing-config/active', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(`已激活「${name}」`);
      loadList();
    } else {
      toast.error(`激活失败: ${data.error}`);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;

  // 收集所有标签
  const allTags = Array.from(new Set(presets.flatMap(p => p.tags ?? [])));

  // 筛选
  let filtered = presets;
  if (filter !== 'all') {
    filtered = filtered.filter(p => p.category === filter || p.tags?.includes(filter));
  }
  if (tagFilter) {
    filtered = filtered.filter(p => p.tags?.includes(tagFilter));
  }

  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Preset 市场</h1>
        <p className="page-subtitle">浏览所有写作风格预设 · 按分类 / 标签筛选 · 一键 fork</p>
      </div>

      {/* 分类筛选 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {([
          ['all', `全部 (${presets.length})`],
          ['work', '💼 工作'],
          ['personal', '🏠 个人'],
          ['client', '🤝 客户'],
          ['academic', '🎓 学术'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            className={filter === k ? 'btn btn-primary' : 'btn'}
            onClick={() => setFilter(k as any)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 标签筛选 */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>标签：</span>
          <button
            className={!tagFilter ? 'btn btn-sm btn-primary' : 'btn btn-sm'}
            onClick={() => setTagFilter('')}
          >
            全部
          </button>
          {allTags.map(t => (
            <button
              key={t}
              className={tagFilter === t ? 'btn btn-sm btn-primary' : 'btn btn-sm'}
              onClick={() => setTagFilter(t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* preset 卡片网格 */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
          暂无匹配的 preset · 改筛选 / 到 /settings/writing 创建新 preset
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {filtered.map(p => (
            <div
              key={p.name}
              className="card"
              style={{ padding: 18, cursor: 'pointer' }}
              onClick={() => router.push(`/settings/writing?preset=${encodeURIComponent(p.name)}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 22, marginRight: 8 }}>
                  {p.active ? '⭐' : p.isSystem ? '◆' : '○'}
                </div>
                <strong style={{ fontSize: 14, color: 'var(--ink)', flex: 1 }}>
                  {p.name}
                </strong>
                {p.active && <span className="pill pill-soft">激活</span>}
                {p.isSystem && <span className="pill" style={{ marginLeft: 4 }}>系统</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                {p.description ?? `${p.outputType} · 更新于 ${new Date(p.updatedAt).toLocaleString('zh-CN')}`}
              </div>
              {/* 标签 + 分类 */}
              {(p.tags?.length || p.category) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {p.category && (
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: 'var(--primary-soft)', color: 'var(--primary)',
                    }}>
                      📁 {p.category}
                    </span>
                  )}
                  {p.tags?.map(t => (
                    <span key={t} style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: 'var(--bg-subtle)', color: 'var(--text-3)',
                    }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              {/* 操作 */}
              <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                {!p.active && (
                  <button className="btn btn-sm btn-primary" onClick={() => handleActivate(p.name)}>激活</button>
                )}
                <button className="btn btn-sm" onClick={() => handleFork(p.name)}>⎘ Fork</button>
                <button className="btn btn-sm" onClick={() => router.push(`/settings/writing?preset=${encodeURIComponent(p.name)}`)}>编辑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}