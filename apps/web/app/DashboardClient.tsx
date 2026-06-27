'use client';

import Link from 'next/link';
import DailyLoopCard from '@/components/DailyLoopCard';

interface Stats {
  totalAssets: number;
  inUseCount: number;
  candidateCount: number;
  e2Count: number;
}

interface EvidenceBucket { level: string; count: number }
interface TopicBucket { name: string; slug: string; count: number }
interface RecentAsset {
  id: string;
  title: string;
  evidenceLevel: string;
  priority: string | null;
  oneSentenceInsight: string | null;
  updatedAt: number;
}
interface RecentOutput {
  id: string;
  title: string;
  outputType: string;
  createdAt: number;
  assetIdsJson: string;
}
interface RecentFeedback {
  id: string;
  assetId: string;
  reaction: string | null;
  evidenceLevelAfter: string | null;
  createdAt: number;
}

const TYPE_LABEL: Record<string, string> = {
  talk_script: '话术',
  article_outline: '大纲',
};

const EVIDENCE_LABEL: Record<string, string> = {
  E0: '观点', E1: '类比', E2: '案例', E3: '共鸣', E4: '落地', E5: '复用',
};

const EVIDENCE_COLORS: Record<string, string> = {
  E0: '#94a3b8',
  E1: '#60a5fa',
  E2: '#22c55e',
  E3: '#10b981',
  E4: 'var(--e4-color)',
  E5: '#a78bfa',
};

export function DashboardClient({
  llmEnabled, stats, evidenceDist, topicDist, todayTodos, writingRecap, recentAssets, recentOutputs, recentFeedback,
}: {
  llmEnabled: boolean;
  stats: Stats;
  evidenceDist: EvidenceBucket[];
  topicDist: TopicBucket[];
  todayTodos: {
    toCalibrate: { count: number; rows: Array<{ id: string; title: string; evidenceLevel: string; createdAt: number }> };
    staleAssets: { count: number; rows: Array<{ id: string; title: string; evidenceLevel: string; lastUsedAt: number | null }> };
    pendingFeedback: { count: number; rows: Array<{ id: string; title: string; outputType: string; createdAt: number }> };
  };
  writingRecap: {
    monthWritingCount: number;
    monthAssetCount: number;
    topCores: Array<{ id: string; title: string; refCount: number; evidenceLevel: string }>;
  };
  recentAssets: RecentAsset[];
  recentOutputs: RecentOutput[];
  recentFeedback: RecentFeedback[];
}) {
  const e2PlusRatio = stats.totalAssets > 0
    ? Math.round((stats.e2Count / stats.totalAssets) * 100)
    : 0;
  const totalEvidence = evidenceDist.reduce((s, d) => s + d.count, 0);
  const totalTopics = topicDist.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      {/* LLM 状态条 */}
      {!llmEnabled && (
        <div className="callout callout-accent" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1, fontSize: 14 }}>
            <strong>LLM 未配置</strong>
            <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>校准和输出生成功能暂不可用</span>
          </div>
          <Link href="/settings" className="btn btn-sm" style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }}>
            去设置 →
          </Link>
        </div>
      )}

      {/* Hero 区 */}
      <div className="dash-hero" style={{
        padding: '28px 32px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
        backgroundImage: 'radial-gradient(at 100% 0%, var(--primary-soft) 0%, transparent 60%)',
      }}>
        <h1 style={{
          fontSize: 26,
          fontWeight: 400,
          color: 'var(--ink)',
          margin: 0,
          lineHeight: 1.3,
          letterSpacing: '-0.005em',
        }}>
          你有 <em style={{ color: 'var(--primary)', fontStyle: 'normal', fontWeight: 600 }}>{stats.candidateCount} 张待校准</em>的洞察
          {stats.candidateCount > 0 && <>，建议尽快跑 <em style={{ color: 'var(--primary)', fontStyle: 'normal', fontWeight: 600 }}>12 章节升级</em></>}
        </h1>
        <div className="dash-hero-meta" style={{
          display: 'flex', alignItems: 'center', gap: 20,
          fontSize: 13, color: 'var(--text-3)',
          marginTop: 12,
        }}>
          <span>📚 资产 <strong style={{ color: 'var(--ink)' }}>{stats.totalAssets}</strong></span>
          <span>✅ 在用 <strong style={{ color: 'var(--ink)' }}>{stats.inUseCount}</strong></span>
          <span>🧪 候选 <strong style={{ color: 'var(--ink)' }}>{stats.candidateCount}</strong></span>
          <span>📈 E2+ 真实案例 <strong style={{ color: 'var(--ink)' }}>{stats.e2Count}</strong> · {e2PlusRatio}%</span>
          <span style={{ flex: 1 }} />
          <Link
            href="/writing/new"
            className="btn"
            style={{
              background: 'var(--primary)',
              color: 'white',
              borderColor: 'var(--primary)',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 18px',
              textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            ✍️ 开始写作
          </Link>
        </div>
      </div>

      {/* v1.6 六层提问法推荐卡 */}
      <Link
        href="/learn/six-layers"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '18px 24px',
          marginBottom: 24,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(168,85,247,0.10) 100%)',
          border: '1.5px solid rgba(99,102,241,0.25)',
          borderRadius: 12,
          textDecoration: 'none',
          color: 'var(--ink)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(99,102,241,0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{
          fontSize: 32,
          lineHeight: 1,
          flexShrink: 0,
        }}>
          🎯
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ink)',
            marginBottom: 4,
          }}>
            用 AI 之前先过 6 层：意图 / 背景 / 判断 / 约束 / 风格 / 反馈
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-2)',
            lineHeight: 1.5,
          }}>
            Vincent 原创方法论 · GPT 协助结构化 · 一键沉淀到你的 Insight Kernel
          </div>
        </div>
        <div style={{
          fontSize: 13,
          color: 'var(--primary)',
          fontWeight: 600,
          flexShrink: 0,
        }}>
          学一下 →
        </div>
      </Link>

      {/* v1.6 Daily Loop - 替换「3 栏待办」为「今日 10 分钟 4 步」 */}
      <DailyLoopCard />

      {/* 4 统计卡（带趋势） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard
          num={stats.totalAssets}
          label="资产卡总数"
          sublabel="OpenClaw 加工 + 本应用整理"
          trend="+活跃"
          trendTone="success"
        />
        <StatCard
          num={stats.inUseCount}
          label="在用"
          sublabel="已入库资产库"
          trend={`${stats.totalAssets > 0 ? Math.round(stats.inUseCount / stats.totalAssets * 100) : 0}%`}
          trendTone="info"
        />
        <StatCard
          num={stats.e2Count}
          label="E2+ 真实案例"
          sublabel="可用于客户场景"
          trend={e2PlusRatio > 50 ? '高' : e2PlusRatio > 20 ? '中' : '低'}
          trendTone={e2PlusRatio > 50 ? 'success' : e2PlusRatio > 20 ? 'info' : 'warning'}
        />
        <StatCard
          num={stats.candidateCount}
          label="待校准"
          sublabel="候选池轻量卡"
          trend={stats.candidateCount > 0 ? '需关注' : '已清空'}
          trendTone={stats.candidateCount > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* v0.10.4 写作复盘 */}
      <div className="card" style={{ padding: 0, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 20px',
          background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.04) 0%, rgba(2, 132, 199, 0.04) 100%)',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>📊 写作复盘</h2>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>过去 30 天</span>
          <span style={{ flex: 1 }} />
          <Link href="/output" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
            全部输出 →
          </Link>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'center' }}>
          {/* 数字摘要 */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
                {writingRecap.monthWritingCount}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>篇写作</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
                {writingRecap.monthAssetCount}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>张被引用卡</div>
            </div>
          </div>
          {/* top cores */}
          <div>
            {writingRecap.topCores.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 8 }}>
                {writingRecap.monthWritingCount === 0
                  ? '✍️ 本月还没写过东西，去 ' 
                  : '📚 还没被反复引用的卡（同一卡被 2+ 篇文章用）'}
                {writingRecap.monthWritingCount === 0 && (
                  <Link href="/writing/new" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                    写第一篇 →
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>
                  🏆 反复引用的真核心（≥2 次）
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {writingRecap.topCores.map(c => (
                    <Link
                      key={c.id}
                      href={`/assets/${c.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', textDecoration: 'none', color: 'inherit',
                        background: 'var(--bg-subtle)', borderRadius: 4,
                        borderLeft: '3px solid var(--primary)',
                      }}
                    >
                      <span className={`pill pill-${c.evidenceLevel.toLowerCase()}`} style={{ flexShrink: 0, fontSize: 10 }}>
                        {c.evidenceLevel}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>
                        ×{c.refCount}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 主体区：左侧证据分布 + 右侧主题热力 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 16,
        marginBottom: 24,
      }} className="dash-main-grid"
      >
        {/* 证据等级分布 */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>证据等级分布</h2>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>共 {totalEvidence} 张</span>
          </div>
          {totalEvidence === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
              暂无资产卡
            </div>
          ) : (
            <div className="ev-bars">
              {evidenceDist.sort((a, b) => a.level.localeCompare(b.level)).map(b => {
                const pct = totalEvidence > 0 ? (b.count / totalEvidence) * 100 : 0;
                return (
                  <div key={b.level} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      width: 32, fontSize: 12, fontWeight: 600,
                      color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace',
                    }}>{b.level}</span>
                    <span style={{ width: 32, fontSize: 11, color: 'var(--text-3)' }}>
                      {EVIDENCE_LABEL[b.level] || ''}
                    </span>
                    <div style={{ flex: 1, height: 18, background: 'var(--bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.max(pct, 3)}%`, height: '100%',
                        background: EVIDENCE_COLORS[b.level] || 'var(--primary)',
                        borderRadius: 4,
                        transition: 'width 600ms',
                      }} />
                    </div>
                    <span style={{
                      width: 32, fontSize: 12, fontWeight: 600,
                      color: 'var(--ink)', textAlign: 'right',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>{b.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 主题热力气泡 */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>主题分布</h2>
            <Link href="/map" style={{ fontSize: 11, color: 'var(--text-3)', textDecoration: 'none' }}>查看地图 →</Link>
          </div>
          {topicDist.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
              暂无主题数据
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {topicDist.slice(0, 12).map(t => {
                const size = Math.min(14, 11 + Math.log2(t.count + 1) * 2);
                return (
                  <Link
                    key={t.slug}
                    href={`/map#${t.slug}`}
                    style={{
                      fontSize: size,
                      padding: '5px 12px',
                      background: 'var(--primary-soft)',
                      color: 'var(--primary)',
                      borderRadius: 16,
                      textDecoration: 'none',
                      fontWeight: 500,
                      border: '1px solid var(--primary-line)',
                      transition: 'transform 120ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {t.name} <span style={{ opacity: 0.6, fontSize: size - 1 }}>{t.count}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 本周回顾卡片（v1.5 Weekly Reflection） */}
      <Link href="/insights/weekly" style={{
        display: 'block', marginBottom: 16, padding: '14px 20px',
        background: 'linear-gradient(135deg, var(--primary-soft) 0%, var(--bg-panel) 100%)',
        border: '1px solid var(--primary)', borderRadius: 10,
        textDecoration: 'none', color: 'inherit',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32 }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              本周回顾 · Weekly Reflection
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              看看这周你沉淀了什么 · 哪些 Kernel 该复盘了
            </div>
          </div>
          <span style={{ color: 'var(--primary)', fontSize: 18 }}>→</span>
        </div>
      </Link>

      {/* 最近更新 + 活动 feed */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 16,
      }} className="dash-main-grid"
      >
        {/* 最近更新 */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="card-title">最近更新</h2>
            <Link href="/assets" className="btn btn-sm btn-ghost">查看全部 →</Link>
          </div>
          <div>
            {recentAssets.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                暂无资产卡
              </div>
            ) : (
              recentAssets.slice(0, 6).map(a => {
                const date = new Date(a.updatedAt * 1000).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
                return (
                  <Link
                    key={a.id}
                    href={`/assets/${a.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 1fr auto auto',
                      gap: 12,
                      alignItems: 'center',
                      padding: '10px 20px',
                      borderTop: '1px solid var(--line-soft)',
                      textDecoration: 'none',
                      color: 'inherit',
                      fontSize: 13,
                    }}
                  >
                    <span className={`pill pill-${a.evidenceLevel.toLowerCase()}`} style={{ justifyContent: 'center', minWidth: 36 }}>
                      {a.evidenceLevel}
                    </span>
                    <span style={{ color: 'var(--ink)', fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.title}
                    </span>
                    {a.priority && (
                      <span className={`pill pill-priority-${a.priority.toLowerCase()}`} style={{ fontSize: 11 }}>{a.priority}</span>
                    )}
                    <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{date}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* 活动 feed */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header">
            <h2 className="card-title">最近活动</h2>
          </div>
          <div>
            {recentOutputs.length === 0 && recentFeedback.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                暂无活动
              </div>
            ) : (
              <>
                {recentOutputs.map(o => {
                  let assetCount = 1;
                  try { assetCount = JSON.parse(o.assetIdsJson).length; } catch {}
                  const date = new Date(o.createdAt * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={o.id} style={{
                      padding: '12px 20px',
                      borderTop: '1px solid var(--line-soft)',
                      fontSize: 13.5,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ color: 'var(--primary)' }}>📤</span>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{TYPE_LABEL[o.outputType] || o.outputType}</span>
                        {assetCount > 1 && <span style={{ color: 'var(--primary)', fontSize: 11, fontWeight: 600 }}>×{assetCount}</span>}
                        <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 11 }}>{date}</span>
                      </div>
                      <div style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>{o.title}</div>
                    </div>
                  );
                })}
                {recentFeedback.map(f => {
                  const date = new Date(f.createdAt * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={f.id} style={{
                      padding: '12px 20px',
                      borderTop: '1px solid var(--line-soft)',
                      fontSize: 13.5,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ color: 'var(--success)' }}>💬</span>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>反馈</span>
                        {f.evidenceLevelAfter && (
                          <span className={`pill pill-${f.evidenceLevelAfter.toLowerCase()}`} style={{ fontSize: 11 }}>{f.evidenceLevelAfter}</span>
                        )}
                        <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 11 }}>{date}</span>
                      </div>
                      <div style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {f.reaction || '(无具体反馈)'}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 响应式：窄屏单列 */}
      <style jsx>{`
        @media (max-width: 900px) {
          .dash-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  num, label, sublabel, trend, trendTone,
}: {
  num: number;
  label: string;
  sublabel?: string;
  trend?: string;
  trendTone?: 'success' | 'info' | 'warning' | 'error';
}) {
  const trendColor = trendTone === 'success' ? 'var(--success)'
    : trendTone === 'warning' ? 'var(--warning)'
    : trendTone === 'error' ? 'var(--danger)'
    : 'var(--primary)';
  return (
    <div className="card" style={{ padding: 16, position: 'relative' }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.015em' }}>
        {num}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, marginTop: 8 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sublabel}</div>}
      {trend && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          fontSize: 11, fontWeight: 600,
          color: trendColor, padding: '3px 9px',
          background: 'var(--bg-subtle)', borderRadius: 10,
        }}>{trend}</div>
      )}
    </div>
  );
}
