'use client';

/**
 * 试写屏 modal（V1.2）
 *
 * 用当前 preset 真生成 1 篇，看味道对不对
 * - 用户可粘贴 1-3 段文本作为"内容"
 * - 后端调 LLM 生成（带 5 维度 + few-shot）
 * - 显示生成结果 + AI 味自检 + 数据真实性扫描
 *
 * 调字段时不用猜，10s 真生成立刻验证
 */

import { useEffect, useState } from 'react';

interface TryWriteModalProps {
  open: boolean;
  presetName: string;
  onClose: () => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const OUTPUT_TYPES = [
  { value: 'article_full', label: '完整文章', desc: '1500-2500 字' },
  { value: 'speech', label: '演讲稿', desc: '3000-5000 字' },
  { value: 'book_note', label: '读书笔记', desc: '1000-1500 字' },
  { value: 'email', label: '邮件', desc: '500-1000 字' },
];

export default function TryWriteModal({ open, presetName, onClose, toast }: TryWriteModalProps) {
  const [outputType, setOutputType] = useState('article_full');
  const [content, setContent] = useState('');  // 用户内容（粘贴 / 几张资产 ID）
  const [audience, setAudience] = useState('公众号读者');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (open) {
      setResult(null);
      setContent('');
      setElapsed(0);
    }
  }, [open]);

  // 计时器
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [generating]);

  const handleGenerate = async () => {
    if (!content.trim()) {
      toast.error('请粘贴一些内容（文章 / 想法 / 资料）');
      return;
    }
    setGenerating(true);
    setElapsed(0);
    try {
      const res = await fetch('/api/output/try-write', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          outputType,
          audience,
          presetName,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data);
        toast.success(`生成完成（${elapsed}s）· AI 味 ${data.qualityChecks?.aiTasteCheck?.data?.score ?? '?'}/100`);
      } else {
        toast.error(`生成失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`请求失败: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{
          maxWidth: 880, width: '100%', maxHeight: '90vh', overflow: 'auto',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
            📝 试写一篇 · {presetName}
          </h3>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
          💡 用当前 preset 真生成一篇 · 调字段时不用猜，10-30s 立刻验证味道
        </div>

        {!result ? (
          <>
            {/* 输出类型 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                输出类型
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {OUTPUT_TYPES.map(ot => (
                  <button
                    key={ot.value}
                    onClick={() => setOutputType(ot.value)}
                    className={outputType === ot.value ? 'btn btn-primary' : 'btn'}
                    style={{ textAlign: 'left', padding: '8px 10px' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{ot.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{ot.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 内容 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                粘贴内容（文章 / 想法 / 资料）· 至少 50 字
              </label>
              <textarea
                className="input"
                placeholder="例如：最近我们在做 AI 落地项目，遇到了几个有意思的问题..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={8}
                style={{ width: '100%', fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{content.length} 字</div>
            </div>

            {/* 受众 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                受众
              </label>
              <input
                className="input"
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="如：公众号读者 / 客户高层 / 团队同事"
                style={{ width: '100%' }}
              />
            </div>

            {/* 生成按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || content.trim().length < 50}>
                {generating ? `生成中… (${elapsed}s)` : '🪄 真生成一篇'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 生成结果 */}
            <div style={{
              padding: 14, background: 'var(--primary-soft)', borderRadius: 6, marginBottom: 14,
              border: '1px solid var(--primary)',
            }}>
              <strong style={{ fontSize: 14, color: 'var(--ink)' }}>📄 {result.data?.title ?? '生成结果'}</strong>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                {result.data?.primary_version?.length ?? 0} 字 · {elapsed}s
                {result.qualityChecks?.aiTasteCheck?.data?.score && (
                  <> · AI 味 <strong style={{ color: result.qualityChecks.aiTasteCheck.data.passed ? 'var(--success)' : 'var(--warning)' }}>{result.qualityChecks.aiTasteCheck.data.score}/100</strong></>
                )}
              </div>
            </div>

            {/* 主体 */}
            <div style={{
              padding: 16, background: 'var(--bg-subtle)', borderRadius: 6,
              fontSize: 13, lineHeight: 1.8, color: 'var(--text)',
              maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap',
            }}>
              {result.data?.primary_version ?? '无内容'}
            </div>

            {/* 质量检查 */}
            {result.qualityChecks && (
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)' }}>
                {result.qualityChecks.aiTasteCheck?.data?.issues?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <strong>AI 味问题：</strong>
                    <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                      {result.qualityChecks.aiTasteCheck.data.issues.slice(0, 3).map((issue: any, i: number) => (
                        <li key={i}>{issue.location}：{issue.problem}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.qualityChecks.dataFidelity && (
                  <div>
                    <strong>数据扫描：</strong>
                    总 {result.qualityChecks.dataFidelity.total} 个数字 · 已标注 {result.qualityChecks.dataFidelity.cited} · 未标注 {result.qualityChecks.dataFidelity.uncited}
                  </div>
                )}
              </div>
            )}

            {/* 操作 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button className="btn" onClick={() => setResult(null)}>← 重新生成</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => {
                  navigator.clipboard.writeText(result.data?.primary_version ?? '');
                  toast.success('已复制全文');
                }}>📋 复制全文</button>
                <button className="btn" onClick={onClose}>关闭</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}