'use client';

/**
 * 多模态输入 modal（V1.2 阶段 C）
 *
 * 上传/粘贴图片 + 文本 prompt → LLM vision 生成
 *
 * - 1-3 张图片
 * - 选 output type（analyze / article_full / speech / book_note / email）
 * - 可选 preset
 * - 实时显示生成结果
 */

import { useEffect, useState } from 'react';

interface VisionModalProps {
  open: boolean;
  onClose: () => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

const OUTPUT_TYPES = [
  { value: 'analyze', label: '🔍 仅分析图片', desc: '描述图片内容 + 提取洞察' },
  { value: 'article_full', label: '📝 文章', desc: '1500-2500 字' },
  { value: 'speech', label: '🎤 演讲稿', desc: '3000-5000 字' },
  { value: 'book_note', label: '📖 读书笔记', desc: '1000-1500 字' },
  { value: 'email', label: '📧 邮件', desc: '500-1000 字' },
];

export default function VisionModal({ open, onClose, toast }: VisionModalProps) {
  const [images, setImages] = useState<Array<{ base64: string; mimeType: string; preview: string; name?: string }>>([]);
  const [prompt, setPrompt] = useState('');
  const [outputType, setOutputType] = useState('analyze');
  const [audience, setAudience] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string>('');

  useEffect(() => {
    if (open) {
      setImages([]);
      setPrompt('');
      setResult('');
      setOutputType('analyze');
    }
  }, [open]);

  // 监听粘贴
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) addImageFile(file);
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open]);

  const addImageFile = (file: File) => {
    if (images.length >= 3) {
      toast.error('最多 3 张图片');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('只支持图片文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setImages(prev => [...prev, { base64, mimeType: file.type, preview: dataUrl, name: file.name }]);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(addImageFile);
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    if (images.length === 0) {
      toast.error('请上传至少 1 张图片');
      return;
    }
    if (!prompt.trim()) {
      toast.error('请填写 prompt');
      return;
    }
    setGenerating(true);
    setResult('');
    try {
      const res = await fetch('/api/output/vision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          images: images.map(img => ({ base64: img.base64, mimeType: img.mimeType })),
          prompt,
          outputType,
          audience,
          model,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data.content);
        toast.success(`生成完成（${data.usage?.totalTokens ?? '?'} tokens）`);
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
            🖼️ 多模态输入（图片 + 文本 → vision LLM）
          </h3>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        {!result ? (
          <>
            {/* 图片上传区 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                图片（1-3 张 · 可拖入 / 点击选择 / 直接 ⌘V 粘贴）
              </label>
              <div style={{
                display: 'flex', gap: 8, flexWrap: 'wrap',
                padding: 12, background: 'var(--bg-subtle)', borderRadius: 6,
                border: '1px dashed var(--line)',
                minHeight: 80,
              }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: 'relative', width: 100, height: 100 }}>
                    <img src={img.preview} alt={`图 ${i + 1}`} style={{
                      width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4,
                    }} />
                    <button
                      onClick={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--danger)', color: '#fff', border: 'none',
                        fontSize: 11, cursor: 'pointer',
                      }}
                    >✕</button>
                  </div>
                ))}
                {images.length < 3 && (
                  <label style={{
                    width: 100, height: 100, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    border: '1px dashed var(--line-soft)', borderRadius: 4,
                    cursor: 'pointer', color: 'var(--text-3)', fontSize: 24,
                  }}>
                    +
                    <input type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                已上传 {images.length}/3 · 截图后 ⌘V 直接粘贴
              </div>
            </div>

            {/* prompt */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Prompt（至少 5 字）
              </label>
              <textarea
                className="input"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="如：分析这张管理咨询场景的对话截图，提取核心洞察。或：基于这张手绘草图写一篇公众号文章。"
                rows={3}
                style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            {/* output type */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                输出类型
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
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

            {/* model + audience */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Vision 模型（必须支持图片）
                </label>
                <input className="input" value={model} onChange={e => setModel(e.target.value)} placeholder="gpt-4o / claude-3.5 / gemini-1.5" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  受众（可选）
                </label>
                <input className="input" value={audience} onChange={e => setAudience(e.target.value)} placeholder="读者 / 客户高层" />
              </div>
            </div>

            <div style={{
              padding: 10, background: 'var(--warning-bg)', borderRadius: 4,
              fontSize: 12, color: 'var(--text-3)', marginBottom: 16,
            }}>
              ⚠️ 当前 baseUrl 必须支持 vision · deepseek-flash 不支持，请用 gpt-4o / claude-3.5 / gemini-1.5
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={onClose} disabled={generating}>取消</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || images.length === 0 || !prompt.trim()}>
                {generating ? '生成中…（10-30s）' : '🖼️ vision 生成'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{
              padding: 12, background: 'var(--primary-soft)', borderRadius: 6, marginBottom: 12,
              fontSize: 12, color: 'var(--text)',
            }}>
              🖼️ vision 生成结果
            </div>
            <div style={{
              padding: 16, background: 'var(--bg-subtle)', borderRadius: 6,
              fontSize: 13, lineHeight: 1.8, color: 'var(--text)',
              maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap',
            }}>
              {result}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button className="btn" onClick={() => setResult('')}>← 重新生成</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => {
                  navigator.clipboard.writeText(result);
                  toast.success('已复制');
                }}>📋 复制</button>
                <button className="btn" onClick={onClose}>关闭</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}