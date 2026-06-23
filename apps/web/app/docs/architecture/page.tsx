'use client';

import Link from 'next/link';
import { Fragment } from 'react';

const ARCH_LAYERS = [
  { key: 'ui', icon: '🖥️', title: 'UI 层', main: 'Next.js 15 + Electron 32', sub: '仪表盘 · 写作 · 资产库 · 图谱 · /settings/kernel' },
  { key: 'biz', icon: '⚙️', title: '业务层', main: '22 API routes · 4 packages', sub: 'core · db · llm · indexer' },
  { key: 'data', icon: '💾', title: '数据层', main: 'SQLite + vault/*.md', sub: '9 表 · FTS5 · WAL · 不上云' },
  { key: 'llm', icon: '🤖', title: 'LLM', main: '任何 OpenAI 兼容服务', sub: 'DeepSeek / Ollama / Qwen / GLM' },
];

const KERNEL_BY_STAGE = [
  {
    stage: '采集',
    dot: 's3',
    routes: [
      { name: 'intake', desc: '（公众号 / 笔记整理）' },
      { name: 'calibrate', desc: '（轻量卡校准）' },
      { name: 'upgrade', desc: '（升级资产卡）' },
      { name: 'classify', desc: '（主题分类）' },
    ],
  },
  {
    stage: '整理',
    dot: 's3',
    routes: [
      { name: 'promote', desc: '（候选升级）' },
      { name: 'promote-batch', desc: '（批量升级）' },
      { name: 'merge', desc: '（资产合并）' },
      { name: 'style-extractor', desc: '（反推风格）' },
    ],
  },
  {
    stage: '输出',
    dot: 's3',
    routes: [
      { name: 'writing/scaffold', desc: '（骨架）' },
      { name: 'writing/companion', desc: '（陪练）' },
      { name: 'output/multi', desc: '（多场景）' },
      { name: 'output/review', desc: '（改稿）' },
      { name: 'output/vision', desc: '（多模态）' },
      { name: 'output/try-write', desc: '（试写）' },
      { name: 'output/verify-data', desc: '（数据校验）' },
      { name: 'ai-taste-check', desc: '（AI 味自检）' },
      { name: 'topic/[id]/kernel', desc: '（主题内核生成）' },
    ],
  },
  {
    stage: '对话',
    dot: 's3',
    routes: [
      { name: 'assistant/chat', desc: '（洞察助手 · 路由 + 总结）' },
      { name: 'assistant/chat', desc: '（流式输出）' },
    ],
  },
];

const DATA_FLOW = [
  { stage: '① 采集', input: '原文 / URL / 语音转写', output: '轻量卡（title + insight + tags）', storage: 'assets (type=light)', highlight: false },
  { stage: '② 整理', input: '轻量卡', output: '资产卡（反常识 + E0-E5）+ 主题', storage: 'assets + topics', highlight: false },
  { stage: '③ 输出', input: '主题 + 卡 + 5 维度', output: '写作骨架（5 sections）', storage: 'outputs · ←Kernel', highlight: true },
  { stage: '改稿', input: '选中段落 + 改稿指令', output: '改写建议 + reasoning', storage: '流式输出', highlight: false },
  { stage: '反馈', input: '客户反应 / 触动点 / 追问', output: 'feedback 记录', storage: 'feedback', highlight: false },
];

export default function ArchitectureDocsPage() {
  return (
    <div style={{ maxWidth: 920 }}>
      <style>{`
        .arch-wrap { max-width: 920px; margin: 0 auto; padding: 40px 32px 60px; }
        .arch-eyebrow { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: #2f6f5e; margin-bottom: 12px; }
        .arch-h1 { font-family: 'DM Serif Display', serif; font-size: 36px; line-height: 1.15; color: #14171e; margin: 0 0 12px; letter-spacing: -0.01em; font-weight: 400; }
        .arch-h2 { font-family: 'DM Serif Display', serif; font-size: 22px; font-weight: 400; color: #14171e; margin: 0 0 4px; letter-spacing: -0.005em; }
        .arch-h2 .num { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #7c7a72; margin-right: 8px; vertical-align: middle; }
        .arch-lede { font-size: 16px; color: #3a4256; margin: 0 0 40px; line-height: 1.55; max-width: 680px; }
        .arch-lede strong { color: #2f6f5e; font-weight: 600; }
        .arch-sub { color: #7c7a72; font-size: 13px; margin: 0 0 18px; }
        .arch-section { margin-bottom: 40px; }

        /* Loop */
        .arch-loop {
          background: #ffffff;
          border: 1px solid #e9e3d6;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }
        .arch-steps { display: flex; align-items: stretch; gap: 0; margin-top: 8px; }
        .arch-step { flex: 1; background: #f7f5f0; border: 1px solid #e9e3d6; border-radius: 10px; padding: 16px; position: relative; }
        .arch-step-num { width: 24px; height: 24px; border-radius: 50%; background: #2f6f5e; color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace; margin-bottom: 8px; }
        .arch-step-name { font-size: 15px; font-weight: 600; color: #14171e; margin-bottom: 3px; }
        .arch-step-en { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #7c7a72; margin-bottom: 8px; }
        .arch-step-flow { font-size: 12px; color: #3a4256; line-height: 1.55; margin-bottom: 8px; }
        .arch-step-flow strong { color: #14171e; font-weight: 600; }
        .arch-step-tag { display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 7px; border-radius: 4px; background: rgba(47, 111, 94, 0.08); color: #2f6f5e; }
        .arch-step.kernel-step .arch-step-num { background: #6366f1; }
        .arch-step.kernel-step .arch-step-tag { background: rgba(99, 102, 241, 0.10); color: #6366f1; }
        .arch-step-arrow { display: flex; align-items: center; justify-content: center; width: 32px; flex-shrink: 0; color: #7c7a72; }

        .arch-loop-feedback { margin-top: 16px; padding: 10px 14px; background: rgba(201, 123, 63, 0.10); border-radius: 8px; font-size: 12px; color: #c97b3f; text-align: center; font-weight: 500; }
        .arch-loop-feedback strong { font-weight: 700; }

        /* Flow table */
        .arch-flow {
          background: #ffffff;
          border: 1px solid #e9e3d6;
          border-radius: 14px;
          padding: 22px 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }
        .arch-flow-row {
          display: grid;
          grid-template-columns: 110px 1fr 1fr 130px;
          gap: 12px;
          align-items: center;
          padding: 9px 0;
          border-bottom: 1px dashed #f0eadc;
          font-size: 13px;
        }
        .arch-flow-row:last-child { border-bottom: none; }
        .arch-flow-row.arch-flow-h {
          font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #7c7a72; border-bottom: 1px solid #e9e3d6; padding-bottom: 6px;
        }
        .arch-flow-row .stage { font-weight: 600; color: #14171e; }
        .arch-flow-row .in, .arch-flow-row .out { color: #3a4256; line-height: 1.5; }
        .arch-flow-row .tag { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #7c7a72; }
        .arch-flow-row.highlight { background: rgba(99, 102, 241, 0.10); border-radius: 6px; padding: 11px 9px; margin: 4px -9px; }
        .arch-flow-row.highlight .stage { color: #6366f1; }
        .arch-flow-row.highlight .tag { color: #6366f1; font-weight: 700; }

        /* Architecture flow */
        .arch-arch {
          background: #ffffff;
          border: 1px solid #e9e3d6;
          border-radius: 14px;
          padding: 22px 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }
        .arch-arch-flow { display: flex; align-items: stretch; gap: 0; }
        .arch-arch-layer {
          flex: 1;
          background: #f7f5f0;
          border: 1px solid #e9e3d6;
          border-radius: 10px;
          padding: 14px 16px;
          text-align: left;
        }
        .arch-arch-layer + .arch-arch-layer { margin-left: 22px; }
        .arch-arch-icon { font-size: 18px; margin-bottom: 6px; }
        .arch-arch-title { font-size: 12px; font-weight: 700; color: #14171e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .arch-arch-desc { font-size: 12px; color: #7c7a72; line-height: 1.5; margin: 0; }
        .arch-arch-desc strong { color: #3a4256; font-weight: 600; }
        .arch-arch-arrow { display: flex; align-items: center; padding: 0 4px; color: #7c7a72; flex-shrink: 0; }

        /* Kernel map */
        .arch-map {
          background: #ffffff;
          border: 1px solid #e9e3d6;
          border-radius: 14px;
          padding: 22px 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }
        .arch-map-row {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: 16px;
          padding: 9px 0;
          align-items: center;
          border-bottom: 1px dashed #f0eadc;
          font-size: 12px;
        }
        .arch-map-row:last-child { border-bottom: none; }
        .arch-map-stage { font-weight: 600; color: #14171e; display: flex; align-items: center; gap: 8px; }
        .arch-map-dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }
        .arch-map-desc code { font-family: 'JetBrains Mono', monospace; font-size: 11px; background: #f7f5f0; padding: 1px 5px; border-radius: 3px; color: #14171e; margin-right: 6px; }

        .arch-breadcrumb { font-size: 11px; font-weight: 600; color: #7c7a72; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .arch-breadcrumb a { color: #7c7a72; text-decoration: none; }
        .arch-breadcrumb a:hover { color: #2f6f5e; }
        .arch-breadcrumb .current { color: #2f6f5e; }

        @media (max-width: 768px) {
          .arch-h1 { font-size: 28px; }
          .arch-steps { flex-direction: column; }
          .arch-step-arrow { width: 100%; height: 24px; transform: rotate(90deg); }
          .arch-flow-row { grid-template-columns: 1fr; gap: 4px; }
          .arch-arch-flow { flex-direction: column; }
          .arch-arch-layer + .arch-arch-layer { margin-left: 0; margin-top: 10px; }
          .arch-arch-arrow { width: 100%; justify-content: center; }
        }
      `}</style>

      <div className="arch-breadcrumb">
        <Link href="/docs" style={{ color: 'inherit', textDecoration: 'none' }}>📖 操作手册</Link>
        {' › '}
        <span className="current">架构与业务流</span>
      </div>

      <div className="arch-eyebrow">Insight Asset OS · 架构与业务流</div>
      <h1 className="arch-h1">把零散经验变成可调用的判断力</h1>
      <p className="arch-lede">
        一个<strong>本地优先的个人思想资产工作台</strong>。
        3 步业务循环（采集 → 整理 → 输出）+ Insight Kernel 让 LLM 输出自动带你的判断立场。
      </p>

      {/* 1. 业务循环 */}
      <div className="arch-section">
        <h2 className="arch-h2"><span className="num">1</span>业务循环</h2>
        <p className="arch-sub">用户每天用产品做的事 —— 3 步循环，闭环。</p>
        <div className="arch-loop">
          <div className="arch-steps">
            <div className="arch-step">
              <div className="arch-step-num">1</div>
              <div className="arch-step-name">采集</div>
              <div className="arch-step-en">Inbox · Collect</div>
              <div className="arch-step-flow">
                笔记 / 公众号 / 书摘 / 录音<br/>
                <strong>→ LLM 整理</strong><br/>
                → 轻量卡（Light Card）
              </div>
              <span className="arch-step-tag">v0.x 起</span>
            </div>

            <div className="arch-step-arrow">
              <svg width="32" height="14" viewBox="0 0 32 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="0" y1="7" x2="26" y2="7" />
                <polyline points="22 3 26 7 22 11" />
              </svg>
            </div>

            <div className="arch-step">
              <div className="arch-step-num">2</div>
              <div className="arch-step-name">整理</div>
              <div className="arch-step-en">Curate · Upgrade</div>
              <div className="arch-step-flow">
                轻量卡<br/>
                <strong>→ 人工校准 / LLM 升级</strong><br/>
                → 资产卡 + 主题分类 + E0-E5<br/>
                → 可关联 Insight Kernel
              </div>
              <span className="arch-step-tag">v0.x 起</span>
            </div>

            <div className="arch-step-arrow">
              <svg width="32" height="14" viewBox="0 0 32 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="0" y1="7" x2="26" y2="7" />
                <polyline points="22 3 26 7 22 11" />
              </svg>
            </div>

            <div className="arch-step kernel-step">
              <div className="arch-step-num">3</div>
              <div className="arch-step-name">输出</div>
              <div className="arch-step-en">Write · Publish</div>
              <div className="arch-step-flow">
                主题 + 核心 + 3-5 张卡<br/>
                <strong>+ Insight Kernel 自动注入</strong><br/>
                → 写作骨架 → 改稿 → 发布<br/>
                → 输出历史 + 反馈 → 升级资产
              </div>
              <span className="arch-step-tag">v1.4 增强</span>
            </div>
          </div>

          <div className="arch-loop-feedback">
            闭环：<strong>反馈 → 升级证据等级</strong> · 资产被多次引用 → 主题思想内核自动重生成 · Insight Kernel 越用越准
          </div>
        </div>
      </div>

      {/* 2. 数据流转 */}
      <div className="arch-section">
        <h2 className="arch-h2"><span className="num">2</span>数据流转</h2>
        <p className="arch-sub">从用户操作到 LLM 输出，每一步数据长什么样、存在哪。</p>
        <div className="arch-flow">
          <div className="arch-flow-row arch-flow-h">
            <div>阶段</div>
            <div>输入</div>
            <div>输出</div>
            <div>存储</div>
          </div>
          {DATA_FLOW.map((r, i) => (
            <div key={i} className={`arch-flow-row${r.highlight ? ' highlight' : ''}`}>
              <div className="stage">{r.stage}</div>
              <div className="in">{r.input}</div>
              <div className="out">{r.output}</div>
              <div className="tag">{r.storage}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 技术架构 */}
      <div className="arch-section">
        <h2 className="arch-h2"><span className="num">3</span>技术架构</h2>
        <p className="arch-sub">4 层支撑业务循环 —— 简单到可独立替换。</p>
        <div className="arch-arch">
          <div className="arch-arch-flow">
            {ARCH_LAYERS.map((layer, i) => (
              <Fragment key={layer.key}>
                {i > 0 && (
                  <div className="arch-arch-arrow">
                    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="0" y1="7" x2="10" y2="7" />
                      <polyline points="6 3 10 7 6 11" />
                    </svg>
                  </div>
                )}
                <div className="arch-arch-layer">
                  <div className="arch-arch-icon">{layer.icon}</div>
                  <div className="arch-arch-title">{layer.title}</div>
                  <div className="arch-arch-desc">
                    <strong>{layer.main}</strong><br/>
                    {layer.sub}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Insight Kernel 注入点 */}
      <div className="arch-section">
        <h2 className="arch-h2"><span className="num">4</span>Insight Kernel 注入点</h2>
        <p className="arch-sub">v1.4 核心 —— Kernel 在业务层进入，跨 19 个 LLM 调用自动拼接到 system prompt。</p>
        <div className="arch-map">
          {KERNEL_BY_STAGE.map((group, gi) => (
            <div key={gi} className="arch-map-row">
              <div className="arch-map-stage">
                <span className="arch-map-dot" />
                {group.stage}
              </div>
              <div className="arch-map-desc">
                {group.routes.map((r, ri) => (
                  <span key={ri}>
                    <code>{r.name}</code>{r.desc}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        marginTop: 48,
        padding: '16px 20px',
        background: 'var(--bg-subtle, #f7f5f0)',
        borderLeft: '3px solid var(--primary, #2f6f5e)',
        borderRadius: 6,
        fontSize: 13,
        color: 'var(--text-2, #3a4256)',
        lineHeight: 1.6,
      }}>
        💡 想要这张图作为独立 HTML 分享？<br/>
        <code style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          padding: '1px 6px',
          background: 'white',
          borderRadius: 3,
          border: '1px solid var(--line, #e9e3d6)',
        }}>prototype/architecture.html</code> 是同源 HTML 文件，可在浏览器双击打开。
      </div>

      <div style={{ marginTop: 32, fontSize: 13, color: 'var(--text-3, #7c7a72)' }}>
        <strong style={{ color: 'var(--ink, #14171e)' }}>下一步 →</strong>{' '}
        <Link href="/docs/quickstart" style={{ color: 'var(--primary, #2f6f5e)' }}>5 分钟上手</Link>
        {' · '}
        <Link href="/docs/insight-kernel" style={{ color: 'var(--primary, #2f6f5e)' }}>Insight Kernel 详解</Link>
      </div>
    </div>
  );
}
