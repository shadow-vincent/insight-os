'use client';

/**
 * /settings/embed — 图谱导出工作台（V1.6 改版）
 *
 * 之前的实现是 iframe 嵌入代码，但需要固定 IP / 域名才能让访客访问
 * 改版后：本地导出 PNG / PDF（不依赖任何网络/IP）
 *
 * 流程：
 *   1) 加载用户资产 → d3-force 渲染图谱
 *   2) 选主题过滤（可选）
 *   3) 选导出格式：PNG（贴公众号/朋友圈）/ PDF（打印/发客户）
 *   4) 导出：客户端 SVG → Canvas → PNG / window.print() → PDF
 *
 * V2.0 有固定域名时再加 iframe 嵌入代码（保留 /p/[user_id]/graph 公开页）
 */

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ToastProvider';

interface AssetNode {
  id: string;
  title: string;
  insight: string | null;
  evidenceLevel: string;
  priority: string | null;
  tags: string[];
  topicNames: string[];
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

export default function EmbedSettingsPage() {
  const toast = useToast();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const [allNodes, setAllNodes] = useState<AssetNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [allTopics, setAllTopics] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf'>('png');
  const [userName] = useState('vincent');  // V1.5 写死

  // 加载资产
  useEffect(() => {
    Promise.all([
      fetch('/api/embed/data?userId=vincent&limit=50').then(r => r.json()),
      fetch('/api/topics').then(r => r.json()),
    ]).then(([embedData, topicsData]) => {
      if (embedData.ok) {
        setAllNodes(embedData.nodes as AssetNode[]);
      }
      if (topicsData.ok) {
        setAllTopics(topicsData.topics);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // 过滤节点
  const filteredNodes = useRef<AssetNode[]>([]);
  filteredNodes.current = selectedTopics.size === 0
    ? allNodes
    : allNodes.filter(n => n.topicNames.some(name => selectedTopics.has(name)));

  // d3-force 渲染
  useEffect(() => {
    if (loading || filteredNodes.current.length === 0) return;
    renderGraph();
  }, [loading, allNodes, selectedTopics, allTopics]);

  const renderGraph = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const width = svg.clientWidth || 720;
    const height = svg.clientHeight || 460;

    const nodes = filteredNodes.current.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));

    // 主题聚类
    const topicSet = Array.from(new Set(nodes.map(n => topicFor(n.tags))));
    const cols = Math.ceil(Math.sqrt(topicSet.length));
    const rows = Math.ceil(topicSet.length / cols);
    const cellW = width * 0.7 / Math.max(cols, 1);
    const cellH = height * 0.7 / Math.max(rows, 1);
    const topicCenters: Record<string, { x: number; y: number }> = {};
    topicSet.forEach((topic, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      topicCenters[topic] = {
        x: width * 0.15 + cellW * (col + 0.5),
        y: height * 0.15 + cellH * (row + 0.5),
      };
    });

    // 动态 import d3-force
    import('d3-force').then((d3) => {
      const sim = (d3 as any).forceSimulation(nodes)
        .force('charge', (d3 as any).forceManyBody().strength(-180))
        .force('center', (d3 as any).forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', (d3 as any).forceCollide().radius(28))
        .force('topicX', (d3 as any).forceX((d: any) => topicCenters[topicFor(d.tags)]?.x ?? width / 2).strength(0.2))
        .force('topicY', (d3 as any).forceY((d: any) => topicCenters[topicFor(d.tags)]?.y ?? height / 2).strength(0.2));

      const NS = 'http://www.w3.org/2000/svg';
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      const g = document.createElementNS(NS, 'g');
      svg.appendChild(g);
      const circleG = document.createElementNS(NS, 'g');
      g.appendChild(circleG);
      const labelG = document.createElementNS(NS, 'g');
      g.appendChild(labelG);

      sim.on('tick', () => {
        while (circleG.firstChild) circleG.removeChild(circleG.firstChild);
        while (labelG.firstChild) labelG.removeChild(labelG.firstChild);

        for (const n of nodes) {
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', String(n.x));
          c.setAttribute('cy', String(n.y));
          c.setAttribute('r', '10');
          c.setAttribute('fill', colorFor(n.tags));
          c.setAttribute('fill-opacity', '0.85');
          c.setAttribute('stroke', '#fff');
          c.setAttribute('stroke-width', '1.5');
          circleG.appendChild(c);

          // 文字背景：白色矩形（保证对比度，canvas 导出兼容）
          const labelText = n.title.length > 8 ? n.title.slice(0, 7) + '…' : n.title;
          const labelW = labelText.length * 7 + 6;
          const labelH = 13;
          const lx = n.x - labelW / 2;
          const ly = n.y + 14;
          const bg = document.createElementNS(NS, 'rect');
          bg.setAttribute('x', String(lx));
          bg.setAttribute('y', String(ly));
          bg.setAttribute('width', String(labelW));
          bg.setAttribute('height', String(labelH));
          bg.setAttribute('rx', '3');
          bg.setAttribute('fill', '#fdfdfb');
          bg.setAttribute('fill-opacity', '0.92');
          labelG.appendChild(bg);

          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', String(n.x));
          t.setAttribute('y', String(ly + 10));
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-size', '10');
          t.setAttribute('font-family', 'sans-serif');
          t.setAttribute('font-weight', '600');
          t.setAttribute('fill', '#0f172a');
          t.textContent = labelText;
          labelG.appendChild(t);
        }
      });
    });
  };

  // ========== 导出 PNG ==========
  const handleExportPNG = async () => {
    if (!widgetRef.current || !svgRef.current) {
      toast.error('图谱未渲染');
      return;
    }
    setExporting(true);
    try {
      // 等 d3 force 收敛（延迟一点）
      await new Promise(r => setTimeout(r, 1500));

      // 构造离屏 canvas（更大尺寸：宽 1600px 用于打印清晰度）
      const exportWidth = 1600;
      const exportHeight = 1100;
      const dpr = 2;  // retina
      const canvas = document.createElement('canvas');
      canvas.width = exportWidth * dpr;
      canvas.height = exportHeight * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2d 不可用');

      // 背景
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#fdfdfb';
      ctx.fillRect(0, 0, exportWidth, exportHeight);

      // 标题
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px "Playfair Display", Georgia, serif';
      ctx.fillText(`${userName} 的判断力图谱`, 40, 60);
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(`Insight OS · ${filteredNodes.current.length} 张资产 · ${new Date().toLocaleDateString('zh-CN')}`, 40, 90);

      // 拷贝 SVG 内容
      const svgEl = svgRef.current;
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('SVG 加载失败'));
        img.src = url;
      });

      // 画 SVG 到 canvas
      ctx.drawImage(img, 40, 120, exportWidth - 80, exportHeight - 200);

      // 图例
      const topicSet = Array.from(new Set(filteredNodes.current.map(n => topicFor(n.tags))));
      let lx = 40;
      const ly = exportHeight - 50;
      ctx.font = '13px Inter, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('主题：', lx, ly);
      lx += 50;
      for (const topic of topicSet) {
        if (topic === 'default') continue;
        ctx.fillStyle = TOPIC_COLORS[topic];
        ctx.beginPath();
        ctx.arc(lx + 5, ly - 4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#475569';
        ctx.fillText(topic, lx + 18, ly);
        lx += ctx.measureText(topic).width + 40;
      }

      // 底部 attribution
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText('🧠 由 Insight OS 生成 · 沉淀你的判断力', exportWidth - 280, exportHeight - 20);

      URL.revokeObjectURL(url);

      // 下载
      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Canvas 转 blob 失败');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `insight-os-graph-${userName}-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        toast.success('PNG 已下载');
      }, 'image/png');
    } catch (e: any) {
      toast.error(`导出失败：${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  // ========== 导出 PDF（用浏览器原生 print） ==========
  const handleExportPDF = () => {
    if (!widgetRef.current) {
      toast.error('图谱未渲染');
      return;
    }
    // 加 print-mode class 到 body
    document.body.classList.add('print-graph');
    setTimeout(() => {
      window.print();
      // 打印对话框关闭后移除 class
      setTimeout(() => {
        document.body.classList.remove('print-graph');
      }, 1000);
    }, 200);
    toast.info('在打印对话框选"另存为 PDF"');
  };

  const toggleTopic = (name: string) => {
    const next = new Set(selectedTopics);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedTopics(next);
  };

  return (
    <>
      {/* @media print 样式：只保留 widget，隐藏其他 */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          body.print-graph .print-widget, body.print-graph .print-widget * { visibility: visible !important; }
          body.print-graph .print-widget {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div style={{ maxWidth: 720 }}>
        <h1 className="page-title">📤 导出图谱</h1>
        <p className="page-subtitle">本地导出 PNG / PDF · 不需要域名 · 贴公众号/朋友圈/发客户</p>

        {/* 主题过滤 */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 13, color: 'var(--ink)' }}>主题过滤：</strong>
            <button
              onClick={() => setSelectedTopics(new Set())}
              style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 16,
                border: '1px solid var(--line)',
                background: selectedTopics.size === 0 ? 'var(--primary)' : 'var(--bg-panel)',
                color: selectedTopics.size === 0 ? 'white' : 'var(--ink)',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              }}
            >
              全部 ({allNodes.length})
            </button>
            {allTopics.map(t => {
              const count = allNodes.filter(n => n.topicNames.includes(t.name)).length;
              if (count === 0) return null;
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTopic(t.name)}
                  style={{
                    fontSize: 12, padding: '4px 12px', borderRadius: 16,
                    border: '1px solid var(--line)',
                    background: selectedTopics.has(t.name) ? 'var(--primary)' : 'var(--bg-panel)',
                    color: selectedTopics.has(t.name) ? 'white' : 'var(--ink)',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                  }}
                >
                  {t.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* 导出按钮 */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>📤 导出</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              className="btn btn-primary"
              onClick={handleExportPNG}
              disabled={exporting || loading}
              style={{ padding: '14px 16px', justifyContent: 'center' }}
            >
              {exporting ? '导出中…' : '📷 导出 PNG（1600×1100）'}
            </button>
            <button
              className="btn btn-accent"
              onClick={handleExportPDF}
              disabled={loading}
              style={{ padding: '14px 16px', justifyContent: 'center' }}
            >
              {exporting ? '导出中…' : '📄 导出 PDF（浏览器打印）'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '12px 0 0', lineHeight: 1.6 }}>
            💡 <strong>PNG：</strong>拖到公众号文章 / 朋友圈 / 飞书文档 / Notion 当配图<br />
            💡 <strong>PDF：</strong>打印给客户 / 留档 / 邮件附件
          </p>
        </div>

        {/* 图谱预览（被导出） */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>⏳ 加载中…</div>
        ) : filteredNodes.current.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            {selectedTopics.size > 0 ? '当前主题过滤下没有资产' : '还没有资产'}
          </div>
        ) : (
          <div className="print-widget" ref={widgetRef} style={{
            background: 'var(--bg-panel)', borderRadius: 10,
            border: '1px solid var(--line)', overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          }}>
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid var(--line)',
              background: 'linear-gradient(180deg, #fafaf7 0%, #fff 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, padding: '3px 8px', background: '#eef2ff', color: '#4f46e5',
                  borderRadius: 10, fontWeight: 600,
                }}>🧠 Insight OS</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                  {userName} 的判断力图谱
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                {filteredNodes.current.length} 张 · {new Date().toLocaleDateString('zh-CN')}
              </span>
            </div>
            <div style={{ position: 'relative', height: 460, background: '#fdfdfb' }}>
              <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            </div>
            <div style={{
              padding: '10px 18px', borderTop: '1px solid #f1f5f9',
              background: '#fafaf7', fontSize: 11, color: '#94a3b8',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>{filteredNodes.current.length} 张资产卡 · 按主题聚类</span>
              <span>由 Insight OS 生成</span>
            </div>
          </div>
        )}

        {/* 使用场景 */}
        <div className="card" style={{ padding: 20, marginBottom: 16, background: 'var(--primary-soft)', border: '1px solid var(--primary)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)', margin: '0 0 12px' }}>💡 使用场景</h2>
          <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>
            <li><strong>公众号头图：</strong>导出 PNG 拖到文章开头，"我的方法论"一眼可见</li>
            <li><strong>朋友圈：</strong>导 PNG 直接发，配文"今年的判断"互动</li>
            <li><strong>客户提案：</strong>导 PDF 附在邮件，正文"我们用的方法论"说服力+1</li>
            <li><strong>团队对齐：</strong>导 PDF 群发，"我们团队的判断库"</li>
            <li><strong>个人主页：</strong>导 PNG 贴到 LinkedIn / About.me 当方法论图</li>
          </ul>
        </div>

        {/* V2.0 改进 */}
        <div style={{ padding: 16, background: 'var(--warning-bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
          <strong>V1.6 改进：</strong>
          <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
            <li>✅ 改成本地导出 PNG / PDF（不需要域名）</li>
            <li>✅ 主题过滤（选哪些主题进图谱）</li>
            <li>✅ retina 2x 分辨率输出（PNG 1600×1100 @2x）</li>
          </ul>
          <strong style={{ marginTop: 8, display: 'block' }}>V2.0 改进：</strong>
          <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
            <li>iframe 嵌入代码（用户有固定域名时）</li>
            <li>每周自动导出（Weekly Reflection 联动）</li>
            <li>深色主题 / 浅色主题切换</li>
          </ul>
        </div>
      </div>
    </>
  );
}
