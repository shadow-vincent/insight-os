'use client';

import Link from 'next/link';

export default function LlmSetupPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <Breadcrumb current="LLM API 开通与配置" />

      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        🔑 LLM API 开通与配置
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.6 }}>
        <strong>不配 LLM 也能用</strong>——开 Insight OS 就能写、能录、能看图谱。
        <br />
        但所有 AI 增强功能（思想内核提炼 / 写作骨架 / 资产升级 / 洞察助手 / 一键提炼 Kernel）都需要 LLM。
      </p>

      <Callout>
        <strong>本文以 DeepSeek 为例</strong>——便宜（输入 ¥1/百万 token）、中文好、兼容 OpenAI 接口、注册 5 分钟搞定。
        如果你想用 OpenAI / 通义千问 / Ollama 本地模型，<strong>跳到最后看替代方案</strong>。
      </Callout>

      <Section title="第 1 步 · 注册 DeepSeek 账号">
        <ol>
          <li>
            打开 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer"><strong>platform.deepseek.com</strong></a>
          </li>
          <li>点右上角 <strong>「注册」</strong> → 用手机号或邮箱注册</li>
          <li>完成实名认证（用中国大陆手机号，秒过）</li>
          <li>登录后自动跳到 <strong>「API Keys」</strong> 页面</li>
        </ol>
        <Callout>
          <strong>关于实名：</strong>DeepSeek 要求实名才能用 API。个人认证即可，公司主体不需要。
          全程 1 分钟搞定。
        </Callout>
      </Section>

      <Section title="第 2 步 · 充值">
        <ol>
          <li>左侧菜单 → <strong>「充值」</strong></li>
          <li>选金额：<strong>建议 ¥10 起步</strong>（够用 3-6 个月日常写作）</li>
          <li>支付方式：微信 / 支付宝</li>
        </ol>
        <p>
          <strong>价格参考</strong>（2026 年 6 月）：<br />
          • DeepSeek-V3 输入 ¥1/百万 token · 输出 ¥2/百万 token<br />
          • 一次资产升级 ≈ ¥0.005（几乎免费）<br />
          • 写一篇 2000 字公众号 ≈ ¥0.03
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
          学员反馈：¥10 充值 + 30 学员共享 Insight OS 一个月 ≈ ¥2-3 元成本。
        </p>
      </Section>

      <Section title="第 3 步 · 创建 API Key">
        <ol>
          <li>左侧菜单 → <strong>「API Keys」</strong></li>
          <li>点 <strong>「创建新密钥」</strong></li>
          <li>输入一个名字（如 <code>insight-os-笔记本</code>）</li>
          <li>点 <strong>「创建」</strong> → 弹出 <code>sk-xxxxxxxxxx</code> 长字符串</li>
          <li>
            <strong style={{ color: '#dc2626' }}>⚠️ 立即复制保存</strong>——
            关掉弹窗就再也看不到了（DeepSeek 不存明文 key）
          </li>
        </ol>
        <Block>
          <Row label="key 格式" value="sk- 开头，48 位随机字符" />
          <Row label="key 权限" value="全 API 权限（够用）" />
          <Row label="key 限流" value="默认 60 次/分钟（够用）" />
          <Row label="key 失效" value="可以随时在后台删除重建" />
        </Block>
      </Section>

      <Section title="第 4 步 · 在 Insight OS 配置">
        <ol>
          <li>打开 Insight OS（<code>insight-os.vercel.app</code> 或桌面 .app）</li>
          <li>侧边栏 → <strong>⚙ 设置</strong> → <strong>LLM 配置</strong></li>
          <li>填 4 个字段：</li>
        </ol>
        <Block>
          <Row label="Provider（服务）" value="DeepSeek" />
          <Row label="Base URL（API 地址）" value="https://api.deepseek.com/v1" />
          <Row label="Model（模型）" value="deepseek-chat" />
          <Row label="API Key" value="sk-xxxxxxxxxx（粘贴刚才复制的）" />
        </Block>
        <p>点 <strong>「保存」</strong>。</p>
        <Callout>
          <strong>数据隐私：</strong>key 只存你本地（IndexedDB / 应用配置目录），
          <strong>不上传到我们服务器</strong>。Insight OS 走 local-first，
          你的资产 + key 完全你拥有。
        </Callout>
      </Section>

      <Section title="第 5 步 · 验证 LLM 是否配通">
        <ol>
          <li>点右下角 <strong>✨ 洞察助手</strong> 浮动按钮</li>
          <li>输入：<code>我有几张高等级卡？</code></li>
          <li>如果返回结果（"你有 X 张 E3+ 卡"）→ <strong style={{ color: '#10b981' }}>配通 ✓</strong></li>
          <li>如果报错：<strong style={{ color: '#dc2626' }}>看下面故障排查</strong></li>
        </ol>
      </Section>

      <Section title="常见问题 / 故障排查">
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 16 }}>
          Q1 · 余额不足 / 「Insufficient Balance」
        </h3>
        <p>
          <strong>原因</strong>：DeepSeek 账户没钱了。<br />
          <strong>解决</strong>：去 platform.deepseek.com → 充值 → ¥10 起步。
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 16 }}>
          Q2 · 「Invalid API Key」
        </h3>
        <p>
          <strong>原因</strong>：key 输错了 / key 被删了 / 多了空格。<br />
          <strong>解决</strong>：去 DeepSeek 后台重新复制 key（点 <strong>「复制」</strong> 按钮最稳）→ 在 Insight OS 设置里覆盖粘贴。
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 16 }}>
          Q3 · 「Network Error」/ 超时
        </h3>
        <p>
          <strong>原因</strong>：网络问题（最常见是 VPN / 防火墙阻挡）。<br />
          <strong>解决</strong>：<br />
          • 关 VPN 试试（DeepSeek 在国内，不需 VPN）<br />
          • 公司网络可能阻挡 → 换手机热点试试<br />
          • 浏览器开发者工具看 Network 标签确认实际错误
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 16 }}>
          Q4 · 速度慢 / 卡顿
        </h3>
        <p>
          <strong>原因</strong>：DeepSeek 高峰期（晚上 8-10 点）排队。<br />
          <strong>解决</strong>：<br />
          • 错峰使用（早上 / 下午）<br />
          • 切到「deepseek-reasoner」模型（高峰时反而更快）<br />
          • 临时切 OpenAI / Ollama
        </p>
      </Section>

      <Section title="替代方案 · 不用 DeepSeek">
        <p>Insight OS 兼容<strong>任何 OpenAI 兼容 API</strong>。下面 3 个常见替代：</p>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 16 }}>
          🌐 OpenAI
        </h3>
        <Block>
          <Row label="注册" value="platform.openai.com（需科学上网）" />
          <Row label="Base URL" value="https://api.openai.com/v1" />
          <Row label="Model" value="gpt-4o-mini（便宜）/ gpt-4o（强）" />
          <Row label="价格" value="gpt-4o-mini 输入 $0.15/百万 token" />
        </Block>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 16 }}>
          🇨🇳 通义千问（Qwen）
        </h3>
        <Block>
          <Row label="注册" value="dashscope.aliyun.com（阿里云账号）" />
          <Row label="Base URL" value="https://dashscope.aliyuncs.com/compatible-mode/v1" />
          <Row label="Model" value="qwen-turbo（便宜）/ qwen-plus" />
          <Row label="优势" value="国内访问快、企业发票" />
        </Block>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 16 }}>
          🏠 Ollama 本地模型（完全免费）
        </h3>
        <Block>
          <Row label="安装" value="ollama.com（macOS / Windows / Linux）" />
          <Row label="拉模型" value="ollama pull qwen2.5:7b" />
          <Row label="Base URL" value="http://localhost:11434/v1" />
          <Row label="Model" value="qwen2.5:7b / llama3.1:8b" />
          <Row label="优势" value="完全免费 + 数据不出本机" />
        </Block>
        <Callout>
          <strong>Mac 16GB 内存以上推荐</strong>，7B 模型速度够用。
          完全免费但首次配置 Ollama 需要 10-15 分钟（下载模型 + 启动服务）。
        </Callout>
      </Section>

      <Divider />

      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: '32px 0 12px' }}>
        🎯 接下来做什么
      </h2>
      <ul>
        <li>
          <Link href="/docs/quickstart"><strong>5 分钟上手</strong></Link>：
          LLM 配好后，看 Insight OS 全貌
        </li>
        <li>
          <Link href="/docs/concepts"><strong>核心概念</strong></Link>：
          理解资产卡 / 内核卡 / 证据等级
        </li>
        <li>
          <Link href="/docs/insight-kernel"><strong>Insight Kernel</strong></Link>：
          用 LLM 之前先沉淀自己的判断宪法
        </li>
      </ul>
    </div>
  );
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <nav style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
      <Link href="/docs" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>操作手册</Link>
      <span style={{ margin: '0 6px' }}>›</span>
      <span style={{ color: 'var(--ink)' }}>{current}</span>
    </nav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{
        fontSize: 20, fontWeight: 600, color: 'var(--ink)',
        margin: '0 0 12px', paddingBottom: 8,
        borderBottom: '1px solid var(--line-soft)',
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px 16px', margin: '12px 0',
      background: 'rgba(99, 102, 241, 0.06)',
      borderLeft: '3px solid #6366f1',
      borderRadius: 6, fontSize: 13, lineHeight: 1.7, color: 'var(--text)',
    }}>
      {children}
    </div>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px 16px', margin: '8px 0',
      background: 'var(--bg-subtle)',
      borderRadius: 6, fontSize: 13, lineHeight: 1.7,
    }}>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', padding: '4px 0',
      borderBottom: '1px dashed var(--line-soft)',
      fontSize: 13,
    }}>
      <span style={{ width: 140, color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid var(--line-soft)', margin: '24px 0' }} />;
}