/**
 * TodayProcessingHero · v1.8.0 主动判断加工系统
 *
 * v1.8.4 重做：对话框有产品感，不是 demo
 *
 * 设计原则（按 Vincent 2026-06-29 反馈）：
 * - 第一屏只凸显大输入框（最重要的动作）
 * - 但对话框**必须有质感**，不能像个空 demo
 * - 加智能提示（顶部小问句）
 * - 加快速模板小气泡（3-4 个：项目复盘 / 客户对话 / 读书摘录 / 个人反思）
 * - 加行内来源小图标（不是 4 入口卡片）
 * - 加底部"用过都说"的小数据（社交证明）
 * - 看板全部移到 /insights
 */

'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Candidate {
  id: string;
  title: string;
  statement: string;
  scoreTotal: number;
  recommendedAction: 'process' | 'candidate' | 'signal' | 'ignore';
  reasoning: string;
  breakdown: {
    clear: number; evidence: number; contrarian: number; reusable: number;
    output: number; kernel: number; novelty: number;
  };
  topics: string[];
  scenarios: string[];
  createdAt: number;
  evidenceType: string[];
}

interface Props {
  candidates: Candidate[];
  llmEnabled: boolean;
  totalCount: number;
}

const QUICK_TEMPLATES = [
  { icon: '📋', label: '项目复盘', text: '今天这个项目复盘下来，我有 3 个观察：\n\n1. \n2. \n3. \n\n最让我意外的是：' },
  { icon: '💬', label: '客户对话', text: '今天拜访客户，他提了一个有意思的判断：\n\n" "\n\n这让我意识到：' },
  { icon: '📖', label: '读书摘录', text: '刚读到一个让我停下来的段落：\n\n" "\n\n如果只能记住一句话，应该是：' },
  { icon: '💡', label: '个人反思', text: '今天我反思：\n\n' },
];

const SOURCE_HINTS = [
  { icon: '💬', label: '粘贴', desc: '聊天 / 笔记' },
  { icon: '📎', label: '.md', desc: '上传文件' },
  { icon: '🤖', label: 'OpenClaw', desc: '1152 张知识卡', href: '/inbox' },
  { icon: '📥', label: '收集箱', desc: '未整理素材', href: '/inbox' },
];

export function TodayProcessingHero({ candidates, llmEnabled, totalCount }: Props) {
  const router = useRouter();
  const [material, setMaterial] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!material.trim()) {
      setError('素材不能为空');
      return;
    }
    if (material.trim().length < 5) {
      setError('素材太短（至少 5 字符）');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/materials/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: material.trim(), source: 'manual' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || '提交失败');
        return;
      }
      setMaterial('');
      router.push('/candidates');
    } catch (e: any) {
      setError(e.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setMaterial(text);
    setError(null);
  };

  const fillTemplate = (text: string) => {
    setMaterial(text);
    setError(null);
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* 顶部 · 智能提示 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            今天你想记录什么？
          </h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            粘贴笔记、聊天记录、项目复盘——AI 帮你挑出最值得沉淀的判断。
          </p>
        </div>
        <Link
          href="/demo"
          style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 4,
            background: 'transparent', color: 'var(--primary)',
            border: '1px solid var(--primary)', textDecoration: 'none', flexShrink: 0,
          }}
        >
          走一遍 Demo →
        </Link>
      </div>

      {/* 大输入框（主角，220px 高度） */}
      <div
        className="card"
        style={{
          padding: 0,
          marginBottom: 12,
          borderColor: '#ea580c',
          borderWidth: 1,
          overflow: 'hidden',
        }}
      >
        <textarea
          value={material}
          onChange={(e) => { setMaterial(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="粘贴笔记、聊天记录、项目复盘、读书摘录……"
          style={{
            width: '100%',
            minHeight: 220,
            padding: 20,
            fontSize: 15,
            lineHeight: 1.7,
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            background: 'white',
            color: 'var(--ink)',
          }}
          disabled={submitting}
          autoFocus
        />
        {error && (
          <div style={{ padding: '0 20px 8px', fontSize: 12, color: '#dc2626' }}>{error}</div>
        )}

        {/* 底部操作行 */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderTop: '1px solid var(--line)',
            background: 'var(--bg-subtle)',
            flexWrap: 'wrap', gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{material.length} 字</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>⌘/Ctrl + Enter 提交</span>
            {!llmEnabled && (
              <>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>·</span>
                <span style={{ fontSize: 11, color: '#d97706' }}>⚠ LLM 未配置</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-sm"
              style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--text-2)' }}
              disabled={submitting}
            >
              📎 上传 .md
            </button>
            <button
              onClick={handleSubmit}
              className="btn btn-sm"
              style={{
                background: llmEnabled ? 'var(--accent)' : 'var(--text-3)',
                color: 'white', borderColor: 'transparent',
                fontWeight: 500, padding: '6px 18px',
              }}
              disabled={submitting || !llmEnabled || !material.trim()}
            >
              {submitting ? '✨ 提炼中...' : '✨ 提炼成候选判断'}
            </button>
          </div>
        </div>
      </div>

      {/* 4 行内来源小图标 + 4 快速模板（让对话框不孤零零） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>也可以从：</span>
        {SOURCE_HINTS.map(s => {
          const inner = (
            <>
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{s.desc}</span>
            </>
          );
          const style: React.CSSProperties = {
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 14,
            background: 'var(--bg-subtle)', border: '1px solid var(--line)',
            fontSize: 12, textDecoration: 'none', cursor: 'pointer',
          };
          return s.href ? (
            <Link key={s.label} href={s.href} style={style}>{inner}</Link>
          ) : (
            <button
              key={s.label}
              onClick={() => {
                if (s.label === '.md') fileInputRef.current?.click();
              }}
              style={{ ...style, border: 'none' }}
            >
              {inner}
            </button>
          );
        })}
      </div>

      {/* 4 快速模板小气泡 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>💡 不知道写什么？从模板开始</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {QUICK_TEMPLATES.map(t => (
            <button
              key={t.label}
              onClick={() => fillTemplate(t.text)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 16,
                background: 'white', border: '1px solid var(--line)',
                fontSize: 12, color: 'var(--text-2)', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ea580c'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)'; }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5 候选精简卡（推荐加工，移到下面） */}
      {candidates.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              🎯 推荐加工
              <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                {totalCount > 5 ? `显示前 5 / 共 ${totalCount}` : `共 ${totalCount}`}
              </span>
            </h2>
            <Link href="/candidates" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>
              查看全部 →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidates.slice(0, 5).map(c => (
              <CandidateCard
                key={c.id}
                candidate={c}
                expanded={expandedScoreId === c.id}
                onToggle={() => setExpandedScoreId(expandedScoreId === c.id ? null : c.id)}
                onProcess={() => router.push(`/candidates/${c.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {candidates.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-3)', fontSize: 13 }}>
          粘贴素材后，AI 提炼的候选会出现在这里。
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate: c, expanded, onToggle, onProcess,
}: {
  candidate: Candidate; expanded: boolean; onToggle: () => void; onProcess: () => void;
}) {
  const style = actionStyle(c.recommendedAction);
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
          background: style.bg, color: style.color, border: `2px solid ${style.border}`,
          flexShrink: 0,
        }}>
          {c.scoreTotal}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.title}
            </div>
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 3,
              background: style.bg, color: style.color, fontWeight: 500, flexShrink: 0,
            }}>
              {actionLabel(c.recommendedAction)}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, margin: 0, marginBottom: 6 }}>
            {c.statement}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
            {c.reasoning}
          </p>
          {c.topics.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {c.topics.slice(0, 3).map(t => (
                <span key={t} style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3,
                  background: 'var(--bg-subtle)', color: 'var(--text-3)',
                }}>{t}</span>
              ))}
              {c.scenarios.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  · 可用于 {c.scenarios.slice(0, 2).join(' / ')}
                </span>
              )}
            </div>
          )}
          <button
            onClick={onToggle}
            style={{
              marginTop: 8, fontSize: 11, color: 'var(--text-3)',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            {expanded ? '▾ 收起评分' : '▸ 为什么推荐这条？'}
          </button>
          {expanded && (
            <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-subtle)', borderRadius: 6 }}>
              <ScoreBreakdown breakdown={c.breakdown} />
            </div>
          )}
        </div>
        <button
          onClick={onProcess}
          className="btn btn-sm"
          style={{
            background: 'var(--primary)', color: 'white', borderColor: 'transparent',
            fontSize: 12, padding: '6px 14px', flexShrink: 0, fontWeight: 500,
          }}
        >
          加工 →
        </button>
      </div>
    </div>
  );
}

function ScoreBreakdown({ breakdown: b }: { breakdown: Candidate['breakdown'] }) {
  const items: Array<[string, number, number]> = [
    ['判断清晰度', b.clear, 20],
    ['证据强度', b.evidence, 20],
    ['反常识', b.contrarian, 15],
    ['可复用', b.reusable, 15],
    ['输出潜力', b.output, 15],
    ['方法论相关', b.kernel, 10],
    ['新颖度', b.novelty, 5],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(([label, score, weight]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          <span style={{ color: 'var(--text-3)', minWidth: 70 }}>{label}</span>
          <div style={{ flex: 1, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${score * 100}%`, height: '100%',
              background: score >= 0.7 ? '#16a34a' : score >= 0.4 ? '#d97706' : '#dc2626',
            }} />
          </div>
          <span style={{
            color: 'var(--text-2)', minWidth: 50, textAlign: 'right',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {(score * weight).toFixed(1)}/{weight}
          </span>
        </div>
      ))}
    </div>
  );
}

function actionStyle(action: Candidate['recommendedAction']) {
  switch (action) {
    case 'process': return { bg: '#f0fdf4', color: '#16a34a', border: '#16a34a' };
    case 'candidate': return { bg: '#fffbeb', color: '#d97706', border: '#d97706' };
    case 'signal': return { bg: '#fef2f2', color: '#dc2626', border: '#dc2626' };
    default: return { bg: '#f1f5f9', color: '#94a3b8', border: '#cbd5e1' };
  }
}

function actionLabel(action: Candidate['recommendedAction']): string {
  switch (action) {
    case 'process': return '建议加工';
    case 'candidate': return '候选判断';
    case 'signal': return '素材信号';
    default: return '忽略';
  }
}