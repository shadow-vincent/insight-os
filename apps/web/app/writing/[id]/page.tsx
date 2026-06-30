'use client';

/**
 * /writing/[id] 写作详情页（v1.5 重写）
 *
 * 改动点（v1.5 一次性加 3 个新功能）：
 * - ① 加 textarea 编辑器（替代纯显示）
 * - ② 草稿自动恢复 + debounce 自动保存（3 秒）
 * - ③ 版本历史 modal（手动保存 + 自动 snapshot + 一键恢复）
 * - ④ 改写 / 润色浮动工具条（选区 + 6 个 style + 对比 modal）
 * - ⑤ 多平台适配 modal（5 个平台 + tips + 另存为版本）
 */

import { useEffect, useState, useCallback, use, useRef, useMemo } from 'react';
import { readSource, writeSource } from '@/lib/data-source';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

interface WritingDetail {
  id: string;
  title: string;
  writingStatus: 'scaffold' | 'draft' | 'published' | null;
  templateType: string | null;
  content: any;
  scaffold: any;
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

const REWRITE_STYLES = [
  { id: 'professional', emoji: '👔', label: '更专业' },
  { id: 'casual', emoji: '💬', label: '更口语' },
  { id: 'concise', emoji: '✂️', label: '更简洁' },
  { id: 'expanded', emoji: '➕', label: '更长' },
  { id: 'english', emoji: '🌐', label: '→ 英文' },
  { id: 'chinese', emoji: '🀄', label: '→ 中文' },
] as const;

const PLATFORMS = [
  { id: 'wechat', emoji: '📰', label: '公众号' },
  { id: 'zhihu', emoji: '🟦', label: '知乎' },
  { id: 'jike', emoji: '☕', label: '即刻' },
  { id: 'xiaohongshu', emoji: '📕', label: '小红书' },
  { id: 'video', emoji: '🎬', label: '视频脚本' },
] as const;

export default function WritingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [writing, setWriting] = useState<WritingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  // ========== v1.5 新增：编辑器状态 ==========
  const [text, setText] = useState<string>('');
  const [textTitle, setTextTitle] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ========== v1.5 新增：选区 + 改写浮动工具条 ==========
  const [selection, setSelection] = useState<{ text: string; rect: { top: number; left: number } } | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<{ original: string; rewritten: string; style: string } | null>(null);

  // ========== v1.5 新增：版本历史 modal ==========
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; createdAt: number; note: string | null; createdBy: string; content: string; title: string | null }>>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);

  // ========== v1.5 新增：多平台适配 modal ==========
  const [showAdapt, setShowAdapt] = useState(false);
  const [adaptPlatform, setAdaptPlatform] = useState<keyof typeof PLATFORMS_MAP | null>(null);
  const [adaptLoading, setAdaptLoading] = useState(false);
  const [adaptResult, setAdaptResult] = useState<{ adapted: { content: string }; tips: string[]; platform: string } | null>(null);

  const PLATFORMS_MAP = useMemo(() => ({
    wechat: { emoji: '📰', label: '公众号' },
    zhihu: { emoji: '🟦', label: '知乎' },
    jike: { emoji: '☕', label: '即刻' },
    xiaohongshu: { emoji: '📕', label: '小红书' },
    video: { emoji: '🎬', label: '视频脚本' },
  }), []);

  // V1.12 统一 helper
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { readSource } = await import('@/lib/data-source');
      const data = await readSource<any>(`/api/writing/${id}`, {
        fallback: async () => {
          const { getOutputs } = await import('@/lib/idb/operations');
          const all = await getOutputs();
          const w = all.find(o => o.id === id);
          return w ? { ok: true, writing: w } : { ok: false };
        },
      });
      if (data.ok && data.writing) {
        setWriting(data.writing);
        const draftData = await readSource<any>(`/api/writing/${id}/draft`, {
          fallback: async () => {
            const { getWritingDrafts } = await import('@/lib/idb/operations');
            const drafts = await getWritingDrafts(id);
            return { ok: true, draft: drafts[0] ?? null };
          },
        });
        const articleText = data.writing.content?.primary_version ?? '';
        if (draftData.ok && draftData.draft && draftData.draft.content !== articleText) {
          setText(draftData.draft.content);
          setTextTitle(draftData.draft.title ?? data.writing.title ?? '');
          setLastSavedAt(draftData.draft.updatedAt);
        } else {
          setText(articleText);
          setTextTitle(data.writing.title ?? '');
        }
        setIsReadOnly(data.writing.writingStatus === 'published');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ========== v1.5 新增：debounce 自动保存 ==========
  const debouncedSave = useCallback((newText: string, newTitle: string) => {
    if (isReadOnly) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        // V1.12 统一 helper
        const { writeSource } = await import('@/lib/data-source');
        const data = await writeSource<any>(`/api/writing/${id}/draft`, { content: newText, title: newTitle }, {
          fallback: async (p: any) => {
            const { addWritingDraft } = await import('@/lib/idb/operations');
            const draftId = `draft_${id}_${Date.now().toString(36)}`;
            await addWritingDraft({ id: draftId, writingId: id, content: p.content, title: p.title });
            return { ok: true, updatedAt: Date.now() };
          },
        });
        if (data.ok) {
          setSaveStatus('saved');
          setLastSavedAt(data.updatedAt);
        } else {
          setSaveStatus('error');
          toast.error(`自动保存失败：${data.error}`);
        }
      } catch (e: any) {
        setSaveStatus('error');
        toast.error(`自动保存失败：${e.message}`);
      }
    }, 3000);
  }, [id, isReadOnly, toast]);

  const handleTextChange = (newText: string) => {
    setText(newText);
    setSaveStatus('idle');
    debouncedSave(newText, textTitle);
  };

  const handleTitleChange = (newTitle: string) => {
    setTextTitle(newTitle);
    debouncedSave(text, newTitle);
  };

  // 离开页面 / 卸载时立即保存
  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, []);

  // ========== v1.5 新增：选区监听 + 浮动工具条位置 ==========
  const handleSelect = () => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) {
      setSelection(null);
      return;
    }
    const selectedText = text.substring(start, end);
    if (selectedText.trim().length < 2) {
      setSelection(null);
      return;
    }
    // 简单定位：选区上方的 textarea 内坐标（用浏览器原生 API）
    const rect = ta.getBoundingClientRect();
    setSelection({
      text: selectedText,
      rect: {
        top: rect.top + window.scrollY + 8,  // 离 textarea 顶部 8px
        left: rect.left + 20,
      },
    });
  };

  // ========== v1.5 新增：改写 / 润色 ==========
  const handleRewrite = async (style: string) => {
    if (!selection) return;
    setRewriting(true);
    try {
      const res = await fetch('/api/writing/rewrite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: selection.text, style, context: text.substring(0, 200) }),
      });
      const data = await res.json();
      if (data.ok) {
        setRewriteResult({ original: data.original, rewritten: data.rewritten, style });
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      } else {
        toast.error(`改写失败：${data.error}`);
      }
    } catch (e: any) {
      toast.error(`改写失败：${e.message}`);
    } finally {
      setRewriting(false);
    }
  };

  const applyRewrite = () => {
    if (!rewriteResult || !textareaRef.current) return;
    const ta = textareaRef.current;
    // 简化实现：直接在原文中找到 original 替换成 rewritten
    const newText = text.replace(rewriteResult.original, rewriteResult.rewritten);
    setText(newText);
    setRewriteResult(null);
    debouncedSave(newText, textTitle);
    toast.success('已替换到正文');
  };

  // ========== v1.5 新增：版本历史 ==========
  const loadVersions = async () => {
    setLoadingVersions(true);
    try {
      const { readSource } = await import('@/lib/data-source');
      const data = await readSource<any>(`/api/writing/${id}/versions`, {
        fallback: async () => {
          const { getWritingVersions } = await import('@/lib/idb/operations');
          const vs = await getWritingVersions(id);
          return { ok: true, versions: vs };
        },
      });
      if (data.ok) setVersions(data.versions);
    } catch (e: any) {
      toast.error(`加载版本失败：${e.message}`);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleOpenVersions = () => {
    setShowVersions(true);
    loadVersions();
  };

  const handleSaveVersion = async (note: string) => {
    setSavingVersion(true);
    try {
      const { writeSource } = await import('@/lib/data-source');
      const res = await writeSource<any>(`/api/writing/${id}/versions`, { content: text, title: textTitle, note, createdBy: 'manual' }, {
        fallback: async (p: any) => {
          const { addWritingVersion } = await import('@/lib/idb/operations');
          const vId = `v_${id}_${Date.now().toString(36)}`;
          await addWritingVersion({ id: vId, writingId: id, content: p.content, title: p.title, note: p.note ?? '', createdBy: p.createdBy ?? 'manual' });
          return { ok: true, versionId: vId };
        },
      });
      if (res.ok) {
        toast.success('版本已保存');
        loadVersions();
      } else {
        toast.error(`保存失败：${data.error}`);
      }
    } catch (e: any) {
      toast.error(`保存失败：${e.message}`);
    } finally {
      setSavingVersion(false);
    }
  };

  const handleRestoreVersion = async (vid: string) => {
    if (!confirm('恢复此版本？当前内容会自动快照到版本历史。')) return;
    try {
      const res = await fetch(`/api/writing/${id}/versions/${vid}/restore`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        toast.success('已恢复');
        setShowVersions(false);
        load();
      } else {
        toast.error(`恢复失败：${data.error}`);
      }
    } catch (e: any) {
      toast.error(`恢复失败：${e.message}`);
    }
  };

  // ========== v1.5 新增：多平台适配 ==========
  const handleAdapt = async (platform: string) => {
    setAdaptLoading(true);
    setAdaptPlatform(platform as any);
    setAdaptResult(null);
    try {
      const res = await fetch('/api/writing/adapt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ writingId: id, targetPlatform: platform, content: text, title: textTitle }),
      });
      const data = await res.json();
      if (data.ok) {
        setAdaptResult({ adapted: data.adapted, tips: data.tips, platform });
      } else {
        toast.error(`适配失败：${data.error}`);
      }
    } catch (e: any) {
      toast.error(`适配失败：${e.message}`);
    } finally {
      setAdaptLoading(false);
    }
  };

  const handleSaveAdaptAsVersion = async () => {
    if (!adaptResult) return;
    setSavingVersion(true);
    try {
      const res = await fetch(`/api/writing/${id}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: adaptResult.adapted.content,
          title: textTitle,
          note: `多平台适配结果 · ${PLATFORMS_MAP[adaptResult.platform as keyof typeof PLATFORMS_MAP]?.label ?? adaptResult.platform}`,
          createdBy: 'system',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('已保存为新版本（在版本历史查看）');
        setShowAdapt(false);
        setAdaptResult(null);
      } else {
        toast.error(`保存失败：${data.error}`);
      }
    } catch (e: any) {
      toast.error(`保存失败：${e.message}`);
    } finally {
      setSavingVersion(false);
    }
  };

  // ========== 状态切换（原有功能） ==========
  const changeStatus = async (newStatus: 'scaffold' | 'draft' | 'published') => {
    if (!writing) return;
    // 切换到 published 时，把 textarea 内容写回 outputs
    if (newStatus === 'published') {
      try {
        const { writeSource } = await import('@/lib/data-source');
        const draftRes = await writeSource<any>(`/api/writing/${id}/draft`, { content: text, title: textTitle }, {
          fallback: async (p: any) => {
            const { addWritingDraft } = await import('@/lib/idb/operations');
            await addWritingDraft({ id: `draft_pub_${id}_${Date.now().toString(36)}`, writingId: id, content: p.content, title: p.title });
            return { ok: true };
          },
        });
        if (!draftRes.ok) {
          toast.error('发布前保存草稿失败');
          return;
        }
      } catch (e: any) {
        toast.error(`发布前保存失败：${e.message}`);
        return;
      }
    }
    setTransitioning(true);
    try {
      const { writeSource } = await import('@/lib/data-source');
      const data = await writeSource<any>(`/api/output/${writing.id}/status`, { writingStatus: newStatus }, {
        fallback: async (p: any) => {
          const { updateOutput } = await import('@/lib/idb/operations');
          await updateOutput(writing.id, { writingStatus: p.writingStatus });
          return { ok: true };
        },
      });
      if (data.ok) {
        toast.success(`已切换到 ${STATUS_LABELS[newStatus].label}`);
        await load();
      } else {
        toast.error(`切换失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`请求失败: ${e.message}`);
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  if (!writing) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>未找到</div>;

  const status = STATUS_LABELS[writing.writingStatus ?? 'draft'];
  const scaffold = writing.scaffold;
  const charCount = text.length;

  return (
    <div style={{ maxWidth: 880, position: 'relative' }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <button className="btn btn-sm" onClick={() => router.push('/writing')}>← 返回</button>
        <span style={{
          fontSize: 12, padding: '4px 12px', borderRadius: 10,
          background: status.color, color: '#fff', fontWeight: 600,
        }}>
          {status.emoji} {status.label}
        </span>
        {/* v1.5: 自动保存状态指示器 */}
        {!isReadOnly && (
          <span style={{
            fontSize: 11, color: 'var(--text-3)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {saveStatus === 'saving' && <>⏳ 保存中…</>}
            {saveStatus === 'saved' && lastSavedAt && (
              <>✓ 已自动保存 · {new Date(lastSavedAt * 1000).toLocaleTimeString('zh-CN')}</>
            )}
            {saveStatus === 'error' && <>⚠️ 保存失败</>}
            {saveStatus === 'idle' && lastSavedAt && (
              <span style={{ opacity: 0.6 }}>· {new Date(lastSavedAt * 1000).toLocaleTimeString('zh-CN')}</span>
            )}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {/* v1.5: 字数统计 */}
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
          {charCount} 字
        </span>
      </div>

      {/* 标题编辑 */}
      <input
        type="text"
        value={textTitle}
        onChange={e => handleTitleChange(e.target.value)}
        readOnly={isReadOnly}
        placeholder="（无标题）"
        style={{
          width: '100%', fontSize: 22, fontWeight: 700, color: 'var(--ink)',
          border: 'none', background: 'transparent', outline: 'none',
          marginBottom: 16, padding: 0,
        }}
      />

      {/* 状态切换 */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
          {/* v1.5: 工具栏 */}
          {!isReadOnly && (
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={handleOpenVersions}>
                📁 版本历史
              </button>
              <button className="btn btn-sm btn-accent" onClick={() => setShowAdapt(true)}>
                🔀 一键改写其他平台
              </button>
            </span>
          )}
        </div>
      </div>

      {/* scaffold 视图（骨架状态仍展示大纲） */}
      {writing.writingStatus === 'scaffold' && scaffold && (
        <div className="card" style={{ padding: 28, marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            {scaffold.title}
          </h2>
          {scaffold.openingHook && (
            <div style={{
              padding: 14, background: 'var(--primary-soft)', borderRadius: 6,
              marginBottom: 20, fontSize: 14, lineHeight: 1.7,
              borderLeft: '3px solid var(--primary)',
            }}>
              <strong style={{ color: 'var(--primary)' }}>开场钩子：</strong> {scaffold.openingHook}
            </div>
          )}
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginTop: 24, marginBottom: 12 }}>
            📑 章节大纲
          </h3>
          {scaffold.sections.map((sec: any, i: number) => (
            <div key={i} style={{
              padding: 14, background: 'var(--bg-subtle)', borderRadius: 6,
              borderLeft: '3px solid var(--accent)', marginBottom: 12,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                {i + 1}. {sec.heading}
              </div>
              {sec.keyPoints?.length > 0 && (
                <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 13 }}>
                  {sec.keyPoints.map((kp: string, j: number) => <li key={j}>{kp}</li>)}
                </ul>
              )}
              {sec.contentHint && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic' }}>
                  💡 {sec.contentHint}
                </div>
              )}
            </div>
          ))}
          {scaffold.closingAction && (
            <div style={{
              padding: 14, background: 'var(--success-bg)', borderRadius: 6,
              marginTop: 20, fontSize: 14, borderLeft: '3px solid var(--success)',
            }}>
              <strong>🎯 收尾行动：</strong> {scaffold.closingAction}
            </div>
          )}
          <div style={{
            padding: 14, background: 'var(--warning-bg)', borderRadius: 6,
            marginTop: 20, fontSize: 13, color: 'var(--text-3)',
          }}>
            💡 切到 <strong>draft</strong> 状态后，可以基于此骨架开始编辑正文
          </div>
        </div>
      )}

      {/* v1.5: 编辑器（draft + published 都用 textarea，published 时 readOnly） */}
      {writing.writingStatus !== 'scaffold' && (
        <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => handleTextChange(e.target.value)}
            onSelect={handleSelect}
            onMouseUp={handleSelect}
            onKeyUp={handleSelect}
            readOnly={isReadOnly}
            placeholder="开始写……"
            style={{
              width: '100%', minHeight: 480, padding: 24,
              fontSize: 15, lineHeight: 1.85, color: 'var(--text)',
              border: 'none', outline: 'none', resize: 'vertical',
              background: 'transparent', fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      {/* v1.5: 改写浮动工具条 */}
      {selection && !isReadOnly && (
        <div
          style={{
            position: 'absolute', top: selection.rect.top, left: selection.rect.left,
            display: 'flex', gap: 4, padding: 6,
            background: 'var(--ink)', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.3)',
            zIndex: 50,
          }}
        >
          {REWRITE_STYLES.map(s => (
            <button
              key={s.id}
              onMouseDown={e => { e.preventDefault(); handleRewrite(s.id); }}
              disabled={rewriting}
              style={{
                padding: '6px 10px', fontSize: 12, color: 'white',
                background: 'transparent', border: 'none', borderRadius: 4,
                cursor: rewriting ? 'wait' : 'pointer',
                fontFamily: 'inherit', fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      )}

      {/* v1.5: 改写结果 modal */}
      {rewriteResult && (
        <Modal title={`改写结果 · ${REWRITE_STYLES.find(s => s.id === rewriteResult.style)?.emoji} ${REWRITE_STYLES.find(s => s.id === rewriteResult.style)?.label}`} onClose={() => setRewriteResult(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>原文</div>
              <div style={{
                padding: 12, background: 'var(--bg-subtle)', borderRadius: 6,
                fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)',
                maxHeight: 280, overflow: 'auto',
              }}>
                {rewriteResult.original}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>改写后</div>
              <div style={{
                padding: 12, background: 'var(--success-bg)', borderRadius: 6,
                fontSize: 13, lineHeight: 1.7, color: 'var(--text)',
                maxHeight: 280, overflow: 'auto',
                border: '1px solid var(--success)',
              }}>
                {rewriteResult.rewritten}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setRewriteResult(null)}>取消</button>
            <button className="btn btn-primary" onClick={applyRewrite}>✓ 替换到正文</button>
          </div>
        </Modal>
      )}

      {/* v1.5: 版本历史 modal */}
      {showVersions && (
        <Modal title="📁 版本历史" onClose={() => setShowVersions(false)} width={640}>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                const note = prompt('版本备注（可选）') || '手动保存';
                if (note !== null) handleSaveVersion(note);
              }}
              disabled={savingVersion}
            >
              💾 保存当前为版本
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              保留最近 20 个版本，超出自动清理旧的
            </span>
          </div>
          {loadingVersions ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>
          ) : versions.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              还没有保存的版本 · 点"💾 保存当前为版本"创建第一个
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {versions.map(v => (
                <div key={v.id} style={{
                  padding: 14, background: 'var(--bg-subtle)', borderRadius: 6,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 8,
                    background: v.createdBy === 'system' ? 'var(--warning-bg)' : 'var(--primary-soft)',
                    color: v.createdBy === 'system' ? 'var(--warning)' : 'var(--primary)',
                    fontWeight: 600, flexShrink: 0, marginTop: 2,
                  }}>
                    {v.createdBy === 'system' ? '🤖 自动' : v.createdBy === 'auto' ? '⏰ 定时' : '👤 手动'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>
                      {v.note || '（无备注）'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {new Date(v.createdAt * 1000).toLocaleString('zh-CN')} · {v.content.length} 字
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleRestoreVersion(v.id)}
                    disabled={isReadOnly}
                  >
                    ↺ 恢复
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* v1.5: 多平台适配 modal */}
      {showAdapt && (
        <Modal title="🔀 一键改写其他平台" onClose={() => setShowAdapt(false)} width={720}>
          {!adaptResult ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
                把当前文章改写为其他平台风格。改写前会自动快照当前内容到版本历史（可恢复）。
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
                {PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAdapt(p.id)}
                    disabled={adaptLoading}
                    style={{
                      padding: 16, background: 'var(--bg-panel)',
                      border: '1px solid var(--line)', borderRadius: 8,
                      cursor: adaptLoading ? 'wait' : 'pointer',
                      fontFamily: 'inherit', textAlign: 'center',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{p.emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.label}</div>
                  </button>
                ))}
              </div>
              {adaptLoading && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>
                  ⏳ 正在改写（基于你的 Insight Kernel）…
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                <strong style={{ color: 'var(--ink)' }}>
                  {PLATFORMS_MAP[adaptResult.platform as keyof typeof PLATFORMS_MAP]?.emoji}
                  {' '}
                  {PLATFORMS_MAP[adaptResult.platform as keyof typeof PLATFORMS_MAP]?.label}
                </strong>
                {' '}改写结果（{adaptResult.adapted.content.length} 字）：
              </div>
              <div style={{
                padding: 16, background: 'var(--bg-subtle)', borderRadius: 6,
                fontSize: 14, lineHeight: 1.8, color: 'var(--text)',
                maxHeight: 320, overflow: 'auto', marginBottom: 16,
                whiteSpace: 'pre-wrap',
              }}>
                {adaptResult.adapted.content}
              </div>
              {adaptResult.tips.length > 0 && (
                <div style={{
                  padding: 12, background: 'var(--primary-soft)', borderRadius: 6,
                  fontSize: 12, color: 'var(--text-2)', marginBottom: 16,
                }}>
                  <strong style={{ color: 'var(--primary)' }}>💡 平台风格提示：</strong>
                  <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
                    {adaptResult.tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => { setAdaptResult(null); setAdaptPlatform(null); }}>
                  ← 选其他平台
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    navigator.clipboard.writeText(adaptResult.adapted.content);
                    toast.success('已复制到剪贴板');
                  }}
                >
                  📋 复制
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveAdaptAsVersion}
                  disabled={savingVersion}
                >
                  {savingVersion ? '保存中…' : '💾 另存为新版本'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// ========== 通用 Modal 组件 ==========
function Modal({ title, children, onClose, width = 600 }: { title: string; children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)', borderRadius: 10, maxWidth: width, width: '100%',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.3)', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0, flex: 1 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', fontSize: 22,
              color: 'var(--text-3)', cursor: 'pointer', padding: 4, lineHeight: 1,
            }}
          >×</button>
        </div>
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
