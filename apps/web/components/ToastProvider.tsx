'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone, durationMs?: number) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message: string, tone: ToastTone = 'info', durationMs = 3000) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setItems(prev => [...prev, { id, message, tone, durationMs }]);
    if (durationMs > 0) {
      setTimeout(() => remove(id), durationMs);
    }
  }, [remove]);

  const success = useCallback((msg: string) => show(msg, 'success'), [show]);
  const error = useCallback((msg: string) => show(msg, 'error', 5000), [show]);
  const info = useCallback((msg: string) => show(msg, 'info'), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info }}>
      {children}
      <ToastContainer items={items} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

function ToastContainer({ items, onClose }: { items: ToastItem[]; onClose: (id: string) => void }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {items.map(t => (
        <ToastView key={t.id} item={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 入场动画
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const colorMap: Record<ToastTone, { bg: string; border: string; text: string; icon: string }> = {
    success: { bg: '#ecfdf5', border: '#16a34a', text: '#15803d', icon: '✓' },
    error:   { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c', icon: '✗' },
    info:    { bg: 'var(--bg-panel)', border: 'var(--line-strong)', text: 'var(--ink)', icon: 'ℹ' },
    warning: { bg: '#fffbeb', border: '#d97706', text: '#b45309', icon: '⚠' },
  };
  const c = colorMap[item.tone];

  return (
    <div
      onClick={onClose}
      style={{
        pointerEvents: 'auto',
        cursor: 'pointer',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: 6,
        padding: '10px 14px',
        minWidth: 240,
        maxWidth: 400,
        fontSize: 13,
        color: c.text,
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'all 200ms ease',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{c.icon}</span>
      <span style={{ flex: 1 }}>{item.message}</span>
    </div>
  );
}
