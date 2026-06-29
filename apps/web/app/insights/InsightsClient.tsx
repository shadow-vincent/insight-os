/**
 * InsightsClient · v1.8.4 仪表盘看板
 *
 * 精简版：不堆砌，每 section 1-2 行内
 *
 * 按 v3 评价 + Vincent 2026-06-29 反馈：
 * - 看板要保留（不是砍掉）
 * - 但每个 section 精简（8-10 行内）
 * - 突出"用户最常看"：4 统计 + 写作复盘 + 主题分布
 * - 弱化次要：证据等级 / 最近活动
 */

'use client';

import Link from 'next/link';

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

const EVIDENCE_LABEL: Record<string, string> = {
  E0: '观点', E1: '类比', E2: '案例', E3: '共鸣', E4: '落地', E5: '复用',
};
const EVIDENCE_COLORS: Record<string, string> = {
  E0: '#94a3b8', E1: '#60a5fa', E2: '#22c55e', E3: '#10b981', E4: '#a78bfa', E5: '#ec4899',
};
const TYPE_LABEL: Record<string, string> = {
  talk_script: '话术', article_outline: '大纲', writing: '长文',
  speech: '演讲', book_note: '读书', email: '邮件',
};

export function InsightsClient({
  llmEnabled, stats, evidenceDist, topicDist, writingRecap, recentAssets, recentOutputs,
}: {
  llmEnabled: boolean;
  stats: Stats;
  evidenceDist: EvidenceBucket[];
  topicDist: TopicBucket[];
  writingRecap: {
    monthWritingCount: number;
    monthAssetCount: number;
    topCores: Array<{ id: string; title: string; refCount: number; evidenceLevel: string }>;
  };
  recentAssets: RecentAsset[];
  recentOutputs: RecentOutput[];
}) {
  const e2PlusRatio = stats.totalAssets > 0
    ? Math.round((stats.e2Count / stats.totalAssets) * 100)
    : 0;
  const totalEvidence = evidenceDist.reduce((s, d) => s + d.count, 0);

  return (
    <div className="page-container">
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">仪表盘</h1>
        <p className="page-subtitle">
          你的判断资产、写作复盘、主题分布。每日加工见首页对话框。
        </p>
      </div>

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

      {/* 4 统计 · 精简版（一行） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard num={stats.totalAssets} label="资产" trend={`+${stats.totalAssets > 0 ? Math.round(stats.inUseCount / stats.totalAssets * 100) : 0}%`} trendTone="info" />
        <StatCard num={stats.inUseCount} label="在用" trend={`${stats.totalAssets > 0 ? Math.round(stats.inUseCount / stats.totalAssets * 100) : 0}%`} trendTone="success" />
        <StatCard num={stats.e2Count} label="E2+" trend={e2PlusRatio > 50 ? '高' : e2PlusRatio > 20 ? '中' : '低'} trendTone={e2PlusRatio > 50 ? 'success' : 'info'} />
        <StatCard num={stats.candidateCount} label="候选" trend={stats.candidateCount > 0 ? '需关注' : '已清空'} trendTone={stats.candidateCount > 0 ? 'warning' : 'muted'} />
      </div>

      {/* 写作复盘 + 主题分布 · 两列 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* 写作复盘 */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>📊 写作复盘 · 过去 30 天</h2>
            <Link href="/output" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>全部输出 →</Link>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <BigNum num={writingRecap.monthWritingCount} label="篇写作" />
            <BigNum num={writingRecap.monthAssetCount} label="次引用" />
          </div>
          {writingRecap.topCores.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                反复引用的真核心 (≥2 次)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {writingRecap.topCores.map(c => (
                  <Link
                    key={c.id}
                    href={`/assets/${c.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                      color: 'var(--text-2)', textDecoration: 'none', padding: '4px 0',
                    }}
                  >
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 600,
                      fontFamily: 'JetBrains Mono, monospace',
                      background: EVIDENCE_COLORS[c.evidenceLevel] ?? '#94a3b8', color: 'white',
                    }}>{c.evidenceLevel}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 11 }}>×{c.refCount}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 主题分布 */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>📚 主题分布</h2>
            <Link href="/topics" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>查看 →</Link>
          </div>
          {topicDist.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>
              还没有主题
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {topicDist.map(t => (
                <Link
                  key={t.slug}
                  href={`/topics/${t.slug}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 16,
                    background: 'var(--bg-subtle)', color: 'var(--text-2)',
                    fontSize: 12, textDecoration: 'none',
                  }}
                >
                  <span>{t.name}</span>
                  <span style={{ color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>{t.count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 证据等级 + 最近活动 · 两列（折叠态） */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 证据等级分布（精简） */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>📈 证据等级</h2>
          {evidenceDist.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>暂无</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evidenceDist.map(d => {
                const pct = totalEvidence > 0 ? Math.round((d.count / totalEvidence) * 100) : 0;
                return (
                  <div key={d.level} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 600, minWidth: 36, textAlign: 'center',
                      fontFamily: 'JetBrains Mono, monospace',
                      background: EVIDENCE_COLORS[d.level] ?? '#94a3b8', color: 'white',
                    }}>{d.level}</span>
                    <span style={{ color: 'var(--text-3)', minWidth: 40 }}>{EVIDENCE_LABEL[d.level] ?? d.level}</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: EVIDENCE_COLORS[d.level] ?? '#94a3b8' }} />
                    </div>
                    <span style={{ color: 'var(--text-2)', minWidth: 32, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{d.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 最近更新 */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>🕐 最近更新</h2>
            <Link href="/assets" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>全部 →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentAssets.slice(0, 5).map(a => (
              <Link
                key={a.id}
                href={`/assets/${a.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                  color: 'var(--text-2)', textDecoration: 'none', padding: '4px 0',
                }}
              >
                <span style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 600, minWidth: 32, textAlign: 'center',
                  fontFamily: 'JetBrains Mono, monospace',
                  background: EVIDENCE_COLORS[a.evidenceLevel] ?? '#94a3b8', color: 'white',
                }}>{a.evidenceLevel}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{a.priority}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ num, label, trend, trendTone }: {
  num: number; label: string; trend: string;
  trendTone: 'success' | 'info' | 'warning' | 'muted';
}) {
  const trendBg: Record<string, string> = {
    success: '#f0fdf4', info: '#eff6ff', warning: '#fef3c7', muted: '#f1f5f9',
  };
  const trendColor: Record<string, string> = {
    success: '#16a34a', info: '#1d4ed8', warning: '#d97706', muted: '#64748b',
  };
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
        {num}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
        <span style={{
          fontSize: 11, padding: '2px 6px', borderRadius: 3,
          background: trendBg[trendTone], color: trendColor[trendTone], fontWeight: 500,
        }}>{trend}</span>
      </div>
    </div>
  );
}

function BigNum({ num, label }: { num: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
        {num}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}