'use client';

import Link from 'next/link';

export default function ConceptsPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 12,
      }}>
        <Link href="/docs" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>📖 操作手册</Link>
        {' › '}
        <span style={{ color: 'var(--primary)' }}>核心概念</span>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        💡 核心概念
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.6 }}>
        看完这一页，你就理解产品结构 — 怎么从「零散笔记」演化成「判断力资产库」。
      </p>

      <Section title="📇 三类卡片">
        <p>Insight Asset OS 的最小单元是<strong>卡片</strong>。有 3 种类型，区别是「成熟度」不同：</p>

        <Concept
          icon="📝"
          title="轻量卡 (Light Card)"
          color="#94a3b8"
          desc="LLM 整理后未校准的笔记。来源：公众号文章 / 书摘 / 客户对话转录。"
        />
        <Concept
          icon="📚"
          title="资产卡 (Asset Card)"
          color="#1d4ed8"
          desc="人工确认 + 反常识判断 + 证据等级。是产品的核心单元。"
        />
        <Concept
          icon="🧠"
          title="内核卡 (Insight Kernel · V1.4)"
          color="#6366f1"
          desc="你的「判断宪法」 — 4 类 × 4 字段。属于你个人，不属于任何主题。"
        />

        <p style={{ marginTop: 12 }}><strong>演进路径：</strong>轻量卡 → 校准 → 候选池 → 人工确认 → 资产卡。详见 <Link href="/docs/quickstart">5 分钟上手</Link> 第 5 分钟。</p>
      </Section>

      <Section title="📂 主题 (Topic)">
        <p>资产卡可以属于多个主题。主题不是文件夹，是<strong>判断维度</strong>。</p>
        <p style={{ marginBottom: 8 }}>示例：</p>
        <ul>
          <li>「组织治理」主题：12 张资产卡，跨 E0-E4 证据等级</li>
          <li>「AI 落地」主题：8 张资产卡，集中在 E1-E2</li>
        </ul>
        <p>每个主题有 1 个 <strong>主题思想内核 (Topic Kernel)</strong> —— LLM 从该主题下所有资产卡总结的 1 句话 + 200-500 字综合 + 3-5 个核心判断。</p>
        <p>主题内核是 <strong>机器总结</strong>，用户内核是 <strong>人工立场</strong>。两者不同。</p>
      </Section>

      <Section title="📊 证据等级 E0-E5">
        <p>每张资产卡有 <strong>evidenceLevel</strong> 字段，从 E0 到 E5：</p>

        <LevelRow e="E0" label="纯观点" desc="暂无案例 · 通常不可用" />
        <LevelRow e="E1" label="类比案例" desc="有类似案例支持" />
        <LevelRow e="E2" label="真实方案" desc="在项目 / 方案中用过" />
        <LevelRow e="E3" label="客户共鸣" desc="客户沟通中获得共鸣" />
        <LevelRow e="E4" label="方案认可" desc="进入方案并被客户认可" />
        <LevelRow e="E5" label="可复用模块" desc="形成课程 / 工具 / 服务模块" />

        <p style={{ marginTop: 12 }}><strong>反馈会自动升级证据等级：</strong>第一次反馈后 evidenceLevelAfter 自动 +1。</p>
      </Section>

      <Section title="✍️ 写作工作流 (Writing Workflow)">
        <p>写作是产品的核心使用场景。流程：</p>
        <ol>
          <li><strong>骨架 (Scaffold)</strong>：选主题 + 1 句核心 + 3-5 张资产 → LLM 生成 5 章节结构化大纲</li>
          <li><strong>草稿 (Draft)</strong>：每章节 hover「展开写」→ 写正文（LLM 改稿陪练可用）</li>
          <li><strong>已发布 (Published)</strong>：写完发布，自动进入输出历史</li>
        </ol>
        <p>写作风格由 <strong>5 维度 preset</strong> 控制（语气 / 节奏 / 结构 / 长度 / 质量），3 套 ship-ready 预设：</p>
        <ul>
          <li><strong>vincent-standard</strong>（默认）：口语化、有判断、不说教</li>
          <li><strong>client-comm</strong>：客户沟通，简洁正式</li>
          <li><strong>academic</strong>：学术风，长篇论证</li>
        </ul>
      </Section>

      <Section title="📊 主题地图 vs 资产图谱">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-3)', fontWeight: 600 }}>视图</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-3)', fontWeight: 600 }}>看什么</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-3)', fontWeight: 600 }}>何时用</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>资产地图 <code>/map</code></td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>主题分组卡片网格</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>「我组织治理有几张卡」</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>资产图谱 <code>/graph</code></td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>力导向关系网络</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>「主题间怎么关联」</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>写作历史 <code>/output</code></td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>输出列表 + 反馈状态</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>「我写过什么，客户反应」</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="🧠 关于 Insight Kernel">
        <p>这是 V1.4 最重要的概念。详见 <Link href="/docs/insight-kernel">Insight Kernel 详解</Link>。</p>
        <p>一句话：<strong>你的「判断宪法」</strong> — 4 类（信念/反常识/擅长/挑战）× 4 字段（content/confidence/counterExample/scope）。每次 LLM 调用自动注入到 system prompt，让所有输出「像你写的」。</p>
      </Section>

      <Divider />

      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: '32px 0 12px' }}>
        🎯 接下来
      </h2>
      <ul style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }}>
        <li>想用 Insight Kernel？ → <Link href="/docs/insight-kernel">Insight Kernel 详解</Link></li>
        <li>遇到问题？ → <Link href="/docs/faq">FAQ + 故障排查</Link></li>
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px', paddingTop: 8, borderTop: '1px solid var(--line-soft)' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}

function Concept({ icon, title, color, desc }: { icon: string; title: string; color: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: 12, marginTop: 8,
      background: 'var(--bg-subtle)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 6,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

function LevelRow({ e, label, desc }: { e: string; label: string; desc: string }) {
  const color = e === 'E5' ? '#10b981' : e === 'E4' ? '#06b6d4' : e === 'E3' ? '#3b82f6' : e === 'E2' ? '#6366f1' : e === 'E1' ? '#94a3b8' : '#cbd5e1';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', fontSize: 13 }}>
      <span style={{
        minWidth: 32, padding: '2px 8px', fontSize: 11, fontWeight: 700,
        background: color, color: 'white', borderRadius: 8,
        fontFamily: 'JetBrains Mono, monospace', textAlign: 'center',
      }}>{e}</span>
      <span style={{ minWidth: 100, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
      <span style={{ color: 'var(--text-2)', flex: 1 }}>{desc}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line-soft)', margin: '32px 0' }} />;
}
