'use client';

/**
 * AI partner 对话改稿 modal（V1.2 阶段 D2）
 *
 * - 粘贴要改的文本（10-500 字）
 * - 输入改稿指令（"更口语化" / "更短" / "加金句"等）
 * - 选 preset（可选）
 * - AI 返回改写版本 + reasoning
 * - 用户可接受 / 拒绝
 */

import { useEffect, useState } from 'react';

interface ReviewModalProps {
  open: boolean;
  presetName?: string;
  onAccept: (newText: string) => void;
  onClose: () => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

const QUICK_INSTRUCTIONS = [
  '更口语化',
  '更短',
  '加金句',
  '更锋利',
  '更温暖',
  '用比喻',
  '用反问',
  '删掉 AI 味',
  '更具体',
];

export default function ReviewModal({ open, presetName, onAccept, onClose, toast }: ReviewModalProps) {
  const [selectedText, setSelectedText] = useState('');
  const [instruction, setInstruction] = useState('');
  const [preset, setPreset] = useState(presetName ?? '');
  const [fullContext, setFullContext] = useState('');
  const [suggestion, setSuggestion] = useState<{ text: string; reasoning: string } | null>(null);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedText('');
      setInstruction('');
      setSuggestion(null);
      setPreset(presetName ?? '');
    }
  }, [open, presetName]);

  const handleReview = async () => {
    if (selectedText.trim().length < 10) {
      toast.error('选中文本至少 10 字');
      return;
    }
    if (instruction.trim().length < 3) {
      toast.error('请填写改稿指令');
      return;
    }
    setReviewing(true);
    try {
      const res = await fetch('/api/output/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          selectedText,
          instruction,
          presetName: preset || undefined,
          fullContext: fullContext || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuggestion({ text: data.suggestion, reasoning: data.reasoning });
        toast.success('改写完成');
      } else {
        toast.error(`改写失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`请求失败: ${e.message}`);
    } finally {
      setReviewing(false);
    }
  };

  const handleAccept = () => {
    if (suggestion) {
      onAccept(suggestion.text);
      onClose();
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
            🤝 AI partner 改稿
          </h3>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        {!suggestion ? (
          <>
            {/* 选中文本 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                选中的文本（10-500 字）
              </label>
              <textarea
                className="input"
                value={selectedText}
                onChange={e => setSelectedText(e.target.value)}
                rows={4}
                style={{ width: '100%', fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }}
                placeholder="粘贴要改写的段落..."
              />
            </div>

            {/* 改稿指令 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                改稿指令
              </label>
              <input
                className="input"
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                placeholder="如：更口语化 / 加一个金句 / 删掉 AI 味"
                style={{ width: '100%' }}
              />
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {QUICK_INSTRUCTIONS.map(q => (
                  <button
                    key={q}
                    className="btn btn-sm"
                    onClick={() => setInstruction(q)}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* preset + 上下文 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Preset（可选）
                </label>
                <input className="input" value={preset} onChange={e => setPreset(e.target.value)} placeholder="vincent-standard" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                文章上下文（可选 · 帮助 AI 理解上下文）
              </label>
              <textarea
                className="input"
                value={fullContext}
                onChange={e => setFullContext(e.target.value)}
                rows={3}
                style={{ width: '100%', fontFamily: 'inherit' }}
                placeholder="可选 · 粘贴文章前 1500 字"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={onClose} disabled={reviewing}>取消</button>
              <button className="btn btn-primary" onClick={handleReview} disabled={reviewing || selectedText.length < 10 || instruction.length < 3}>
                {reviewing ? '改写中…' : '🤝 AI 改稿'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 对比 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>原文</div>
                <div style={{
                  padding: 12, background: 'var(--bg-subtle)', borderRadius: 6,
                  fontSize: 13, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap',
                }}>
                  {selectedText}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>改写</div>
                <div style={{
                  padding: 12, background: 'var(--primary-soft)', borderRadius: 6,
                  fontSize: 13, lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap',
                  border: '1px solid var(--primary)',
                }}>
                  {suggestion.text}
                </div>
              </div>
            </div>

            <div style={{
              padding: 12, background: 'var(--bg-subtle)', borderRadius: 6,
              fontSize: 12, color: 'var(--text-3)', marginBottom: 16,
            }}>
              💡 {suggestion.reasoning}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn" onClick={() => setSuggestion(null)}>← 重新改写</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={onClose}>拒绝</button>
                <button className="btn btn-primary" onClick={handleAccept}>✓ 接受</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}