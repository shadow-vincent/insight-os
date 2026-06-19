'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// react-force-graph-2d 在 Next.js 15 RSC 下需要 ssr:false
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// ==================== 类型 ====================
interface NodeData {
  id: string;
  title: string;
  evidenceLevel: string;
  priority: string;
  feedbackCount: number;
  topicCount: number;
  topicNames: string[];
  relatedIds: string[];
  oneSentenceInsight: string | null;
  val: number;
}

interface Topic {
  id: string;
  name: string;
  slug: string;
}

interface GraphData {
  ok: boolean;
  nodes: NodeData[];
  topics: Topic[];
  stats: { nodeCount: number; edgeCount: number; topicCount: number };
}

// ==================== 视觉调色板（固定浅色，跟 app shell 一致）====================
const PALETTE = {
  bg: '#f7f9fc',
  bgAlt: '#f1f5f9',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  textInk: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
};

const EVIDENCE_COLORS: Record<string, string> = {
  E0: '#94a3b8', // slate-400
  E1: '#0284c7', // sky-600
  E2: '#1d4ed8', // blue-700
  E3: '#b45309', // amber-700
  E4: '#c2410c', // orange-700
  E5: '#b91c1c', // red-700
};

const EVIDENCE_BG: Record<string, string> = {
  E0: '#f1f5f9', E1: '#e0f2fe', E2: '#dbeafe', E3: '#fef3c7', E4: '#ffedd5', E5: '#fee2e2',
};

// 证据等级 → 边框粗细（E 等级越高边框越粗）
const EVIDENCE_STROKE: Record<string, number> = {
  E0: 1, E1: 1.5, E2: 2, E3: 2.5, E4: 3, E5: 4,
};

// 证据等级 → 内圈图标（用 unicode 符号在中心表达等级）
const EVIDENCE_GLYPH: Record<string, string> = {
  E0: '○', E1: '◐', E2: '●', E3: '★', E4: '★★', E5: '✪',
};

// 优先级 → 顶部横条颜色 + 描边
const PRIORITY_COLOR: Record<string, string> = {
  A: '#dc2626', // red-600
  B: '#f59e0b', // amber-500
  C: '#94a3b8', // slate-400
};

// 角色 → 节点外环颜色（ancestor 浅蓝 / descendant 深蓝 / sibling 主题色 / center 证据色）
const ROLE_RING_COLOR = {
  ancestor: '#0ea5e9',     // sky-500
  descendant: '#2563eb',   // blue-600
  sibling: '#a78bfa',      // violet-400
  center: '#f59e0b',       // amber-500
} as const;

const NODE_RADIUS_BASE = 4;

// ==================== 主体 ====================
export default function GraphClient() {
  const router = useRouter();
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'pedigree' | 'overview'>('pedigree');

  useEffect(() => {
    fetch('/api/graph')
      .then(r => r.json())
      .then(d => {
        if (d.ok) setData(d);
        else setError(d.error || '加载失败');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>加载图谱…</div>;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 180px)' }}>
      {/* 顶部 tab 切换 */}
      <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 3, background: 'var(--bg-subtle)', borderRadius: 6 }}>
          <button
            onClick={() => setMode('pedigree')}
            className={mode === 'pedigree' ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
            style={{ fontSize: 12, background: mode === 'pedigree' ? undefined : 'transparent', border: 'none' }}
          >
            🌳 血脉图
          </button>
          <button
            onClick={() => setMode('overview')}
            className={mode === 'overview' ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
            style={{ fontSize: 12, background: mode === 'overview' ? undefined : 'transparent', border: 'none' }}
          >
            🕸 全景图
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          <span><strong style={{ color: 'var(--ink)' }}>{data.stats.nodeCount}</strong> 节点</span>
          <span>·</span>
          <span><strong style={{ color: 'var(--ink)' }}>{data.stats.edgeCount}</strong> 血脉边</span>
          <span>·</span>
          <span><strong style={{ color: 'var(--ink)' }}>{data.stats.topicCount}</strong> 主题</span>
        </div>
      </div>

      {/* 模式说明 */}
      <div className="card" style={{ padding: '10px 20px', fontSize: 12, color: 'var(--text-2)' }}>
        {mode === 'pedigree' ? (
          <>
            <strong style={{ color: 'var(--ink)' }}>血脉图</strong>：选一张卡看它的血脉 — 上方 = 谁引出了它（来源） · 中间 = 当前卡 · 下方 = 它引出了谁（派生） · 周围圆环 = 同主题但无直接血脉的卡。
            点任意节点可切换中心。
          </>
        ) : (
          <>
            <strong style={{ color: 'var(--ink)' }}>全景图</strong>：所有资产卡 + related 边 · 自由力导向布局 · 点击节点查看详情。
          </>
        )}
      </div>

      {/* 主视图 */}
      {mode === 'pedigree' ? (
        <PedigreeView data={data} onJumpToDetail={(id) => router.push(`/assets/${id}`)} />
      ) : (
        <OverviewView data={data} onJumpToDetail={(id) => router.push(`/assets/${id}`)} />
      )}
    </div>
  );
}

// ==================== 血脉图（Page Graph）====================
function PedigreeView({ data, onJumpToDetail }: { data: GraphData; onJumpToDetail: (id: string) => void }) {
  // 默认中心：relatedCount + feedbackCount 最高的卡（最核心）
  const initialCenterId = useMemo(() => {
    const sorted = [...data.nodes].sort((a, b) =>
      (b.relatedIds.length * 2 + b.feedbackCount) - (a.relatedIds.length * 2 + a.feedbackCount)
    );
    return sorted[0]?.id ?? null;
  }, [data]);

  const [centerId, setCenterId] = useState<string | null>(initialCenterId);
  // 重新计算时中心可能因为切换 mode 改了，重置
  useEffect(() => { setCenterId(initialCenterId); }, [initialCenterId]);

  const nodeMap = useMemo(() => new Map(data.nodes.map(n => [n.id, n])), [data]);

  // 围绕中心计算血脉
  const layout = useMemo(() => {
    if (!centerId) return null;
    const center = nodeMap.get(centerId);
    if (!center) return null;

    // 上排：反向 related（哪些卡的 relatedIds 包含中心）
    const ancestors = data.nodes
      .filter(n => n.id !== centerId && n.relatedIds.includes(centerId))
      .slice(0, 3);

    // 下排：正向 related（中心 relatedIds 包含的）
    const descendants = center.relatedIds
      .map(id => nodeMap.get(id))
      .filter((n): n is NodeData => !!n && n.id !== centerId)
      .slice(0, 3);

    // 周围：同主题但不在 related
    const relatedSet = new Set([centerId, ...ancestors.map(n => n.id), ...descendants.map(n => n.id)]);
    const centerTopics = new Set(center.topicNames);
    const siblings = data.nodes
      .filter(n => !relatedSet.has(n.id) && n.topicNames.some(t => centerTopics.has(t)))
      .slice(0, 4);

    return { center, ancestors, descendants, siblings };
  }, [centerId, data, nodeMap]);

  if (!layout) {
    return (
      <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
        没有可显示的节点
      </div>
    );
  }

  return (
    <PedigreeCanvas
      layout={layout}
      centerId={centerId}
      onSelectCenter={setCenterId}
      onJumpToDetail={onJumpToDetail}
    />
  );
}

interface PedigreeLayout {
  center: NodeData;
  ancestors: NodeData[];
  descendants: NodeData[];
  siblings: NodeData[];
}

function PedigreeCanvas({
  layout, centerId, onSelectCenter, onJumpToDetail,
}: {
  layout: PedigreeLayout;
  centerId: string | null;
  onSelectCenter?: (id: string) => void;
  onJumpToDetail: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = size.w;
  const H = size.h;
  const cx = W / 2;
  const cy = H / 2;
  const topY = cy - 180;
  const bottomY = cy + 180;
  const siblingRadius = Math.min(W, H) * 0.4;

  // 节点大小：基础 + 反馈数（反馈越多越大）+ related 数（关联越多越大）
  const nodeSize = (n: NodeData, base: number) => {
    const feedback = Math.min(8, n.feedbackCount);
    return base + feedback * 0.6 + Math.min(3, n.relatedIds.length) * 0.4;
  };

  // 计算节点位置
  const positions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; size: number; type: 'center' | 'ancestor' | 'descendant' | 'sibling' }>();
    pos.set(layout.center.id, { x: cx, y: cy, size: nodeSize(layout.center, 50), type: 'center' });

    // 上排（ancestors）：X 均匀分布
    const aCount = layout.ancestors.length;
    if (aCount > 0) {
      const aSpacing = Math.min(200, (W - 240) / Math.max(1, aCount));
      const aStartX = cx - ((aCount - 1) * aSpacing) / 2;
      layout.ancestors.forEach((n, i) => {
        pos.set(n.id, { x: aStartX + i * aSpacing, y: topY, size: nodeSize(n, 32), type: 'ancestor' });
      });
    }

    // 下排（descendants）
    const dCount = layout.descendants.length;
    if (dCount > 0) {
      const dSpacing = Math.min(200, (W - 240) / Math.max(1, dCount));
      const dStartX = cx - ((dCount - 1) * dSpacing) / 2;
      layout.descendants.forEach((n, i) => {
        pos.set(n.id, { x: dStartX + i * dSpacing, y: bottomY, size: nodeSize(n, 32), type: 'descendant' });
      });
    }

    // 周围（siblings）：环形（避开祖先/后裔区域）
    const sCount = layout.siblings.length;
    if (sCount > 0) {
      layout.siblings.forEach((n, i) => {
        // 角度均分，从上方两侧开始（避开祖先/后裔）
        const angle = -Math.PI / 2 + (i - sCount / 2) * (Math.PI * 0.6 / sCount);
        let x = cx + Math.cos(angle) * siblingRadius;
        let y = cy + Math.sin(angle) * siblingRadius;
        // 避免太靠近祖先/后裔
        if (y < 0) y = Math.max(y, topY + 70);
        if (y > 0) y = Math.min(y, bottomY - 70);
        pos.set(n.id, { x, y, size: nodeSize(n, 28), type: 'sibling' });
      });
    }
    return pos;
  }, [layout, W, H, cx, cy, topY, bottomY, siblingRadius]);

  // 边
  const edges = useMemo(() => {
    const e: { from: string; to: string; type: 'parent' | 'child' | 'sibling' }[] = [];
    // 父→中心（ancestor → center，线方向：ancestor → center）
    layout.ancestors.forEach(n => e.push({ from: n.id, to: layout.center.id, type: 'parent' }));
    // 中心→子（center → descendant，方向：center → descendant）
    layout.descendants.forEach(n => e.push({ from: layout.center.id, to: n.id, type: 'child' }));
    // 兄弟虚线（sibling ↔ center）
    layout.siblings.forEach(n => e.push({ from: layout.center.id, to: n.id, type: 'sibling' }));
    return e;
  }, [layout]);

  return (
    <div
      ref={containerRef}
      className="card"
      style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: 0, minHeight: 540, background: PALETTE.bg }}
    >
      {/* 右下角：当前中心信息卡（避开 SVG 节点区） */}
      <div style={{
        position: 'absolute', right: 16, bottom: 16, zIndex: 2,
        background: 'white', border: '1px solid var(--line)',
        borderRadius: 8, padding: '12px 16px', maxWidth: 280,
        boxShadow: '0 4px 16px rgba(15,23,42,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span className={`pill pill-${layout.center.evidenceLevel.toLowerCase()}`}>{layout.center.evidenceLevel}</span>
          {layout.center.priority && <span className={`pill pill-priority-${layout.center.priority.toLowerCase()}`}>{layout.center.priority}</span>}
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
            {layout.ancestors.length}↑ {layout.descendants.length}↓ {layout.siblings.length}⊕
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 6 }}>
          {layout.center.title}
        </div>
        {layout.center.oneSentenceInsight && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 10 }}>
            {layout.center.oneSentenceInsight.length > 80
              ? layout.center.oneSentenceInsight.slice(0, 80) + '…'
              : layout.center.oneSentenceInsight}
          </div>
        )}
        <button
          onClick={() => onJumpToDetail(layout.center.id)}
          className="btn btn-primary btn-sm"
          style={{ fontSize: 12, width: '100%' }}
        >
          查看详情 →
        </button>
      </div>

      {/* SVG 画布 */}
      <svg width={W} height={H} style={{ display: 'block' }}>
        <defs>
          <marker id="arrow-parent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1d4ed8" />
          </marker>
          <marker id="arrow-child" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1d4ed8" />
          </marker>
          {/* 中心节点光晕 filter */}
          <filter id="center-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 分区背景带（淡色块暗示"上 = 来源 / 中 = 中心 / 下 = 派生"）*/}
        <rect x={0} y={0} width={W} height={topY - 60} fill="rgba(14, 165, 233, 0.05)" />
        <rect x={0} y={bottomY + 60} width={W} height={H - (bottomY + 60)} fill="rgba(37, 99, 235, 0.05)" />
        <text x={20} y={20} fill="var(--text-3)" fontSize={11} fontWeight={600} letterSpacing="0.05em">↑ 来源（哪些卡派生出当前）</text>
        <text x={20} y={H - 12} fill="var(--text-3)" fontSize={11} fontWeight={600} letterSpacing="0.05em">↓ 派生（当前卡引用了哪些）</text>

        {/* 边 */}
        {edges.map((e, i) => {
          const from = positions.get(e.from);
          const to = positions.get(e.to);
          if (!from || !to) return null;
          // 箭头方向：parent 指向中心；child 中心指向子；sibling 中心指向
          const isToCenter = e.to === layout.center.id;
          const isFromCenter = e.from === layout.center.id;

          // 计算边端点（避开圆边界）
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ux = dx / dist;
          const uy = dy / dist;
          const x1 = from.x + ux * from.size;
          const y1 = from.y + uy * from.size;
          const x2 = to.x - ux * to.size;
          const y2 = to.y - uy * to.size;

          const isSibling = e.type === 'sibling';
          return (
            <g key={i}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isSibling ? '#cbd5e1' : '#1d4ed8'}
                strokeWidth={isSibling ? 1 : 1.6}
                strokeDasharray={isSibling ? '4,3' : undefined}
                opacity={isSibling ? 0.7 : 0.85}
                markerEnd={isSibling ? undefined : (isToCenter ? 'url(#arrow-parent)' : 'url(#arrow-child)')}
              />
            </g>
          );
        })}

        {/* 节点 */}
        {Array.from(positions.entries()).map(([id, p]) => {
          const n = layout.center.id === id ? layout.center
            : layout.ancestors.find(x => x.id === id)
            ?? layout.descendants.find(x => x.id === id)
            ?? layout.siblings.find(x => x.id === id);
          if (!n) return null;

          const evColor = EVIDENCE_COLORS[n.evidenceLevel] ?? '#94a3b8';
          const evBg = EVIDENCE_BG[n.evidenceLevel] ?? '#f1f5f9';
          const evStroke = EVIDENCE_STROKE[n.evidenceLevel] ?? 1.5;
          const evGlyph = EVIDENCE_GLYPH[n.evidenceLevel] ?? '●';
          const priorityColor = PRIORITY_COLOR[n.priority] ?? '#94a3b8';
          const ringColor = ROLE_RING_COLOR[p.type];
          const isCenter = p.type === 'center';

          // 文字
          const label = n.title.length > (isCenter ? 18 : 14)
            ? n.title.slice(0, (isCenter ? 18 : 14)) + '…'
            : n.title;
          const fontSize = isCenter ? 12 : 10;

          // 优先级色点位置：右上角小勋章（不挡主体，不"撑伞"）
          // 公式：cos(45°) * size * 0.85 算圆周右上点
          const dotR = 4.5;
          const dotOff = p.size * 0.78;
          const dotX = p.x + dotOff * 0.85;
          const dotY = p.y - dotOff * 0.85;

          return (
            <g
              key={id}
              style={{ cursor: onSelectCenter ? 'pointer' : 'default' }}
              onClick={() => {
                if (id !== centerId && onSelectCenter) onSelectCenter(id);
                else if (onJumpToDetail) onJumpToDetail(id);
              }}
            >
              {/* 外层角色色环（虚线圈，区分来源/派生/同主题） */}
              {!isCenter && (
                <circle
                  cx={p.x} cy={p.y} r={p.size + 4}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth={1.2}
                  strokeDasharray={p.type === 'sibling' ? '2,2' : '4,2'}
                  opacity={0.55}
                />
              )}
              {/* 中心节点：双层光晕 + 实色填充 */}
              {isCenter && (
                <>
                  <circle cx={p.x} cy={p.y} r={p.size + 12} fill={evColor} opacity={0.12} />
                  <circle cx={p.x} cy={p.y} r={p.size + 6} fill={evColor} opacity={0.25} />
                </>
              )}
              {/* 节点主圆 */}
              <circle
                cx={p.x} cy={p.y} r={p.size}
                fill={isCenter ? evColor : evBg}
                stroke={evColor}
                strokeWidth={isCenter ? 3 : evStroke}
                filter={isCenter ? 'url(#center-glow)' : undefined}
              />
              {/* 节点内圈：证据等级符号（中心用 ✪ 替换 CENTER 字样） */}
              {isCenter ? (
                <text
                  x={p.x} y={p.y + 5}
                  textAnchor="middle" fontSize={16} fontWeight={700}
                  fill="white" letterSpacing="0.02em"
                >
                  {evGlyph}
                </text>
              ) : (
                <text
                  x={p.x} y={p.y + 3}
                  textAnchor="middle" fontSize={Math.max(8, p.size * 0.45)} fontWeight={700}
                  fill={evColor}
                >
                  {evGlyph}
                </text>
              )}
              {/* 主题色点（中心节点右下小圈，提示"主主题"） */}
              {isCenter && layout.center.topicNames[0] && (
                <circle
                  cx={p.x + p.size - 4} cy={p.y + p.size - 4} r={5}
                  fill="white" stroke={evColor} strokeWidth={1.5}
                />
              )}
              {/* 优先级小色点（右上角勋章，替代"撑伞"） */}
              <circle
                cx={dotX} cy={dotY} r={dotR}
                fill={priorityColor} stroke="white" strokeWidth={1.5}
              />
              {/* 文字背景 + 标签（圆下方） */}
              <rect
                x={p.x - 72} y={p.y + p.size + 6}
                width={144} height={fontSize * 2.6 + 4}
                fill="white" stroke={evColor} strokeWidth={0.6} rx={3}
                opacity={0.97}
              />
              <text
                x={p.x} y={p.y + p.size + 6 + fontSize * 1.4}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={isCenter ? 700 : 600}
                fill="var(--ink)"
              >
                {label}
              </text>
              {/* 角色标签（位置标签） */}
              {p.type === 'ancestor' && (
                <text x={p.x} y={p.y - p.size - 8} textAnchor="middle" fontSize={9} fill={ringColor} fontWeight={600} letterSpacing="0.05em">↑ 来源</text>
              )}
              {p.type === 'descendant' && (
                <text x={p.x} y={p.y + p.size + fontSize * 2.6 + 18} textAnchor="middle" fontSize={9} fill={ringColor} fontWeight={600} letterSpacing="0.05em">↓ 派生</text>
              )}
              {p.type === 'sibling' && (
                <text x={p.x} y={p.y - p.size - 8} textAnchor="middle" fontSize={9} fill={ringColor} fontWeight={600} letterSpacing="0.05em">⊕ 同主题</text>
              )}
            </g>
          );
        })}
      </svg>

      {/* 中下角：图例（避开左下/右下节点，贴在两个 detail 区域之间） */}
      <div style={{
        position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 2,
        background: 'white', border: '1px solid var(--line)', borderRadius: 6,
        padding: '8px 14px', fontSize: 11, color: 'var(--text-2)',
        display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
        maxWidth: '70%',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2.5px solid #b91c1c', background: '#fee2e2' }} /> E5 公认
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #1d4ed8', background: '#dbeafe' }} /> E2 强证据
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid #0284c7', background: '#e0f2fe' }} /> E1 起步
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#dc2626', border: '1.5px solid white', boxShadow: '0 0 0 1px #cbd5e1' }} /> 优先级 A
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', border: '1.5px solid white', boxShadow: '0 0 0 1px #cbd5e1' }} /> B
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#94a3b8', border: '1.5px solid white', boxShadow: '0 0 0 1px #cbd5e1' }} /> C
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.2px dashed #0ea5e9' }} /> 来源
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.2px dashed #2563eb' }} /> 派生
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.2px dotted #a78bfa' }} /> 同主题
        </span>
        <span style={{ color: 'var(--text-3)', fontSize: 10 }}>· 大小=反馈+关联 · 内圈=证据等级</span>
      </div>
    </div>
  );
}

// ==================== 全景图（力导向）====================
function OverviewView({ data, onJumpToDetail }: { data: GraphData; onJumpToDetail: (id: string) => void }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState('all');
  const fgRef = useRef<any>(null);

  // 构造 nodes/links（force-graph 2D 需要 val/color）
  const filteredData = useMemo(() => {
    const allowedNodes = evidenceFilter === 'all'
      ? data.nodes
      : evidenceFilter === 'E2+'
        ? data.nodes.filter(n => ['E2', 'E3', 'E4', 'E5'].includes(n.evidenceLevel))
        : data.nodes.filter(n => n.evidenceLevel === evidenceFilter);
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
      nodes: allowedNodes.map(n => ({ ...n, color: EVIDENCE_COLORS[n.evidenceLevel] ?? '#94a3b8' })),
      links,
    };
  }, [data, evidenceFilter]);

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

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onEngineStop = useCallback(() => {
    try { fgRef.current?.zoomToFit(400, 50); } catch (e) { /* */ }
  }, []);

  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n: any = node;
    const isSelected = selectedId === n.id;
    const isHovered = hoveredId === n.id;
    const isDimmed = focusSet && !focusSet.has(n.id);
    const r = Math.max(NODE_RADIUS_BASE, n.val);
    const fill = isDimmed ? 0.18 : 1.0;
    const strokeAlpha = isDimmed ? 0.1 : (isSelected ? 1.0 : isHovered ? 0.85 : 0.5);
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = n.color;
    ctx.globalAlpha = fill;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : 1;
    ctx.strokeStyle = isSelected ? '#0f172a' : isHovered ? 'rgba(15,23,42,0.7)' : 'rgba(15,23,42,0.4)';
    ctx.globalAlpha = strokeAlpha;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false);
      ctx.strokeStyle = 'rgba(26, 54, 93, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if ((isSelected || isHovered) && globalScale > 0.5) {
      const label = n.title.length > 22 ? n.title.slice(0, 22) + '…' : n.title;
      const fs = Math.max(11, 12 / globalScale);
      ctx.font = `600 ${fs}px "PingFang SC", "Microsoft YaHei", sans-serif`;
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
    ctx.strokeStyle = isFocused ? 'rgba(26, 54, 93, 0.9)' : 'rgba(15, 23, 42, 0.25)';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 540 }}>
      {/* 证据等级过滤 */}
      <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>证据等级：</span>
        {[
          { v: 'all', l: '全部' }, { v: 'E2+', l: 'E2+ 强证据' }, { v: 'E1', l: 'E1 起步' }, { v: 'E0', l: 'E0 雏形' },
        ].map(o => (
          <button
            key={o.v}
            onClick={() => setEvidenceFilter(o.v)}
            className={evidenceFilter === o.v ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
            style={{ fontSize: 12 }}
          >
            {o.l}
          </button>
        ))}
        {selectedId && (
          <button onClick={() => setSelectedId(null)} className="btn btn-sm" style={{ fontSize: 12, marginLeft: 'auto' }}>
            ✕ 清除选中
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="card"
        style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: 0, background: PALETTE.bg }}
      >
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
            if (focusSet.has(link.source.id) && focusSet.has(link.target.id)) return 'rgba(26, 54, 93, 0.9)';
            return 'rgba(15, 23, 42, 0.15)';
          }) : () => 'rgba(15, 23, 42, 0.25)'}
          linkWidth={1.2}
          linkDirectionalParticles={0}
          {...({ linkDistance: 90, cooldownTicks: 200, warmupTicks: 60 } as any)}
          onNodeHover={onNodeHover}
          onNodeClick={onNodeClick}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            const r = Math.max(NODE_RADIUS_BASE, node.val) + 6;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
          linkCanvasObjectMode={() => 'replace'}
          linkCanvasObject={drawLink}
          backgroundColor={PALETTE.bg}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          enableNodeDrag={true}
        />

        {/* 选中节点信息卡 */}
        {selectedId && (() => {
          const n = data.nodes.find(x => x.id === selectedId);
          if (!n) return null;
          return (
            <div style={{
              position: 'absolute', right: 16, bottom: 16, zIndex: 2,
              background: 'white', border: '1px solid var(--line)', borderRadius: 8,
              padding: '12px 16px', maxWidth: 320,
              boxShadow: '0 4px 16px rgba(15,23,42,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span className={`pill pill-${n.evidenceLevel.toLowerCase()}`}>{n.evidenceLevel}</span>
                {n.priority && <span className={`pill pill-priority-${n.priority.toLowerCase()}`}>{n.priority}</span>}
                <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
                  {n.relatedIds.length} 个关联
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.4 }}>
                {n.title}
              </div>
              {n.oneSentenceInsight && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 10 }}>
                  {n.oneSentenceInsight.length > 100 ? n.oneSentenceInsight.slice(0, 100) + '…' : n.oneSentenceInsight}
                </div>
              )}
              <button
                onClick={() => onJumpToDetail(selectedId)}
                className="btn btn-primary btn-sm"
                style={{ fontSize: 12 }}
              >
                查看详情 →
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
