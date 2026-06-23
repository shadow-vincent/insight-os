'use client';

import Link from 'next/link';

export default function FAQPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 12,
      }}>
        <Link href="/docs" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>📖 操作手册</Link>
        {' › '}
        <span style={{ color: 'var(--primary)' }}>FAQ</span>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        ❓ FAQ + 故障排查
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.6 }}>
        常见问题 + 安装/运行故障排查。按问题类型分组。
      </p>

      <Section title="🚀 安装与启动">
        <QA q="下载 .dmg 后启动报 'Insight OS 已损坏，无法打开' 怎么办？">
          <p>macOS 11+ Gatekeeper 拦未签名 Electron .app。修复 3 行命令：</p>
          <CodeBlock>{`xattr -cr '/Applications/Insight OS.app' && codesign --force --deep --sign - '/Applications/Insight OS.app' && open '/Applications/Insight OS.app'`}</CodeBlock>
          <p>不跑会报「已损坏」。一行命令搞定（清 quarantine + ad-hoc 重签名 + 启动）。</p>
          <p>如果 <code>codesign</code> 报 command not found：</p>
          <CodeBlock>{`xcode-select --install`}</CodeBlock>
          <p>装完 Xcode CLI 再跑上面那行。</p>
        </QA>

        <QA q=".app 必须拖到 /Applications/ 吗？">
          <p><strong>必须。</strong>macOS .dmg 打开后，.app 必须拖入 <code>/Applications/</code>。在 /Applications/ 外的 .app 启动会有资源路径问题（启动失败 / 黑屏 / 找不到 db）。</p>
        </QA>

        <QA q="dev 模式启动报 NODE_MODULE_VERSION 128 vs 131 怎么办？">
          <p>这是因为刚跑过 <code>npm run build:desktop</code> —— rebuild:native 把 better-sqlite3 编成了 Electron 用的 ABI 128，但 dev 模式用的是系统 Node 23 (ABI 131)。两边 ABI 不可兼得。</p>
          <p>修法（一行）：</p>
          <CodeBlock>{`npm rebuild better-sqlite3`}</CodeBlock>
          <p>下次再跑 <code>npm run build:desktop</code> 又会被切回 ABI 128。V1.x 期间临时方案。</p>
        </QA>
      </Section>

      <Section title="🔧 配置与使用">
        <QA q="必须配 LLM Key 才能用吗？">
          <p>不是。基础功能（资产库 / 主题 / 写作 / 图谱）都可用。LLM 用于：思想内核提炼 / 写作骨架 / 资产升级 / 洞察助手。</p>
          <p>如果不配 LLM Key：写作骨架会用 fallback 模板（简陋但能用）；其他高级功能会报「LLM 未配置」。</p>
        </QA>

        <QA q="不用 DeepSeek 行不行？">
          <p><strong>任何兼容 OpenAI API 协议的服务都行</strong> —— 本地 Ollama / 自部署 vLLM / DeepSeek / Qwen / GLM / OpenAI / Claude（通过兼容代理）都接。</p>
          <p>在 <Link href="/onboarding">onboarding</Link> 选「自定义」填 base URL + model + api key 即可。</p>
        </QA>

        <QA q="Insight Kernel 装了但 LLM 输出还是没立场？">
          <p>检查 3 件事：</p>
          <ol>
            <li>去 <Link href="/settings/kernel">⚙ 设置 › 判断协议</Link> 确认有 active 内核（不是 0 条）</li>
            <li>触发 LLM 调用前，看 dev 控制台 / desktop 启动 log，应该看到 system prompt 里 <code># Insight Kernel（用户判断协议）</code> 字段</li>
            <li>如果内核有但 LLM 不跟 —— 模型可能太小 / 不支持 system prompt 长输入。换更聪明的模型。</li>
          </ol>
        </QA>

        <QA q="怎么导出我的 Insight Kernel？">
          <p>去 <Link href="/settings/kernel">⚙ 设置 › 判断协议</Link> → 顶栏 <strong>↓ 导出 beliefs.md</strong> → 下载 markdown 文件，按 4 类别分组，每条含 content / confidence / 适用 / 不适用 / 关联证据。</p>
          <p>建议放进 git 仓库，每次修改 commit —— 「判断宪法」就有版本历史了。</p>
        </QA>
      </Section>

      <Section title="💾 数据与备份">
        <QA q="数据存在哪？安全吗？">
          <p>Web dev 模式存在 <code>apps/web/storage/insight.db</code>（SQLite 本地文件）。桌面 .app 存在 <code>~/Library/Application Support/insight-os-desktop/storage/insight.db</code>。</p>
          <p><strong>所有数据都本地</strong>，不上云。</p>
        </QA>

        <QA q="怎么备份？">
          <p>复制 db 文件到安全位置：</p>
          <CodeBlock>{`# Web dev 模式
cp apps/web/storage/insight.db ~/backups/insight-$(date +%F).db

# 桌面 .app
cp ~/Library/Application\\ Support/insight-os-desktop/storage/insight.db ~/backups/insight-$(date +%F).db`}</CodeBlock>
          <p>或者用 tar 打包整个 vault（包含 .md 资产卡）：</p>
          <CodeBlock>{`tar czf backup-$(date +%F).tar.gz apps/web/storage/`}</CodeBlock>
        </QA>

        <QA q="升级 .dmg 会丢数据吗？">
          <p><strong>不会。</strong> 直接下载新 .dmg → 拖入 <code>/Applications/</code> 覆盖 → 数据完整保留。</p>
          <p>db 存在 <code>~/Library/Application Support/</code> 下，跟 .app bundle 分离，升级 .app 不影响 db。</p>
        </QA>
      </Section>

      <Section title="🧠 Insight Kernel 高级">
        <QA q="怎么让 LLM 输出更强地反映我的 Insight Kernel？">
          <p>3 个增强手段：</p>
          <ol>
            <li><strong>填 counterExample</strong>：每条内核填「不适用场景」，LLM 会避免教条套用。</li>
            <li><strong>关联 evidenceAssetIds</strong>：把现有资产卡 ID 关联到内核，LLM 引用时会引用证据。</li>
            <li><strong>调置信度</strong>：低于 60 的内核 LLM 会更谨慎（不会强行套用）。</li>
          </ol>
        </QA>

        <QA q="Insight Kernel 跟主题思想内核 (Topic Kernel) 是什么关系？">
          <p><strong>不同概念：</strong></p>
          <ul>
            <li><strong>Insight Kernel (用户内核)</strong>：你<strong>人工写</strong>的「判断宪法」，属于<strong>用户</strong>。每次 LLM 调用注入。</li>
            <li><strong>Topic Kernel (主题内核)</strong>：LLM <strong>从该主题下所有资产卡总结</strong>的 1 句话 + 3-5 个核心判断，属于<strong>主题</strong>。只在主题页面显示。</li>
          </ul>
          <p>两者关系：主题内核是「机器总结「，Insight Kernel 是」人工立场」。两者可以互补 —— LLM 生成主题内核时也会自动带你的 Insight Kernel 立场。</p>
        </QA>
      </Section>

      <Section title="🆘 还是没解决？">
        <p>在 GitHub 提 issue：</p>
        <ul>
          <li><a href="https://github.com/shadow-vincent/insight-os/issues" style={{ color: 'var(--primary)' }}>shadow-vincent/insight-os/issues</a></li>
        </ul>
        <p>提 issue 时附上：</p>
        <ol>
          <li>操作步骤（怎么触发的）</li>
          <li>期望结果 vs 实际结果</li>
          <li>截图 / 控制台报错（如果是 desktop app，从 ⚙ 设置 › 关于 看 logs）</li>
          <li>Insight Asset OS 版本（在 ⚙ 设置主页右上角）</li>
        </ol>
      </Section>
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

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>
        Q: {q}
      </h3>
      <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--line-soft)' }}>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre style={{
      padding: '12px 14px',
      background: '#1e293b',
      color: '#e2e8f0',
      borderRadius: 6,
      fontSize: 12, lineHeight: 1.6,
      fontFamily: 'JetBrains Mono, monospace',
      overflowX: 'auto',
      margin: '8px 0',
    }}>
      {children}
    </pre>
  );
}
