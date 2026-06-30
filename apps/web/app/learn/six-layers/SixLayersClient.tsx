'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

interface Layer {
  order: number;
  label: string;
  content: string;
  confidence: number;
  counterExample: string;
}

interface SixLayersData {
  ok: boolean;
  title: string;
  description: string;
  origin: string;
  layers: Layer[];
  usage: string;
}

const LAYER_COLORS: Record<string, { bg: string; border: string; text: string; emoji: string }> = {
  '意图': { bg: 'rgba(99, 102, 241, 0.06)', border: 'rgba(99, 102, 241, 0.4)', text: '#4f46e5', emoji: '🎯' },
  '背景': { bg: 'rgba(14, 165, 233, 0.06)', border: 'rgba(14, 165, 233, 0.4)', text: '#0284c7', emoji: '🌐' },
  '判断': { bg: 'rgba(16, 185, 129, 0.06)', border: 'rgba(16, 185, 129, 0.4)', text: '#059669', emoji: '✅' },
  '约束': { bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.4)', text: '#d97706', emoji: '🚧' },
  '风格': { bg: 'rgba(168, 85, 247, 0.06)', border: 'rgba(168, 85, 247, 0.4)', text: '#9333ea', emoji: '🎨' },
  '反馈': { bg: 'rgba(244, 63, 94, 0.06)', border: 'rgba(244, 63, 94, 0.4)', text: '#e11d48', emoji: '🔁' },
};

export default function SixLayersClient() {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<SixLayersData | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [adopted, setAdopted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // V1.11.16: IDB-first
  useEffect(() => {
    (async () => {
      try {
        const { seedSixLayersKernels } = await import('@/lib/idb/kernel-seeds');
        const d = await seedSixLayersKernels({ preview: true });
        setData(d);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  const adopt = async () => {
    setAdopting(true);
    try {
      const { seedSixLayersKernels } = await import('@/lib/idb/kernel-seeds');
      await seedSixLayersKernels({ preview: false });
      setAdopted(true);
      toast.success('已沉淀 6 条六层提问法内核');
      setTimeout(() => router.push('/kernel'), 1500);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdopting(false);
    }
  };

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>
        <h1>加载失败</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
        加载中…
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)',
      padding: '60px 20px 100px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* 顶部 hero */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            display: 'inline-block',
            padding: '6px 14px',
            background: 'rgba(99, 102, 241, 0.1)',
            color: 'var(--primary)',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 16,
          }}>
            🎓 训练营 · 第一节课教学示范
          </div>
          <h1 style={{
            fontSize: 40,
            fontWeight: 700,
            color: 'var(--ink)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            {data.title}
          </h1>
          <p style={{
            fontSize: 16,
            color: 'var(--text-2)',
            marginTop: 16,
            lineHeight: 1.7,
            maxWidth: 720,
            margin: '16px auto 0',
          }}>
            {data.description}
          </p>
          <p style={{
            fontSize: 12,
            color: 'var(--text-3)',
            marginTop: 12,
            fontStyle: 'italic',
          }}>
            {data.origin}
          </p>
        </div>

        {/* 6 层卡片网格 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
          marginBottom: 48,
        }}>
          {data.layers.map((layer) => {
            const c = LAYER_COLORS[layer.label] ?? LAYER_COLORS['意图'];
            return (
              <div
                key={layer.order}
                style={{
                  background: 'white',
                  border: `1.5px solid ${c.border}`,
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                }}>
                  <div style={{
                    fontSize: 32,
                    lineHeight: 1,
                  }}>
                    {c.emoji}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-3)',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}>
                      第 {layer.order} 层
                    </div>
                    <div style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: c.text,
                      lineHeight: 1.2,
                    }}>
                      {layer.label}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: c.bg,
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 12,
                  fontSize: 14,
                  color: 'var(--ink)',
                  lineHeight: 1.6,
                  fontWeight: 500,
                }}>
                  {layer.content}
                </div>

                <div style={{
                  fontSize: 12,
                  color: 'var(--text-3)',
                  lineHeight: 1.5,
                  paddingTop: 12,
                  borderTop: '1px dashed var(--line-soft)',
                }}>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>不适用：</span>
                    {layer.counterExample}
                  </div>
                  <div style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: c.text,
                    fontWeight: 600,
                  }}>
                    置信度 {layer.confidence}/100
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部 CTA */}
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          border: '1px solid var(--line-soft)',
        }}>
          {adopted ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                已沉淀到你的 Insight OS
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 12 }}>
                1.5 秒后跳到内核列表…
              </p>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                把这 6 层变成你的方法论
              </h2>
              <p style={{
                fontSize: 14,
                color: 'var(--text-2)',
                marginTop: 12,
                lineHeight: 1.7,
                maxWidth: 560,
                margin: '12px auto 0',
              }}>
                沉淀后每条都<strong>可以独立编辑</strong>，改 1 改就变成你自己的判断力资产。
                <br />之后每次 AI 调用都会自动注入这 6 条作为你的「判断宪法」。
              </p>
              <button
                onClick={adopt}
                disabled={adopting}
                className="btn"
                style={{
                  marginTop: 24,
                  padding: '14px 32px',
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: adopting ? 'wait' : 'pointer',
                  opacity: adopting ? 0.6 : 1,
                }}
              >
                {adopting ? '沉淀中…' : '✨ 一键沉淀到我的 Insight OS'}
              </button>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12 }}>
                数据存你本地，不上传服务器
              </p>
            </>
          )}
        </div>

        {/* 返回链接 */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a
            href="/"
            style={{
              fontSize: 13,
              color: 'var(--text-3)',
              textDecoration: 'none',
            }}
          >
            ← 返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
