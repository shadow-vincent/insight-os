'use client';

import Link from 'next/link';

const DOCS = [
  {
    href: '/docs/quickstart',
    icon: '⚡',
    title: '5 分钟上手',
    subtitle: 'Quickstart',
    desc: '装入示例数据 → 写第一篇文章 → 看你的判断力资产。看完能完整跑一遍产品。',
    time: '5 分钟',
    color: '#1d4ed8',
    bg: 'linear-gradient(135deg, rgba(29,78,216,0.06), rgba(2,132,199,0.04))',
  },
  {
    href: '/docs/concepts',
    icon: '💡',
    title: '核心概念',
    subtitle: 'Concepts',
    desc: '资产卡 vs 轻量卡 vs 内核卡 / 主题分类 / 工作流状态 / E0-E5 证据等级。一遍读懂产品结构。',
    time: '8 分钟',
    color: '#1f5d4c',
    bg: 'linear-gradient(135deg, rgba(31,93,76,0.06), rgba(245,158,11,0.04))',
  },
  {
    href: '/docs/insight-kernel',
    icon: '🧠',
    title: 'Insight Kernel',
    subtitle: 'v1.4 新功能',
    desc: '4 类 × 4 字段 × 3 机制。理解你的「判断宪法」怎么自动注入所有 LLM 调用。',
    time: '10 分钟',
    color: '#6366f1',
    bg: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(244,63,94,0.04))',
    badge: '推荐',
  },
  {
    href: '/docs/architecture',
    icon: '🏗️',
    title: '架构与业务流',
    subtitle: 'Architecture',
    desc: '3 步业务循环 + 数据流转 + 4 层架构 + 19 个 Insight Kernel 注入点。一张图看清产品。',
    time: '3 分钟',
    color: '#c97b3f',
    bg: 'linear-gradient(135deg, rgba(201,123,63,0.06), rgba(47,111,94,0.04))',
  },
  {
    href: '/docs/faq',
    icon: '❓',
    title: 'FAQ + 故障排查',
    subtitle: 'Help',
    desc: 'Mac Gatekeeper 警告怎么办 / dev 模式 ABI 错 / LLM 没配能用吗 / 数据存哪里 / 如何备份。',
    time: '按需',
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(244,63,94,0.04))',
  },
];

const HIGHLIGHTS = [
  { icon: '🧠', text: '判断力工程化：把零散经验转化为可调用的资产' },
  { icon: '✍️', text: '写作工作流：1 句核心 + 3 张卡 = 完整骨架 + 改稿陪练' },
  { icon: '📊', text: '主题地图 + 资产图谱：可视化你的判断结构' },
  { icon: '💬', text: '洞察助手：用自然语言问「我有几张高等级卡」' },
];

export default function DocsHomePage() {
  return (
    <div style={{ maxWidth: 880 }}>
      {/* Hero */}
      <div style={{
        marginBottom: 32,
        padding: '28px 32px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(244,63,94,0.04), rgba(245,158,11,0.04))',
        borderRadius: 12,
        border: '1px solid var(--line-soft)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 6,
        }}>
          📖 操作手册
        </div>
        <h1 style={{
          fontSize: 30, fontWeight: 700, color: 'var(--ink)',
          margin: 0, lineHeight: 1.2, letterSpacing: '-0.02em',
        }}>
          学习 Insight Asset OS
        </h1>
        <p style={{
          fontSize: 15, color: 'var(--text-2)',
          marginTop: 12, lineHeight: 1.7, maxWidth: 640,
        }}>
          一个把零散经验转化为<strong>可调用、可输出、可验证、可进化</strong>的管理思想资产的产品。
          下面的指南帮你从「打开就是空页面」走到「知道自己要做什么」。
        </p>
        <div style={{
          marginTop: 16, fontSize: 13, color: 'var(--text-3)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
            v1.4.0
          </span>
          <span>·</span>
          <span>所有数据本地，不上云</span>
          <span>·</span>
          <span>任何 OpenAI 兼容 LLM 都支持</span>
        </div>
      </div>

      {/* 4 入口卡片 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14,
        marginBottom: 32,
      }}>
        {DOCS.map(d => (
          <Link
            key={d.href}
            href={d.href}
            style={{
              display: 'block', padding: 22,
              background: d.bg,
              border: '1px solid var(--line)',
              borderRadius: 10,
              textDecoration: 'none', color: 'inherit',
              position: 'relative',
              transition: 'all 160ms',
            }}
          >
            {d.badge && (
              <span style={{
                position: 'absolute', top: 14, right: 14,
                padding: '2px 8px', fontSize: 10, fontWeight: 700,
                background: d.color, color: 'white',
                borderRadius: 8,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {d.badge}
              </span>
            )}
            <div style={{ fontSize: 32, marginBottom: 10 }}>{d.icon}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {d.subtitle}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 2, marginBottom: 6 }}>
              {d.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              {d.desc}
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                ⏱ {d.time}
              </span>
              <span style={{ fontSize: 13, color: d.color, fontWeight: 600 }}>
                开始 →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* 核心特性回顾 */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>
          这个产品做什么
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {HIGHLIGHTS.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.6 }}>
              <span style={{ fontSize: 18 }}>{h.icon}</span>
              <span style={{ color: 'var(--text)' }}>{h.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 阅读路径建议 */}
      <div className="card" style={{ padding: 20, marginBottom: 24, background: 'var(--bg-subtle)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>
          🗺️ 建议阅读路径
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8 }}>
          <li><strong style={{ color: 'var(--ink)' }}>第一次用？</strong> → <Link href="/docs/quickstart" style={{ color: 'var(--primary)' }}>5 分钟上手</Link></li>
          <li><strong style={{ color: 'var(--ink)' }}>想 3 分钟看清产品长什么样？</strong> → <Link href="/docs/architecture" style={{ color: 'var(--primary)' }}>架构与业务流</Link></li>
          <li><strong style={{ color: 'var(--ink)' }}>想了解产品结构？</strong> → <Link href="/docs/concepts" style={{ color: 'var(--primary)' }}>核心概念</Link></li>
          <li><strong style={{ color: 'var(--ink)' }}>看到 V1.4 新功能不知道怎么用？</strong> → <Link href="/docs/insight-kernel" style={{ color: 'var(--primary)' }}>Insight Kernel 详解</Link></li>
          <li><strong style={{ color: 'var(--ink)' }}>出问题？</strong> → <Link href="/docs/faq" style={{ color: 'var(--primary)' }}>FAQ + 故障排查</Link></li>
        </ol>
      </div>

      {/* 反馈 */}
      <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
        操作手册仍有不清楚的地方？<br />
        在 GitHub 提 issue：<a href="https://github.com/shadow-vincent/insight-os/issues" style={{ color: 'var(--primary)' }}>shadow-vincent/insight-os</a>
      </div>
    </div>
  );
}
