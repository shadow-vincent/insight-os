'use client';

import { useState, useEffect } from 'react';
import AssistantDrawer from './AssistantDrawer';

export default function AssistantButton() {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);

  // 首次访问 2s 后弹出小气泡提示
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem('assistant-hint-seen');
    if (seen) return;
    const t = setTimeout(() => {
      setHint(true);
      setTimeout(() => {
        setHint(false);
        localStorage.setItem('assistant-hint-seen', '1');
      }, 5000);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {open && <AssistantDrawer onClose={() => setOpen(false)} />}

      {/* 气泡提示 */}
      {hint && !open && (
        <div
          onClick={() => { setOpen(true); setHint(false); localStorage.setItem('assistant-hint-seen', '1'); }}
          style={{
            position: 'fixed', right: 78, bottom: 22, zIndex: 9997,
            background: 'white', border: '1px solid var(--line)', borderRadius: 10,
            padding: '10px 14px', fontSize: 12, color: 'var(--ink)',
            boxShadow: '0 4px 16px rgba(15,23,42,0.12)',
            cursor: 'pointer', maxWidth: 220,
            animation: 'fade-in 0.3s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span>✨</span>
            <strong>新：洞察助手</strong>
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 11 }}>
            搜资产卡 · 多卡联合输出
          </div>
          <div style={{
            position: 'absolute', right: -6, bottom: 16,
            width: 0, height: 0,
            borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
            borderLeft: '6px solid white',
          }} />
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* 浮动按钮 */}
      <button
        onClick={() => { setOpen(o => !o); setHint(false); localStorage.setItem('assistant-hint-seen', '1'); }}
        title="洞察助手"
        style={{
          position: 'fixed', right: 24, bottom: 24, zIndex: 9997,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? 'var(--text-2)' : 'linear-gradient(135deg, #1d4ed8, #0284c7)',
          color: 'white', border: 'none', cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(29, 78, 216, 0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {open ? '×' : '✨'}
      </button>
    </>
  );
}
