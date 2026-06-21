'use client';

/**
 * 从样本反推写作风格 modal
 *
 * 设计：
 *   - 两个 tab：粘贴文本 / 从资产库选
 *   - 粘贴 tab: textarea（支持分段，可选填标题）
 *   - 资产 tab: 列出 article_full / article_outline / writing 类型的 outputs，最多选 5 篇
 *   - 提交 → 后端调 LLM 反推 5 维度
 *   - 反推结果：风格总结 + 5 维度预览 + 命名 + 保存
 *   - 保存后：自动激活 + 跳到主编辑页
 */

import { useEffect, useState } from 'react';

interface InferResult {
  summary: string;
  suggestedName: string;
  confidence: 'low' | 'medium' | 'high';
  config: any;  // WritingConfig
}

interface ArticleItem {
  id: string;
  title: string;
  preview: string;  // 前 200 字
  outputType: string;
  createdAt: number;
}

interface InferStyleModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (newName: string) => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

export default function InferStyleModal({ open, onClose, onSaved, toast }: InferStyleModalProps) {
  const [tab, setTab] = useState<'paste' | 'asset'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [result, setResult] = useState<InferResult | null>(null);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  // 打开 modal 时清空状态 + 拉资产列表
  useEffect(() => {
    if (open) {
      setResult(null);
      setSaveName('');
      setSelectedIds([]);
      if (tab === 'asset' && articles.length === 0) {
        loadArticles();
      }
    }
  }, [open, tab]);

  // 切换到 asset tab 时拉列表
  useEffect(() => {
    if (open && tab === 'asset' && articles.length === 0) {
      loadArticles();
    }
  }, [tab]);

  const loadArticles = async () => {
    setLoadingArticles(true);
    try {
      const res = await fetch('/api/articles?types=article_full,article_outline,writing&limit=30');
      const data = await res.json();
      if (data.ok) {
        setArticles(data.articles);
      } else {
        toast.error(`加载文章列表失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`加载失败: ${e.message}`);
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleInfer = async () => {
    const sources: any[] = [];
    if (tab === 'paste') {
      if (!pasteText.trim()) {
        toast.error('请粘贴文章内容');
        return;
      }
      if (pasteText.trim().length < 100) {
        toast.error('样本太短，至少 100 字');
        return;
      }
      // 长文会智能采样，不需要前端截断
      sources.push({ type: 'paste', text: pasteText, title: pasteTitle || undefined });
    } else {
      if (selectedIds.length === 0) {
        toast.error('至少选 1 篇');
        return;
      }
      if (selectedIds.length > 5) {
        toast.error('最多选 5 篇');
        return;
      }
      for (const id of selectedIds) {
        sources.push({ type: 'asset', id });
      }
    }

    setInferring(true);
    try {
      const res = await fetch('/api/writing-config/infer-style', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sources }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({
          summary: data.summary,
          suggestedName: data.suggestedName,
          confidence: data.confidence,
          config: data.config,
        });
        setSaveName(data.suggestedName);
        toast.success(`反推成功 · 置信度 ${data.confidence === 'high' ? '高' : data.confidence === 'medium' ? '中' : '低'}`);
      } else {
        toast.error(`反推失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`请求失败: ${e.message}`);
    } finally {
      setInferring(false);
    }
  };

  const handleSave = async () => {
    if (!result || !saveName.trim()) {
      toast.error('请填写名字');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(saveName)) {
      toast.error('名字必须是小写字母、数字、横线');
      return;
    }
    setSaving(true);
    try {
      const configToSave = {
        ...result.config,
        name: saveName,
        description: result.summary.slice(0, 80),
        updatedAt: Date.now(),
      };
      const res = await fetch(`/api/writing-config/${encodeURIComponent(saveName)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(configToSave),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`已保存「${saveName}」`);
        if (data.warnings?.length > 0) {
          toast.info(`提示: ${data.warnings[0]}`);
        }
        onSaved(saveName);
        onClose();
      } else {
        toast.error(`保存失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`请求失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRedo = () => {
    setResult(null);
    setSaveName('');
  };

  const toggleAsset = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 5) {
        toast.error('最多选 5 篇');
        return prev;
      }
      return [...prev, id];
    });
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
          maxWidth: 720, width: '100%', maxHeight: '85vh', overflow: 'auto',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
            🪄 从样本提炼风格
          </h3>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        {!result ? (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--line-soft)' }}>
              <button
                onClick={() => setTab('paste')}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  border: 'none',
                  background: 'transparent',
                  borderBottom: tab === 'paste' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: tab === 'paste' ? 'var(--primary)' : 'var(--text-3)',
                  fontWeight: tab === 'paste' ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                粘贴文本
              </button>
              <button
                onClick={() => setTab('asset')}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  border: 'none',
                  background: 'transparent',
                  borderBottom: tab === 'asset' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: tab === 'asset' ? 'var(--primary)' : 'var(--text-3)',
                  fontWeight: tab === 'asset' ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                从资产库选
              </button>
            </div>

            {tab === 'paste' ? (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>
                    标题（可选）
                  </label>
                  <input
                    className="input"
                    placeholder="例如：公众号文章《做正确的事》"
                    value={pasteTitle}
                    onChange={e => setPasteTitle(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>
                    文章正文（至少 100 字；超过 3500 字会自动采样首+中+尾，保留立意/论据/收尾）
                  </label>
                  <textarea
                    className="input"
                    placeholder="粘贴文章正文…"
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    rows={12}
                    style={{ width: '100%', fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    {pasteText.length} 字 ·{' '}
                    {pasteText.length > 3500
                      ? `超 3500 字 · 会自动采样（首+中+尾）`
                      : pasteText.length > 0
                      ? `未超 3500 字 · 全量送入`
                      : '空'}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                  从 outputs 表选 article_full / article_outline / writing（最多 5 篇）
                </div>
                {loadingArticles ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>加载文章列表…</div>
                ) : articles.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
                    暂无文章样本。先用「联合完整文章」生成几篇，或用「粘贴文本」tab
                  </div>
                ) : (
                  <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--line-soft)', borderRadius: 6 }}>
                    {articles.map(a => {
                      const selected = selectedIds.includes(a.id);
                      return (
                        <div
                          key={a.id}
                          onClick={() => toggleAsset(a.id)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--line-soft)',
                            cursor: 'pointer',
                            background: selected ? 'var(--primary-soft)' : 'transparent',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleAsset(a.id)}
                              style={{ cursor: 'pointer' }}
                            />
                            <strong style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>{a.title}</strong>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {a.outputType}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginLeft: 26 }}>
                            {a.preview}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                  已选 {selectedIds.length} / 5
                </div>
              </div>
            )}

            {/* 底部按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={onClose} disabled={inferring}>取消</button>
              <button className="btn btn-primary" onClick={handleInfer} disabled={inferring}>
                {inferring ? '反推中…（约 10-20s）' : '🪄 反推风格'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 反推结果展示 */}
            <div style={{
              padding: 14,
              background: 'var(--primary-soft)',
              borderRadius: 6,
              marginBottom: 16,
              border: '1px solid var(--primary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 13, color: 'var(--ink)' }}>📝 风格总结</strong>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: result.confidence === 'high' ? 'var(--success)' : result.confidence === 'medium' ? 'var(--warning)' : 'var(--danger)',
                  color: '#fff',
                }}>
                  置信度 · {result.confidence === 'high' ? '高' : result.confidence === 'medium' ? '中' : '低'}
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
                {result.summary}
              </div>
            </div>

            {/* 5 维度预览（紧凑） */}
            <div style={{
              padding: 14,
              background: 'var(--bg-subtle)',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 12,
              lineHeight: 1.8,
              color: 'var(--text)',
            }}>
              <strong style={{ display: 'block', marginBottom: 8, color: 'var(--ink)' }}>5 维度预览</strong>
              <div>语气温度 {result.config.dimensions.style.tone}/100 · 立场 {result.config.dimensions.style.stance} · 人设「{result.config.dimensions.style.persona}」</div>
              <div>句式 {result.config.dimensions.sentence.rhythm} · 短句占比 {Math.round(result.config.dimensions.sentence.shortRatio * 100)}% · 段落 {result.config.dimensions.sentence.paragraphLength} 字</div>
              <div>结构 {result.config.dimensions.structure.argumentPattern} · {result.config.dimensions.structure.sectionCount} 章 · {result.config.dimensions.structure.ending}</div>
              <div>字数 {result.config.dimensions.length.targetWords} · 单章 {result.config.dimensions.length.perSectionWords} 字 · 金句 {result.config.dimensions.length.keyQuotes} 个</div>
              <div>引用上限 {result.config.dimensions.quality.citationLimit} · 禁用词 {result.config.dimensions.quality.bannedWords.length} 个 · 数据真实性 {result.config.dimensions.quality.dataFidelity}</div>
              {result.config.dimensions.quality.bannedWords.length > 0 && (
                <div style={{ marginTop: 6, color: 'var(--text-3)' }}>
                  禁用词预览: {result.config.dimensions.quality.bannedWords.slice(0, 8).join('、')}
                  {result.config.dimensions.quality.bannedWords.length > 8 && '…'}
                </div>
              )}
            </div>

            {/* 命名 + 保存 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>
                保存为新 preset 名（小写字母 + 数字 + 横线）
              </label>
              <input
                className="input"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder={result.suggestedName}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                建议名: <code>{result.suggestedName}</code>
              </div>
            </div>

            <div style={{
              padding: 10,
              background: 'var(--warning-bg)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--text-3)',
              marginBottom: 16,
            }}>
              💡 反推结果是「草稿」· 保存后可在主编辑页调整所有维度 · 不会自动激活
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button className="btn" onClick={handleRedo} disabled={saving}>← 重新反推</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={onClose} disabled={saving}>取消</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中…' : '保存为新 preset'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}