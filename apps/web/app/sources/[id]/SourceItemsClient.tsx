/**
 * SourceItemsClient · 信息源详情页（看抓到的内容）
 *
 * v1.9.0 只展示 + 过滤 + 跳过（不调 intake）
 * v1.9.1+ 会加"导入为候选"按钮（调 intake API 转成 assets）
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SourceRow {
  id: string;
  type: string;
  url: string;
  title: string;
  enabled: number;
  lastFetchedAt: number | null;
  lastError: string | null;
  fetchIntervalMin: number;
  newItemsCount: number;
  totalItemsCount: number;
}

interface SourceItemRow {
  id: string;
  guid: string;
  title: string;
  url: string | null;
  excerpt: string | null;
  publishedAt: number | null;
  fetchedAt: number;
  status: string;
  assetId: string | null;
}

interface Props {
  source: SourceRow;
  items: SourceItemRow[];
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new: { label: '新', color: '#dc2626' },
  imported: { label: '已加工', color: '#16a34a' },
  skipped: { label: '已跳过', color: 'var(--text-3)' },
};

export function SourceItemsClient({ source, items }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'new' | 'imported' | 'skipped'>('all');
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState<string | null>(null); // 正在加工的 item id

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
  const newCount = items.filter(i => i.status === 'new').length;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/sources/${source.id}/sync`, { method: 'POST' });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async (itemId: string) => {
    if (!confirm('加工后该条目会进候选判断池（调 LLM 提炼）。确认？')) return;
    setImporting(itemId);
    try {
      const res = await fetch(`/api/sources/${source.id}/items/${itemId}/import`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(`加工失败: ${data.error}`);
        return;
      }
      router.refresh();
    } catch (e: any) {
      alert(`加工失败: ${e.message}`);
    } finally {
      setImporting(null);
    }
  };

  const handleSkip = async (itemId: string) => {
    // V1.9.1 PATCH 端点暂未加，先用 confirm 提示
    if (!confirm('标记为已跳过？')) return;
    // 简化：用 PATCH source item 状态（待加端点）
    alert('跳过功能 V1.9.1 暂未实现（V1.9.2 加 PATCH 端点）');
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 8 }}>
        <Link href="/sources" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>
          ← 返回信息源列表
        </Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>📰 {source.title}</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn btn-sm"
          style={{
            background: 'var(--primary)', color: 'white', borderColor: 'transparent',
            fontSize: 12, padding: '6px 14px',
          }}
        >
          {syncing ? '同步中...' : '🔄 立即同步'}
        </button>
      </div>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        {source.url}<br/>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {source.lastFetchedAt ? `上次同步：${formatTime(source.lastFetchedAt)}` : '尚未同步'}
          <span style={{ marginLeft: 12 }}>共 {items.length} 条</span>
          {newCount > 0 && <span style={{ marginLeft: 12 }}>· {newCount} 条新</span>}
        </span>
      </p>

      {/* 状态过滤 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>过滤：</span>
        {(['all', 'new', 'imported', 'skipped'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 12,
              background: filter === f ? 'var(--primary)' : 'white',
              color: filter === f ? 'white' : 'var(--text-2)',
              border: '1px solid ' + (filter === f ? 'var(--primary)' : 'var(--line)'),
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? `全部 (${items.length})` :
             f === 'new' ? `新 (${items.filter(i => i.status === 'new').length})` :
             f === 'imported' ? `已加工 (${items.filter(i => i.status === 'imported').length})` :
             `已跳过 (${items.filter(i => i.status === 'skipped').length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
          没有符合条件的内容
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => {
            const status = STATUS_LABEL[item.status] || STATUS_LABEL.new;
            return (
              <div key={item.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <a
                        href={item.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 13, fontWeight: 500, color: 'var(--ink)',
                          textDecoration: 'none', overflow: 'hidden',
                          textOverflow: 'ellipsis', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {item.title}
                      </a>
                      <span style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 2,
                        background: 'transparent', color: status.color,
                        border: `1px solid ${status.color}`, fontWeight: 500, flexShrink: 0,
                      }}>
                        {status.label}
                      </span>
                    </div>
                    {item.excerpt && (
                      <p style={{
                        fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5,
                        margin: '0 0 6px 0', overflow: 'hidden',
                        textOverflow: 'ellipsis', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {item.excerpt}
                      </p>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleString('zh-CN')
                        : `抓取于 ${formatTime(item.fetchedAt)}`}
                    </div>
                  </div>
                  {item.status === 'new' && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => handleImport(item.id)}
                        disabled={importing === item.id}
                        className="btn btn-sm"
                        style={{
                          background: 'var(--primary)', color: 'white',
                          borderColor: 'transparent',
                          fontSize: 10, padding: '4px 10px',
                        }}
                      >
                        {importing === item.id ? '加工中...' : '✨ 加工为候选'}
                      </button>
                      <button
                        onClick={() => handleSkip(item.id)}
                        className="btn btn-sm"
                        style={{
                          background: 'transparent', color: 'var(--text-3)',
                          border: '1px solid var(--line)', fontSize: 10, padding: '4px 8px',
                        }}
                      >
                        跳过
                      </button>
                    </div>
                  )}
                  {item.status === 'imported' && item.assetId && (
                    <Link
                      href={`/assets/${item.assetId}`}
                      style={{
                        fontSize: 10, color: 'var(--primary)', textDecoration: 'none', flexShrink: 0,
                      }}
                    >
                      查看资产 →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 12, color: 'var(--text-3)' }}>
        💡 点「✨ 加工为候选」调 intake（自动 LLM 提炼），生成的新资产会出现在 <Link href="/candidates" style={{ color: 'var(--primary)' }}>候选判断</Link> 池。
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = Math.floor((now - ts) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return d.toLocaleDateString('zh-CN');
}