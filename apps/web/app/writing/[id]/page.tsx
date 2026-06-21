'use client';

/**
 * /writing/[id] 写作详情页
 *
 * - scaffold 状态：显示生成的大纲，可以编辑、生成正文
 * - draft 状态：显示文章正文 + 编辑
 * - published 状态：显示 + 锁定（不能改）
 */

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';

interface WritingDetail {
  id: string;
  title: string;
  writingStatus: 'scaffold' | 'draft' | 'published' | null;
  templateType: string | null;
  content: any;
  scaffold: {
    title: string;
    openingHook: string;
    sections: Array<{ heading: string; keyPoints: string[]; refAssetIds: string[]; contentHint: string }>;
    closingAction: string;
  } | null;
  audience: string;
  createdAt: number;
  updatedAt: number;
}

const STATUS_FLOW: Record<string, string[]> = {
  scaffold: ['draft', 'published'],
  draft: ['scaffold', 'published'],
  published: ['draft'],
};

const STATUS_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  scaffold: { label: '骨架', color: 'var(--warning)', emoji: '🏗️' },
  draft: { label: '草稿', color: 'var(--info)', emoji: '📝' },
  published: { label: '已发布', color: 'var(--success)', emoji: '✅' },
};

export default function WritingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [writing, setWriting] = useState<WritingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/writing/${id}`);
      const data = await res.json();
      if (data.ok) setWriting(data.writing);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (newStatus: 'scaffold' | 'draft' | 'published') => {
    if (!writing) return;
    setTransitioning(true);
    try {
      const res = await fetch(`/api/output/${writing.id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ writingStatus: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        await load();
      } else {
        alert(`切换失败: ${data.error}`);
      }
    } catch (e: any) {
      alert(`请求失败: ${e.message}`);
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  if (!writing) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>未找到</div>;

  const status = STATUS_LABELS[writing.writingStatus ?? 'draft'];
  const scaffold = writing.scaffold;
  const articleText = writing.content?.primary_version ?? '';

  return (
    <div style={{ maxWidth: 880 }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <button className="btn btn-sm" onClick={() => router.push('/writing')}>← 返回</button>
        <span style={{ flex: 1 }} />
        <span style={{
          fontSize: 12, padding: '4px 12px', borderRadius: 10,
          background: status.color, color: '#fff', fontWeight: 600,
        }}>
          {status.emoji} {status.label}
        </span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px' }}>
          {writing.title || '（无标题）'}
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          创建 {new Date(writing.createdAt * 1000).toLocaleString('zh-CN')} · 更新 {new Date(writing.updatedAt * 1000).toLocaleString('zh-CN')}
        </div>
      </div>

      {/* 状态切换 */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong style={{ fontSize: 13, color: 'var(--ink)' }}>切换状态：</strong>
          {STATUS_FLOW[writing.writingStatus ?? 'draft'].map(nextStatus => (
            <button
              key={nextStatus}
              className="btn btn-sm btn-primary"
              onClick={() => changeStatus(nextStatus as any)}
              disabled={transitioning}
            >
              → {STATUS_LABELS[nextStatus].label}
            </button>
          ))}
          {writing.writingStatus === 'published' && (
            <span style={{ fontSize: 12, color: 'var(--success)' }}>已锁定 · 不允许再编辑</span>
          )}
        </div>
      </div>

      {/* scaffold 视图 */}
      {writing.writingStatus === 'scaffold' && scaffold && (
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            {scaffold.title}
          </h2>
          {scaffold.openingHook && (
            <div style={{
              padding: 14, background: 'var(--primary-soft)', borderRadius: 6,
              marginBottom: 20, fontSize: 14, lineHeight: 1.7, color: 'var(--text)',
              borderLeft: '3px solid var(--primary)',
            }}>
              <strong style={{ color: 'var(--primary)' }}>开场钩子：</strong> {scaffold.openingHook}
            </div>
          )}

          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginTop: 24, marginBottom: 12 }}>
            📑 章节大纲
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {scaffold.sections.map((sec, i) => (
              <div key={i} style={{
                padding: 14, background: 'var(--bg-subtle)', borderRadius: 6,
                borderLeft: '3px solid var(--accent)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                  {i + 1}. {sec.heading}
                </div>
                {sec.keyPoints?.length > 0 && (
                  <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 13, color: 'var(--text)' }}>
                    {sec.keyPoints.map((kp, j) => <li key={j}>{kp}</li>)}
                  </ul>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic' }}>
                  💡 {sec.contentHint}
                </div>
                {sec.refAssetIds?.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                    🔗 引用资产：{sec.refAssetIds.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {scaffold.closingAction && (
            <div style={{
              padding: 14, background: 'var(--success-bg)', borderRadius: 6,
              marginTop: 20, fontSize: 14, color: 'var(--text)',
              borderLeft: '3px solid var(--success)',
            }}>
              <strong>🎯 收尾行动：</strong> {scaffold.closingAction}
            </div>
          )}

          <div style={{
            padding: 14, background: 'var(--warning-bg)', borderRadius: 6,
            marginTop: 20, fontSize: 13, color: 'var(--text-3)',
          }}>
            💡 切到 <strong>draft</strong> 状态时，可以基于此骨架生成完整正文（在多卡联合输出里用 article_full 模板）
          </div>
        </div>
      )}

      {/* draft 视图 */}
      {writing.writingStatus === 'draft' && (
        <div className="card" style={{ padding: 28 }}>
          <div style={{
            fontSize: 14, lineHeight: 1.9, color: 'var(--text)',
            whiteSpace: 'pre-wrap',
          }}>
            {articleText || '（正文为空）'}
          </div>
        </div>
      )}

      {/* published 视图（锁定） */}
      {writing.writingStatus === 'published' && (
        <div className="card" style={{ padding: 28 }}>
          <div style={{
            padding: 12, background: 'var(--success-bg)', borderRadius: 6,
            marginBottom: 16, fontSize: 13, color: 'var(--text)',
          }}>
            ✅ 已发布 · 内容锁定 · 不会再修改
          </div>
          <div style={{
            fontSize: 14, lineHeight: 1.9, color: 'var(--text)',
            whiteSpace: 'pre-wrap',
          }}>
            {articleText}
          </div>
        </div>
      )}
    </div>
  );
}