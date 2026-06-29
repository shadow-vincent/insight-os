/**
 * AssetThreeSections · v1.8.2 判断资产详情页 3 段卡片
 *
 * 按 Vincent v3 评价第 3 条：
 *   资产卡默认只露出：判断标题 / 当前阶段 / 产出记录 / 下一步建议 / 主按钮
 *   "为什么从 E1 升到 E2" + "完整进化线" 折叠
 *
 * 3 段：
 *   1. 帮你产出了（默认展开）— 列出引用本资产的所有 outputs
 *   2. 下一步还能变强（默认展开）— 根据当前状态给具体建议
 *   3. 完整进化线（默认折叠）— 5 阶段时间线
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';

interface AssetLite {
  id: string;
  title: string;
  status: string;
  evidenceLevel: string;
  outputCount?: number;
  isKernelCandidate?: number;
  isKernelApproved?: number;
}

interface OutputLite {
  id: string;
  title: string;
  outputType: string;
  templateType: string | null;
  sourceUrl: string | null;
  createdAt: number;
}

interface FeedbackLite {
  id: string;
  scene: string;
  reaction: string | null;
  mostTouchedPoint: string | null;
  evidenceLevelBefore: string | null;
  evidenceLevelAfter: string | null;
  createdAt: number;
}

interface Props {
  asset: AssetLite;
  outputs: OutputLite[];
  feedbackCount: number;
  feedbackRows: FeedbackLite[];
  kernelCandidates: number;
  kernelApproved: number;
}

const SCENE_LABEL: Record<string, string> = {
  client_talk: '客户沟通',
  article: '公众号',
  course: '课程',
  colleague: '同事',
  archive: '归档',
  other: '其他',
};

const OUTPUT_TYPE_LABEL: Record<string, string> = {
  talk_script: '话术',
  article_outline: '文章大纲',
  article_full: '公众号长文',
  writing: '写作',
  speech: '演讲',
  book_note: '读书笔记',
  email: '邮件',
};

export function AssetThreeSections({ asset, outputs, feedbackCount, feedbackRows, kernelCandidates, kernelApproved }: Props) {
  const [showFullEvolution, setShowFullEvolution] = useState(false);

  // 产出统计
  const outputCount = outputs.length;
  const hasOutput = outputCount > 0;

  // 下一步建议
  const suggestions = computeSuggestions(asset, outputCount, feedbackCount, kernelCandidates, kernelApproved);

  return (
    <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 段 1 · 帮你产出了（默认展开） */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            📤 帮你产出了
            <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
              {outputCount > 0 ? `被引用 ${outputCount} 次` : '还没用于输出'}
            </span>
          </h3>
          <Link href="/output" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>
            查看输出记录 →
          </Link>
        </div>
        {!hasOutput ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 8, textAlign: 'center' }}>
            <span style={{ marginRight: 6 }}>💡</span>
            这条判断还没用于任何输出。点右上「在开始写作中打开」基于它生成文章 / 方案 / 课程。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {outputs.slice(0, 5).map(o => (
              <Link
                key={o.id}
                href={o.outputType === 'writing' ? `/writing/${o.id}` : '/output'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                  color: 'var(--text-2)', textDecoration: 'none', padding: 4,
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 500,
                  background: 'var(--bg-subtle)', color: 'var(--text-2)',
                }}>
                  {OUTPUT_TYPE_LABEL[o.outputType] ?? o.outputType}
                </span>
                <span style={{ flex: 1 }}>{o.title}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{formatDate(o.createdAt)}</span>
              </Link>
            ))}
            {outputs.length > 5 && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 4 }}>
                还有 {outputs.length - 5} 条未展开
              </div>
            )}
          </div>
        )}
      </div>

      {/* 段 2 · 下一步还能变强（默认展开） */}
      <div className="card" style={{ padding: 18, borderColor: suggestions.length > 0 ? '#1a365d' : 'var(--line)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>
          🚀 下一步还能变强
        </h3>
        {suggestions.length === 0 ? (
          <div style={{ fontSize: 12, color: '#16a34a', padding: 8 }}>
            ✓ 这条判断已经很强了：被多次引用、有反馈、已沉淀为方法论
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestions.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: 10, background: 'var(--bg-subtle)', borderRadius: 6,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: s.priority === 'high' ? '#dc2626' : s.priority === 'mid' ? '#d97706' : '#1a365d',
                  color: 'white', fontSize: 11, fontWeight: 600, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.5 }}>
                    {s.reason}
                  </div>
                </div>
                {s.cta && s.ctaHref && (
                  <Link
                    href={s.ctaHref}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 4,
                      background: 'var(--primary)', color: 'white',
                      textDecoration: 'none', flexShrink: 0, fontWeight: 500,
                    }}
                  >
                    {s.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 段 3 · 完整进化线（默认折叠） */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <button
          onClick={() => setShowFullEvolution(!showFullEvolution)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
            padding: 16, background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-2)', fontWeight: 500,
          }}
        >
          <span>📜 完整进化线（来源 → 升级 → 被引用 → 反馈 → Kernel）</span>
          <span style={{ color: 'var(--text-3)' }}>{showFullEvolution ? '▾' : '▸'}</span>
        </button>
        {showFullEvolution && (
          <FullEvolutionContent
            asset={asset}
            outputs={outputs}
            feedbackRows={feedbackRows}
            kernelCandidates={kernelCandidates}
            kernelApproved={kernelApproved}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 完整进化线内容（折叠展开后）
 */
function FullEvolutionContent({ asset, outputs, feedbackRows, kernelCandidates, kernelApproved }: Pick<Props, 'asset' | 'outputs' | 'feedbackRows' | 'kernelCandidates' | 'kernelApproved'>) {
  // 简化版：5 阶段时间线
  const stages: Array<{ stage: string; label: string; color: string; ts: number; title: string; subtitle?: string }> = [];

  // 来源
  stages.push({
    stage: 'source',
    label: '📥 来源',
    color: '#6366f1',
    ts: asset.id.length > 0 ? 0 : 0,  // 用 createdAt 不行因为没传，placeholder
    title: '原始素材入库',
    subtitle: asset.status === 'in_use' ? '已升级为正式资产' : '候选 / 原始状态',
  });

  return (
    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--line-soft)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12, marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        输出记录
      </div>
      {outputs.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>暂无</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-2)' }}>
          {outputs.map(o => (
            <li key={o.id}>
              {o.title} · {OUTPUT_TYPE_LABEL[o.outputType] ?? o.outputType} · {formatDate(o.createdAt)}
            </li>
          ))}
        </ul>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12, marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        反馈记录
      </div>
      {feedbackRows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>暂无</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-2)' }}>
          {feedbackRows.map(f => (
            <li key={f.id}>
              {SCENE_LABEL[f.scene] ?? f.scene}
              {f.evidenceLevelBefore && f.evidenceLevelAfter && ` · ${f.evidenceLevelBefore} → ${f.evidenceLevelAfter}`}
              {f.mostTouchedPoint ? ` · ${f.mostTouchedPoint}` : ''}
            </li>
          ))}
        </ul>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12, marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Kernel 状态
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
        {kernelApproved ? '✓ 已沉淀为方法论' : kernelCandidates ? '⚡ 推荐沉淀' : '尚未推荐'}
      </div>
    </div>
  );
}

interface Suggestion {
  title: string;
  reason: string;
  cta?: string;
  ctaHref?: string;
  priority: 'high' | 'mid' | 'low';
}

/**
 * 根据当前状态计算下一步建议
 *
 * 规则：
 *   - 引用 >= 5 次 + 有反馈 → 推荐沉淀为方法论
 *   - 引用 >= 3 次 + 无反馈 → 建议先用一次（公众号/客户）
 *   - 反馈 >= 3 次但 evidence=E0 → 记录反馈可以升级等级
 *   - evidence=E0 且无引用 → 找机会用一次
 */
function computeSuggestions(
  asset: AssetLite,
  outputCount: number,
  feedbackCount: number,
  kernelCandidates: number,
  kernelApproved: number
): Suggestion[] {
  const list: Suggestion[] = [];

  if (!kernelApproved && (kernelCandidates === 1 || outputCount >= 5)) {
    list.push({
      title: '沉淀为方法论',
      reason: `本判断已被引用 ${outputCount} 次 + ${feedbackCount} 次反馈，是稳定可复用的模式。建议在「我的方法论」页标记为方法论（Kernel）。`,
      cta: '去沉淀',
      ctaHref: '/kernel',
      priority: 'high',
    });
  }

  if (outputCount < 1 && asset.status === 'in_use') {
    list.push({
      title: '找机会用一次',
      reason: '正式资产还没用于任何输出。公众号 / 客户方案 / 课程大纲都可以试试。',
      cta: '去写作',
      ctaHref: `/writing/new?assetId=${asset.id}`,
      priority: 'high',
    });
  }

  if (outputCount >= 1 && feedbackCount < 1) {
    list.push({
      title: '记一次反馈',
      reason: `已被引用 ${outputCount} 次，但还没记录客户/读者的反馈。一次反馈可以升到 E2。`,
      cta: '记反馈',
      ctaHref: '#feedback',  // AssetDetailClient 已有 feedback modal
      priority: 'mid',
    });
  }

  if (feedbackCount >= 1 && asset.evidenceLevel === 'E0') {
    list.push({
      title: '升级证据等级',
      reason: `已有 ${feedbackCount} 次反馈但 evidence 还在 E0。客户/同事/读者反馈能升 E2，方案被客户认可可升 E4。`,
      cta: '查看证据等级',
      ctaHref: '/insights',
      priority: 'mid',
    });
  }

  if (outputCount >= 1 && outputCount < 5) {
    list.push({
      title: '多用几次',
      reason: `已被引用 ${outputCount} 次。满 5 次会被自动推荐为方法论。`,
      priority: 'low',
    });
  }

  return list;
}

function formatDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}