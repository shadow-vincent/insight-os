'use client';

/**
 * /insights/weekly — Weekly Reflection 报告（V1.6 加自动生成 + 缓存）
 *
 * 流程：
 * - localStorage 缓存上次生成的报告（7 天内不重新计算）
 * - "✨ 重新生成本周报告" 按钮：手动触发
 * - 顶部显示"上次生成于 X · 距今 Y 天 · Z 天后过期"
 * - 每周一 09:00 在 dashboard banner 提醒（client-side schedule）
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WeeklyReport {
  ok: boolean;
  weekRange: { start: string; end: string };
  summary: {
    assetsNew: number;
    feedbackNew: number;
    outputsNew: number;
    kernelsNew: number;
    totalAssets: number;
    totalKernels: number;
    totalOutputs: number;
    totalFeedback: number;
  };
  newAssets: Array<{ id: string; title: string; evidenceLevel: string; insight: string | null }>;
  topFeedback: Array<{ id: string; assetId: string; scene: string; reaction: string | null; mostTouchedPoint: string | null; followUpQuestions: string | null }>;
  newOutputs: Array<{ id: string; title: string; outputType: string; writingStatus: string | null }>;
  staleKernels: Array<{ id: string; category: string; content: string; confidence: number; lastVerifiedAt: number | null; daysSinceVerify: number | null }>;
  topKernels: Array<{ id: string; category: string; content: string; confidence: number; referencedCount: number }>;
}

const CACHE_KEY = 'insight-weekly-report-v1';
const CACHE_DAYS = 7;

interface CachedReport {
  report: WeeklyReport;
  generatedAt: number;  // unix seconds
}

export default function WeeklyReflectionPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      // 1) 读 localStorage
      const cached = readCache();
      if (cached && !isStale(cached)) {
        setReport(cached.report);
        setGeneratedAt(cached.generatedAt);
        setLoading(false);
        return;
      }
      // 2) 缓存失效 / 不存在 → 重新生成
      await generate(false);
    } finally {
      setLoading(false);
    }
  };

  const generate = async (showLoading = true) => {
    if (showLoading) setGenerating(true);
    try {
      const res = await fetch('/api/insights/weekly');
      const data = await res.json();
      if (data.ok) {
        setReport(data);
        const now = Math.floor(Date.now() / 1000);
        setGeneratedAt(now);
        writeCache({ report: data, generatedAt: now });
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setGenerating(false);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>⏳ 加载中…</div>;
  if (!report) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>暂无数据</div>;

  const s = report.summary;
  const weekEmpty = s.assetsNew === 0 && s.feedbackNew === 0 && s.outputsNew === 0;
  const daysAgo = generatedAt ? Math.floor((Date.now() / 1000 - generatedAt) / 86400) : null;
  const daysToStale = daysAgo !== null ? Math.max(0, CACHE_DAYS - daysAgo) : 0;
  const isMonday = new Date().getDay() === 1;
  const isStaleCached = daysAgo !== null && daysAgo >= CACHE_DAYS;

  return (
    <div style={{ maxWidth: 880 }}>
      <h1 className="page-title">📊 本周回顾</h1>
      <p className="page-subtitle">
        {new Date(report.weekRange.start).toLocaleDateString('zh-CN')} ~ {new Date(report.weekRange.end).toLocaleDateString('zh-CN')} · 7 天活动汇总
      </p>

      {/* 缓存状态 + 重新生成 */}
      <div className="card" style={{
        padding: 14, marginBottom: 16,
        background: isStaleCached ? 'var(--warning-bg)' : 'var(--bg-subtle)',
        border: isStaleCached ? '1px solid var(--warning)' : '1px solid var(--line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>
            {generatedAt ? (
              <>
                <span style={{ color: 'var(--text-3)' }}>上次生成：</span>
                <strong>{new Date(generatedAt * 1000).toLocaleString('zh-CN')}</strong>
                <span style={{ color: 'var(--text-3)' }}> · {daysAgo === 0 ? '今天' : `${daysAgo} 天前`}</span>
                {isStaleCached ? (
                  <span style={{ color: 'var(--warning)', marginLeft: 8, fontWeight: 600 }}>
                    ⚠️ 缓存已过期
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>
                    · {daysToStale} 天后过期
                  </span>
                )}
              </>
            ) : (
              <span>未生成</span>
            )}
            {isMonday && !isStaleCached && (
              <span style={{ marginLeft: 12, padding: '2px 8px', background: 'var(--primary-soft)', color: 'var(--primary)', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                📅 周一提醒：建议刷新一下
              </span>
            )}
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => generate(true)}
            disabled={generating}
          >
            {generating ? '生成中…' : '✨ 重新生成本周报告'}
          </button>
        </div>
      </div>

      {/* 数据汇总 */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>📈 数据</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: '新资产', value: s.assetsNew, total: s.totalAssets, color: 'var(--primary)' },
            { label: '新反馈', value: s.feedbackNew, total: s.totalFeedback, color: 'var(--accent)' },
            { label: '新输出', value: s.outputsNew, total: s.totalOutputs, color: 'var(--success)' },
            { label: '新 Kernel', value: s.kernelsNew, total: s.totalKernels, color: 'var(--warning)' },
          ].map(m => (
            <div key={m.label} style={{
              padding: 14, background: 'var(--bg-subtle)', borderRadius: 8,
              borderTop: `3px solid ${m.color}`, textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{m.label}（共 {m.total}）</div>
            </div>
          ))}
        </div>
        {weekEmpty && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--warning-bg)', borderRadius: 6, fontSize: 13, color: 'var(--text-2)' }}>
            本周没新活动 —— 是不是该花 30 分钟沉淀一条新资产？
          </div>
        )}
      </div>

      {/* 待验证 Kernel */}
      {report.staleKernels.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 16, borderLeft: '3px solid var(--warning)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
            ⏰ 待验证 Kernel <span style={{ fontSize: 12, color: 'var(--text-3)' }}>（{report.staleKernels.length} 条 30 天没动）</span>
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px' }}>
            这些 Kernel 太久没复盘了 —— 要不要想想"还成立吗？"
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.staleKernels.map(k => (
              <div key={k.id} style={{
                padding: 12, background: 'var(--bg-subtle)', borderRadius: 6,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 8,
                  background: 'var(--warning-bg)', color: 'var(--warning)',
                  fontWeight: 600, flexShrink: 0,
                }}>
                  {k.daysSinceVerify === null ? '从未验证' : `${k.daysSinceVerify} 天前`}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{k.content}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {k.category} · 置信度 {k.confidence}% · 引用 {k.referencedCount} 次
                  </div>
                </div>
                <Link href="/settings/kernel" className="btn btn-sm">✓ 复盘</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Kernel */}
      {report.topKernels.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>🏆 被引用最多</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px' }}>这些是你最常被 LLM 调用的判断</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.topKernels.map((k, i) => (
              <div key={k.id} style={{
                padding: 12, background: 'var(--bg-subtle)', borderRadius: 6,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  fontSize: 16, fontWeight: 700, color: 'var(--primary)',
                  width: 24, textAlign: 'center', flexShrink: 0,
                }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{k.content}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {k.category} · 置信度 {k.confidence}% · 引用 {k.referencedCount} 次
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 本周新资产 */}
      {report.newAssets.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>
            ✨ 本周新资产 <span style={{ fontSize: 12, color: 'var(--text-3)' }}>（{report.newAssets.length}）</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.newAssets.map(a => (
              <Link key={a.id} href={`/assets/${a.id}`} style={{
                padding: 12, background: 'var(--bg-subtle)', borderRadius: 6,
                textDecoration: 'none', color: 'inherit', display: 'block',
                border: '1px solid var(--line-soft)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 6,
                    background: 'var(--primary-soft)', color: 'var(--primary)',
                    fontWeight: 600, flexShrink: 0,
                  }}>{a.evidenceLevel}</span>
                  <div style={{ fontSize: 13, color: 'var(--ink)', flex: 1, fontWeight: 500 }}>{a.title}</div>
                </div>
                {a.insight && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>
                    💡 {a.insight}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 本周最触动反馈 */}
      {report.topFeedback.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>💬 本周最触动反馈</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px' }}>这些反馈最值得复盘</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {report.topFeedback.map(f => (
              <div key={f.id} style={{
                padding: 14, background: 'var(--bg-subtle)', borderRadius: 6,
                borderLeft: '3px solid var(--primary)',
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 6 }}>
                  "{f.reaction}"
                </div>
                {f.mostTouchedPoint && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    ✨ 最触动点：<span style={{ color: 'var(--ink)' }}>{f.mostTouchedPoint}</span>
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6 }}>
                  <Link href={`/assets/${f.assetId}`} style={{ color: 'var(--primary)' }}>查看资产 →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, background: 'var(--primary-soft)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)' }}>
        💡 <strong>Weekly Reflection</strong> 的核心不是"看你做了多少"，是"看你想得对不对"。
        {isMonday && <><br />📅 今天周一 —— 强烈建议刷新一次本周报告，看看过去 7 天你的判断质量。</>}
      </div>
    </div>
  );
}

function readCache(): CachedReport | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedReport;
  } catch { return null; }
}

function writeCache(c: CachedReport) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* quota */ }
}

function isStale(c: CachedReport): boolean {
  const daysAgo = Math.floor((Date.now() / 1000 - c.generatedAt) / 86400);
  return daysAgo >= CACHE_DAYS;
}
