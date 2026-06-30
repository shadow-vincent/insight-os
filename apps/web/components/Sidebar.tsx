'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GlobalSearchModal } from './GlobalSearchModal';

// v1.8.0 主动判断加工系统 · 7 主导航
// 设计原则：每日工作流 2 / 判断资产 3 / 输出方法论 2
// 7 入口：V1.11.16 把"资产图谱"加回（V1.7 砍过但 Vincent 找不到，V1.11.16 复原）
const navItems = [
  { section: '每日工作流', href: '/', label: '今日加工', icon: 'today' },
  { section: '每日工作流', href: '/candidates', label: '候选判断', icon: 'candidates' },
  { section: '判断资产', href: '/assets', label: '判断资产', icon: 'assets' },
  { section: '判断资产', href: '/topics', label: '主题资产包', icon: 'topic' },
  { section: '判断资产', href: '/graph', label: '资产图谱', icon: 'graph' },
  { section: '输出与方法论', href: '/output', label: '输出包', icon: 'output' },
  { section: '输出与方法论', href: '/kernel', label: '我的方法论', icon: 'methodology' },
];

const icons: Record<string, React.ReactNode> = {
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  topic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  methodology: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 0-7 17l-1 4 4-1a10 10 0 1 0 4-20z" />
      <circle cx="9" cy="11" r="1" fill="currentColor" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <path d="M9 14h6" />
    </svg>
  ),
  writing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  candidates: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 10v6" />
      <path d="M4.22 4.22l4.24 4.24m7.07 7.07 4.24 4.24" />
      <path d="M1 12h6m10 0h6" />
      <path d="M4.22 19.78l4.24-4.24m7.07-7.07 4.24-4.24" />
    </svg>
  ),
  assets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  graph: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="6" y1="8.5" x2="6" y2="15.5" />
      <line x1="18" y1="8.5" x2="18" y2="15.5" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="8" y1="7" x2="16" y2="17" />
    </svg>
  ),
  output: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  campaign: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 5 4 4-11 11-4-4Z" />
      <path d="m14 6 4 4" />
      <path d="M3 21h6" />
      <path d="m9 9 3 3" />
    </svg>
  ),
};

export function Sidebar() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K 全局快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <aside className="sidebar">
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div className="sidebar-logo">
            <span className="sidebar-logo-dot">I</span>
            <span>Insight OS</span>
          </div>
        </Link>

        {/* 搜索按钮 */}
        <button
          onClick={() => setSearchOpen(true)}
          className="sidebar-search-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span>搜索资产</span>
          <kbd style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'var(--text-3)',
            background: 'white',
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid var(--line)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>⌘K</kbd>
        </button>

        {/* v1.8.0 按 section 分组渲染 */}
        {(() => {
          const grouped = new Map<string, typeof navItems>();
          for (const item of navItems) {
            const sec = item.section ?? '其他';
            if (!grouped.has(sec)) grouped.set(sec, []);
            grouped.get(sec)!.push(item);
          }
          const elements: React.ReactNode[] = [];
          for (const [section, items] of grouped) {
            elements.push(
              <div key={`sec-${section}`} className="sidebar-section">{section}</div>
            );
            for (const item of items) {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              elements.push(
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  {icons[item.icon]}
                  <span>{item.label}</span>
                </Link>
              );
            }
          }
          return elements;
        })()}

        <div className="sidebar-section">系统</div>
        <Link href="/insights" className={`nav-item ${pathname === '/insights' ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>仪表盘</span>
        </Link>
        <Link href="/docs" className={`nav-item ${pathname.startsWith('/docs') ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <span>操作手册</span>
        </Link>
        <Link href="/settings" className={`nav-item ${pathname.startsWith('/settings') ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a2 2 0 0 1-2.83-2.83l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>设置</span>
        </Link>
      </aside>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
