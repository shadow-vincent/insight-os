'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
} from 'd3-force';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// ==================== Types ====================
interface NodeData {
  id: string;
  title: string;
  evidenceLevel: string;
  priority: string;
  feedbackCount: number;
  topicCount: number;
  topicNames: string[];
  primaryTopic: string | null;
  color: string;
  relatedIds: string[];
  oneSentenceInsight: string | null;
  val: number;
}

interface GraphData {
  ok: boolean;
  nodes: NodeData[];
  links: { source: string; target: string }[];
  topics: { id: string; name: string; slug: string }[];
  stats: { nodeCount: number; edgeCount: number; topicCount: number };
}

// ==================== Theme (light, 跟 app shell 一致) ====================
const C = {
  bg: '#fafbfd',
  bgGrad: 'linear-gradient(180deg, #fafbfd 0%, #eef2f8 100%)',
  bgCard: '#ffffff',
  bgCard2: '#f5f7fb',
  line: '#e2e8f0',
  lineSoft: '#eceff5',
  ink: '#0f172a',
  ink2: '#334155',
  ink3: '#64748b',
  ink4: '#94a3b8',
};

// ==================== Helpers ====================
function shortTitle(title: string, max = 10): string {
  const clean = title
    .replace(/[，。！？、；：""''《》（）()\[\]【】\.,!?;:"'()\[\]·]/g, '')
    .trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean || '未命名';
}

// ==================== Main ====================
export default function GraphClient() {
  const router = useRouter();
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'pedigree' | 'overview'>('pedigree');
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  // V1.11.18: 双源（IDB + server SQLite）
  // - Vercel: IDB 唯一数据源（V1.10 IDB-first）
  // - 本地 dev 4191: 优先 server SQLite（Vincent 真实数据在 SQLite，未迁 IDB）→ fallback IDB
  useEffect(() => {
    (async () => {
      try {
        // 1) 先并发拿：IDB + server API
        const { getAssets, getAssetTopicsByAsset, getTopics, getRelatedAssets } = await import('@/lib/idb/operations');
        const [idbAssets, idbTopics, serverRes] = await Promise.all([
          getAssets({}),
          getTopics(),
          fetch('/api/graph', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
        ]);

        let assets: any[] = idbAssets;
        let topics: any[] = idbTopics;
        let relations: any[] = [];  // asset ↔ asset related links（仅 server API 有）

        // 2) 如果 server 返 ok + 有数据，覆盖 IDB（本地 dev SQLite 优先）
        if (serverRes && serverRes.ok && serverRes.nodes && serverRes.nodes.length > idbAssets.length) {
          // server 拿 node + topic + links 完整
          const serverNodes = serverRes.nodes;
          const serverTopics = serverRes.topics ?? [];
          const serverLinks = serverRes.links ?? [];
          // 拆 node 为 assets + topics
          const nodeMap = new Map(serverNodes.map((n: any) => [n.id, n]));
          assets = serverNodes
            .filter((n: any) => n.type === 'asset' || n.type === 'light' || (n.type && n.type !== 'topic'))
            .map((n: any) => ({
              id: n.id,
              title: n.title,
              type: n.type,
              evidenceLevel: n.evidenceLevel ?? 'E1',
              createdAt: n.createdAt ?? 0,
              feedbackCount: n.feedbackCount ?? 0,
              relatedIds: n.relatedIds ?? [],
              primaryTopic: n.primaryTopic,
              topicNames: n.topicNames ?? [],
            }));
          topics = serverTopics.length > 0 ? serverTopics : topics;
          // 拆 link：asset-asset 关系 vs asset-topic
          relations = serverLinks.filter((l: any) => l.type === 'related' || (l.type !== 'asset_topic' && l.source && l.target && !topics.find((t: any) => t.id === l.source) && !topics.find((t: any) => t.id === l.target)));
        }

        // 3) 构造 graph nodes + links
        const topicMap = new Map(topics.map((t: any) => [t.id, t]));
        const nodes: any[] = [];
        const links: any[] = [];
        for (const a of assets.slice(0, 200)) {
          let ats: any[] = [];
          let topicNames: string[] = a.topicNames ?? [];
          if (topicNames.length === 0) {
            // IDB 来源需要再查
            ats = await getAssetTopicsByAsset(a.id);
            topicNames = ats.map((at: any) => topicMap.get(at.topicId)?.name).filter(Boolean);
          }
          const primaryTopic = topicNames[0] ?? a.primaryTopic ?? null;
          nodes.push({
            id: a.id,
            title: a.title,
            type: a.type,
            evidenceLevel: a.evidenceLevel,
            createdAt: a.createdAt,
            primaryTopic,
            color: a.evidenceLevel === 'E0' ? '#ef4444' : a.evidenceLevel === 'E1' ? '#f97316' : a.evidenceLevel === 'E2' ? '#eab308' : a.evidenceLevel === 'E3' ? '#22c55e' : a.evidenceLevel === 'E4' ? '#3b82f6' : '#8b5cf6',
            topicNames,
            relatedIds: a.relatedIds ?? [],
            feedbackCount: a.feedbackCount ?? 0,
          });
          for (const tn of topicNames) {
            const t = Array.from(topicMap.values()).find((tt: any) => tt.name === tn);
            if (t) links.push({ source: a.id, target: t.id, type: 'asset_topic' });
          }
        }
        for (const t of topics) {
          nodes.push({ id: t.id, title: t.name, type: 'topic', createdAt: t.createdAt ?? 0, primaryTopic: t.name, color: '#3b82f6' });
        }
        // asset-asset 关系
        for (const a of assets) {
          for (const rid of a.relatedIds ?? []) {
            if (assets.find((x: any) => x.id === rid)) {
              links.push({ source: a.id, target: rid, type: 'related' });
            }
          }
        }
        setData({ ok: true, nodes, links, total: nodes.length, stats: { nodeCount: nodes.length, edgeCount: links.length, topicCount: topics.length }, sources: [], outputs: [], topics, list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [] });
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-3)' }}>加载图谱…</div>;
  }
  if (error) {
    return <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--danger)' }}>加载失败：{error}</div>;
  }
  if (!data || data.nodes.length === 0) {
    return (
      <div className="card empty-state">
        <div className="icon">🕸️</div>
        <p>还没有资产卡</p>
        <Link href="/inbox" className="btn btn-primary" style={{ marginTop: 14 }}>去收集箱</Link>
      </div>
    );
  }

  // top topics（按节点数取前 8）
  const topicCounts = new Map<string, { name: string; count: number; color: string }>();
  for (const n of data.nodes) {
    const t = n.primaryTopic;
    if (!t) continue;
    if (!topicCounts.has(t)) topicCounts.set(t, { name: t, count: 0, color: n.color });
    topicCounts.get(t)!.count++;
  }
  const topTopics = Array.from(topicCounts.values()).sort((a, b) => b.count - a.count).slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 顶部标题（保留 app shell 浅色一致） */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontSize: 32, fontWeight: 700,
              color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em',
            }}
          >
            资产图谱
          </h1>
          <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
            节点 = 资产 · 颜色 = 主题分类 · 大小 = 影响力 · 距离 = 关系强度
          </p>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-3)' }}>
          <span><strong style={{ fontFamily: 'var(--font-jetbrains), monospace', color: 'var(--ink)', fontSize: 16 }}>{data.stats.nodeCount}</strong> 节点</span>
          <span>·</span>
          <span><strong style={{ fontFamily: 'var(--font-jetbrains), monospace', color: 'var(--ink)', fontSize: 16 }}>{data.stats.edgeCount}</strong> 关联</span>
          <span>·</span>
          <span><strong style={{ fontFamily: 'var(--font-jetbrains), monospace', color: 'var(--ink)', fontSize: 16 }}>{data.stats.topicCount}</strong> 主题</span>
        </div>
      </div>

      {/* 沉浸式主图区域（浅色，跟 app shell 一致） */}
      <div
        style={{
          background: C.bgGrad,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          position: 'relative',
          overflow: 'hidden',
          minHeight: 760,
          fontFamily: 'var(--font-inter), sans-serif',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        }}
      >
        {/* 装饰网格点 */}
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(circle, rgba(99, 102, 241, 0.06) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* 模式切换 tab + 标题 */}
        <div
          style={{
            position: 'absolute', top: 18, left: 18, zIndex: 5,
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: 4, border: `1px solid ${C.line}`, boxShadow: '0 2px 6px rgba(15,23,42,0.04)' }}>
            <button
              onClick={() => setMode('pedigree')}
              style={{
                padding: '6px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500,
                background: mode === 'pedigree' ? C.bgCard2 : 'transparent',
                color: mode === 'pedigree' ? C.ink : C.ink3,
                fontFamily: 'inherit',
              }}
            >
              🕸 图谱
            </button>
            <button
              onClick={() => setMode('overview')}
              style={{
                padding: '6px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500,
                background: mode === 'overview' ? C.bgCard2 : 'transparent',
                color: mode === 'overview' ? C.ink : C.ink3,
                fontFamily: 'inherit',
              }}
            >
              🌐 全景
            </button>
          </div>
        </div>

        {/* 三栏布局 */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 340px', height: 760, position: 'relative' }}>
          {/* 左侧 filter */}
          <FilterPanel
            topTopics={topTopics}
            topicFilter={topicFilter}
            setTopicFilter={setTopicFilter}
            stats={data.stats}
          />

          {/* 中间主图 */}
          {mode === 'pedigree' ? (
            <PedigreeView data={data} topicFilter={topicFilter} onJumpToDetail={(id) => router.push(`/assets/${id}`)} />
          ) : (
            <OverviewView data={data} topicFilter={topicFilter} onJumpToDetail={(id) => router.push(`/assets/${id}`)} />
          )}

          {/* 右侧详情面板（pedigree 模式固定显示中心节点） */}
          <DetailPanel data={data} topicFilter={topicFilter} setTopicFilter={setTopicFilter} />
        </div>

        {/* 底部 statusbar */}
        <div
          style={{
            position: 'absolute', left: '50%', bottom: 18,
            transform: 'translateX(-50%)', zIndex: 10,
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 11, color: C.ink3,
            display: 'flex', gap: 16, alignItems: 'center',
            pointerEvents: 'none',
            fontFamily: 'var(--font-inter), sans-serif',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
          }}
        >
          <span><Kbd>⌘K</Kbd> 搜索</span>
          <span style={{ color: C.ink4 }}>·</span>
          <span><Kbd>滚轮</Kbd> 缩放</span>
          <span style={{ color: C.ink4 }}>·</span>
          <span><Kbd>拖拽</Kbd> 节点</span>
          <span style={{ color: C.ink4 }}>·</span>
          <span><Kbd>点击</Kbd> 切换中心 / 查看详情</span>
          <span style={{ color: C.ink4 }}>·</span>
          <span><Kbd>悬停</Kbd> 聚焦邻域</span>
        </div>
      </div>
    </div>
  );
}

// ==================== Kbd ====================
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-jetbrains), monospace',
        background: C.bgCard2, border: `1px solid ${C.line}`,
        borderRadius: 3, padding: '1px 5px', fontSize: 10, color: C.ink2,
      }}
    >
      {children}
    </span>
  );
}

// ==================== Filter Panel (left) ====================
function FilterPanel({
  topTopics, topicFilter, setTopicFilter, stats,
}: {
  topTopics: { name: string; count: number; color: string }[];
  topicFilter: string | null;
  setTopicFilter: (t: string | null) => void;
  stats: GraphData['stats'];
}) {
  return (
    <div
      style={{
        borderRight: `1px solid ${C.line}`,
        padding: '70px 20px 24px',
        color: C.ink,
        overflow: 'auto',
        background: 'rgba(255, 255, 255, 0.6)',
      }}
    >
      <FilterSection label="主题分类">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip
            active={topicFilter === null}
            onClick={() => setTopicFilter(null)}
            color={C.ink4}
          >
            全部 · {stats.nodeCount}
          </Chip>
          {topTopics.map(t => (
            <Chip
              key={t.name}
              active={topicFilter === t.name}
              onClick={() => setTopicFilter(topicFilter === t.name ? null : t.name)}
              color={t.color}
            >
              {t.name} · {t.count}
            </Chip>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="图例">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, color: C.ink2 }}>
          <LegendRow color="#f472b6">派生关系</LegendRow>
          <LegendRow color="#a78bfa">来源关系</LegendRow>
          <LegendRow color="#5a6276" dashed>同主题</LegendRow>
        </div>
        <div
          style={{
            marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`,
            fontSize: 11, color: C.ink3, lineHeight: 1.7,
          }}
        >
          节点颜色 = 主主题分类<br />
          节点大小 = 反馈数 + 关联数<br />
          节点距离 = 关系强度
        </div>
      </FilterSection>
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 10, fontWeight: 600, color: C.ink3,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 11px', borderRadius: 14, cursor: 'pointer',
        background: active ? `${color}22` : C.bgCard,
        border: `1px solid ${active ? color : C.line}`,
        color: active ? color : C.ink2,
        fontSize: 12, fontWeight: 500,
        fontFamily: 'inherit',
        transition: 'all 0.12s',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color, display: 'inline-block',
        }}
      />
      {children}
    </button>
  );
}

function LegendRow({ color, dashed, children }: { color: string; dashed?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span
        style={{
          width: 22, height: 2, borderRadius: 1,
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)`
            : color,
        }}
      />
      <span>{children}</span>
    </div>
  );
}

// ==================== Detail Panel (right) ====================
function DetailPanel({ data, topicFilter, setTopicFilter }: { data: GraphData; topicFilter: string | null; setTopicFilter: (t: string | null) => void }) {
  const router = useRouter();
  const [centerId, setCenterId] = useState<string | null>(null);

  // 监听全局中心节点（pedigreeView 通过 window 事件传递，避免 prop drilling）
  useEffect(() => {
    const handler = (e: any) => setCenterId(e.detail);
    window.addEventListener('graph:centerChange', handler);
    return () => window.removeEventListener('graph:centerChange', handler);
  }, []);

  const center = centerId ? data.nodes.find(n => n.id === centerId) : null;
  const display = center || data.nodes[0]; // 没选中显示第一个

  if (!display) return null;

  // Recent items（按创建时间倒序，取前 6）
  const recent = [...data.nodes]
    .sort((a, b) => (b as any).createdAt - (a as any).createdAt)
    .slice(0, 5);

  return (
    <div
      style={{
        borderLeft: `1px solid ${C.line}`,
        padding: '70px 22px 24px',
        color: C.ink,
        overflow: 'auto',
        background: 'rgba(255, 255, 255, 0.6)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}
    >
      {/* 节点详情 */}
      <div>
        <div
          style={{
            fontSize: 10, fontWeight: 600, color: C.ink3,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
          }}
        >
          {center ? '中心节点' : '默认节点'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 12,
              background: `${display.color}22`, color: display.color, fontWeight: 500,
            }}
          >
            ● {display.primaryTopic || '通用'}
          </span>
          <Pill dark>{display.evidenceLevel}</Pill>
          {display.priority && <Pill dark>{display.priority}</Pill>}
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontSize: 22, fontWeight: 700, color: C.ink,
            lineHeight: 1.25, margin: '0 0 10px',
          }}
        >
          {display.title}
        </h2>
        {display.oneSentenceInsight && (
          <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.7, margin: 0 }}>
            {display.oneSentenceInsight}
          </p>
        )}
      </div>

      {/* Stats 网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label="关联数" value={display.relatedIds.length} />
        <Stat label="反馈数" value={display.feedbackCount} />
        <Stat label="主题数" value={display.topicCount} />
        <Stat label="强度" value={display.relatedIds.length + display.feedbackCount} />
      </div>

      {/* Topics */}
      {display.topicNames.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 10, fontWeight: 600, color: C.ink3,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
            }}
          >
            主题
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {display.topicNames.map(t => {
              const isActive = topicFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => setTopicFilter(isActive ? null : t)}
                  style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 10,
                    background: isActive ? `${display.color}33` : C.bgCard,
                    border: `1px solid ${isActive ? display.color : C.line}`,
                    color: isActive ? display.color : C.ink3,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => router.push(`/assets/${display.id}`)}
        style={{
          marginTop: 'auto',
          width: '100%', padding: '11px',
          background: display.color, color: '#ffffff',
          border: 'none', borderRadius: 6,
          fontFamily: 'inherit', fontSize: 13,
          fontWeight: 600, cursor: 'pointer',
        }}
      >
        查看完整详情 →
      </button>

      {/* 最近添加（兜底内容） */}
      {!center && (
        <div style={{ marginTop: 8, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <div
            style={{
              fontSize: 10, fontWeight: 600, color: C.ink3,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
            }}
          >
            最近添加
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recent.map(n => (
              <div
                key={n.id}
                onClick={() => router.push(`/assets/${n.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 0', borderBottom: `1px solid ${C.lineSoft}`,
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.color }} />
                <span style={{ flex: 1, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shortTitle(n.title, 14)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11, padding: '2px 8px', borderRadius: 10,
        background: dark ? C.bgCard2 : 'transparent',
        color: C.ink2, fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: C.bgCard, borderRadius: 6,
        padding: '11px 13px',
      }}
    >
      <div
        style={{
          fontSize: 10, color: C.ink3,
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 20, fontWeight: 600, color: C.ink,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ==================== Pedigree View (force-directed around center) ====================
function PedigreeView({ data, topicFilter, onJumpToDetail }: { data: GraphData; topicFilter: string | null; onJumpToDetail: (id: string) => void }) {
  const initialCenterId = useMemo(() => {
    const sorted = [...data.nodes].sort(
      (a, b) => (b.relatedIds.length * 2 + b.feedbackCount) - (a.relatedIds.length * 2 + a.feedbackCount)
    );
    return sorted[0]?.id ?? null;
  }, [data]);

  const [centerId, setCenterId] = useState<string | null>(initialCenterId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 通知 DetailPanel
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('graph:centerChange', { detail: centerId }));
  }, [centerId]);

  // 容器尺寸
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 760 });
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 邻域计算（受 topicFilter 影响）
  const layout = useMemo(() => {
    if (!centerId) return null;
    let center = data.nodes.find(n => n.id === centerId);
    if (!center) return null;

    let pool = data.nodes;
    if (topicFilter) {
      pool = data.nodes.filter(n => n.topicNames.includes(topicFilter));
    }

    // descendants 优先（节点在 center.relatedIds 里）
    const descendantIds = new Set(center.relatedIds);
    const descendants = center.relatedIds
      .map(id => pool.find(n => n.id === id))
      .filter((n): n is NodeData => !!n && n.id !== centerId)
      .slice(0, 4);

    // ancestors 排除已经是 descendant 的节点（避免双向关系的角色重复）
    const ancestors = pool
      .filter(n =>
        n.id !== centerId
        && n.relatedIds.includes(centerId)
        && !descendantIds.has(n.id)
      )
      .slice(0, 4);

    // 所有跟 center 有血脉关系的节点（用于排除 siblings）
    const allRelatedIds = new Set<string>([centerId, ...descendantIds]);
    for (const n of ancestors) allRelatedIds.add(n.id);

    const centerTopics = new Set(center.topicNames);
    const siblings = pool
      .filter(n => !allRelatedIds.has(n.id) && n.topicNames.some(t => centerTopics.has(t)))
      .slice(0, 6);

    return { center, ancestors, descendants, siblings };
  }, [centerId, data, topicFilter]);

  // 邻域边
  const edges = useMemo(() => {
    if (!layout) return [];
    const e: { from: string; to: string; type: 'ancestor' | 'descendant' | 'sibling' }[] = [];
    layout.ancestors.forEach(n => e.push({ from: n.id, to: layout.center.id, type: 'ancestor' }));
    layout.descendants.forEach(n => e.push({ from: layout.center.id, to: n.id, type: 'descendant' }));
    layout.siblings.forEach(n => e.push({ from: layout.center.id, to: n.id, type: 'sibling' }));
    return e;
  }, [layout]);

  // d3-force 自动布局（中心固定，邻域按主题聚类）
  const positions = useMemo(() => {
    if (!layout) return new Map<string, { x: number; y: number; color: string; size: number; topicName: string | null; type: string }>();
    const W = size.w, H = size.h;
    const cx = W / 2, cy = H / 2;

    const neighbors = [...layout.ancestors, ...layout.descendants, ...layout.siblings];

    // 初始：环形分散
    const simNodes = neighbors.map((n, i) => {
      const angle = (i / Math.max(1, neighbors.length)) * Math.PI * 2;
      const radius = Math.min(W, H) * 0.30;
      const type = layout.ancestors.find(a => a.id === n.id) ? 'ancestor'
        : layout.descendants.find(d => d.id === n.id) ? 'descendant' : 'sibling';
      return {
        id: n.id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        color: n.color,
        topicName: n.primaryTopic,
        size: 7 + Math.min(n.feedbackCount, 5) * 0.8,
        type,
      };
    });

    // 主题簇吸引力（custom force）：同名主题相互吸引（弱化，避免压成中心团）
    const themeClusterForce = () => {
      let nodes = simNodes;
      return () => {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            if (nodes[i].topicName && nodes[i].topicName === nodes[j].topicName) {
              const dx = nodes[j].x - nodes[i].x;
              const dy = nodes[j].y - nodes[i].y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              if (dist > 200) continue;  // 太远不吸引
              const force = 0.15;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              nodes[i].x += fx;
              nodes[i].y += fy;
              nodes[j].x -= fx;
              nodes[j].y -= fy;
            }
          }
        }
      };
    };

    const sim = forceSimulation(simNodes as any)
      .force('charge', forceManyBody().strength(-420))
      .force('collide', forceCollide().radius((d: any) => d.size + 22).strength(0.9))
      .force('x', forceX(cx).strength(0.02))
      .force('y', forceY(cy).strength(0.02))
      .force('theme', themeClusterForce())
      .stop();

    for (let i = 0; i < 500; i++) sim.tick();

    // clamp 到画布内（避免节点超出可视区）
    const margin = 40;
    simNodes.forEach(n => {
      n.x = Math.max(margin + n.size, Math.min(W - margin - n.size, n.x));
      n.y = Math.max(margin + n.size, Math.min(H - margin - n.size - 20, n.y));
    });

    const pos = new Map<string, any>();
    pos.set(layout.center.id, { x: cx, y: cy, color: layout.center.color, size: 22, topicName: layout.center.primaryTopic, type: 'center' });
    simNodes.forEach(n => {
      pos.set(n.id, { x: n.x, y: n.y, color: n.color, size: n.size, topicName: n.topicName, type: n.type });
    });
    return pos;
  }, [layout, size]);

  // hover 邻域
  const hoverNeighborhood = useMemo(() => {
    if (!hoveredId) return null;
    const s = new Set<string>([hoveredId]);
    edges.forEach(e => {
      if (e.from === hoveredId) s.add(e.to);
      if (e.to === hoveredId) s.add(e.from);
    });
    return s;
  }, [hoveredId, edges]);

  if (!layout) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink3, fontSize: 13 }}>
        没有可显示的节点
      </div>
    );
  }

  const W = size.w;
  const H = size.h;
  const centerPos = positions.get(layout.center.id)!;
  const centerColor = layout.center.color;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg width={W} height={H} style={{ display: 'block', cursor: 'grab' }}>
        <defs>
          {/* 中心节点 halo（浅色背景：低强度） */}
          <radialGradient id="center-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={centerColor} stopOpacity="0.28" />
            <stop offset="60%" stopColor={centerColor} stopOpacity="0.08" />
            <stop offset="100%" stopColor={centerColor} stopOpacity="0" />
          </radialGradient>
          {/* 箭头 marker（按中心节点颜色） */}
          <marker id={`arrow-${centerColor.slice(1)}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={centerColor} />
          </marker>
        </defs>

        {/* 中心 halo */}
        <circle cx={centerPos.x} cy={centerPos.y} r={120} fill="url(#center-halo)" />

        {/* 边 */}
        {edges.map((e, i) => {
          const from = positions.get(e.from);
          const to = positions.get(e.to);
          if (!from || !to) return null;
          const isInHover = hoverNeighborhood
            && hoverNeighborhood.has(e.from)
            && hoverNeighborhood.has(e.to);
          const opacity = hoverNeighborhood
            ? (isInHover ? 0.85 : 0.1)
            : 0.55;
          const stroke = e.type === 'ancestor' ? '#a78bfa'
            : e.type === 'descendant' ? centerColor
            : C.ink4;
          const dashArray = e.type === 'sibling' ? '4,4' : undefined;
          const markerEnd = e.type === 'descendant' ? `url(#arrow-${centerColor.slice(1)})` : undefined;
          // 避圆边：从 to 节点边缘出发
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / dist, uy = dy / dist;
          const x2 = to.x - ux * (to.size + 2);
          const y2 = to.y - uy * (to.size + 2);
          return (
            <line
              key={i}
              x1={from.x} y1={from.y} x2={x2} y2={y2}
              stroke={stroke} strokeWidth={1.5} strokeDasharray={dashArray}
              opacity={opacity} markerEnd={markerEnd}
            />
          );
        })}

        {/* 节点 */}
        {[
          layout.center,
          ...layout.ancestors,
          ...layout.descendants,
          ...layout.siblings,
        ].map(n => {
          const p = positions.get(n.id);
          if (!p) return null;
          const isCenter = n.id === centerId;
          const isHovered = hoveredId === n.id;
          const isInHover = hoverNeighborhood && hoverNeighborhood.has(n.id);
          const opacity = hoverNeighborhood ? (isInHover ? 1 : 0.18) : 1;

          // 非中心节点：外圈虚线 + 主体圆
          return (
            <g
              key={n.id}
              style={{ cursor: 'pointer', opacity, transition: 'opacity 0.2s ease' }}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => {
                if (isCenter) onJumpToDetail(n.id);
                else setCenterId(n.id);
              }}
            >
              {/* 外圈虚线（非中心） */}
              {!isCenter && (
                <circle
                  cx={p.x} cy={p.y} r={p.size + 7}
                  fill="none" stroke={p.color} strokeWidth={1}
                  strokeDasharray="3,3" opacity={0.4}
                />
              )}
              {/* 中心节点多层 halo（浅背景：低强度） */}
              {isCenter && (
                <>
                  <circle cx={p.x} cy={p.y} r={p.size + 28} fill={p.color} opacity={0.06} />
                  <circle cx={p.x} cy={p.y} r={p.size + 14} fill={p.color} opacity={0.12} />
                </>
              )}
              {/* 主体圆 */}
              <circle
                cx={p.x} cy={p.y} r={p.size}
                fill={p.color}
                stroke={isHovered ? C.ink : (isCenter ? '#ffffff' : 'rgba(255,255,255,0.7)')}
                strokeWidth={isCenter ? 2.5 : isHovered ? 2 : 1.2}
              />
              {/* 节点下方标签 */}
              <text
                x={p.x} y={p.y + p.size + (isCenter ? 22 : 16)}
                textAnchor="middle"
                fontSize={isCenter ? 13 : 11}
                fontWeight={isCenter ? 600 : 500}
                fill={isCenter ? '#0f172a' : C.ink2}
                fontFamily="var(--font-inter), sans-serif"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {shortTitle(n.title, isCenter ? 16 : 9)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ==================== Overview View (full graph, force-directed) ====================
function OverviewView({ data, topicFilter, onJumpToDetail }: { data: GraphData; topicFilter: string | null; onJumpToDetail: (id: string) => void }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('graph:centerChange', { detail: selectedId }));
  }, [selectedId]);

  const graphRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: 760 });
  useEffect(() => {
    if (!graphRef.current) return;
    const el = graphRef.current;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 过滤 + 加 color
  const filteredData = useMemo(() => {
    const allowedNodes = topicFilter
      ? data.nodes.filter(n => n.topicNames.includes(topicFilter))
      : data.nodes;
    const ids = new Set(allowedNodes.map(n => n.id));
    const links: any[] = [];
    const seen = new Set<string>();
    for (const a of allowedNodes) {
      for (const targetId of a.relatedIds) {
        if (!ids.has(targetId)) continue;
        const key = [a.id, targetId].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ source: a.id, target: targetId });
      }
    }
    return {
      nodes: allowedNodes.map(n => ({ ...n, color: n.color })),
      links,
    };
  }, [data, topicFilter]);

  // 1 度邻居聚焦
  const focusSet = useMemo(() => {
    if (!selectedId) return null;
    const s = new Set<string>([selectedId]);
    for (const n of data.nodes) {
      if (n.id === selectedId) continue;
      if (n.relatedIds.includes(selectedId)) s.add(n.id);
      if (data.nodes.find(x => x.id === selectedId)?.relatedIds.includes(n.id)) s.add(n.id);
    }
    return s;
  }, [selectedId, data]);

  const onEngineStop = useCallback(() => {
    try { fgRef.current?.zoomToFit(400, 60); } catch (e) { /* */ }
  }, []);

  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n: any = node;
    const isSelected = selectedId === n.id;
    const isHovered = hoveredId === n.id;
    const isDimmed = focusSet && !focusSet.has(n.id);
    const r = Math.max(5, n.val);
    const fill = isDimmed ? 0.18 : 1.0;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = n.color;
    ctx.globalAlpha = fill;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : 1;
    ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)';
    ctx.globalAlpha = isDimmed ? 0.1 : (isSelected ? 1 : isHovered ? 0.95 : 0.7);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if ((isSelected || isHovered) && globalScale > 0.6) {
      const label = shortTitle(n.title, 14);
      const fs = Math.max(11, 12 / globalScale);
      ctx.font = `500 ${fs}px "var(--font-inter)", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(node.x - tw / 2 - 5, node.y + r + 3, tw + 10, fs + 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(label, node.x, node.y + r + 6);
    }
  }, [selectedId, hoveredId, focusSet]);

  const drawLink = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const s = link.source;
    const t = link.target;
    const isFocused = focusSet && (focusSet.has(s.id) && focusSet.has(t.id));
    const isDimmed = focusSet && !isFocused;
    ctx.strokeStyle = isFocused ? 'rgba(99, 102, 241, 0.7)' : 'rgba(100, 116, 139, 0.35)';
    ctx.globalAlpha = isDimmed ? 0.08 : (isFocused ? 1.0 : 0.7);
    ctx.lineWidth = isFocused ? 1.5 : 0.8;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }, [focusSet]);

  const onNodeHover = useCallback((node: any) => {
    setHoveredId(node?.id ?? null);
  }, []);

  const onNodeClick = useCallback((node: any) => {
    if (node?.id) {
      if (selectedId === node.id) {
        router.push(`/assets/${node.id}`);
      } else {
        setSelectedId(node.id);
      }
    }
  }, [selectedId, router]);

  return (
    <div ref={graphRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={filteredData}
        onEngineStop={onEngineStop}
        nodeRelSize={5}
        nodeVal={(node: any) => node.val}
        nodeColor={(node: any) => node.color}
        linkColor={focusSet ? ((link: any) => {
          if (focusSet.has(link.source.id) && focusSet.has(link.target.id)) return 'rgba(99, 102, 241, 0.7)';
          return 'rgba(100, 116, 139, 0.15)';
        }) : () => 'rgba(100, 116, 139, 0.35)'}
        linkWidth={1}
        linkDirectionalParticles={0}
        {...({ linkDistance: 90, cooldownTicks: 200, warmupTicks: 60, d3AlphaDecay: 0.02, d3VelocityDecay: 0.3 } as any)}
        onNodeHover={onNodeHover}
        onNodeClick={onNodeClick}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const r = Math.max(5, node.val) + 6;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={drawLink}
        backgroundColor={C.bg}
        enableNodeDrag={true}
      />
    </div>
  );
}