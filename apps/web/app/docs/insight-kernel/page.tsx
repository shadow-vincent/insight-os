'use client';

import Link from 'next/link';

export default function InsightKernelDocsPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 12,
      }}>
        <Link href="/docs" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>📖 操作手册</Link>
        {' › '}
        <span style={{ color: 'var(--primary)' }}>Insight Kernel</span>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        🧠 Insight Kernel
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 8px', lineHeight: 1.6 }}>
        你的「判断宪法」 —— <strong>每次 LLM 调用都会自动注入到 system prompt</strong>，让所有输出「像你写的」。
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.5 }}>
        v1.4 新功能 · 推荐用 10 分钟读完这一页，再去 <Link href="/settings/kernel">⚙ 设置 › 判断协议</Link> 实操
      </p>

      <Section title="为什么需要 Insight Kernel">
        <p>默认 LLM 输出是「通用调调「 —— 套话、营销腔、空泛总结。让它有」你的立场」，传统做法是写长 prompt：</p>
        <Block>
          <code style={{ fontSize: 12, color: 'var(--text-3)' }}>
            你是 Vincent 的写作助手。Vincent 的风格是口语化、有判断、不说教、有温度。不要用'首先其次最后'，不要用'我们应该'，不要营销腔……
          </code>
        </Block>
        <p style={{ marginTop: 10 }}>但这种 prompt 是<strong>风格</strong>，不是<strong>立场</strong>。你真正想要的是：LLM 知道<strong>你怎么判断问题</strong>。</p>
        <p><strong>Insight Kernel = 把你的判断结构化</strong>，让 LLM 调用时自动带「你的立场」。</p>
      </Section>

      <Section title="4 类别">
        <p>Insight Kernel 不只是一堆判断 —— 按「判断性质」分 4 类，避免教条化：</p>

        <Category
          icon="◆"
          color="#6366f1"
          name="底层信念 (Belief)"
          desc="长期价值主张 / 哲学立场 · 决定你看问题的方式"
          example="管理的本质是激发人的善意和潜能，而不是控制"
        />
        <Category
          icon="◇"
          color="#f43f5e"
          name="反常识判断 (Contrarian)"
          desc="反对主流叙事的判断 · 在套话中识别真问题"
          example="AI 不会让所有人变强，只让强者更强"
        />
        <Category
          icon="◈"
          color="#10b981"
          name="擅长问题域 (Expertise)"
          desc="被验证过能力的领域 · 知道什么是自己懂的"
          example="战略定位：找到用户非买不可的理由"
        />
        <Category
          icon="◉"
          color="#f59e0b"
          name="想挑战的常识 (Challenge)"
          desc="想消灭 / 重塑的行业套话 · 持续进化的靶子"
          example='「AI 让所有人变强」 是 AI 厂商营销叙事'
        />
      </Section>

      <Section title="4 字段">
        <p>每条内核有 4 个关键字段（避免教条化的核心）：</p>

        <Field name="content" desc="一句话判断（最核心）。LLM 实际引用这句。" />
        <Field name="confidence" desc="置信度 0-100。高于 80 = 经验验证，60-80 = 推论，低于 60 = 待验证或挑战。" />
        <Field name="counterExample" desc="强制反例：什么时候不成立。**这是避免教条化的关键**。" />
        <Field name="scope" desc="适用场景：如「客户咨询 · 公众号」。让 LLM 知道何时引用。" />

        <p style={{ marginTop: 12 }}><strong>默认只填 content + category + confidence</strong>（30 秒搞定一条）。counterExample 和 scope 在编辑 modal 里「▸展开高级」再填。</p>
      </Section>

      <Section title="它怎么注入 LLM">
        <p>每次 LLM 调用前，Insight Kernel 自动拼接到 system prompt 前面：</p>

        <Block>
          <pre style={{
            fontSize: 12, color: 'var(--text-2)',
            fontFamily: 'JetBrains Mono, monospace',
            lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap',
          }}>{`# Insight Kernel（用户判断协议）
你在所有写作、对话、改稿、推演时应遵循以下立场。
这些是经过用户确认的判断，不是通用 LLM 调调——请严格遵守。

## 底层信念 (Belief)
- 管理的本质是激发人的善意和潜能，而不是控制（置信度 95/100）  · 适用: 客户咨询
  - 不适用场景: 合规高压场景（金融/医疗），前期需要强约束
- 判断力比知识稀缺，AI 时代尤其如此（置信度 90/100）

## 反常识判断 (Contrarian)
- AI 不会让所有人变强，只让强者更强（置信度 85/100）

## 想挑战的常识 (Challenge)
- 「AI 让所有人变强」 是 AI 厂商营销叙事，不是事实（置信度 55/100）

---

（这里是原 system prompt，比如「你是 Vincent 的写作改稿 partner...」）
`}</pre>
        </Block>

        <p style={{ marginTop: 12 }}>这意味着 <strong>所有 19 个 LLM 调用点</strong>都自动带立场 —— 写作骨架 / 改稿 / AI 味自检 / 风格反推 / 数据校验 / vision / 主题内核 / 主题分类 / 资产升级 / 资产校准 / 候选升级 / intake / writing companion / assistant chat / 试写屏 / output multi / output scaffold（兼容）/ writing scaffold / output generate。</p>
      </Section>

      <Section title="怎么用">
        <p>三步上手：</p>
        <ol>
          <li><strong>去 <Link href="/settings/kernel">⚙ 设置 › 判断协议</Link></strong></li>
          <li>点 <strong>「装入 6 条 ship-ready 默认内核」</strong>（如果你没装过）</li>
          <li>触发任意 LLM 调用（写作 / 改稿 / 反推 / chat）→ 看输出有没有「你的立场」</li>
        </ol>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 18, marginBottom: 8 }}>
          改 / 加 / 删
        </h3>
        <ul>
          <li><strong>改</strong>：hover 卡片 → 编辑 → 极简 modal（默认只 3 字段，高级折叠）</li>
          <li><strong>加</strong>：顶栏 + 新增内核</li>
          <li><strong>归档</strong>：hover 卡片 → 归档（不物理删除，可恢复）</li>
        </ul>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 18, marginBottom: 8 }}>
          导出 / git 版本控制
        </h3>
        <p>点 <strong>「↓ 导出 beliefs.md」</strong> → 拿到一个 markdown 文件，按 4 类别分组，每条含 content / confidence / 适用 / 不适用 / 关联证据。</p>
        <p>把它放进 git 仓库，每次修改后 commit —— 你的「判断宪法」就有版本历史了。</p>
      </Section>

      <Section title="⚠️ 避免教条化：3 个内置机制">
        <p>Insight Kernel 最危险的是变成「AI 厂商营销叙事」那种套话。3 个内置机制防止：</p>

        <Mechanism
          icon="⚡"
          name="counterExample 强制反例"
          desc="每条内核建议填反例 —— 什么时候不成立。LLM 会看反例，避免教条套用。"
        />
        <Mechanism
          icon="📚"
          name="evidenceAssetIds 证据关联"
          desc="每条内核可关联现有资产卡 ID。LLM 引用时知道「这条判断的证据是什么」，不脱离实际。"
        />
        <Mechanism
          icon="🔄"
          name="✓ 我重新想过了"
          desc="每条内核可手动标记「已验证」，刷新 lastVerifiedAt。3 个月没验证的内核可以重新评估。"
        />

        <p style={{ marginTop: 12 }}>注：<strong>反向校准层</strong>（每次 LLM 输出后自查「是否过度套用内核」）和 <strong>Weekly Reflection</strong>（每周自动跑强化/加反例/归档建议）规划在 <strong>V1.5</strong>。先做基础价值。</p>
      </Section>

      <Section title="6 条 ship-ready 默认（已装）">
        <p>Onboarding 第 4 步会装入 6 条 Vincent 风格通用版内核。装完可以立即让 LLM 输出带立场。</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-3)', fontWeight: 600 }}>类别</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-3)', fontWeight: 600 }}>内容</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-3)', fontWeight: 600 }}>置信</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td style={{ padding: '8px 12px' }}><span style={{ color: '#6366f1' }}>◆</span> belief</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>管理的本质是激发人的善意和潜能，而不是控制</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--success)' }}>95</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td style={{ padding: '8px 12px' }}><span style={{ color: '#6366f1' }}>◆</span> belief</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>判断力比知识稀缺，AI 时代尤其如此</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--success)' }}>90</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td style={{ padding: '8px 12px' }}><span style={{ color: '#f43f5e' }}>◇</span> contrarian</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>AI 不会让所有人变强，只让强者更强</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--success)' }}>85</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td style={{ padding: '8px 12px' }}><span style={{ color: '#f43f5e' }}>◇</span> contrarian</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>组织变革的瓶颈从来不是技术，是组织吸收力</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--success)' }}>85</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td style={{ padding: '8px 12px' }}><span style={{ color: '#10b981' }}>◈</span> expertise</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>战略定位：找到用户非买不可的理由（不是「我们能做什么」）</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--success)' }}>90</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px' }}><span style={{ color: '#f59e0b' }}>◉</span> challenge</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-2)' }}>「AI 让所有人变强」 是 AI 厂商营销叙事，不是事实</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--warning, #f59e0b)' }}>55</td>
            </tr>
          </tbody>
        </table>

        <p style={{ marginTop: 12 }}>这 6 条是 Vincent 的判断，你可以直接用、可以改、可以加自己的 —— 它只是 ship-ready 起点，不是真理。</p>
      </Section>

      <Divider />

      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: '32px 0 12px' }}>
        🎯 接下来
      </h2>
      <ul style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }}>
        <li>去实操 → <Link href="/settings/kernel">⚙ 设置 › 判断协议</Link></li>
        <li>遇到问题 → <Link href="/docs/faq">FAQ + 故障排查</Link></li>
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

function Category({ icon, color, name, desc, example }: { icon: string; color: string; name: string; desc: string; example: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: 14, marginTop: 8,
      background: 'var(--bg-subtle)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 6,
    }}>
      <span style={{ fontSize: 22, color, lineHeight: 1.4 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.6 }}>{desc}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic' }}>
          例："{example}"
        </div>
      </div>
    </div>
  );
}

function Field({ name, desc }: { name: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', fontSize: 13 }}>
      <code style={{
        minWidth: 140, padding: '4px 8px', fontSize: 12, fontWeight: 600,
        background: 'var(--bg-subtle)', color: 'var(--primary)',
        borderRadius: 4, fontFamily: 'JetBrains Mono, monospace',
      }}>{name}</code>
      <span style={{ color: 'var(--text-2)', flex: 1, lineHeight: 1.6 }}>{desc}</span>
    </div>
  );
}

function Mechanism({ icon, name, desc }: { icon: string; name: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: 12, marginTop: 8,
      background: 'rgba(245, 158, 11, 0.06)',
      border: '1px solid rgba(245, 158, 11, 0.2)',
      borderRadius: 6,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line-soft)', margin: '32px 0' }} />;
}
