/**
 * /demo
 *
 * v1.8.4 Demo 流程 6 步（按 Vincent v3 评价"做一条完整 Demo 流程"）
 *
 * 用 Vincent 真实场景做 6 步连贯演示：
 *   1. 粘贴一段项目复盘
 *   2. AI 提炼 3 条候选
 *   3. 选择 1 条加工为判断资产
 *   4. 加入主题资产包
 *   5. 生成客户方案
 *   6. 输出后强化我的方法论
 *
 * 设计原则：
 *   - 不造假数据（每步链接到真实页面 + 真实数据）
 *   - 不写"V2.0 待做"
 *   - 跨 4 页可视化（V1.8.4 完成版）
 */

import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface DemoStep {
  num: number;
  title: string;
  desc: string;
  page: string;
  cta: string;
  done?: boolean;
}

const STEPS: DemoStep[] = [
  {
    num: 1,
    title: '粘贴一段项目复盘',
    desc: '在今日加工页把一段笔记、聊天记录、项目复盘粘贴进大输入框。AI 会自动识别值得加工的判断。',
    page: '/',
    cta: '去粘贴',
  },
  {
    num: 2,
    title: 'AI 提炼 3 条候选',
    desc: '回到首页，看 5 张候选精简卡。每张卡显示评分（0-100）、AI 提炼的判断、推荐理由、折叠的 7 维度评分。',
    page: '/',
    cta: '看候选卡',
  },
  {
    num: 3,
    title: '选择 1 条加工为判断资产',
    desc: '点「加工 →」进入候选详情页。看到完整 7 维度评分 + 推荐理由后，点底部「加工为正式判断」按钮。',
    page: '/candidates',
    cta: '去加工',
  },
  {
    num: 4,
    title: '加入主题资产包',
    desc: '加工完成后系统跳到判断资产页。在「所属主题」面板把这条资产加进主题（如「数字化变革」）。',
    page: '/topics',
    cta: '看主题',
  },
  {
    num: 5,
    title: '生成客户方案',
    desc: '在判断资产详情页点「在「开始写作」中打开」，AI 会基于这条判断生成客户方案 / 公众号长文。',
    page: '/assets',
    cta: '去资产库',
  },
  {
    num: 6,
    title: '输出后强化我的方法论',
    desc: '在输出包页展开任一输出，点底部「✨ 沉淀为方法论」按钮。AI 提炼这条输出体现的判断方式，自动加进「我的方法论」页。',
    page: '/output',
    cta: '去沉淀',
  },
];

export default function DemoPage() {
  return (
    <div style={{ maxWidth: 880, padding: '0 0 60px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">走一遍 Demo</h1>
        <p className="page-subtitle">
          6 步走通 Insight OS V1.8.4 主线——从粘贴一段乱素材到沉淀为方法论。
        </p>
      </div>

      {/* 6 步卡片 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STEPS.map((step, idx) => (
          <div
            key={step.num}
            className="card"
            style={{
              padding: 20,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              borderLeft: `3px solid var(--primary)`,
            }}
          >
            {/* 步骤编号 */}
            <div
              style={{
                width: 40, height: 40, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
                background: 'var(--primary)', color: 'white', flexShrink: 0,
              }}
            >
              {step.num}
            </div>

            {/* 步骤内容 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                {step.desc}
              </p>
            </div>

            {/* CTA */}
            <Link
              href={step.page}
              className="btn btn-sm"
              style={{
                background: 'var(--primary)', color: 'white', borderColor: 'transparent',
                fontSize: 13, padding: '8px 16px', flexShrink: 0, textDecoration: 'none',
              }}
            >
              {step.cta} →
            </Link>
          </div>
        ))}
      </div>

      {/* 底部说明 */}
      <div className="card" style={{ padding: 20, marginTop: 24, background: 'var(--bg-subtle)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>
          💡 Demo 完成后你会看到
        </h3>
        <ul style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: 0, paddingLeft: 20 }}>
          <li>判断资产库多了一张你亲手加工的卡片</li>
          <li>主题资产包多了一条带商业用途的主题</li>
          <li>输出包多了一篇你基于这条判断写的内容</li>
          <li>我的方法论多了一条 AI 提炼的"判断方式"</li>
          <li>所有数据同步到 Insight OS 资产库，不会丢</li>
        </ul>
      </div>

      {/* 回到首页 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Link
          href="/"
          className="btn"
          style={{ background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--line)' }}
        >
          ← 回到今日加工
        </Link>
      </div>
    </div>
  );
}