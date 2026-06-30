/**
 * SourcesClient · 信息源管理客户端
 *
 * 功能：
 * - 添加 RSS 源（输入 URL + 可选 title）
 * - 列表（启停 / 删除 / 立即同步 / 看新内容）
 * - 空状态引导
 *
 * 错误处理：
 * - URL 重复 → 提示
 * - 抓取失败（feed 不可达 / XML 错）→ 显示后端 error
 */

'use client';

import { useState, useEffect } from 'react';
import { syncSource } from '@/lib/idb/client-rss';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSources } from '@/lib/idb/hooks';
import { useToast } from '@/components/ToastProvider';
import { addSource, updateSource, deleteSource } from '@/lib/idb/operations';

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
  createdAt: number;
  updatedAt: number;
}

interface Props {
  initialSources: SourceRow[];
}

const FEED_PRESETS = [
  { name: 'Hacker News (Newest)', url: 'https://hnrss.org/newest' },
  { name: '36 氪', url: 'https://36kr.com/feed' },
  { name: '虎嗅', url: 'https://www.huxiu.com/rss/0.xml' },
  { name: '少数派', url: 'https://sspai.com/feed' },
];

const REDDIT_PRESETS = [
  { name: 'r/LocalLLaMA', handle: 'LocalLLaMA' },
  { name: 'r/MachineLearning', handle: 'MachineLearning' },
  { name: 'r/programming', handle: 'programming' },
  { name: 'u/spez', handle: 'spez' },
];

export function SourcesClient({ initialSources }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [sources, setSources] = useState<SourceRow[]>(initialSources);
  const [addType, setAddType] = useState<'rss' | 'twitter' | 'reddit'>('rss');
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  // V1.10: 从 IndexedDB 读 sources（demo / Vercel 上 server 没数据时）
  const { data: idbSources } = useSources();

  useEffect(() => {
    if (idbSources && idbSources.length > 0) {
      setSources(idbSources as any);
    } else if (idbSources) {
      setSources([]);
    }
  }, [idbSources]);

  const handleAdd = async () => {
    if (addType === 'rss' && !newUrl.trim()) {
      setError('RSS URL 不能为空');
      return;
    }
    if ((addType === 'twitter' || addType === 'reddit') && !newHandle.trim()) {
      setError(`${addType === 'twitter' ? 'Twitter handle' : 'subreddit/user 名'} 不能为空`);
      return;
    }
setError(null);
    setAdding(true);
    try {
      // V1.10: 直接写 IndexedDB（同时尝试调 server route 抓 RSS 内容）
      const id = `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const sourceData: any = {
        id,
        type: addType,
        url: addType === 'rss' ? newUrl.trim() : '',
        title: newTitle.trim() || newUrl.trim() || newHandle.trim() || 'Untitled',
        enabled: 1,
        lastFetchedAt: null,
        lastError: null,
        fetchIntervalMin: 60,
        newItemsCount: 0,
        totalItemsCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      // 尝试调 server route 抓 RSS
      try {
        const res = await fetch('/api/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: addType,
            url: addType === 'rss' ? newUrl.trim() : undefined,
            title: sourceData.title,
            handle: addType !== 'rss' ? newHandle.trim() : undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.source) {
            await addSource({ ...sourceData, id: data.source.id, ...data.source });
          } else {
            await addSource(sourceData);
          }
        } else {
          await addSource(sourceData);
        }
      } catch {
        // server 不可用 → 直接写 IDB
        await addSource(sourceData);
      }
      setNewUrl('');
      setNewTitle('');
      setNewHandle('');
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      // V1.10: 直接更新 IDB
      await updateSource(id, { enabled: enabled ? 1 : 0 });
      // 同步到 server（可选，server 不可用时静默失败）
      fetch(`/api/sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      }).catch(() => {});
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该信息源及其所有已抓内容？')) return;
    try {
      // V1.10: 直接删 IDB
      await deleteSource(id);
      fetch(`/api/sources/${id}`, { method: 'DELETE' }).catch(() => {});
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      // V1.11: client 端直接 fetch RSS + 写 IDB
      const src = sources.find(s => s.id === id);
      if (!src) return;
      const result = await syncSource(src as any);
      if (result.error) {
        toast.error(`同步失败: ${result.error}`);
      } else {
        toast.success(`✓ 同步完成 · 新增 ${result.newCount} 条 / 共 ${result.totalCount} 条`);
        load();
      }
    } catch (e: any) {
      // 回退 server API
      try {
        await fetch(`/api/sources/${id}/sync`, { method: 'POST' });
        window.location.reload();
      } catch (e2: any) {
        toast.error(e.message || e2.message);
      }
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncing('__all__');
    try {
      let totalNew = 0;
      let totalAll = 0;
      for (const src of sources) {
        const result = await syncSource(src as any);
        totalNew += result.newCount;
        totalAll += result.totalCount;
        if (result.error) console.warn(`[sync] ${src.title} failed:`, result.error);
      }
      toast.success(`✓ 全部同步完成 · 新增 ${totalNew} 条 / 共 ${totalAll} 条`);
      load();
    } catch (e: any) {
      try {
        await fetch('/api/sources/sync-all', { method: 'POST' });
        window.location.reload();
      } catch (e2: any) {
        toast.error(e.message || e2.message);
      }
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title">📡 信息源订阅</h1>
        {sources.length > 0 && (
          <button
            onClick={handleSyncAll}
            disabled={syncing === '__all__'}
            className="btn btn-sm"
            style={{
              background: 'var(--primary)', color: 'white', borderColor: 'transparent',
              fontSize: 12, padding: '6px 14px',
            }}
          >
            {syncing === '__all__' ? '同步中...' : '🔄 全部同步'}
          </button>
        )}
      </div>
      <p className="page-subtitle" style={{ marginBottom: 24 }}>
        订阅 RSS / Reddit 源。开 insight-os 自动拉新。
      </p>

      {/* 添加源 */}
      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
            + 添加信息源
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['rss', 'reddit'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setAddType(t); setError(null); }}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 12,
                  background: addType === t ? 'var(--primary)' : 'white',
                  color: addType === t ? 'white' : 'var(--text-2)',
                  border: '1px solid ' + (addType === t ? 'var(--primary)' : 'var(--line)'),
                  cursor: 'pointer',
                }}
              >
                {t === 'rss' ? '📰 RSS' : '🟠 Reddit'}
              </button>
            ))}
          </div>
        </div>

        {addType === 'rss' ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => { setNewUrl(e.target.value); setError(null); }}
                placeholder="https://example.com/feed.xml"
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 13,
                  border: '1px solid var(--line)', borderRadius: 6,
                  background: 'white', color: 'var(--ink)',
                }}
              />
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="名称（可选，自动从 feed 抓）"
                style={{
                  width: 200, padding: '8px 12px', fontSize: 13,
                  border: '1px solid var(--line)', borderRadius: 6,
                  background: 'white', color: 'var(--ink)',
                }}
              />
              <button
                onClick={handleAdd}
                disabled={adding}
                className="btn btn-sm"
                style={{
                  background: 'var(--accent)', color: 'white', borderColor: 'transparent',
                  fontSize: 13, padding: '8px 18px', fontWeight: 500,
                }}
              >
                {adding ? '添加中...' : '添加'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>试试：</span>
              {FEED_PRESETS.map(p => (
                <button
                  key={p.url}
                  onClick={() => setNewUrl(p.url)}
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 3,
                    background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                    color: 'var(--text-2)', cursor: 'pointer',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={newHandle}
                onChange={(e) => { setNewHandle(e.target.value); setError(null); }}
                placeholder="subreddit 名（如 LocalLLaMA）或 user 名（如 spez）"
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 13,
                  border: '1px solid var(--line)', borderRadius: 6,
                  background: 'white', color: 'var(--ink)',
                }}
              />
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="显示名（可选）"
                style={{
                  width: 180, padding: '8px 12px', fontSize: 13,
                  border: '1px solid var(--line)', borderRadius: 6,
                  background: 'white', color: 'var(--ink)',
                }}
              />
              <button
                onClick={handleAdd}
                disabled={adding}
                className="btn btn-sm"
                style={{
                  background: 'var(--accent)', color: 'white', borderColor: 'transparent',
                  fontSize: 13, padding: '8px 18px', fontWeight: 500,
                }}
              >
                {adding ? '添加中...' : '添加'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>试试：</span>
              {REDDIT_PRESETS.map(p => (
                <button
                  key={p.handle}
                  onClick={() => setNewHandle(p.handle)}
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 3,
                    background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                    color: 'var(--text-2)', cursor: 'pointer',
                  }}
                >
                  {p.name}
                </button>
              ))}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                · 走 Reddit 官方 RSS（零配置）
              </span>
            </div>
          </>
        )}
        {error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>⚠ {error}</div>}
      </div>

      {/* 列表 */}
      {sources.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>还没有订阅任何信息源</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            粘贴 RSS 源 URL 即可。Hacker News / 36 氪 / 虎嗅 都支持。
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sources.map(s => (
            <div key={s.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 6, flexShrink: 0,
                  background: s.enabled
                    ? (s.type === 'reddit' ? 'rgba(255, 88, 0, 0.10)' : 'rgba(234, 88, 12, 0.10)')
                    : 'var(--bg-subtle)',
                  color: s.enabled
                    ? (s.type === 'reddit' ? '#ff5800' : '#ea580c')
                    : 'var(--text-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>{s.type === 'reddit' ? '🟠' : '📰'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{s.title}</span>
                    {s.newItemsCount > 0 && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 3,
                        background: '#fef2f2', color: '#dc2626', fontWeight: 500,
                      }}>{s.newItemsCount} 条新</span>
                    )}
                    {!s.enabled && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 3,
                        background: 'var(--bg-subtle)', color: 'var(--text-3)',
                      }}>已停用</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4, wordBreak: 'break-all' }}>
                    {s.url}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {s.lastFetchedAt
                      ? `上次同步：${formatTime(s.lastFetchedAt)}`
                      : '尚未同步'}
                    <span style={{ marginLeft: 12 }}>共 {s.totalItemsCount} 条内容</span>
                    {s.lastError && (
                      <span style={{ color: '#dc2626', marginLeft: 12 }}>⚠ {s.lastError}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Link
                    href={`/sources/${s.id}`}
                    className="btn btn-sm"
                    style={{
                      background: 'white', color: 'var(--text-2)', border: '1px solid var(--line)',
                      fontSize: 11, padding: '4px 10px', textDecoration: 'none',
                    }}
                  >
                    看内容
                  </Link>
                  <button
                    onClick={() => handleSync(s.id)}
                    disabled={syncing === s.id}
                    className="btn btn-sm"
                    style={{
                      background: 'white', color: 'var(--text-2)', border: '1px solid var(--line)',
                      fontSize: 11, padding: '4px 10px',
                    }}
                  >
                    {syncing === s.id ? '...' : '🔄'}
                  </button>
                  <button
                    onClick={() => handleToggle(s.id, s.enabled === 1)}
                    className="btn btn-sm"
                    style={{
                      background: 'white', color: 'var(--text-2)', border: '1px solid var(--line)',
                      fontSize: 11, padding: '4px 10px',
                    }}
                  >
                    {s.enabled ? '停用' : '启用'}
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="btn btn-sm"
                    style={{
                      background: 'white', color: '#dc2626', border: '1px solid #fecaca',
                      fontSize: 11, padding: '4px 10px',
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleDateString('zh-CN');
}