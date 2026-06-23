'use client';

import type { UserKernelRow } from '@insight-os/db';
import { useState } from 'react';

const CATEGORY_META: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  belief:     { label: '底层信念',     color: '#6366f1', bg: 'rgba(99, 102, 241, 0.08)',  emoji: '◆' },
  contrarian: { label: '反常识判断',   color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.08)',   emoji: '◇' },
  expertise:  { label: '擅长问题域',   color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)',  emoji: '◈' },
  challenge:  { label: '想挑战的常识', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)',  emoji: '◉' },
};

interface KernelCardProps {
  kernel: UserKernelRow;
  onEdit: (k: UserKernelRow) => void;
  onArchive: (k: UserKernelRow) => void;
  onVerify: (k: UserKernelRow) => void;
  onReactivate?: (k: UserKernelRow) => void;
}

export default function KernelCard({ kernel, onEdit, onArchive, onVerify, onReactivate }: KernelCardProps) {
  const meta = CATEGORY_META[kernel.category] ?? CATEGORY_META.belief;
  const [hover, setHover] = useState(false);
  const archived = kernel.status === 'archived';

  const conf = kernel.confidence;
  const confColor = conf >= 80 ? '#10b981' : conf >= 60 ? '#f59e0b' : '#94a3b8';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: '18px 20px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        opacity: archived ? 0.6 : 1,
        transition: 'all 120ms',
        boxShadow: hover ? '0 4px 14px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      {/* 顶部：类别 + confidence pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px',
          background: meta.bg, color: meta.color,
          fontSize: 12, fontWeight: 600,
          borderRadius: 12,
        }}>
          <span style={{ fontSize: 10 }}>{meta.emoji}</span>
          {meta.label}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 9px',
          background: 'var(--bg-subtle)',
          color: confColor,
          fontSize: 12, fontWeight: 600,
          borderRadius: 10,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: confColor,
          }} />
          {conf}/100
        </span>
        <span style={{ flex: 1 }} />
        {kernel.referencedCount > 0 && (
          <span style={{
            fontSize: 11, color: 'var(--text-3)',
            background: 'var(--bg-subtle)',
            padding: '2px 7px', borderRadius: 8,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            📌 {kernel.referencedCount}
          </span>
        )}
        {archived && (
          <span style={{
            fontSize: 11, color: 'var(--text-3)',
            background: 'var(--bg-subtle)',
            padding: '2px 8px', borderRadius: 8,
          }}>
            已归档
          </span>
        )}
      </div>

      {/* 主体：一句话判断 */}
      <div style={{
        fontSize: 16, fontWeight: 500, color: 'var(--ink)',
        lineHeight: 1.6, marginBottom: kernel.scope || kernel.counterExample ? 12 : 0,
      }}>
        {kernel.content}
      </div>

      {/* 适用 / 不适用 */}
      {(kernel.scope || kernel.counterExample) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
          {kernel.scope && (
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>适用：</span>
              {kernel.scope}
            </div>
          )}
          {kernel.counterExample && (
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>不适用：</span>
              {kernel.counterExample}
            </div>
          )}
        </div>
      )}

      {/* 操作按钮（hover 显示） */}
      <div style={{
        display: 'flex', gap: 6, marginTop: 12,
        opacity: hover ? 1 : 0.4,
        transition: 'opacity 120ms',
      }}>
        {!archived ? (
          <>
            <button className="btn" onClick={() => onEdit(kernel)} style={{ fontSize: 12, padding: '5px 10px' }}>
              ✎ 编辑
            </button>
            <button className="btn btn-ghost" onClick={() => onVerify(kernel)} style={{ fontSize: 12, padding: '5px 10px' }}>
              ✓ 我重新想过了
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={() => onArchive(kernel)} style={{ fontSize: 12, padding: '5px 10px' }}>
              归档
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1 }} />
            {onReactivate && (
              <button className="btn" onClick={() => onReactivate(kernel)} style={{ fontSize: 12, padding: '5px 10px' }}>
                ↻ 恢复
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
