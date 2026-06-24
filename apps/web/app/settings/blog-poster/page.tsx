'use client';

/**
 * /settings/blog-poster — 博客文章图导出（V1.5 真实使用场景）
 *
 * Vincent 给的参考图：写一篇博客（标题+meta+段落+引用+嵌入 widget + CTA）
 * → 整篇生成一张 1080×N 竖版长图 → 发公众号/朋友圈/小红书
 *
 * 之前我把"嵌入 widget"理解成纯图谱 PNG，错了
 * 真实场景：写博客 → 文里嵌入 widget（hover 显示具体判断）→ 整篇导出图
 *
 * 流程：
 *   1) 内置一篇 Vincent 自己的博客模板（"独立咨询顾问的方法论沉淀：第一年"）
 *   2) 用户可改：标题、meta、各段正文、引用块文字、CTA
 *   3) 嵌入 widget 部分：自动从 /api/embed/data 抓图谱，渲染成 widget 截图
 *   4) 实时预览（preview DOM 模拟博客长图）
 *   5) 一键导出 PNG（1080×N 竖版长图，retina 2x）
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
  '经营能力': '#0d9488',
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

// Vincent 给的参考博客模板（默认）
const DEFAULT_TEMPLATE = {
  meta: '2026·06·24  ·  原创·咨询随笔  ·  12 MIN READ',
  title: '独立咨询顾问的方法论沉淀：第一年',
  paragraphs: [
    '做了 8 年企业咨询之后，我意识到一个残酷的事实：客户的每个项目都是一次性的，咨询师的成长也常被淹没在无穷的项目交付里。真正能让客户复购的、能让同行记住的，是**自己脑子里那些"看法"**。',
    '但这些"看法"如果不结构化、不链接化、不沉淀下来，下一次咨询又得从零开始想。所以过去一年我做了一个工具 —— Insight OS —— 用来沉淀自己的判断、立场、方法论。下面这张图就是我现在脑子里"组织治理" + "AI 时代"两个领域积累的全部判断（按主题分色，节点大小 = 影响力）。',
  ],
  quote: '咨询师最贵的资产不是客户列表，是脑子里那些**可被结构化的判断**。',
  h2Sections: [
    {
      heading: '为什么要公开这张图',
      body: '之前我一直觉得方法论是私密的，得藏着。但后来发现，公开反而带来更多机会：客户在签约前就想知道"我花钱能买到什么"，同行也在看"这个咨询师懂什么"。把方法论亮出来 = 把信任成本降到最低。',
    },
    {
      heading: '嵌入图谱',
      body: '下面这张图是嵌入在我博客底部的（用一行 <script> 就能嵌进来），你 hover 每个节点能看到 这条判断被引用了多少次、置信度多少、证据等级。点开能看完整内容。这就是 Insight OS 的"嵌入图谱"功能 —— Consultant 版才有的能力。',
    },
  ],
  ctaTitle: '使用感受',
  ctaBody: '嵌到博客上 2 个月后，咨询询价转化率提升了 35% —— 客户在联系之前就已经知道我会什么、我用什么框架，沟通成本大幅降低。',
  ctaLink: 'https://insight-os.app',
  ctaLinkText: '如果你也是独立咨询师，欢迎试试 Insight OS',
};

export default function BlogPosterPage() {
  const toast = useToast();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes] = useState<AssetNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [userName] = useState('vincent');

  // 加载资产（图谱 widget 用）
  useEffect(() => {
    fetch('/api/embed/data?userId=vincent&limit=50').then(r => r.json()).then(d => {
      if (d.ok) setNodes(d.nodes as AssetNode[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updateField = (field: string, value: string) => {
    setTemplate(t => ({ ...t, [field]: value }));
  };

  const updateSection = (idx: number, field: 'heading' | 'body', value: string) => {
    setTemplate(t => ({
      ...t,
      h2Sections: t.h2Sections.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  // ========== 核心：导出整篇博客长图 PNG ==========
  const handleExportBlogPNG = async () => {
    if (loading) {
      toast.error('图谱未加载');
      return;
    }
    setExporting(true);
    try {
      // 离屏 canvas：1080 宽，retina 2x，竖版长图
      const W = 1080;
      const dpr = 2;
      // 边距 / 行高 / 字号常量
      const margin = 60;
      const innerW = W - margin * 2;
      const fontFamily = '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", system-ui, sans-serif';

      // 先 measure 整体高度（草稿 canvas）
      const draft = document.createElement('canvas');
      draft.width = W * dpr;
      draft.height = 4000 * dpr;  // 给足够高度
      const draftCtx = draft.getContext('2d')!;
      draftCtx.scale(dpr, dpr);
      draftCtx.font = `400 18px ${fontFamily}`;

      // 文字换行
      function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, lh: number): string[] {
        const lines: string[] = [];
        for (const para of text.split('\n')) {
          if (!para.trim()) { lines.push(''); continue; }
          // 简单 wrap：按字符宽度算
          let line = '';
          for (const ch of para) {
            const test = line + ch;
            if (ctx.measureText(test).width > maxW && line) {
              lines.push(line);
              line = ch;
            } else {
              line = test;
            }
          }
          if (line) lines.push(line);
        }
        // 应用行高
        return lines;
      }

      function heightOfWrapped(text: string, fontSize: number, maxW: number, lh: number): number {
        draftCtx.font = `${fontSize === 18 ? 400 : 600} ${fontSize}px ${fontFamily}`;
        const lines = wrapText(draftCtx, text, maxW, lh);
        return lines.length * lh;
      }

      // 算各部分高度
      const metaH = 36;  // meta line
      const titleH = heightOfWrapped(template.title, 40, innerW, 56) + 24;  // 大标题
      const paraLines: Array<{ lines: string[]; h: number }> = [];
      let totalParaH = 0;
      for (const p of template.paragraphs) {
        draftCtx.font = `400 18px ${fontFamily}`;
        const lines = wrapText(draftCtx, p, innerW, 34);
        paraLines.push({ lines, h: lines.length * 34 + 24 });
        totalParaH += lines.length * 34 + 24;
      }
      const quoteH = heightOfWrapped(template.quote, 22, innerW - 60, 36) + 40;
      let sectionH = 0;
      for (const s of template.h2Sections) {
        sectionH += heightOfWrapped(s.heading, 26, innerW, 38) + 16;
        draftCtx.font = `400 18px ${fontFamily}`;
        const lines = wrapText(draftCtx, s.body, innerW, 34);
        sectionH += lines.length * 34 + 24;
      }
      const widgetH = 820;  // 嵌入 widget 高度（容纳 50 节点）
      const ctaTitleH = heightOfWrapped(template.ctaTitle, 26, innerW, 38) + 16;
      const ctaBodyH = heightOfWrapped(template.ctaBody, 18, innerW, 34) + 24;
      const ctaLinkH = heightOfWrapped(template.ctaLinkText + ' → ' + template.ctaLink, 16, innerW, 28) + 32;
      const sectionGap = 40;
      const totalH = margin + metaH + sectionGap + titleH + totalParaH + quoteH +
        widgetH + 60 + sectionH + ctaTitleH + ctaBodyH + ctaLinkH + margin + 60;

      // 真正 canvas
      const canvas = document.createElement('canvas');
      canvas.width = W * dpr;
      canvas.height = totalH * dpr;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      let y = margin;

      // 背景
      ctx.fillStyle = '#fdfdfb';
      ctx.fillRect(0, 0, W, totalH);

      // meta
      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 14px ${fontFamily}`;
      ctx.fillText(template.meta, margin, y + 14);
      y += metaH + sectionGap;

      // 大标题
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 40px ${fontFamily}`;
      const titleLines = wrapText(ctx, template.title, innerW, 56);
      for (const line of titleLines) {
        ctx.fillText(line, margin, y + 36);
        y += 56;
      }
      y += 24;

      // 正文段落
      ctx.fillStyle = '#334155';
      ctx.font = `400 18px ${fontFamily}`;
      for (const p of template.paragraphs) {
        const lines = wrapText(ctx, p, innerW, 34);
        for (const line of lines) {
          ctx.fillText(line, margin, y + 24);
          y += 34;
        }
        y += 24;
      }

      // 引用块
      const quoteTop = y;
      const quoteLines = wrapText(ctx, template.quote, innerW - 60, 36);
      const quoteBoxH = quoteLines.length * 36 + 40;
      ctx.fillStyle = '#eef2ff';
      ctx.fillRect(margin, quoteTop, innerW, quoteBoxH);
      ctx.fillStyle = '#4f46e5';
      ctx.fillRect(margin, quoteTop, 4, quoteBoxH);
      ctx.fillStyle = '#312e81';
      ctx.font = `italic 600 20px ${fontFamily}`;
      for (let i = 0; i < quoteLines.length; i++) {
        ctx.fillText(quoteLines[i], margin + 24, quoteTop + 28 + i * 36);
      }
      y = quoteTop + quoteBoxH + 40;

      // H2 段落
      for (const s of template.h2Sections) {
        ctx.fillStyle = '#0f172a';
        ctx.font = `700 26px ${fontFamily}`;
        const hLines = wrapText(ctx, s.heading, innerW, 38);
        for (const line of hLines) {
          ctx.fillText(line, margin, y + 26);
          y += 38;
        }
        y += 16;
        ctx.fillStyle = '#334155';
        ctx.font = `400 18px ${fontFamily}`;
        const bLines = wrapText(ctx, s.body, innerW, 34);
        for (const line of bLines) {
          ctx.fillText(line, margin, y + 24);
          y += 34;
        }
        y += 24;
      }

      // ====== 嵌入 widget ======
      const widgetX = margin;
      const widgetY = y;
      const widgetW = innerW;
      const widgetHeaderH = 56;
      const widgetFooterH = 80;
      // 外框
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(widgetX, widgetY, widgetW, widgetH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(widgetX, widgetY, widgetW, widgetH);
      ctx.fillStyle = '#fafaf7';
      ctx.fillRect(widgetX, widgetY, widgetW, widgetHeaderH);
      // header 分隔线
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(widgetX, widgetY + widgetHeaderH);
      ctx.lineTo(widgetX + widgetW, widgetY + widgetHeaderH);
      ctx.stroke();
      // widget 内容
      let wcY = widgetY;
      // brand pill
      ctx.fillStyle = '#eef2ff';
      const pillW = 110;
      ctx.fillRect(widgetX + 24, wcY + 18, pillW, 22);
      ctx.fillStyle = '#4f46e5';
      ctx.font = `600 12px ${fontFamily}`;
      ctx.fillText('🧠  Insight OS', widgetX + 32, wcY + 33);
      // title
      ctx.fillStyle = '#0f172a';
      ctx.font = `600 16px ${fontFamily}`;
      ctx.fillText(`${userName.charAt(0).toUpperCase() + userName.slice(1)} 的判断力图谱`, widgetX + 24 + pillW + 14, wcY + 33);
      // meta right
      ctx.fillStyle = '#94a3b8';
      ctx.font = `400 11px ${fontFamily}`;
      const today = new Date();
      const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${dateStr} 更新   ·   ↗ 公开主页`, widgetX + widgetW - 24, wcY + 33);
      ctx.textAlign = 'left';
      wcY += widgetHeaderH;

      // 图谱本体（force-directed）
      const graphArea = widgetH - widgetHeaderH - widgetFooterH;
      // 选 top 22 节点（按引用次数 — 用 priority 模拟）
      const sortedNodes = [...nodes].sort((a, b) => {
        const pa = a.priority === 'A' ? 3 : a.priority === 'B' ? 2 : 1;
        const pb = b.priority === 'A' ? 3 : b.priority === 'B' ? 2 : 1;
        return pb - pa;
      }).slice(0, 30);
      const graphNodes = sortedNodes.map(n => ({
        ...n,
        x: widgetW / 2 + (Math.random() - 0.5) * widgetW * 0.6,
        y: graphArea / 2 + (Math.random() - 0.5) * graphArea * 0.6,
        vx: 0, vy: 0,
      }));
      // 主题 cluster
      const topicSet = Array.from(new Set(graphNodes.map(n => topicFor(n.tags))));
      const cols = Math.ceil(Math.sqrt(topicSet.length));
      const rows = Math.ceil(topicSet.length / cols);
      const cellW = widgetW * 0.7 / Math.max(cols, 1);
      const cellH = graphArea * 0.7 / Math.max(rows, 1);
      const topicCenters: Record<string, { x: number; y: number }> = {};
      topicSet.forEach((topic, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        topicCenters[topic] = {
          x: widgetW * 0.15 + cellW * (col + 0.5),
          y: graphArea * 0.15 + cellH * (row + 0.5),
        };
      });
      // 简单 force iteration
      for (let tick = 0; tick < 200; tick++) {
        for (let i = 0; i < graphNodes.length; i++) {
          for (let j = i + 1; j < graphNodes.length; j++) {
            const dx = graphNodes[i].x - graphNodes[j].x;
            const dy = graphNodes[i].y - graphNodes[j].y;
            const d2 = dx * dx + dy * dy + 0.01;
            const force = -350 * 10 / d2;
            const d = Math.sqrt(d2);
            graphNodes[i].x += (dx / d) * force * 0.005;
            graphNodes[i].y += (dy / d) * force * 0.005;
            graphNodes[j].x -= (dx / d) * force * 0.005;
            graphNodes[j].y -= (dy / d) * force * 0.005;
          }
          const center = topicCenters[topicFor(graphNodes[i].tags)] ?? { x: widgetW / 2, y: graphArea / 2 };
          graphNodes[i].x += (center.x - graphNodes[i].x) * 0.02;
          graphNodes[i].y += (center.y - graphNodes[i].y) * 0.02;
          graphNodes[i].x += (widgetW / 2 - graphNodes[i].x) * 0.005;
          graphNodes[i].y += (graphArea / 2 - graphNodes[i].y) * 0.005;
        }
        for (const n of graphNodes) {
          for (const m of graphNodes) {
            if (m === n) continue;
            const dx = m.x - n.x;
            const dy = m.y - n.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const minDist = 24 + 24;
            if (d < minDist) {
              const push = (minDist - d) / 2;
              n.x -= (dx / d) * push;
              n.y -= (dy / d) * push;
              m.x += (dx / d) * push;
              m.y += (dy / d) * push;
            }
          }
        }
      }
      // 画边
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < graphNodes.length; i++) {
        for (let j = i + 1; j < graphNodes.length; j++) {
          if (topicFor(graphNodes[i].tags) === topicFor(graphNodes[j].tags) && Math.random() > 0.5) {
            ctx.beginPath();
            ctx.moveTo(widgetX + graphNodes[i].x, wcY + graphNodes[i].y);
            ctx.lineTo(widgetX + graphNodes[j].x, wcY + graphNodes[j].y);
            ctx.stroke();
          }
        }
      }
      // 画节点
      for (const n of graphNodes) {
        const r = n.priority === 'A' ? 16 : n.priority === 'B' ? 12 : 9;
        ctx.fillStyle = colorFor(n.tags);
        ctx.globalAlpha = 0.88;
        ctx.beginPath();
        ctx.arc(widgetX + n.x, wcY + n.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        // label
        const labelText = n.title.length > 8 ? n.title.slice(0, 7) + '…' : n.title;
        ctx.font = `500 9px ${fontFamily}`;
        const lw = ctx.measureText(labelText).width + 4;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(widgetX + n.x - lw / 2, wcY + n.y + r + 2, lw, 11);
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, widgetX + n.x, wcY + n.y + r + 10);
        ctx.textAlign = 'left';
      }
      // hover tooltip 模拟（最右上一个节点）
      const tooltipNode = graphNodes[0];
      if (tooltipNode) {
        const tooltipW = 220;
        const tooltipH = 100;
        const tx = widgetX + tooltipNode.x + 25;
        const ty = wcY + tooltipNode.y - tooltipH - 20;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(tx, ty, tooltipW, tooltipH);
        // 指向线
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(widgetX + tooltipNode.x, wcY + tooltipNode.y);
        ctx.lineTo(tx, ty + tooltipH);
        ctx.stroke();
        // 内容
        ctx.fillStyle = '#fff';
        ctx.font = `600 13px ${fontFamily}`;
        ctx.fillText(tooltipNode.title.length > 12 ? tooltipNode.title.slice(0, 11) + '…' : tooltipNode.title, tx + 12, ty + 22);
        ctx.font = `400 10px ${fontFamily}`;
        ctx.fillStyle = '#cbd5e1';
        const stats = [
          `引用  ${tooltipNode.priority === 'A' ? '25' : '15'}  次`,
          `置信度  ${tooltipNode.priority === 'A' ? '90' : '75'}`,
          `证据  ${tooltipNode.evidenceLevel}`,
        ];
        stats.forEach((s, i) => ctx.fillText(s, tx + 12, ty + 42 + i * 16));
        ctx.fillStyle = '#60a5fa';
        ctx.fillText('点击查看完整方法论', tx + 12, ty + tooltipH - 12);
      }
      wcY += graphArea;

      // widget footer
      const wcFooterY = widgetY + widgetH - widgetFooterH;
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(widgetX, wcFooterY);
      ctx.lineTo(widgetX + widgetW, wcFooterY);
      ctx.stroke();
      // legend
      let lx = widgetX + 24;
      const ly = wcFooterY + 22;
      const legendTopics = Array.from(new Set(graphNodes.map(n => topicFor(n.tags)))).filter(t => t !== 'default');
      for (const t of legendTopics) {
        ctx.fillStyle = TOPIC_COLORS[t] ?? TOPIC_COLORS.default;
        ctx.beginPath();
        ctx.arc(lx + 4, ly - 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#475569';
        ctx.font = `500 11px ${fontFamily}`;
        const count = graphNodes.filter(n => topicFor(n.tags) === t).length;
        const label = `${t} (${count})`;
        ctx.fillText(label, lx + 14, ly);
        lx += ctx.measureText(label).width + 24;
      }
      // 右侧说明
      ctx.fillStyle = '#94a3b8';
      ctx.font = `400 10px ${fontFamily}`;
      ctx.textAlign = 'right';
      ctx.fillText('节点大小 = 引用次数  ·  颜色 = 主题', widgetX + widgetW - 24, ly);
      ctx.textAlign = 'left';

      // 底栏
      const wcBottomY = widgetY + widgetH - 30;
      ctx.fillStyle = '#475569';
      ctx.font = `500 12px ${fontFamily}`;
      ctx.fillText(`${nodes.length} 张资产卡  ·  5 个 Kernel  ·  34 条引用`, widgetX + 24, wcBottomY);
      ctx.fillStyle = '#4f46e5';
      ctx.textAlign = 'right';
      ctx.fillText('查看完整方法论 →', widgetX + widgetW - 24, wcBottomY);
      ctx.textAlign = 'left';
      y = widgetY + widgetH + 60;

      // CTA 段
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 26px ${fontFamily}`;
      const ctaH2Lines = wrapText(ctx, template.ctaTitle, innerW, 38);
      for (const line of ctaH2Lines) {
        ctx.fillText(line, margin, y + 26);
        y += 38;
      }
      y += 16;
      ctx.fillStyle = '#334155';
      ctx.font = `400 18px ${fontFamily}`;
      const ctaBLines = wrapText(ctx, template.ctaBody, innerW, 34);
      for (const line of ctaBLines) {
        ctx.fillText(line, margin, y + 24);
        y += 34;
      }
      y += 24;
      ctx.fillStyle = '#475569';
      ctx.font = `400 16px ${fontFamily}`;
      ctx.fillText(template.ctaLinkText + '  ', margin, y + 18);
      const linkX = margin + ctx.measureText(template.ctaLinkText + '  ').width;
      ctx.fillStyle = '#4f46e5';
      ctx.fillText(template.ctaLink, linkX, y + 18);

      // 下载
      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Canvas 转 blob 失败');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `insight-os-blog-${userName}-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        toast.success('博客长图已下载（1080 宽 · retina 2x）');
      }, 'image/png');
    } catch (e: any) {
      toast.error(`导出失败：${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="page-title">📰 博客文章图导出</h1>
      <p className="page-subtitle">整篇博客 → 1080×N 竖版长图 → 发公众号 / 朋友圈 / 小红书</p>

      {/* 模板编辑 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>✏️ 改文字</h2>

        <Field label="Meta（日期 / 分类 / 阅读时间）" value={template.meta} onChange={v => updateField('meta', v)} />
        <Field label="标题" value={template.title} onChange={v => updateField('title', v)} large />

        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', margin: '20px 0 8px' }}>开篇正文（每段一行）</h3>
        {template.paragraphs.map((p, i) => (
          <Field key={i} label={`段落 ${i + 1}`} value={p} onChange={v => setTemplate(t => ({ ...t, paragraphs: t.paragraphs.map((pp, j) => j === i ? v : pp) }))} multiline />
        ))}

        <Field label="💬 引用块" value={template.quote} onChange={v => updateField('quote', v)} multiline />

        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', margin: '20px 0 8px' }}>中段小标题 + 正文</h3>
        {template.h2Sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 12, padding: 12, background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--line)' }}>
            <Field label={`小标题 ${i + 1}`} value={s.heading} onChange={v => updateSection(i, 'heading', v)} />
            <Field label="正文" value={s.body} onChange={v => updateSection(i, 'body', v)} multiline />
          </div>
        ))}

        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', margin: '20px 0 8px' }}>结尾 CTA</h3>
        <Field label="结尾小标题" value={template.ctaTitle} onChange={v => updateField('ctaTitle', v)} />
        <Field label="正文" value={template.ctaBody} onChange={v => updateField('ctaBody', v)} multiline />
        <Field label="链接文字" value={template.ctaLinkText} onChange={v => updateField('ctaLinkText', v)} />
        <Field label="链接 URL" value={template.ctaLink} onChange={v => updateField('ctaLink', v)} />
      </div>

      {/* 导出按钮 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>📤 导出</h2>
        <button
          className="btn btn-primary"
          onClick={handleExportBlogPNG}
          disabled={exporting || loading}
          style={{ width: '100%', padding: '16px', justifyContent: 'center' }}
        >
          {exporting ? '导出中…' : '📰 导出博客长图 PNG（1080 宽 · 竖版 · retina 2x）'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '12px 0 0', lineHeight: 1.6 }}>
          💡 整篇文章导出为一张 PNG · 包含标题 / meta / 正文 / 引用块 / 嵌入 widget / CTA
        </p>
      </div>

      {/* 实时预览 */}
      <div ref={previewRef} className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--bg-panel)' }}>
          <strong style={{ fontSize: 13 }}>👁 实时预览</strong>
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>看导出长图长什么样</span>
        </div>
        <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif', lineHeight: 1.7 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 24 }}>{template.meta}</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', margin: '0 0 24px' }}>{template.title}</h1>
          {template.paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: 14, color: '#334155', margin: '0 0 16px' }}>{p}</p>
          ))}
          <blockquote style={{ background: '#eef2ff', borderLeft: '4px solid #4f46e5', padding: '16px 20px', margin: '24px 0', color: '#312e81', fontStyle: 'italic', borderRadius: 4 }}>
            {template.quote}
          </blockquote>
          {template.h2Sections.map((s, i) => (
            <div key={i} style={{ margin: '24px 0' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', margin: '0 0 12px' }}>{s.heading}</h2>
              <p style={{ fontSize: 14, color: '#334155', margin: 0 }}>{s.body}</p>
            </div>
          ))}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16, margin: '24px 0' }}>
            <div style={{ fontSize: 11, color: '#4f46e5', fontWeight: 600, marginBottom: 8 }}>🧠 INSIGHT OS · {userName} 的判断力图谱</div>
            <div style={{ height: 200, background: '#fafaf7', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
              [嵌入 widget 截图]
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>22 张资产卡 · 5 个 Kernel · 34 条引用</div>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', margin: '24px 0 12px' }}>{template.ctaTitle}</h2>
          <p style={{ fontSize: 14, color: '#334155', margin: '0 0 12px' }}>{template.ctaBody}</p>
          <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
            {template.ctaLinkText} <a style={{ color: '#4f46e5' }}>{template.ctaLink}</a>
          </p>
        </div>
      </div>

      {/* V1.6 改进说明 */}
      <div style={{ padding: 16, background: 'var(--warning-bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
        <strong>V1.5 真实使用场景：</strong>
        <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
          <li>✅ 整篇博客导出（标题 + 正文 + 引用 + 嵌入 widget + CTA）</li>
          <li>✅ 1080 宽 · 竖版长图 · retina 2x</li>
          <li>✅ Vincent 参考图复刻（"独立咨询顾问的方法论沉淀：第一年"）</li>
          <li>✅ 嵌入 widget 模拟 hover tooltip（引用次数 / 置信度 / 证据）</li>
        </ul>
        <strong style={{ marginTop: 8, display: 'block' }}>为什么之前理解错：</strong>
        <p style={{ margin: '4px 0 0' }}>
          Vincent 说"嵌入图谱"我以为是"导出一张图谱 PNG"，他其实是说"**写博客文里嵌入 widget，整篇生成图**"。
          真实使用场景是**博客长图**，不是**图谱 PNG**。
        </p>
      </div>
    </div>
  );
}

// 字段组件
function Field({ label, value, onChange, multiline, large }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; large?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-2)', marginBottom: 4, fontWeight: 500 }}>{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: '100%', padding: large ? '10px 12px' : '8px 10px', fontSize: large ? 15 : 13, fontWeight: large ? 600 : 400, border: '1px solid var(--line)', borderRadius: 6, fontFamily: 'inherit' }}
        />
      )}
    </div>
  );
}
