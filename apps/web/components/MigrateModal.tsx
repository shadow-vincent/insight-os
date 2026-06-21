'use client';

/**
 * 风格迁移 modal（深度版 · V1.2 阶段 D3）
 *
 * 支持多 src preset 维度混合：
 * - 选 1 个 dst（被覆盖）
 * - 选 1-N 个 src（拉取来源）
 * - 每个 src 可勾选要拉取哪些维度
 * - 实时显示合并结果
 */

import { useEffect, useState } from 'react';

interface WritingConfig {
  name: string;
  description?: string;
  dimensions: {
    style: any;
    sentence: any;
    structure: any;
    length: any;
    quality: any;
  };
}

interface MigrateModalProps {
  open: boolean;
  presets: Array<{ name: string; description?: string }>;
  onClose: () => void;
  onSaved: (newName: string) => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

type Dim = 'style' | 'sentence' | 'structure' | 'length' | 'quality';

const DIM_LABELS: Record<Dim, string> = {
  style: 'A 风格',
  sentence: 'B 句式',
  structure: 'C 结构',
  length: 'D 长度',
  quality: 'E 质检',
};

const DIM_DESCS: Record<Dim, string> = {
  style: '语气温度 / 立场 / 人设 / 视角 / 术语密度 / 温度',
  sentence: '节奏 / 短句比 / 段落长度 / 修辞',
  structure: '标题 / 核心位置 / 论证模式 / 章节数 / 收尾',
  length: '字数 / 单章字数 / 关键金句',
  quality: '引用上限 / 禁用词 / 数据真实性',
};

interface SourceSelection {
  srcName: string;
  dims: Set<Dim>;
}

export default function MigrateModal({ open, presets, onClose, onSaved, toast }: MigrateModalProps) {
  const [dst, setDst] = useState<string>('');
  const [sources, setSources] = useState<SourceSelection[]>([]);
  const [merged, setMerged] = useState<WritingConfig | null>(null);
  const [newName, setNewName] = useState<string>('');
  const [migrating, setMigrating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMerged(null);
      setNewName('');
      setSources([]);
      setDst('');
    }
  }, [open]);

  const addSource = (srcName: string) => {
    if (sources.find(s => s.srcName === srcName)) {
      toast.error(`${srcName} 已添加`);
      return;
    }
    setSources(prev => [...prev, { srcName, dims: new Set(['style']) }]);
  };

  const removeSource = (srcName: string) => {
    setSources(prev => prev.filter(s => s.srcName !== srcName));
  };

  const toggleDim = (srcName: string, d: Dim) => {
    setSources(prev => prev.map(s => {
      if (s.srcName !== srcName) return s;
      const next = new Set(s.dims);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return { ...s, dims: next };
    }));
  };

  const handleMigrate = async () => {
    if (!dst) {
      toast.error('请选目标 preset');
      return;
    }
    if (sources.length === 0) {
      toast.error('至少加 1 个源 preset');
      return;
    }
    const sourcesObj: any = {};
    for (const s of sources) {
      if (s.dims.size === 0) continue;
      sourcesObj[s.srcName] = Object.fromEntries(Array.from(s.dims).map(d => [d, true]));
    }
    if (Object.keys(sourcesObj).length === 0) {
      toast.error('至少勾选 1 个维度');
      return;
    }
    setMigrating(true);
    try {
      const res = await fetch('/api/writing-config/migrate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dst, sources: sourcesObj }),
      });
      const data = await res.json();
      if (data.ok) {
        setMerged(data.config);
        const suggestedName = `${dst}-mixed-${sources.map(s => s.srcName.slice(0, 4)).join('-')}`;
        setNewName(suggestedName);
        toast.success('混合完成 · 命名后保存');
      } else {
        toast.error(`迁移失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`请求失败: ${e.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const handleSave = async () => {
    if (!merged || !newName.trim()) {
      toast.error('请填写名字');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(newName)) {
      toast.error('名字必须是小写字母、数字、横线');
      return;
    }
    setSaving(true);
    try {
      const configToSave = { ...merged, name: newName, updatedAt: Date.now() };
      const res = await fetch(`/api/writing-config/${encodeURIComponent(newName)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(configToSave),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`已保存「${newName}」`);
        onSaved(newName);
        onClose();
      } else {
        toast.error(`保存失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`请求失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{
          maxWidth: 760, width: '100%', maxHeight: '90vh', overflow: 'auto',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>🔀 风格迁移（多 src 混合）</h3>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
          💡 从多个源 preset 拉取不同维度，覆盖到目标 preset · 适合"A 的风格 + B 的结构 + C 的质检"
        </div>

        {!merged ? (
          <>
            {/* 选目标 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                🎯 目标 preset（被覆盖）
              </label>
              <select value={dst} onChange={e => setDst(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
                <option value="">-- 选目标 --</option>
                {presets.filter(p => !sources.find(s => s.srcName === p.name)).map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 选 src + 每个 src 勾选维度 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                📥 源 presets（拉取来源 · 可加多个）
              </label>

              {/* 已选的 src */}
              {sources.map(s => (
                <div key={s.srcName} style={{
                  padding: 12, marginBottom: 8, background: 'var(--bg-subtle)', borderRadius: 6,
                  border: '1px solid var(--primary-soft)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 13, color: 'var(--ink)' }}>📦 {s.srcName}</strong>
                    <span style={{ flex: 1 }} />
                    <button className="btn btn-sm" onClick={() => removeSource(s.srcName)} style={{ fontSize: 11 }}>移除</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(Object.keys(DIM_LABELS) as Dim[]).map(d => (
                      <label
                        key={d}
                        style={{
                          padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 4,
                          background: s.dims.has(d) ? 'var(--primary)' : 'transparent',
                          color: s.dims.has(d) ? '#fff' : 'var(--text)',
                          border: '1px solid var(--line-soft)',
                        }}
                      >
                        <input type="checkbox" checked={s.dims.has(d)} onChange={() => toggleDim(s.srcName, d)} style={{ display: 'none' }} />
                        {DIM_LABELS[d]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* 加新 src */}
              <select
                value=""
                onChange={e => { if (e.target.value) addSource(e.target.value); }}
                style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
              >
                <option value="">+ 添加源 preset</option>
                {presets.filter(p => p.name !== dst && !sources.find(s => s.srcName === p.name)).map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={onClose} disabled={migrating}>取消</button>
              <button className="btn btn-primary" onClick={handleMigrate} disabled={migrating || !dst || sources.length === 0}>
                {migrating ? '合并中…' : '🔀 合并预览'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{
              padding: 12, background: 'var(--primary-soft)', borderRadius: 6, marginBottom: 14,
              fontSize: 12, color: 'var(--text)',
            }}>
              合并自：<strong>{dst}</strong> ← {sources.map(s => `${s.srcName}(${Array.from(s.dims).map(d => DIM_LABELS[d]).join('+')})`).join(' + ')}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                保存为新 preset 名
              </label>
              <input
                className="input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn" onClick={() => setMerged(null)} disabled={saving}>← 重新合并</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={onClose} disabled={saving}>取消</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中…' : '保存为新 preset'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}