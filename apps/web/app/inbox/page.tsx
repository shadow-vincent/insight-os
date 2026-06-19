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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/inbox/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawContent: text,
          sourceType: source,
        }),
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
    try {
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
        // 公众号折叠提示（保留在 state 让 paste tab 也能看到）
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

  const handleFileRead = useCallback((file: File) => {
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
        // 提取 frontmatter 标题
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
      setError(null);
      setTab('paste');
    };
    reader.onerror = () => setError('文件读取失败');
    reader.readAsText(file, 'utf-8');
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileRead(file);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">收集箱</h1>
        <p className="page-subtitle">把看到、听到、想到的随手丢进来，AI 帮你整理成可入库的资产</p>
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
            网页 URL
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://mp.weixin.qq.com/s/... 或任意文章 URL"
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
            抓取后会跳到"粘贴" tab 显示正文，可编辑后再交给 AI 整理
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
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            支持 .md / .txt（&lt; 1MB）
          </div>
          {fileName && (
            <div style={{ fontSize: 13, color: 'var(--primary)', marginTop: 14, fontWeight: 600 }}>
              ✓ {fileName}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
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
              <button
                onClick={() => { setFileName(null); setText(''); }}
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
              <button onClick={() => { setResult(null); setText(''); setFileName(null); }} className="btn">
                清空
              </button>
            )}
            <button
              onClick={handleOrganize}
              disabled={!text.trim() || busy}
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
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>已保存到候选池</span>
          </div>

          <ResultPreview result={result} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line-soft)' }}>
            <button onClick={() => router.push('/candidates')} className="btn">
              留在候选池
            </button>
            <button
              onClick={async () => {
                if (!confirm('确认入库为正式资产？')) return;
                const res = await fetch(`/api/candidates/${result.assetId}/promote`, { method: 'POST' });
                const data = await res.json();
                if (data.ok) router.push(`/assets/${data.assetId}`);
              }}
              className="btn btn-primary"
            >
              确认入库 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultPreview({ result }: { result: any }) {
  const card = result.lightCard || {};
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {card.priority && <span className={`pill pill-priority-${card.priority.toLowerCase()}`}>优先级 {card.priority}</span>}
        {card.recommended_next_action && <span className="pill" style={{ background: 'var(--bg-subtle)', color: 'var(--text-2)' }}>{card.recommended_next_action}</span>}
      </div>

      <h3 style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.4 }}>
        {card.title}
      </h3>

      {card.initial_insight && (
        <div className="callout" style={{ marginBottom: 14 }}>
          <strong style={{ color: 'var(--primary)' }}>初始洞察：</strong>
          <span style={{ color: 'var(--text)' }}> {card.initial_insight}</span>
        </div>
      )}

      {card.anti_common_sense && (
        <div className="callout callout-accent" style={{ marginBottom: 14 }}>
          <strong style={{ color: 'var(--accent)' }}>反常识：</strong>
          <span style={{ color: 'var(--text)' }}> {card.anti_common_sense}</span>
        </div>
      )}

      {card.why_it_matters && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>为什么重要</div>
          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>{card.why_it_matters}</p>
        </div>
      )}

      {Array.isArray(card.keywords) && card.keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
          {card.keywords.map((t: string, i: number) => (
            <span key={i} className="pill" style={{ background: 'var(--bg-subtle)', color: 'var(--text-2)' }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
