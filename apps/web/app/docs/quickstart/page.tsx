'use client';

import Link from 'next/link';

export default function QuickstartPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <Breadcrumb current="5 分钟上手" />

      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        ⚡ 5 分钟上手
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.6 }}>
        从打开看到完整产品形态 → 写第一篇文章 → 看你的判断力资产怎么沉淀。<strong>5 分钟看完就能用。</strong>
      </p>

      <Callout>
        <strong>前置：</strong>已完成 <Link href="/onboarding">onboarding</Link> 的 4 步配置（LLM + Vault 路径 + 示例数据 + Insight Kernel）。
        如果还没装入示例数据，<Link href="/onboarding">点这里回去</Link>。
      </Callout>

      <Section title="第 1 分钟 · 认识你的仪表盘">
        <p>打开 <Link href="/">仪表盘</Link>，你会看到 8 张示例资产 + 2 个主题 + 1 个写作示例。</p>
        <p>每张资产卡都长这样：</p>
        <Block>
          <Row label="标题" value="AI 时代的判断力比知识稀缺" />
          <Row label="一句话洞察" value="知识能搜，判断不能搜" />
          <Row label="反常识" value="AI 让所有人变强是营销叙事" />
          <Row label="证据等级" value="E2（有真实案例）" />
        </Block>
        <p style={{ marginTop: 12 }}><strong>先点开任意一张卡</strong>看完整 .md 内容 — 这就是 Insight Asset OS 的最小单元。</p>
      </Section>

      <Section title="第 2 分钟 · 看资产地图和图谱">
        <p>侧边栏有两类可视化视图：</p>
        <ul>
          <li><Link href="/map"><strong>资产地图</strong></Link>：按主题分组的卡片网格。看「组织治理」主题下有几张卡、覆盖哪些判断。</li>
          <li><Link href="/graph"><strong>资产图谱</strong></Link>：力导向网络图。看不同主题之间怎么关联。节点颜色=主题，hover 单卡 dim 邻域 0.18。</li>
        </ul>
      </Section>

      <Section title="第 3 分钟 · 写第一篇文章">
        <ol>
          <li>点 <Link href="/writing/new"><strong>开始写作</strong></Link></li>
          <li>选主题 → 选 1 句核心判断 → 选 3-5 张资产卡</li>
          <li>点 <strong>生成骨架</strong>：LLM 生成 5 章节结构化大纲</li>
          <li>每章节 hover 显示「展开写」按钮 → 写正文</li>
          <li>写完点 <strong>✓ 发布</strong>，自动进入「已发布」列表</li>
        </ol>
        <Callout>
          <strong>骨架哪里来？</strong>LLM 结合你的主题、核心判断、3-5 张资产卡，<strong>加上你的 Insight Kernel</strong>（如果装了）生成。
          不同 Insight Kernel → 完全不同的「立场感」。这是 V1.4 的核心价值。
        </Callout>
      </Section>

      <Section title="第 4 分钟 · 用洞察助手">
        <p>点右下角 <strong>✨</strong> 浮动按钮 → 输入自然语言：</p>
        <ul>
          <li>「我有几张高等级卡」 → 列出 E3+ 资产</li>
          <li>「组织治理核心思想是什么」 → 调主题内核</li>
          <li>「AI 时代判断力的反常识」 → 调多卡联合输出</li>
          <li>「写作风格 → 改成更口语化」 → 改稿陪练</li>
        </ul>
      </Section>

      <Section title="第 5 分钟 · 反馈回路">
        <p>发布过的文章 → <Link href="/output"><strong>输出历史</strong></Link> → 点开任一篇 → 点 <strong>记录反馈</strong>：</p>
        <ul>
          <li>客户反应（「哪里最触动」）</li>
          <li>证据等级变化（E2 → E3）</li>
          <li>追问（「还能怎么用」）</li>
        </ul>
        <p>反馈累计到 3+ 次的资产会进入候选池 → 你可以选择升级到资产库。</p>
      </Section>

      <Divider />

      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: '32px 0 12px' }}>
        🎯 接下来做什么
      </h2>
      <ul style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }}>
        <li>想了解产品结构？ → <Link href="/docs/concepts">核心概念</Link></li>
        <li>想深度使用 Insight Kernel？ → <Link href="/docs/insight-kernel">Insight Kernel 详解</Link></li>
        <li>遇到问题？ → <Link href="/docs/faq">FAQ + 故障排查</Link></li>
      </ul>
    </div>
  );
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 12,
    }}>
      <Link href="/docs" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>📖 操作手册</Link>
      {' › '}
      <span style={{ color: 'var(--primary)' }}>{current}</span>
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

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px 16px',
      background: 'rgba(29, 78, 216, 0.06)',
      borderLeft: '3px solid var(--primary)',
      borderRadius: 6,
      fontSize: 13, color: 'var(--text)', lineHeight: 1.6,
      margin: '12px 0',
    }}>
      {children}
    </div>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: 14, background: 'var(--bg-subtle)',
      border: '1px solid var(--line-soft)', borderRadius: 6,
      fontSize: 13, lineHeight: 1.7,
    }}>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '4px 0' }}>
      <span style={{ minWidth: 100, color: 'var(--text-3)', fontSize: 12, fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line-soft)', margin: '32px 0' }} />;
}
