/**
 * 主题资产包 · 客户端组件（v1.8.0 用户化版）
 *
 * 按 v3 原型对齐：
 * - 4 主题切换
 * - 主题一句话 / 核心判断 / 支撑资产 / 证据缺口 / 可输出 / 已输出 / 商业用途
 * - 不写"值多少钱"（按 Vincent v3 评价第 4 条）
 */

'use client';

import { useState } from 'react';

interface TopicAsset {
  id: string;
  title: string;
  evidenceLevel: string;
  outputCount: number;
}

interface TopicOutput {
  id: string;
  title: string;
  outputType: string;
  createdAt: number;
}

interface TopicKernel {
  headline: string;
  summary: string;
  coreBeliefs: string[];
}

interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  assets: TopicAsset[];
  outputs: TopicOutput[];
  kernel: TopicKernel | null;
  quality: { total: number; e3Plus: number };
}

interface Props {
  topics: Topic[];
}

export function TopicAssetPackageClient({ topics }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const t = topics[activeIdx];

  if (!t) return null;

  const e3PlusRatio = t.quality.total > 0 ? Math.round((t.quality.e3Plus / t.quality.total) * 100) : 0;

  // 商业用途推断（基于实际数据）
  const hasArticleReady = t.assets.some(a => a.evidenceLevel === 'E2' || a.evidenceLevel === 'E3');
  const hasProposalReady = t.assets.some(a => a.evidenceLevel === 'E3');
  const hasMethod = t.quality.e3Plus >= 3;

  return (
    <div style={{ padding: '0 0 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">主题资产包</h1>
        <p className="page-subtitle">
          不是项目管理，而是围绕一个主题聚合所有判断资产，告诉你「这个主题能输出什么、还差什么、商业用途是什么」。
        </p>
      </div>

      {/* 主题切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {topics.map((topic, idx) => (
          <button
            key={topic.id}
            onClick={() => setActiveIdx(idx)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.15s',
              color: idx === activeIdx ? '#1a365d' : '#64748b',
              border: idx === activeIdx ? '1px solid #1a365d' : '1px solid transparent',
              background: idx === activeIdx ? '#ffffff' : 'transparent',
              fontWeight: idx === activeIdx ? 500 : 400,
            }}
          >
            {topic.name} <span style={{ color: '#94a3b8', marginLeft: 4 }}>{topic.assets.length}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* 左：主题概述 + 核心判断 + 支撑资产 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 主题一句话 */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              主题一句话
            </div>
            <p style={{ fontSize: 16, color: '#1a2332', lineHeight: 1.5, margin: 0 }}>
              {t.description ?? t.kernel?.headline ?? `${t.name}方法论与案例汇总`}
            </p>
            {t.kernel && (
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginTop: 12, paddingTop: 12, borderTop: '1px solid #eef2f7' }}>
                {t.kernel.summary}
              </p>
            )}
          </div>

          {/* 核心判断 */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                核心判断
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {t.quality.total} 个 · E3+ 占比 {e3PlusRatio}%
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {t.assets.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8', padding: 16, textAlign: 'center' }}>
                  还没有判断归到这个主题
                </div>
              ) : (
                t.assets.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 6, cursor: 'pointer' }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 8,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13,
                      background: evBg(a.evidenceLevel), color: evColor(a.evidenceLevel),
                    }}>
                      {a.evidenceLevel}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: '#1a2332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        被引用 {a.outputCount} 次
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 右：商业用途 + 证据缺口 + 已输出 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 商业用途 · v1.8.0 用户化（不写"值多少钱"） */}
          <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(26, 54, 93, 0.03), rgba(234, 88, 12, 0.03))', borderColor: '#1a365d' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a365d', marginBottom: 12 }}>
              💼 商业用途
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
              <div>
                <div style={{ color: '#64748b', marginBottom: 6 }}>✅ 已可输出：</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {hasArticleReady && <span className="pill pill-emerald">公众号长文</span>}
                  {hasProposalReady && <span className="pill pill-emerald">客户方案</span>}
                  {hasArticleReady && <span className="pill pill-emerald">咨询提纲</span>}
                  {!hasArticleReady && !hasProposalReady && (
                    <span style={{ color: '#94a3b8' }}>积累中（≥E2 资产后可输出）</span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', marginBottom: 6 }}>⏳ 还差什么：</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {!hasMethod && <span className="pill pill-amber">课程大纲（需 ≥3 个 E3+）</span>}
                  {t.outputs.length === 0 && <span className="pill pill-amber">1 个客户案例</span>}
                  {hasMethod && t.outputs.length > 0 && (
                    <span style={{ color: '#16a34a', fontSize: 12 }}>已具备商业化基础</span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', marginBottom: 6 }}>🚀 可升级为：</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {hasMethod && <span className="pill pill-violet">培训产品</span>}
                  {hasProposalReady && <span className="pill pill-violet">高客单咨询包</span>}
                  {!hasMethod && !hasProposalReady && (
                    <span style={{ color: '#94a3b8' }}>沉淀更多判断后再升级</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 证据缺口 */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              ⚠ 证据缺口
            </div>
            {t.assets.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>还没有判断归到这个主题</div>
            ) : (
              <div style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {t.quality.total < 5 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ color: '#d97706' }}>●</span>
                    <div>判断数量不足 5 个</div>
                  </div>
                )}
                {t.quality.e3Plus === 0 && t.quality.total > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ color: '#d97706' }}>●</span>
                    <div>缺 E3+ 高质量判断</div>
                  </div>
                )}
                {t.outputs.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ color: '#d97706' }}>●</span>
                    <div>还没用于任何输出</div>
                  </div>
                )}
                {t.quality.total >= 5 && t.quality.e3Plus >= 3 && t.outputs.length > 0 && (
                  <div style={{ color: '#16a34a', fontSize: 12 }}>
                    ✓ 没有明显证据缺口，可以输出
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 已输出 */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              📤 已输出内容
            </div>
            {t.outputs.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>还没有输出记录</div>
            ) : (
              <div style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {t.outputs.map(o => (
                  <div key={o.id}>
                    <div style={{ color: '#1a2332', fontWeight: 500 }}>{o.title}</div>
                    <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                      {formatDate(o.createdAt)} · {o.outputType}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="action-btn process"
            style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: 10 }}
          >
            开始生成 →
          </button>
        </div>
      </div>
    </div>
  );
}

function evBg(level: string): string {
  if (level === 'E3') return '#bfdbfe';
  if (level === 'E2') return '#dbeafe';
  if (level === 'E1') return '#e0e7ff';
  return '#f1f5f9';
}

function evColor(level: string): string {
  if (level === 'E3') return '#1e40af';
  if (level === 'E2') return '#1d4ed8';
  if (level === 'E1') return '#4338ca';
  return '#64748b';
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}