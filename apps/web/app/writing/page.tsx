'use client';

/**
 * /writing 写作仪表盘
 * 列出所有写作状态的文章（scaffold / draft / published）
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface WritingRow {
  id: string;
  title: string;
  writingStatus: 'scaffold' | 'draft' | 'published' | null;
  templateType: string | null;
  createdAt: number;
  updatedAt: number;
  assetIdsJson: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  scaffold: { label: '骨架', color: 'var(--warning)', emoji: '🏗️' },
  draft: { label: '草稿', color: 'var(--info)', emoji: '📝' },
  published: { label: '已发布', color: 'var(--success)', emoji: '✅' },
};

const TEMPLATE_LABELS: Record<string, string> = {
  wechat_article: '公众号长文',
  speech: '演讲稿',
  book_note: '读书笔记',
};

export default function WritingDashboard() {
  const router = useRouter();
  const [writings, setWritings] = useState<WritingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'scaffold' | 'draft' | 'published'>('all');

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/writing');
      const data = await res.json();
      if (data.ok) {
        // 兼容 Vercel fallback（line 18 NO_SQLITE 时返 {data, count, ...} 不含 writings）
        // 和 SQLite 真实数据 {writings: rows}
        const list = data.writings ?? data.data ?? [];
        setWritings(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const filtered = filter === 'all' ? writings : writings.filter(w => w.writingStatus === filter);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">写作</h1>
        <p className="page-subtitle">scaffold（骨架） → draft（草稿） → published（已发布）· 全流程管理</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'scaffold', 'draft', 'published'] as const).map(s => (
          <button
            key={s}
            className={filter === s ? 'btn btn-primary' : 'btn'}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? `全部 (${writings.length})` :
             `${STATUS_LABELS[s].emoji} ${STATUS_LABELS[s].label} (${writings.filter(w => w.writingStatus === s).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
          {filter === 'all'
            ? '暂无写作任务 · 到 /assets 选 3-5 张资产卡 → "生成骨架" 开始'
            : `暂无 ${STATUS_LABELS[filter]?.label} 任务`}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {filtered.map((w, i) => {
            const status = STATUS_LABELS[w.writingStatus ?? 'draft'];
            const assetCount = (JSON.parse(w.assetIdsJson) as string[]).length;
            return (
              <div
                key={w.id}
                onClick={() => router.push(`/writing/${w.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--line-soft)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 24 }}>{status.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                    {w.title || '（无标题）'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {TEMPLATE_LABELS[w.templateType ?? ''] ?? w.templateType ?? '通用'} ·{' '}
                    {assetCount} 张资产 · 更新于 {new Date(w.updatedAt * 1000).toLocaleString('zh-CN')}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 10,
                  background: status.color, color: '#fff', fontWeight: 500,
                }}>
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}