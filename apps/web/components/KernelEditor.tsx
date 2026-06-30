'use client';

import type { UserKernelRow } from '@insight-os/db';
import { useState, useEffect } from 'react';
import { addUserKernel, updateUserKernel } from '@/lib/idb/operations';

const CATEGORIES = [
  { id: 'belief' as const,     label: '底层信念',     color: '#6366f1', hint: '长期价值主张 / 哲学立场' },
  { id: 'contrarian' as const, label: '反常识判断',   color: '#f43f5e', hint: '反对主流叙事的判断' },
  { id: 'expertise' as const,  label: '擅长问题域',   color: '#10b981', hint: '被验证过能力的领域' },
  { id: 'challenge' as const,  label: '想挑战的常识', color: '#f59e0b', hint: '想消灭 / 重塑的行业套话' },
];

interface KernelEditorProps {
  open: boolean;
  initial: UserKernelRow | null;  // null = 新增模式
  onClose: () => void;
  onSaved: () => void;
}

export default function KernelEditor({ open, initial, onClose, onSaved }: KernelEditorProps) {
  const [category, setCategory] = useState<typeof CATEGORIES[number]['id']>('belief');
  const [content, setContent] = useState('');
  const [confidence, setConfidence] = useState(70);
  const [counterExample, setCounterExample] = useState('');
  const [scope, setScope] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCategory((initial?.category as any) ?? 'belief');
      setContent(initial?.content ?? '');
      setConfidence(initial?.confidence ?? 70);
      setCounterExample(initial?.counterExample ?? '');
      setScope(initial?.scope ?? '');
      setShowAdvanced(!!(initial?.counterExample || initial?.scope));
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSave = async () => {
    if (!content.trim()) {
      setError('content 不能为空');
      return;
    }
    if (content.trim().length < 5) {
      setError('content 至少 5 字');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // V1.11: 优先写 IndexedDB
      if (initial) {
        await updateUserKernel(initial.id, {
          category,
          content: content.trim(),
          confidence,
          counterExample: counterExample.trim() || undefined,
          scope: scope.trim() || undefined,
        });
      } else {
        const id = `kernel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await addUserKernel({
          id,
          category,
          kind: 'belief' as any,
          content: content.trim(),
          confidence,
          counterExample: counterExample.trim() || undefined,
          scope: scope.trim() || undefined,
          evidenceAssetIdsJson: '[]',
          referencedCount: 0,
          status: 'active',
          sortOrder: 99,
        });
      }
      onSaved?.();
      onClose();
    } catch (e: any) {
      // 回退 server API
      try {
        let res: Response;
        if (initial) {
          res = await fetch(`/api/kernel/${initial.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              category,
              content: content.trim(),
              confidence,
              counterExample: counterExample.trim() || null,
              scope: scope.trim() || null,
            }),
          });
        } else {
          res = await fetch('/api/kernel', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              category,
              content: content.trim(),
              confidence,
              counterExample: counterExample.trim() || null,
              scope: scope.trim() || null,
            }),
          });
        }
        const data = await res.json();
        if (data.ok) {
          onSaved?.();
          onClose();
        } else {
          setError(data.error ?? '保存失败');
        }
      } catch (e2: any) {
        setError(e.message || e2.message || String(e));
      }
    } finally {
      setSaving(false);
    }
  };

  const confColor = confidence >= 80 ? '#10b981' : confidence >= 60 ? '#f59e0b' : '#94a3b8';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--bg-panel)',
          borderRadius: 10,
          boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
          padding: 28,
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{
          fontSize: 18, fontWeight: 600, color: 'var(--ink)',
          margin: '0 0 4px',
        }}>
          {initial ? '编辑内核' : '新增内核'}
        </h2>
        <p style={{
          fontSize: 13, color: 'var(--text-3)',
          margin: '0 0 20px', lineHeight: 1.5,
        }}>
          极简编辑：一句话判断 + 类型 + 置信度。高级字段默认折叠。
        </p>

        {/* 类别 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            类别
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {CATEGORIES.map(c => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: active ? c.color : 'var(--bg-subtle)',
                    color: active ? 'white' : 'var(--text)',
                    border: active ? `1px solid ${c.color}` : '1px solid var(--line)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 120ms',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{c.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 一句话判断 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            一句话判断 <span style={{ color: '#f43f5e' }}>*</span>
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="例如：管理的本质是激发人的善意和潜能，而不是控制"
            rows={3}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontSize: 14, color: 'var(--ink)',
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: 70,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 置信度 slider */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              置信度
            </label>
            <span style={{
              fontSize: 13, fontWeight: 700, color: confColor,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {confidence}/100
            </span>
          </div>
          <input
            type="range" min={0} max={100} step={5}
            value={confidence}
            onChange={e => setConfidence(Number(e.target.value))}
            style={{ width: '100%', accentColor: confColor }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.4 }}>
            高 = 经验验证 · 中 = 推论 · 低 = 待验证或挑战
          </div>
        </div>

        {/* 高级折叠 */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--text-3)', cursor: 'pointer',
            fontSize: 12, padding: '6px 0',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{ fontSize: 10 }}>{showAdvanced ? '▼' : '▸'}</span>
          展开高级（反例 / 适用场景）
        </button>

        {showAdvanced && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4, display: 'block' }}>
              不适用场景（反例）
            </label>
            <input
              value={counterExample}
              onChange={e => setCounterExample(e.target.value)}
              placeholder="什么时候不成立 / 失效"
              className="form-input"
              style={{ marginBottom: 12 }}
            />
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4, display: 'block' }}>
              适用场景
            </label>
            <input
              value={scope}
              onChange={e => setScope(e.target.value)}
              placeholder="客户咨询 · 公众号 · 团队管理"
              className="form-input"
            />
          </div>
        )}

        {error && (
          <div className="callout callout-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        {/* 操作 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{ flex: 1, fontWeight: 600 }}
          >
            {saving ? '保存中…' : (initial ? '✓ 保存' : '+ 新增')}
          </button>
        </div>
      </div>
    </div>
  );
}
