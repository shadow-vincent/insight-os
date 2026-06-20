'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const SOURCES = [
  { id: 'web', label: '网页摘录' },
  { id: 'note', label: '随手记' },
  { id: 'transcript', label: '会议转录' },
  { id: 'quote', label: '引文金句' },
];

const TABS = [
  {
    id: 'paste', label: '粘贴',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    ),
  },
  {
    id: 'url', label: 'URL 抓取',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    id: 'file', label: '拖文件',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
    ),
  },
] as const;

type Tab = typeof TABS[number]['id'];

/**
 * 文件名 → SourceType 识别（V1.1 自动识别）
 * 注：服务端 lib/parsers/detect.ts 也有相同逻辑，这里是 UI 层先识别传给后端
 */
function detectFileType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(lower)) return 'image';
  if (/\.(mp3|m4a|wav)$/.test(lower)) return 'audio';
  if (/\.(docx|doc)$/.test(lower)) return 'docx';
  if (/\.(pptx|ppt)$/.test(lower)) return 'pptx';
  if (/\.(xlsx|xls)$/.test(lower)) return 'xlsx';
  if (/\.(epub|mobi|azw3)$/.test(lower)) return 'epub';
  if (/\.(srt|vtt)$/.test(lower)) return 'subtitle';
  if (/\.(pdf)$/.test(lower)) return 'pdf';
  if (/\.(md|markdown)$/.test(lower)) return 'markdown';
  if (/\.(txt)$/.test(lower)) return 'manual';
  return 'manual';
}

// V1.1 快捷按钮配置
// ready=true: 已 work（office + pdf）
// ready=false: stub 状态（W2-W5 后续迭代）
const SHORTCUTS: Array<{
  id: string; label: string; icon: string;
  accept?: string; placeholder?: string;
  ready: boolean;
  eta?: string;
}> = [
  { id: 'image',     label: '截图 OCR',   icon: '📷',  accept: 'image/*',                        ready: false, eta: 'V1.1 W2' },
  { id: 'video',     label: '视频字幕',   icon: '🎬',  placeholder: 'YouTube / B 站 URL',        ready: false, eta: 'V1.1 W4' },
  { id: 'epub',      label: '电子书',     icon: '📕',  accept: '.epub,.mobi,.azw3',             ready: false, eta: 'V1.1 W3' },
  { id: 'audio',     label: '音频转写',   icon: '🎙️', accept: '.mp3,.m4a,.wav',                 ready: false, eta: 'V1.1 W5' },
  { id: 'xiaoyuzhou', label: '小宇宙',    icon: '🎙️', placeholder: '小宇宙 URL',                  ready: false, eta: 'V1.1 W5' },
  { id: 'weread',    label: '微信读书',   icon: '📱',  accept: '.md,.txt',                      ready: false, eta: 'V1.1 W5' },
  { id: 'office',    label: 'Office',     icon: '📄',  accept: '.docx,.pptx,.xlsx,.doc,.ppt,.xls', ready: true },
];

export default function InboxPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>}>
      <InboxInner />
    </Suspense>
  );
}

function InboxInner() {
  const search = useSearchParams();
  const router = useRouter();
  const resumeId = search.get('resume');
  const [tab, setTab] = useState<Tab>('paste');

  const [text, setText] = useState('');
  const [source, setSource] = useState('web');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // URL 抓取
  const [url, setUrl] = useState('');
  const [urlFetching, setUrlFetching] = useState(false);

  // 拖文件
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFileSource, setPendingFileSource] = useState<string>('manual');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shortcutFileInputRef = useRef<HTMLInputElement>(null);
  const [shortcutTarget, setShortcutTarget] = useState<string>('image');

  useEffect(() => {
    if (resumeId) {
      fetch(`/api/candidates/${resumeId}`)
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            setText(data.candidate.rawText);
            setSource(data.candidate.source);
            setTab('paste');
          }
        });
    }
  }, [resumeId]);

  const handleOrganize = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      let body: any;

      if (pendingFile) {
        // 文件上传路径（V1.1 新）
        const base64 = await fileToBase64(pendingFile);
        body = {
          file: base64,
          fileName: pendingFile.name,
          sourceType: pendingFileSource,
        };
      } else if (text.trim()) {
        // 纯文本路径
        body = {
          rawContent: text,
          sourceType: source,
        };
      } else {
        setError('需要粘贴文本 / 上传文件 / 填 URL');
        setBusy(false);
        return;
      }

      const res = await fetch('/api/inbox/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data);
      } else {
        setError(data.error || '整理失败');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUrlFetch = async () => {
    if (!url.trim() || urlFetching) return;
    setUrlFetching(true);
    setError(null);

    // 视频类 URL（YouTube/B站/小宇宙）走新的 intake
    const isVideoUrl = /youtube\.com|youtu\.be|bilibili\.com|b23\.tv|xiaoyuzhou\.fm/.test(url);

    try {
      if (isVideoUrl) {
        // 直接 POST 给新 intake
        const detectedType = /youtube|youtu\.be/.test(url) ? 'youtube'
          : /bilibili|b23/.test(url) ? 'bilibili'
          : /xiaoyuzhou/.test(url) ? 'xiaoyuzhou'
          : 'web';
        const res = await fetch('/api/inbox/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, sourceType: detectedType }),
        });
        const data = await res.json();
        if (data.ok) {
          setResult(data);
        } else {
          setError(data.error || '抓取失败');
        }
        setUrlFetching(false);
        return;
      }

      // 其他 URL 走原 import-url
      const res = await fetch('/api/inbox/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.ok) {
        setText(data.content);
        setSource(data.sourceType === 'weixin_article' ? 'web' : 'web');
        if (data.title && !text.trim()) {
          setText(`标题：${data.title}\n\n${data.content}`);
        }
        if (data.warning) {
          setError(data.warning);
        } else {
          setError(null);
        }
        setTab('paste');
      } else {
        setError(data.error || '抓取失败');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUrlFetching(false);
    }
  };

  // 文本文件读取（md/txt 兼容老逻辑）
  const handleFileRead = useCallback((file: File, sourceType: string) => {
    const isText = /\.(txt|md|markdown)$/i.test(file.name);
    if (isText) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content !== 'string') {
          setError('文件读取失败');
          return;
        }
        setFileName(file.name);
        const isMd = file.name.toLowerCase().endsWith('.md');
        if (isMd) {
          const fmMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
          if (fmMatch) {
            const fm = fmMatch[1];
            const body = fmMatch[2];
            const titleMatch = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
            const titleLine = titleMatch ? `\n# ${titleMatch[1]}\n` : '';
            setText(titleLine + body);
          } else {
            setText(content);
          }
          setSource('knowledge_card');
        } else {
          setText(content);
          setSource('book');
        }
        setPendingFile(null);
        setError(null);
        setTab('paste');
      };
      reader.onerror = () => setError('文件读取失败');
      reader.readAsText(file, 'utf-8');
    } else {
      // 非文本（图片 / 音频 / Office / 电子书）走文件上传路径
      setFileName(file.name);
      setPendingFile(file);
      setPendingFileSource(sourceType);
      setText(`[${file.name}] 已选择，${Math.round(file.size / 1024)} KB，点"AI 整理"上传 → 抽卡`);
      setTab('paste');
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileRead(file, detectFileType(file.name));
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file, detectFileType(file.name));
  };

  const onShortcutClick = (shortcutId: string) => {
    const sc = SHORTCUTS.find(s => s.id === shortcutId);
    if (!sc) return;

    // 未就绪的快捷按钮：直接提示，不弹文件选择（避免二次操作）
    if (!sc.ready) {
      setError(`「${sc.label}」将在 ${sc.eta ?? '后续版本'} 实现，V1.1 首批主链路（Office + PDF）已就绪`);
      setTimeout(() => setError(null), 4000);
      return;
    }

    if (shortcutId === 'video' || shortcutId === 'xiaoyuzhou') {
      // URL 类型：填到 url 输入框
      setUrl('');
      setTab('url');
    } else {
      // 文件类型：触发文件选择
      setShortcutTarget(shortcutId);
      if (sc.accept) {
        shortcutFileInputRef.current?.setAttribute('accept', sc.accept);
      }
      shortcutFileInputRef.current?.click();
    }
  };

  const onShortcutFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file, shortcutTarget);
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">收集箱</h1>
        <p className="page-subtitle">把看到、听到、想到的随手丢进来，AI 帮你整理成可入库的资产</p>
      </div>

      {/* V1.1: 快捷按钮栏 - 拖入或粘贴自动识别 */}
      <div style={{
        marginBottom: 20, padding: 14,
        background: 'var(--bg-subtle)', borderRadius: 8,
        border: '1px solid var(--line-soft)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
          快捷输入
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SHORTCUTS.map(sc => (
            <button
              key={sc.id}
              onClick={() => onShortcutClick(sc.id)}
              title={sc.ready ? sc.label : `${sc.label} · ${sc.eta ?? '后续版本'}实现`}
              style={{
                padding: '8px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--line)',
                borderRadius: 6, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                color: sc.ready ? 'var(--text)' : 'var(--text-3)',
                opacity: sc.ready ? 1 : 0.7,
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 16 }}>{sc.icon}</span>
              <span>{sc.label}</span>
              {!sc.ready && (
                <span style={{
                  fontSize: 9, padding: '1px 4px',
                  background: 'var(--bg-subtle)', color: 'var(--text-3)',
                  borderRadius: 3, fontWeight: 600, letterSpacing: '0.02em',
                }}>
                  {sc.eta}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          ref={shortcutFileInputRef}
          type="file"
          onChange={onShortcutFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--line)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--primary)' : 'transparent'}`,
              color: tab === t.id ? 'var(--primary)' : 'var(--text-2)',
              fontSize: 14, fontWeight: tab === t.id ? 600 : 500,
              cursor: 'pointer', marginBottom: -1,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle' }}>
              {t.icon}{t.label}
            </span>
          </button>
        ))}
      </div>

      {/* URL Tab */}
      {tab === 'url' && (
        <div className="card" style={{ padding: 28, marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>
            网页 / 视频 / 播客 URL
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="公众号 / YouTube / B 站 / 小宇宙"
              className="form-input"
              style={{
                flex: 1, padding: '11px 14px',
                background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                borderRadius: 6, fontSize: 14, color: 'var(--ink)', fontFamily: 'inherit',
              }}
              disabled={urlFetching}
            />
            <button
              onClick={handleUrlFetch}
              disabled={!url.trim() || urlFetching}
              className="btn btn-primary"
            >
              {urlFetching ? '抓取中…' : '抓取 →'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
            视频/播客 URL 直接抽卡；公众号/网页 URL 抓取后跳到"粘贴" tab
          </div>
          {error && (
            <div className="callout callout-warning" style={{ marginTop: 16, fontSize: 13 }}>
              <strong>提示：</strong> {error}
            </div>
          )}
        </div>
      )}

      {/* 文件 Tab */}
      {tab === 'file' && (
        <div
          className="card"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            padding: 56, marginBottom: 16,
            textAlign: 'center',
            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--line-strong)'}`,
            background: dragOver ? 'var(--primary-soft)' : 'var(--bg-subtle)',
            transition: 'all 120ms',
            cursor: 'pointer',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📎</div>
          <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 500, marginBottom: 6 }}>
            拖文件到此处，或点击选择
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
            支持 .md / .txt / .docx / .pptx / .xlsx / .epub / .mobi / .pdf / .srt / .vtt / 图片 / 音频
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            自动识别文件类型 → 解析 → AI 抽卡
          </div>
          {fileName && (
            <div style={{ fontSize: 13, color: 'var(--primary)', marginTop: 14, fontWeight: 600 }}>
              ✓ {fileName}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={onFileInputChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* 粘贴 / 编辑 Tab (URL 和文件最终都到这里) */}
      {tab === 'paste' && (
        <div className="card" style={{ padding: 28, marginBottom: 16 }}>
          {fileName && (
            <div className="callout" style={{ marginBottom: 16, fontSize: 13 }}>
              已加载文件：<strong>{fileName}</strong>
              {pendingFile && <span style={{ marginLeft: 8, color: 'var(--text-3)' }}>(待上传)</span>}
              <button
                onClick={() => { setFileName(null); setText(''); setPendingFile(null); }}
                style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13 }}
              >
                清除
              </button>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>
              来源
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SOURCES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSource(s.id)}
                  style={{
                    padding: '7px 14px',
                    background: source === s.id ? 'var(--primary)' : 'var(--bg-subtle)',
                    color: source === s.id ? '#fff' : 'var(--text)',
                    border: `1px solid ${source === s.id ? 'var(--primary)' : 'var(--line)'}`,
                    borderRadius: 5, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>
              原文（可编辑）
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="把任何看到、听到、想到的随手贴进来…"
              style={{
                width: '100%',
                minHeight: 240,
                padding: 16,
                fontSize: 15, lineHeight: 1.7,
                fontFamily: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 6,
                background: 'var(--bg-subtle)',
                color: 'var(--ink)',
                resize: 'vertical',
              }}
              disabled={busy}
            />
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8, textAlign: 'right' }}>
              {text.length} 字
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {result && (
              <button onClick={() => { setResult(null); setText(''); setFileName(null); setPendingFile(null); }} className="btn">
                清空
              </button>
            )}
            <button
              onClick={handleOrganize}
              disabled={(!text.trim() && !pendingFile) || busy}
              className="btn btn-primary"
            >
              {busy ? '整理中…' : 'AI 整理 →'}
            </button>
          </div>

          {error && (
            <div className="callout callout-warning" style={{ marginTop: 16 }}>
              <strong>提示：</strong> {error}
              <button
                onClick={() => setError(null)}
                style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12 }}
              >
                知道了
              </button>
            </div>
          )}
        </div>
      )}

      {/* 整理结果 */}
      {result && (
        <div className="card" style={{ padding: 28, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>整理结果</h2>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {result.segmentsCount ? `已生成 ${result.assetIds?.length ?? 0} 张轻量卡` : '已保存到候选池'}
            </span>
          </div>

          {result.segmentsCount > 1 ? (
            // 多段结果（chunked）
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                检测到 {result.segmentsCount} 段内容，已逐段抽卡：
              </div>
              {result.lightCards?.map((lc: any, i: number) => (
                <ResultPreview key={i} card={lc} />
              ))}
            </div>
          ) : (
            // 单段结果
            <ResultPreview card={result.lightCards?.[0] || result.lightCard} />
          )}

          {result.errors && result.errors.length > 0 && (
            <div className="callout callout-warning" style={{ marginTop: 16, fontSize: 12 }}>
              <strong>部分段落失败：</strong>
              <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
                {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line-soft)' }}>
            <button onClick={() => router.push('/candidates')} className="btn">
              留在候选池
            </button>
            {result.assetIds?.length === 1 && (
              <button
                onClick={async () => {
                  if (!confirm('确认入库为正式资产？')) return;
                  const res = await fetch(`/api/candidates/${result.assetIds[0]}/promote`, { method: 'POST' });
                  const data = await res.json();
                  if (data.ok) router.push(`/assets/${data.assetId}`);
                }}
                className="btn btn-primary"
              >
                确认入库 →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultPreview({ card }: { card: any }) {
  if (!card) return null;
  return (
    <div style={{ marginBottom: 14, padding: 14, background: 'var(--bg-subtle)', borderRadius: 6 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {card.priority && <span className={`pill pill-priority-${card.priority.toLowerCase()}`}>优先级 {card.priority}</span>}
        {card.recommended_next_action && <span className="pill" style={{ background: 'var(--bg-card)', color: 'var(--text-2)' }}>{card.recommended_next_action}</span>}
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px', lineHeight: 1.4 }}>
        {card.title}
      </h3>

      {card.initial_insight && (
        <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8, lineHeight: 1.6 }}>
          💡 <strong style={{ color: 'var(--primary)' }}>洞察：</strong> {card.initial_insight}
        </div>
      )}

      {card.anti_common_sense && (
        <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8, lineHeight: 1.6 }}>
          ⚡ <strong style={{ color: 'var(--accent)' }}>反常识：</strong> {card.anti_common_sense}
        </div>
      )}

      {Array.isArray(card.keywords) && card.keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {card.keywords.map((t: string, i: number) => (
            <span key={i} className="pill" style={{ background: 'var(--bg-card)', color: 'var(--text-2)', fontSize: 11 }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// File → base64 工具（V1.1 新）
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('FileReader returned non-string'));
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}