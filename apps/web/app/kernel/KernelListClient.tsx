'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSharedDexie } from '@/components/shared-dexie';
import type { UserKernelRow } from '@insight-os/db';
import KernelCard from '@/components/KernelCard';
import KernelEditor from '@/components/KernelEditor';
import { useToast } from '@/components/ToastProvider';
import { updateUserKernel, addUserKernel, getUserKernels } from '@/lib/idb/operations';
import { seedDefaultKernels, seedSixLayersKernels } from '@/lib/idb/kernel-seeds';

type Filter = 'all' | 'belief' | 'contrarian' | 'expertise' | 'challenge';

const FILTERS: { id: Filter; label: string; color: string; bg: string }[] = [
  { id: 'all',         label: '全部',   color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
  { id: 'belief',      label: '◆ 底层信念', color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
  { id: 'contrarian',  label: '◇ 反常识',   color: '#f43f5e', bg: 'rgba(244,63,94,0.08)' },
  { id: 'expertise',   label: '◈ 擅长',     color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  { id: 'challenge',   label: '◉ 挑战',     color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
];

interface Stats {
  total: number;
  active: number;
  archived: number;
  byCategory: Record<string, number>;
  avgConfidence: number;
  totalReferenced: number;
}

export default function KernelListClient() {
  const toast = useToast();
  const [kernels, setKernels] = useState<UserKernelRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserKernelRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [seeding, setSeeding] = useState<'default' | 'six-layers' | null>(null);
  // v1.6: 一键提炼候选
  const [inferring, setInferring] = useState(false);
  const [inferCandidate, setInferCandidate] = useState<{
    category: string;
    kind: string;
    content: string;
    counterExample: string;
    scope: string;
    confidence: number;
    evidenceAssetIds: string[];
    reasoning: string;
    sourceLabel: string;
  } | null>(null);
  const [inferError, setInferError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // V1.10: 优先从 IndexedDB 读（demo / Vercel），回退到 server API
      let idbKernels: UserKernelRow[] | null = null;
      try {
        const DexieModule = await import('dexie');

        const db = await getSharedDexie();
idbKernels = await db.userKernels.toArray();
        if (idbKernels.length === 0) idbKernels = null;
      } catch { /* IDB 不可用时回退 server */ }

      if (idbKernels && idbKernels.length > 0) {
        setKernels(idbKernels);
        // 计算 stats（从 IDB 数据本地算）
        const active = idbKernels.filter((k: any) => k.status === 'active');
        const archived = idbKernels.filter((k: any) => k.status === 'archived');
        const byCategory: Record<string, number> = {};
        let totalConf = 0;
        let totalRef = 0;
        for (const k of idbKernels) {
          byCategory[k.category] = (byCategory[k.category] ?? 0) + 1;
          totalConf += k.confidence || 0;
          totalRef += k.referencedCount || 0;
        }
        setStats({
          total: idbKernels.length,
          active: active.length,
          archived: archived.length,
          byCategory,
          avgConfidence: idbKernels.length > 0 ? totalConf / idbKernels.length : 0,
          totalReferenced: totalRef,
        });
      } else {
        // 回退 server API
        const [kRes, sRes] = await Promise.all([
          fetch('/api/kernel?status=all'),
          fetch('/api/kernel/stats'),
        ]);
        const kData = await kRes.json();
        const sData = await sRes.json();
        if (kData.ok) setKernels(kData.kernels);
        if (sData.ok) setStats(sData);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (k: UserKernelRow) => {
    setEditing(k);
    setEditorOpen(true);
  };

  const handleArchive = async (k: UserKernelRow) => {
    if (!confirm(`归档「${k.content.slice(0, 30)}…」？归档后可以恢复。`)) return;
    try {
      // V1.11: 直接写 IndexedDB
      await updateUserKernel(k.id, { status: 'archived' });
      toast.success('已归档');
      load();
    } catch (e: any) {
      // 回退 server API（本地 dev）
      try {
        const r = await fetch(`/api/kernel/${k.id}`, { method: 'DELETE' });
        const d = await r.json();
        if (d.ok) { toast.success('已归档'); load(); }
        else { toast.error(d.error ?? '归档失败'); }
      } catch (e2: any) {
        toast.error(e.message || e2.message);
      }
    }
  };

  const handleReactivate = async (k: UserKernelRow) => {
    try {
      await updateUserKernel(k.id, { status: 'active' });
      toast.success('已恢复');
      load();
    } catch (e: any) {
      try {
        const r = await fetch(`/api/kernel/${k.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });
        const d = await r.json();
        if (d.ok) { toast.success('已恢复'); load(); }
        else { toast.error(d.error ?? '恢复失败'); }
      } catch (e2: any) {
        toast.error(e.message || e2.message);
      }
    }
  };

  const handleVerify = async (k: UserKernelRow) => {
    try {
      await updateUserKernel(k.id, { lastVerifiedAt: Date.now() });
      toast.success('已标记「重新想过了」');
      load();
    } catch (e: any) {
      try {
        const r = await fetch(`/api/kernel/verify/${k.id}`, { method: 'POST' });
        const d = await r.json();
        if (d.ok) { toast.success('已标记「重新想过了」'); load(); }
        else { toast.error(d.error ?? '标记失败'); }
      } catch (e2: any) {
        toast.error(e.message || e2.message);
      }
    }
  };

  const seedPreset = async (kind: 'default' | 'six-layers') => {
    setSeeding(kind);
    try {
      // V1.11: 直接写 IndexedDB
      const result = kind === 'default' ? await seedDefaultKernels() : await seedSixLayersKernels();
      if (result.seeded > 0) {
        toast.success(`已种入 ${result.seeded} 条`);
        load();
      } else if (result.existingCount > 0) {
        toast.info(`已存在 ${result.existingCount} 条`);
        load();
      }
    } catch (e: any) {
      // 回退 server API
      try {
        const r = await fetch(`/api/kernel/seed-${kind}`, { method: 'POST' });
        const d = await r.json();
        if (d.ok) { toast.success(d.message ?? `已种入 ${d.seeded} 条`); load(); }
        else if (d.existingCount) { toast.info(`已存在 ${d.existingCount} 条`); }
        else { toast.error(d.error ?? '种子失败'); }
      } catch (e2: any) {
        toast.error(e.message || e2.message);
      }
    } finally {
      setSeeding(null);
    }
  };

  // v1.6: 一键提炼 Kernel（需要 LLM 配 API key，Vercel demo 不支持）
  const inferFromAssets = async () => {
    setInferring(true);
    setInferError(null);
    try {
      const r = await fetch('/api/kernel/infer-from-assets', { method: 'POST' });
      const d = await r.json();
      if (d.ok) {
        setInferCandidate(d.candidate);
        toast.success('已生成候选');
      } else {
        setInferError(d.error ?? '提炼失败');
        toast.error(d.error ?? '提炼失败');
      }
    } catch (e: any) {
      setInferError(e.message);
      toast.error('需要 LLM 配置 + server SQLite（V1.11 demo 暂不支持）');
    } finally {
      setInferring(false);
    }
  };

  // 确认保存候选 Kernel
  const saveInferredCandidate = async () => {
    if (!inferCandidate) return;
    try {
      // V1.11: 直接写 IndexedDB
      const id = `kernel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await addUserKernel({
        id,
        category: inferCandidate.category as any,
        kind: inferCandidate.kind as any,
        content: inferCandidate.content,
        counterExample: inferCandidate.counterExample || undefined,
        scope: inferCandidate.scope || undefined,
        confidence: inferCandidate.confidence || 70,
        evidenceAssetIdsJson: JSON.stringify(inferCandidate.evidenceAssetIds || []),
        referencedCount: 0,
        status: 'active',
        sortOrder: 99,
      });
      toast.success('已保存为 Kernel');
      setInferCandidate(null);
      load();
    } catch (e: any) {
      // 回退 server API
      try {
        const r = await fetch('/api/kernel', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            category: inferCandidate.category,
            kind: inferCandidate.kind,
            content: inferCandidate.content,
            counterExample: inferCandidate.counterExample,
            scope: inferCandidate.scope,
            confidence: inferCandidate.confidence,
            evidenceAssetIds: inferCandidate.evidenceAssetIds,
          }),
        });
        const d = await r.json();
        if (d.ok) {
          toast.success('已保存为 Kernel');
          setInferCandidate(null);
          load();
        } else {
          toast.error(d.error ?? '保存失败');
        }
      } catch (e2: any) {
        toast.error(e.message || e2.message);
      }
    }
  };

  // 过滤
  const filteredKernels = kernels.filter((k) => {
    if (filter === 'all') return true;
    return k.category === filter;
  });

  // 按 6 层 + 类别分组排序
  const sixLayers = kernels.filter((k) => (k.scope ?? '').includes('六层提问法'));

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* 顶部 hero · v1.8.4 改名「我的方法论」 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            我的方法论
          </h1>
          {stats && (
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {stats.active} 条活跃 · 平均置信度 {Math.round(stats.avgConfidence)} · 被引用 {stats.totalReferenced} 次
            </span>
          )}
        </div>
        <p className="page-subtitle" style={{ margin: 0 }}>
          让 AI 按你的判断方式写作和分析——不是每次重新教 AI，而是让它长期记住你的判断。
        </p>
      </div>

      {/* 6 层 + 预置快捷区 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
        marginBottom: 24,
      }}>
        {/* 六层提问法卡 */}
        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.06) 100%)',
          border: '1.5px solid rgba(99,102,241,0.20)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>🎯</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#4f46e5' }}>六层提问法</span>
            {sixLayers.length > 0 && (
              <span style={{
                marginLeft: 'auto',
                fontSize: 11, color: 'var(--text-3)',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                ✓ 已存 {sixLayers.length} 条
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.6, marginBottom: 12 }}>
            Vincent 原创方法论 · 训练营第一节课教学示范 · 6 层框架一次沉淀
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => seedPreset('six-layers')}
              disabled={seeding === 'six-layers'}
              className="btn"
              style={{
                fontSize: 12, padding: '6px 12px',
                background: '#4f46e5', color: 'white', borderColor: '#4f46e5',
                opacity: seeding === 'six-layers' ? 0.5 : 1,
              }}
            >
              {seeding === 'six-layers' ? '装入中…' : sixLayers.length > 0 ? '查看 / 编辑' : '✨ 装入 6 条六层'}
            </button>
            <a
              href="/learn/six-layers"
              style={{
                fontSize: 12, padding: '6px 12px',
                color: '#4f46e5', textDecoration: 'none',
                border: '1px solid #4f46e5', borderRadius: 6,
              }}
            >
              教学页 →
            </a>
          </div>
        </div>

        {/* 默认预置卡 */}
        <div style={{
          padding: 20,
          background: 'var(--bg-subtle)',
          border: '1px solid var(--line)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>◆</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Ship-ready 默认内核</span>
            {stats && stats.active >= 6 && (
              <span style={{
                marginLeft: 'auto',
                fontSize: 11, color: 'var(--text-3)',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                ✓ 已存 ≥ 6 条
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.6, marginBottom: 12 }}>
            6 条 ship-ready 默认内核（belief/contrarian/expertise/challenge 各 1-2 条）
          </p>
          <button
            onClick={() => seedPreset('default')}
            disabled={seeding === 'default'}
            className="btn"
            style={{
              fontSize: 12, padding: '6px 12px',
              opacity: seeding === 'default' ? 0.5 : 1,
            }}
          >
            {seeding === 'default' ? '装入中…' : '✨ 装入 6 条默认'}
          </button>
        </div>
      </div>

      {/* v1.6: 一键提炼 Kernel（从高频资产） */}
      <div style={{
        padding: 18,
        marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.06))',
        border: '1.5px solid rgba(99,102,241,0.25)',
        borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          color: 'white', fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          ✨
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
            从你被高频引用的资产提炼 1 条 Kernel
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            找最常被你引用的 5 张资产，调 LLM 总结出 1 条普适方法论。
            <span style={{ color: 'var(--primary)', fontWeight: 600, marginLeft: 6 }}>🔒 Pro</span>
          </div>
          {inferError && (
            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>
              {inferError}
            </div>
          )}
        </div>
        <button
          onClick={inferFromAssets}
          disabled={inferring}
          className="btn"
          style={{
            padding: '10px 18px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            color: 'white', border: 'none',
            fontSize: 13, fontWeight: 600,
            flexShrink: 0,
            opacity: inferring ? 0.6 : 1,
          }}
        >
          {inferring ? '提炼中…' : '✨ 一键提炼'}
        </button>
      </div>

      {/* 筛选 + 新建 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        {FILTERS.map((f) => {
          const count = f.id === 'all'
            ? kernels.filter((k) => k.status === 'active').length
            : kernels.filter((k) => k.status === 'active' && k.category === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: '6px 12px',
                fontSize: 12, fontWeight: 500,
                background: filter === f.id ? f.bg : 'transparent',
                color: filter === f.id ? f.color : 'var(--text-3)',
                border: filter === f.id ? `1.5px solid ${f.color}` : '1px solid var(--line)',
                borderRadius: 999,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              {f.label}
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                {count}
              </span>
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <button
          onClick={openNew}
          className="btn"
          style={{
            fontSize: 13, padding: '7px 14px',
            background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)',
            fontWeight: 600,
          }}
        >
          + 新建内核
        </button>
      </div>

      {/* 列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
          加载中…
        </div>
      ) : filteredKernels.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60,
          background: 'var(--bg-subtle)', borderRadius: 12,
          border: '1px dashed var(--line)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', margin: 0, marginBottom: 8 }}>
            {filter === 'all' ? '还没有 Insight Kernel' : `${FILTERS.find((f) => f.id === filter)?.label} 类暂无`}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, marginBottom: 20 }}>
            {filter === 'all' ? '装入预置内核，或自己写第一条' : '试试别的分类或新建一条'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            <button
              onClick={() => seedPreset('six-layers')}
              className="btn"
              style={{
                fontSize: 13, padding: '8px 16px',
                background: '#4f46e5', color: 'white', borderColor: '#4f46e5',
              }}
            >
              ✨ 装入六层提问法
            </button>
            <button
              onClick={openNew}
              className="btn"
              style={{ fontSize: 13, padding: '8px 16px' }}
            >
              自己写一条
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 14,
        }}>
          {filteredKernels.map((k) => (
            <KernelCard
              key={k.id}
              kernel={k}
              onEdit={openEdit}
              onArchive={handleArchive}
              onVerify={handleVerify}
              onReactivate={handleReactivate}
            />
          ))}
        </div>
      )}

      {/* Editor 弹窗 */}
      <KernelEditor
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={load}
      />

      {/* v1.6: 一键提炼候选 modal */}
      {inferCandidate && (
        <InferredKernelModal
          candidate={inferCandidate}
          onClose={() => setInferCandidate(null)}
          onSaved={() => {
            setInferCandidate(null);
            load();
          }}
          onSave={saveInferredCandidate}
        />
      )}
    </div>
  );
}

/**
 * v1.6: 候选 Kernel modal（可调整后保存）
 */
function InferredKernelModal({
  candidate,
  onClose,
  onSaved,
  onSave,
}: {
  candidate: any;
  onClose: () => void;
  onSaved: () => void;
  onSave: () => void;
}) {
  const [content, setContent] = useState(candidate.content);
  const [counterExample, setCounterExample] = useState(candidate.counterExample ?? '');
  const [scope, setScope] = useState(candidate.scope ?? '');
  const [confidence, setConfidence] = useState(candidate.confidence ?? 75);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 改 candidate 内容（因为是 React state，要回调给父级）
      candidate.content = content;
      candidate.counterExample = counterExample;
      candidate.scope = scope;
      candidate.confidence = confidence;
      await onSave();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640,
          background: 'white', borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          padding: 32,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'inline-block', padding: '4px 10px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))',
            color: 'var(--primary)',
            borderRadius: 999, fontSize: 11, fontWeight: 600,
            marginBottom: 8,
          }}>
            ✨ AI 提炼候选
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            检视 / 调整后保存为 Kernel
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.6 }}>
            基于你被高频引用的 {candidate.evidenceAssetIds.length} 张资产，AI 总结了 1 条候选方法论。
            检视后改 1 改再保存 — 保存后自动注入到 LLM 提示。
          </p>
        </div>

        <div style={{
          padding: 12,
          background: 'var(--bg-subtle)',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--ink)' }}>📝 提炼理由：</strong>
          {candidate.reasoning}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
            一句话判断
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            className="form-input"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
            适用场景
          </label>
          <input
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="form-input"
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
            什么时候不适用（反例）
          </label>
          <textarea
            value={counterExample}
            onChange={(e) => setCounterExample(e.target.value)}
            rows={2}
            className="form-input"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
            置信度: <span style={{ color: 'var(--primary)' }}>{confidence}/100</span>
          </label>
          <input
            type="range" min={0} max={100} value={confidence}
            onChange={(e) => setConfidence(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6 }}>
            引用 {candidate.evidenceAssetIds.length} 张资产（保存后自动关联）
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="btn"
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              color: 'white', border: 'none',
              fontWeight: 600,
              opacity: saving || !content.trim() ? 0.5 : 1,
            }}
          >
            {saving ? '保存中…' : '💾 保存为 Kernel'}
          </button>
        </div>
      </div>
    </div>
  );
}
