'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ToastProvider';
import KernelCard from '@/components/KernelCard';
import KernelEditor from '@/components/KernelEditor';
import type { UserKernelRow } from '@insight-os/db';

const CATEGORIES = [
  { id: 'all' as const,        label: '全部',   color: '#64748b', emoji: '◎' },
  { id: 'belief' as const,     label: '底层信念',     color: '#6366f1', emoji: '◆' },
  { id: 'contrarian' as const, label: '反常识判断',   color: '#f43f5e', emoji: '◇' },
  { id: 'expertise' as const,  label: '擅长问题域',   color: '#10b981', emoji: '◈' },
  { id: 'challenge' as const,  label: '想挑战的常识', color: '#f59e0b', emoji: '◉' },
];

interface Stats {
  total: number;
  active: number;
  archived: number;
  byCategory: Record<string, number>;
  avgConfidence: number;
  totalReferenced: number;
}

type CategoryFilter = 'all' | 'belief' | 'contrarian' | 'expertise' | 'challenge';

export default function KernelSettingsPage() {
  const toast = useToast();
  const [kernels, setKernels] = useState<UserKernelRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserKernelRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // V1.11.16: 改 IDB-first（之前 /api/kernel Vercel NO_SQLITE 500）
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { getUserKernels, getUserKernelStats } = await import('@/lib/idb/operations');
      const [kernels, stats] = await Promise.all([
        getUserKernels({ status: statusFilter }),
        getUserKernelStats(),
      ]);
      setKernels(kernels);
      setStats(stats);
    } catch (e: any) {
      toast.error('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = category === 'all'
    ? kernels
    : kernels.filter(k => k.category === category);

  // V1.11.16: IDB-first
  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { seedDefaultKernels } = await import('@/lib/idb/kernel-seeds');
      const n = await seedDefaultKernels();
      toast.success(`已种入 ${n} 条 ship-ready 默认内核`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleArchive = async (k: UserKernelRow) => {
    if (!confirm(`归档这条内核？\n\n${k.content}\n\n归档后可恢复。`)) return;
    try {
      const { archiveUserKernel } = await import('@/lib/idb/operations');
      await archiveUserKernel(k.id);
      toast.success('已归档');
      await loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleVerify = async (k: UserKernelRow) => {
    try {
      const { verifyUserKernel } = await import('@/lib/idb/operations');
      await verifyUserKernel(k.id);
      toast.success('已标记为"重新想过"，lastVerifiedAt 已刷新');
      await loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReactivate = async (k: UserKernelRow) => {
    try {
      const { reactivateUserKernel } = await import('@/lib/idb/operations');
      await reactivateUserKernel(k.id);
      toast.success('已恢复');
      await loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleExport = () => {
    window.open('/api/kernel/export-md', '_blank');
  };

  const handleEdit = (k: UserKernelRow) => {
    setEditing(k);
    setEditorOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleSaved = () => {
    toast.success('已保存');
    loadData();
  };

  return (
    <div style={{ maxWidth: 920 }}>
      {/* Hero */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 4,
        }}>
          Settings › 判断协议
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.2 }}>
          🧠 Insight Kernel
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.6 }}>
          你的"判断宪法"。每次 LLM 调用都会自动注入到 system prompt，让所有输出"像你写的"。
        </p>
      </div>

      {/* 顶部状态条 */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {stats && (
          <>
            <Stat label="激活" value={stats.active} color="var(--primary)" />
            <span style={{ color: 'var(--line)' }}>·</span>
            <Stat label="归档" value={stats.archived} color="var(--text-3)" />
            <span style={{ color: 'var(--line)' }}>·</span>
            <Stat label="平均置信" value={`${stats.avgConfidence}`} color="#10b981" suffix="/100" />
            <span style={{ color: 'var(--line)' }}>·</span>
            <Stat label="被引用" value={stats.totalReferenced} color="#f59e0b" />
          </>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={handleNew} className="btn btn-primary" style={{ fontSize: 13 }}>
          + 新增内核
        </button>
        <button onClick={handleExport} className="btn" style={{ fontSize: 13 }}>
          ↓ 导出 beliefs.md
        </button>
      </div>

      {/* 空状态 */}
      {!loading && stats && stats.active === 0 && statusFilter === 'active' && (
        <div className="card" style={{
          padding: 48, textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(244,63,94,0.04))',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>
            还没有内核
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.6 }}>
            装入 6 条 ship-ready 默认内核，立刻就能让所有 LLM 输出带你的立场。<br />
            之后再回来改、改成你自己的判断。
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="btn btn-primary"
              style={{ fontSize: 14, padding: '10px 22px', fontWeight: 600 }}
            >
              {seeding ? '装入中…' : '✨ 装入 6 条默认内核'}
            </button>
            <button onClick={handleNew} className="btn" style={{ fontSize: 14, padding: '10px 22px' }}>
              自己写一条
            </button>
          </div>
        </div>
      )}

      {/* 4 类 Tab */}
      {!loading && kernels.length > 0 && (
        <>
          <div style={{
            display: 'flex', gap: 4, marginBottom: 16,
            borderBottom: '1px solid var(--line-soft)', paddingBottom: 4,
            alignItems: 'center',
          }}>
            {CATEGORIES.map(c => {
              const active = category === c.id;
              const count = c.id === 'all'
                ? kernels.length
                : kernels.filter(k => k.category === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  style={{
                    padding: '8px 14px',
                    background: active ? c.color : 'transparent',
                    color: active ? 'white' : 'var(--text)',
                    border: 'none',
                    borderRadius: '6px 6px 0 0',
                    fontSize: 13, fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 120ms',
                  }}
                >
                  <span style={{ fontSize: 11 }}>{c.emoji}</span>
                  {c.label}
                  <span style={{
                    fontSize: 11,
                    background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg-subtle)',
                    padding: '1px 6px', borderRadius: 8,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
            <span style={{ flex: 1 }} />
            {/* 状态过滤 */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{
                padding: '6px 10px', fontSize: 12,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--line)',
                borderRadius: 6,
                color: 'var(--text)',
              }}
            >
              <option value="active">仅激活</option>
              <option value="archived">仅归档</option>
              <option value="all">全部</option>
            </select>
          </div>

          {/* 卡片列表 */}
          {filtered.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              这个类别没有内核
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(k => (
                <KernelCard
                  key={k.id}
                  kernel={k}
                  onEdit={handleEdit}
                  onArchive={handleArchive}
                  onVerify={handleVerify}
                  onReactivate={handleReactivate}
                />
              ))}
            </div>
          )}
        </>
      )}

      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>
      )}

      <KernelEditor
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function Stat({ label, value, color, suffix }: { label: string; value: string | number; color: string; suffix?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}{suffix}</span>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
    </div>
  );
}
