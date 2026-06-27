'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDailyLoop } from './useDailyLoop';
import { useToast } from './ToastProvider';

interface Step {
  idx: 0 | 1 | 2 | 3;
  icon: string;
  title: string;
  sub: string;
  href: string;
  color: string;
}

const STEPS: Step[] = [
  {
    idx: 0,
    icon: '📥',
    title: '扔进 1 条观察',
    sub: '今天看到的、听到的、想到的',
    href: '/inbox',
    color: '#6366f1',
  },
  {
    idx: 1,
    icon: '🎯',
    title: '校准 1 张候选卡',
    sub: '候选池里挑一张升级 / 改证据等级',
    href: '/candidates',
    color: '#f59e0b',
  },
  {
    idx: 2,
    icon: '✍️',
    title: '输出 1 个可用片段',
    sub: '基于资产写一段话 / 文章 / 方案',
    href: '/writing/new',
    color: '#10b981',
  },
  {
    idx: 3,
    icon: '💬',
    title: '记录 1 条反馈',
    sub: '客户/同事/读者的反应',
    href: '/output',
    color: '#f43f5e',
  },
];

/**
 * v1.6: 今日 10 分钟 4 步（最小日常动作）
 *
 * 替换 V1.6 #1 的"3 栏待办"，更明确的"daily loop"
 */
export default function DailyLoopCard() {
  const router = useRouter();
  const toast = useToast();
  const { state, markDone, reset, completedCount, allDone, hydrated } = useDailyLoop();

  // hydration 之前不渲染（避免 server/client mismatch）
  if (!hydrated) {
    return (
      <div style={{
        height: 220,
        background: 'var(--bg-subtle)',
        borderRadius: 12,
        border: '1px solid var(--line)',
      }} />
    );
  }

  const handleStepClick = (step: Step) => {
    markDone(step.idx);
    toast.success(`✓ ${step.title} 已标记完成`);
    router.push(step.href);
  };

  // 全部完成 → 庆祝页
  if (allDone) {
    return (
      <div style={{
        padding: '32px 28px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(168,85,247,0.10) 100%)',
        border: '2px solid rgba(99,102,241,0.30)',
        borderRadius: 12,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0, marginBottom: 8 }}>
          今天的 4 步全部完成！
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, marginBottom: 20, lineHeight: 1.6 }}>
          你刚刚做了<strong style={{ color: 'var(--primary)' }}> 1 条观察 + 1 次校准 + 1 个输出 + 1 条反馈</strong>。
          <br />
          明天见 👋（或在 <Link href="/insights/weekly" style={{ color: 'var(--primary)' }}>周报</Link> 看趋势）
        </p>
        <button
          onClick={() => {
            if (confirm('重新开始今天的 4 步？')) reset();
          }}
          style={{
            background: 'transparent',
            border: '1px solid var(--line)',
            color: 'var(--text-3)',
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ↻ 重新开始
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px 28px',
      background: 'var(--bg-panel)',
      border: '1.5px solid var(--line)',
      borderRadius: 12,
      marginBottom: 24,
    }}>
      {/* 顶部：标题 + 进度 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
          🎯 今日 10 分钟 4 步
        </h2>
        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>
          今天完成 <strong style={{ color: 'var(--primary)' }}>{completedCount} / 4</strong> 步
        </span>
        <span style={{ flex: 1 }} />
        <Link
          href="/insights/weekly"
          style={{ fontSize: 11, color: 'var(--text-3)', textDecoration: 'none' }}
        >
          看周报 →
        </Link>
      </div>

      {/* 进度条 */}
      <div style={{
        height: 6,
        background: 'var(--bg-subtle)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        <div style={{
          height: '100%',
          width: `${(completedCount / 4) * 100}%`,
          background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* 4 步卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 10,
      }}>
        {STEPS.map((step) => {
          const done = state.steps[step.idx];
          return (
            <button
              key={step.idx}
              onClick={() => handleStepClick(step)}
              disabled={done}
              style={{
                padding: '14px 16px',
                background: done ? step.color + '10' : 'var(--bg-subtle)',
                border: done ? `1.5px solid ${step.color}` : '1px solid var(--line)',
                borderRadius: 10,
                textAlign: 'left',
                cursor: done ? 'default' : 'pointer',
                opacity: done ? 0.85 : 1,
                transition: 'all 0.15s',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!done) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = `0 4px 12px ${step.color}20`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: done ? step.color : 'var(--bg-panel)',
                  color: done ? 'white' : 'var(--text-3)',
                  border: done ? 'none' : '1.5px solid var(--line-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {done ? '✓' : step.idx + 1}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: done ? step.color : 'var(--ink)' }}>
                  {step.title}
                </span>
              </div>
              <div style={{
                fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5,
                paddingLeft: 32,
              }}>
                {done ? '✓ 今天已完成' : step.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* 底部提示 */}
      <p style={{
        fontSize: 11, color: 'var(--text-3)',
        marginTop: 14, marginBottom: 0, lineHeight: 1.6,
      }}>
        💡 点 CTA = 「我承诺做」= 自动标记完成。每天 0 点进度自动重置。
        完成 4 步解锁 🎉 庆祝页。
      </p>
    </div>
  );
}