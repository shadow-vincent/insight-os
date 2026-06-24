'use client';

/**
 * /p/[user_id]/graph — 公开图谱页（v1.5 embed widget）
 *
 * 不需登录即可访问（meta noindex）
 * 嵌入博客的 widget 实际就是 iframe 这个页面
 */

import { use, useEffect, useRef, useState } from 'react';

interface EmbedData {
  ok: boolean;
  userId: string;
  topic: string | null;
  nodes: Array<{ id: string; title: string; insight: string | null; evidenceLevel: string; priority: string | null; tags: string[] }>;
  links: Array<{ source: string; target: string }>;
  topics: Array<{ id: string; name: string; slug: string }>;
  meta: { count: number; source: string; embedVersion: number; generatedAt: string };
}

const TOPIC_COLORS: Record<string, string> = {
  '组织治理': '#1e40af',
  '数字化转型': '#155e75',
  'AI 时代': '#6d28d9',
  'AI': '#6d28d9',
  '战略与定位': '#b91c1c',
  '战略': '#b91c1c',
  'default': '#64748b',
};

function topicFor(tags: string[]): string {
  for (const t of tags) {
    if (TOPIC_COLORS[t]) return t;
  }
  return 'default';
}

function colorFor(tags: string[]): string {
  return TOPIC_COLORS[topicFor(tags)] ?? TOPIC_COLORS.default;
}

export default function PublicGraphPage({ params }: { params: Promise<{ user_id: string }> }) {
  const { user_id } = use(params);
  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<EmbedData['nodes'][0] | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    fetch(`/api/embed/data?userId=${encodeURIComponent(user_id)}&limit=50`)
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  }, [user_id]);

  useEffect(() => {
    if (!data || !svgRef.current) return;
    const svg = svgRef.current;
    const width = svg.clientWidth;
    const height = svg.clientHeight;

    // 用 d3-force 模拟（动态 import）
    import('d3-force').then((d3) => {
      const nodes = data.nodes.map(n => ({ ...n, x: width / 2 + (Math.random() - 0.5) * 200, y: height / 2 + (Math.random() - 0.5) * 200 }));
      const links: any[] = data.links.map(l => ({ ...l }));

      // v1.6: 计算每个 node 的主题 cluster 中心（让同主题聚类）
      const topicCenters: Record<string, { x: number; y: number }> = {};
      const allTopics = Array.from(new Set(nodes.map(n => topicFor(n.tags))));
      const cols = Math.ceil(Math.sqrt(allTopics.length));
      const rows = Math.ceil(allTopics.length / cols);
      const cellW = width * 0.75 / cols;
      const cellH = height * 0.75 / rows;
      allTopics.forEach((topic, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        topicCenters[topic] = {
          x: width * 0.125 + cellW * (col + 0.5),
          y: height * 0.125 + cellH * (row + 0.5),
        };
      });

      const sim = (d3 as any).forceSimulation(nodes)
        .force('charge', (d3 as any).forceManyBody().strength(-180))
        .force('center', (d3 as any).forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', (d3 as any).forceCollide().radius(28))
        .force('topicX', (d3 as any).forceX((d: any) => {
          const t = topicCenters[topicFor(d.tags)];
          return t?.x ?? width / 2;
        }).strength(0.18))
        .force('topicY', (d3 as any).forceY((d: any) => {
          const t = topicCenters[topicFor(d.tags)];
          return t?.y ?? height / 2;
        }).strength(0.18));

      if (links.length > 0) {
        sim.force('link', (d3 as any).forceLink(links).id((d: any) => d.id).distance(60).strength(0.4));
      }

      const NS = 'http://www.w3.org/2000/svg';
      // 清空
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      // 边
      const linkSel = (svg as any).appendChild ? null : null; // 不用
      const g = document.createElementNS(NS, 'g');
      svg.appendChild(g);

      // 用 foreignObject 渲染 tooltip 太复杂，简化为 svg 文本
      const circleG = document.createElementNS(NS, 'g');
      g.appendChild(circleG);

      const labelG = document.createElementNS(NS, 'g');
      g.appendChild(labelG);

      const lineG = document.createElementNS(NS, 'g');
      g.insertBefore(lineG, circleG);

      sim.on('tick', () => {
        // 清空
        while (lineG.firstChild) lineG.removeChild(lineG.firstChild);
        while (circleG.firstChild) circleG.removeChild(circleG.firstChild);
        while (labelG.firstChild) labelG.removeChild(labelG.firstChild);

        // 边
        for (const l of links) {
          const line = document.createElementNS(NS, 'line');
          line.setAttribute('x1', String((l.source as any).x ?? 0));
          line.setAttribute('y1', String((l.source as any).y ?? 0));
          line.setAttribute('x2', String((l.target as any).x ?? 0));
          line.setAttribute('y2', String((l.target as any).y ?? 0));
          line.setAttribute('stroke', '#cbd5e1');
          line.setAttribute('stroke-width', '0.8');
          line.setAttribute('stroke-opacity', '0.5');
          lineG.appendChild(line);
        }

        // 节点
        for (const n of nodes) {
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', String(n.x));
          c.setAttribute('cy', String(n.y));
          c.setAttribute('r', '10');
          c.setAttribute('fill', colorFor(n.tags));
          c.setAttribute('fill-opacity', '0.85');
          c.setAttribute('stroke', '#fff');
          c.setAttribute('stroke-width', '1.5');
          c.style.cursor = 'pointer';
          c.addEventListener('mouseenter', (e) => {
            setHovered(n);
            const rect = (svg as any).getBoundingClientRect();
            setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          });
          c.addEventListener('mouseleave', () => { setHovered(null); setTooltipPos(null); });
          circleG.appendChild(c);

          // 标签
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', String(n.x));
          t.setAttribute('y', String(n.y + 18));
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-size', '9');
          t.setAttribute('font-family', 'Inter, sans-serif');
          t.setAttribute('font-weight', '500');
          t.setAttribute('fill', '#0f172a');
          t.setAttribute('paint-order', 'stroke');
          t.setAttribute('stroke', '#fdfdfb');
          t.setAttribute('stroke-width', '3');
          t.setAttribute('stroke-linejoin', 'round');
          t.textContent = n.title.length > 8 ? n.title.slice(0, 7) + '…' : n.title;
          labelG.appendChild(t);
        }
      });
    });
  }, [data]);

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
        ⏳ 加载图谱中…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf7', padding: '20px 16px' }}>
      <head>
        <meta name="robots" content="noindex,nofollow" />
        <title>{user_id} 的判断力图谱 · Insight OS</title>
      </head>

      {/* Widget header */}
      <div style={{
        maxWidth: 720, margin: '0 auto',
        background: '#fff', borderRadius: 10,
        border: '1px solid #e2e8f0', overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(180deg, #fafaf7 0%, #fff 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, padding: '3px 8px', background: '#eef2ff', color: '#4f46e5',
              borderRadius: 10, fontWeight: 600,
            }}>🧠 Insight OS</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              {user_id} 的判断力图谱
            </span>
          </div>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            {data?.meta.count ?? 0} 张 · {new Date(data?.meta.generatedAt ?? Date.now()).toLocaleDateString('zh-CN')}
          </span>
        </div>

        <div style={{ position: 'relative', height: 460, background: '#fdfdfb' }}>
          <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          {/* v1.6: 主题 cluster 图例（背景色块） */}
          <div style={{
            position: 'absolute', top: 8, right: 8,
            display: 'flex', flexDirection: 'column', gap: 4,
            background: 'rgba(255,255,255,0.85)', padding: '6px 8px',
            borderRadius: 6, fontSize: 10, color: '#475569',
            backdropFilter: 'blur(4px)',
          }}>
            {Object.entries(TOPIC_COLORS).filter(([k]) => k !== 'default').map(([topic, color]) => (
              <div key={topic} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
                <span>{topic}</span>
              </div>
            ))}
          </div>

          {hovered && tooltipPos && (
            <div style={{
              position: 'absolute',
              top: tooltipPos.y + 12, left: tooltipPos.x + 12,
              background: 'rgba(15, 23, 42, 0.95)', color: 'white',
              padding: '8px 12px', borderRadius: 6, fontSize: 12,
              maxWidth: 260, pointerEvents: 'none', zIndex: 10,
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{hovered.title}</div>
              {hovered.insight && (
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                  {hovered.insight}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                {hovered.evidenceLevel} · {hovered.tags.slice(0, 3).join(' / ')}
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '10px 18px', borderTop: '1px solid #f1f5f9',
          background: '#fafaf7', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', fontSize: 11, color: '#94a3b8',
        }}>
          <span>
            {data?.topics.length ?? 0} 个主题 · {data?.nodes.length ?? 0} 张资产卡
          </span>
          <a
            href={`/?ref=embed-${user_id}`}
            style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}
          >
            由 Insight OS 嵌入生成 →
          </a>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 10, color: '#94a3b8' }}>
        🧠 想沉淀自己的判断库？<a href="/" style={{ color: '#64748b' }}>试试 Insight OS</a>
      </div>
    </div>
  );
}
