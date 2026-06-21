'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';
import InferStyleModal from '@/components/InferStyleModal';
import TryWriteModal from '@/components/TryWriteModal';
import MigrateModal from '@/components/MigrateModal';
import HistoryModal from '@/components/HistoryModal';

interface PresetMeta {
  name: string;
  outputType: string;
  description?: string;
  updatedAt: number;
  isSystem: boolean;
  active: boolean;
}

interface WritingConfig {
  name: string;
  outputType: string;
  description?: string;
  forkedFrom: string | null;
  updatedAt: number;
  dimensions: {
    style: { tone: number; stance: string; persona: string; viewpoint: string; termDensity: string; temperature: number };
    sentence: { rhythm: string; shortRatio: number; paragraphLength: number; rhetoric: string[] };
    structure: { headingStyle: string; corePosition: string; argumentPattern: string; sectionCount: number; ending: string };
    length: { targetWords: number; sectionCount: number; perSectionWords: number; variants: number; keyQuotes: number };
    quality: { citationLimit: number; bannedWords: string[]; dataFidelity: string; aiTasteCheck: boolean; fewShotRefs: string[] };
  };
  llmParams: { model: string; temperature: number; topP: number };
}

const STANCE_OPTS = ['neutral', 'advisory', 'critical', 'coach'];
const VIEWPOINT_OPTS = ['first', 'second', 'third', 'mixed'];
const DENSITY_OPTS = ['low', 'medium', 'high'];
const RHYTHM_OPTS = ['short', 'mixed', 'long'];
const HEADING_OPTS = ['numbered-question', 'question', 'statement', 'parallel'];
const POSITION_OPTS = ['title', 'opening', 'middle', 'ending'];
const ARG_OPTS = ['total-detail-total', 'progressive', 'parallel', 'contrast'];
const ENDING_OPTS = ['call-to-action', 'quote', 'open', 'summary'];
const FIDELITY_OPTS = ['strict', 'loose', 'none'];

const STANCE_LABELS: Record<string, string> = {
  neutral: '中立', advisory: '顾问建议', critical: '批判', coach: '教练',
};
const POSITION_LABELS: Record<string, string> = {
  title: '标题', opening: '首段', middle: '中段', ending: '结尾',
};
const ENDING_LABELS: Record<string, string> = {
  'call-to-action': '行动呼吁', quote: '金句', open: '留白', summary: '总结',
};
const HEADING_LABELS: Record<string, string> = {
  'numbered-question': '数字+提问', question: '纯提问', statement: '陈述', parallel: '对仗',
};
const ARG_LABELS: Record<string, string> = {
  'total-detail-total': '总分总', progressive: '递进', parallel: '并列', contrast: '对照',
};

export default function WritingSettingsPage() {
  const toast = useToast();
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [activeName, setActiveName] = useState<string>('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [config, setConfig] = useState<WritingConfig | null>(null);
  const [yamlPreview, setYamlPreview] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [importYaml, setImportYaml] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showInfer, setShowInfer] = useState(false);
  const [showTryWrite, setShowTryWrite] = useState(false);
  const [showMigrate, setShowMigrate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Array<{ version: number; timestamp: number; size: number }>>([]);
  const [showStylePreview, setShowStylePreview] = useState(true);

  const loadList = useCallback(async () => {
    const res = await fetch('/api/writing-config');
    const data = await res.json();
    if (data.ok) {
      setPresets(data.presets);
      setActiveName(data.activeName);
    }
  }, []);

  const loadConfig = useCallback(async (name: string) => {
    setLoading(true);
    const res = await fetch(`/api/writing-config/${encodeURIComponent(name)}`);
    const data = await res.json();
    if (data.ok) {
      setConfig(data);
      setEditingName(name);
      setDirty(false);
    } else {
      toast.error(`读取失败: ${data.error}`);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    // 首次访问时确保 ship-ready 预设存在
    fetch('/api/writing-config/vincent-standard')
      .catch(() => {/* ignore */})
      .finally(() => {
        loadList().finally(() => setLoading(false));
      });
  }, [loadList]);

  const handleActivate = async (name: string) => {
    const res = await fetch('/api/writing-config/active', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.ok) {
      setActiveName(name);
      toast.success(`已激活「${name}」`);
      loadList();
    } else {
      toast.error(`激活失败: ${data.error}`);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确认删除 preset「${name}」？`)) return;
    const res = await fetch(`/api/writing-config/${encodeURIComponent(name)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      toast.success(`已删除「${name}」`);
      if (editingName === name) {
        setEditingName(null);
        setConfig(null);
      }
      loadList();
    } else {
      toast.error(`删除失败: ${data.error}`);
    }
  };

  const handleDuplicate = async (src: string) => {
    const newName = prompt(`复制为新 preset 名（小写字母 + 数字 + 横线）:`, `${src}-copy`);
    if (!newName) return;
    if (!/^[a-z0-9-]+$/.test(newName)) {
      toast.error('名字必须是小写字母、数字、横线');
      return;
    }
    const res = await fetch(`/api/writing-config/${encodeURIComponent(src)}/duplicate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ newName }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(`已复制为「${newName}」`);
      loadList();
    } else {
      toast.error(`复制失败: ${data.error}`);
    }
  };

  const handleSave = async () => {
    if (!config || !editingName) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/writing-config/${encodeURIComponent(editingName)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`已保存「${editingName}」`);
        setDirty(false);
        if (data.warnings?.length > 0) {
          toast.info(`提示: ${data.warnings[0]}`);
        }
        loadList();
      } else {
        toast.error(`保存失败: ${data.error}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (path: string, value: any) => {
    if (!config) return;
    const keys = path.split('.');
    const newConfig = JSON.parse(JSON.stringify(config));
    let cursor: any = newConfig;
    for (let i = 0; i < keys.length - 1; i++) {
      cursor = cursor[keys[i]];
    }
    cursor[keys[keys.length - 1]] = value;
    setConfig(newConfig);
    setDirty(true);
  };

  const handleBannedWordsChange = (text: string) => {
    const words = text.split(/[\n,，]/).map(s => s.trim()).filter(Boolean);
    handleFieldChange('dimensions.quality.bannedWords', words);
  };

  const handleLoadYaml = async () => {
    if (!editingName) return;
    // 先清空避免显示旧的 yaml
    setYamlPreview('');
    const res = await fetch('/api/writing-config/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: editingName, includeLLMParams: true, includeFewShot: true }),
    });
    const data = await res.json();
    if (data.ok) {
      setYamlPreview(data.yaml);
    } else {
      toast.error(`导出失败: ${data.error}`);
    }
  };

  const handleImport = async () => {
    if (!importYaml.trim()) {
      toast.error('请粘贴 YAML');
      return;
    }
    const res = await fetch('/api/writing-config/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ yaml: importYaml }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(`已导入「${data.name}」`);
      setShowImport(false);
      setImportYaml('');
      loadList();
    } else {
      toast.error(`导入失败: ${data.error}`);
    }
  };

  const handleExportYaml = async () => {
    if (!editingName) return;
    const res = await fetch('/api/writing-config/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: editingName, includeLLMParams: false, includeFewShot: true }),
    });
    const data = await res.json();
    if (data.ok) {
      navigator.clipboard.writeText(data.yaml);
      toast.success(`已复制 YAML 到剪贴板（${data.yaml.length} 字符）`);
    } else {
      toast.error(`导出失败: ${data.error}`);
    }
  };

  const loadHistory = async (name: string) => {
    const res = await fetch(`/api/writing-config/history?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (data.ok) {
      setHistory(data.history);
      setShowHistory(true);
    } else {
      toast.error(`加载历史失败: ${data.error}`);
    }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">写作风格配置</h1>
        <p className="page-subtitle">5 维度配置（风格 / 句式 / 结构 / 长度 / 质检） · YAML 存储 · 切换预设让 LLM 写出不同味道</p>
      </div>

      {/* 顶部工具栏 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setShowInfer(true)}>🪄 从样本提炼风格</button>
        <button className="btn" onClick={() => setShowTryWrite(true)} disabled={!editingName} title={!editingName ? '请先选一个 preset' : ''}>📝 试写一篇</button>
        <button className="btn" onClick={() => setShowMigrate(true)}>🔀 风格迁移</button>
        <button className="btn" onClick={() => editingName && loadHistory(editingName)} disabled={!editingName} title={!editingName ? '请先选一个 preset' : ''}>📜 历史</button>
        <button className="btn" onClick={() => setShowImport(true)}>↥ 导入 YAML</button>
        <button className="btn" onClick={() => { handleLoadYaml(); setShowExport(true); }}>↧ 导出当前</button>
        <Link href="/writing-config-market" className="btn">🏪 浏览市场</Link>
        <Link href="/writing" className="btn">📚 我的写作</Link>
        <span style={{ flex: 1 }} />
      </div>

      {/* preset 列表 */}
      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-soft)', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>所有预设 · {presets.length} 套</h2>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            当前激活 · <strong style={{ color: 'var(--primary)' }}>{activeName}</strong>
          </span>
        </div>
        <div>
          {presets.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>暂无 preset</div>
          ) : (
            presets.map(p => (
              <div
                key={p.name}
                onClick={() => loadConfig(p.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--line-soft)',
                  cursor: 'pointer',
                  background: editingName === p.name ? 'var(--primary-soft)' : 'transparent',
                }}
              >
                <div style={{ fontSize: 18, width: 28, textAlign: 'center' }}>
                  {p.active ? '★' : p.isSystem ? '◆' : '○'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                    {p.name}
                    {p.active && <span className="pill pill-soft" style={{ marginLeft: 8 }}>激活</span>}
                    {p.isSystem && <span className="pill" style={{ marginLeft: 8 }}>系统预设</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {p.description ?? `${p.outputType} · 更新于 ${new Date(p.updatedAt).toLocaleString('zh-CN')}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  {!p.active && (
                    <button className="btn btn-sm btn-primary" onClick={() => handleActivate(p.name)}>激活</button>
                  )}
                  <button className="btn btn-sm" onClick={() => handleDuplicate(p.name)} title="复制">⎘</button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(p.name)}
                    disabled={p.active}
                    title={p.active ? '不能删除激活的 preset' : '删除'}
                  >✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5 维度编辑器 */}
      {config && editingName && (
        <div className="card" style={{ padding: 28 }}>
          {/* 实时风格预览（折叠区） */}
          <div style={{ marginBottom: 18, padding: 14, background: 'var(--bg-subtle)', borderRadius: 6, border: '1px solid var(--line-soft)' }}>
            <div
              onClick={() => setShowStylePreview(!showStylePreview)}
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            >
              <strong style={{ fontSize: 13, color: 'var(--ink)' }}>📖 当前风格预览（不调 LLM）</strong>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{showStylePreview ? '收起 ▾' : '展开 ▸'}</span>
            </div>
            {showStylePreview && (
              <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace' }}>
                {generateStylePreview(config)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>{editingName}</h2>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--accent)' }}>● 未保存</span>}
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={() => { handleLoadYaml(); setShowExport(true); }} style={{ marginRight: 8 }}>预览 YAML</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>

          {/* A 风格 */}
          <h3 style={sectionTitleStyle}>A · 风格</h3>
          <div style={gridStyle}>
            <Field label={`语气温度: ${config.dimensions.style.tone}/100`}>
              <input type="range" min={0} max={100} value={config.dimensions.style.tone}
                onChange={e => handleFieldChange('dimensions.style.tone', parseInt(e.target.value))} style={{ width: '100%' }} />
            </Field>
            <Field label="立场">
              <select value={config.dimensions.style.stance} onChange={e => handleFieldChange('dimensions.style.stance', e.target.value)} style={inputStyle}>
                {STANCE_OPTS.map(o => <option key={o} value={o}>{STANCE_LABELS[o] ?? o}</option>)}
              </select>
            </Field>
            <Field label="人设">
              <input value={config.dimensions.style.persona} onChange={e => handleFieldChange('dimensions.style.persona', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="视角">
              <select value={config.dimensions.style.viewpoint} onChange={e => handleFieldChange('dimensions.style.viewpoint', e.target.value)} style={inputStyle}>
                {VIEWPOINT_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="术语密度">
              <select value={config.dimensions.style.termDensity} onChange={e => handleFieldChange('dimensions.style.termDensity', e.target.value)} style={inputStyle}>
                {DENSITY_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label={`LLM 创造性: ${config.dimensions.style.temperature.toFixed(2)}`}>
              <input type="range" min={0} max={10} value={Math.round(config.dimensions.style.temperature * 10)}
                onChange={e => handleFieldChange('dimensions.style.temperature', parseInt(e.target.value) / 10)} style={{ width: '100%' }} />
            </Field>
          </div>

          {/* B 句式 */}
          <h3 style={sectionTitleStyle}>B · 句式</h3>
          <div style={gridStyle}>
            <Field label="节奏">
              <select value={config.dimensions.sentence.rhythm} onChange={e => handleFieldChange('dimensions.sentence.rhythm', e.target.value)} style={inputStyle}>
                {RHYTHM_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label={`短句占比: ${Math.round(config.dimensions.sentence.shortRatio * 100)}%`}>
              <input type="range" min={0} max={10} value={Math.round(config.dimensions.sentence.shortRatio * 10)}
                onChange={e => handleFieldChange('dimensions.sentence.shortRatio', parseInt(e.target.value) / 10)} style={{ width: '100%' }} />
            </Field>
            <Field label="段落字数">
              <input type="number" min={40} max={400} value={config.dimensions.sentence.paragraphLength}
                onChange={e => handleFieldChange('dimensions.sentence.paragraphLength', parseInt(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="修辞偏好（逗号分隔）">
              <input value={config.dimensions.sentence.rhetoric.join(', ')}
                onChange={e => handleFieldChange('dimensions.sentence.rhetoric', e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean))} style={inputStyle} />
            </Field>
          </div>

          {/* C 结构 */}
          <h3 style={sectionTitleStyle}>C · 结构</h3>
          <div style={gridStyle}>
            <Field label="标题风格">
              <select value={config.dimensions.structure.headingStyle} onChange={e => handleFieldChange('dimensions.structure.headingStyle', e.target.value)} style={inputStyle}>
                {HEADING_OPTS.map(o => <option key={o} value={o}>{HEADING_LABELS[o] ?? o}</option>)}
              </select>
            </Field>
            <Field label="核心位置">
              <select value={config.dimensions.structure.corePosition} onChange={e => handleFieldChange('dimensions.structure.corePosition', e.target.value)} style={inputStyle}>
                {POSITION_OPTS.map(o => <option key={o} value={o}>{POSITION_LABELS[o] ?? o}</option>)}
              </select>
            </Field>
            <Field label="论证模式">
              <select value={config.dimensions.structure.argumentPattern} onChange={e => handleFieldChange('dimensions.structure.argumentPattern', e.target.value)} style={inputStyle}>
                {ARG_OPTS.map(o => <option key={o} value={o}>{ARG_LABELS[o] ?? o}</option>)}
              </select>
            </Field>
            <Field label="章节数">
              <input type="number" min={2} max={8} value={config.dimensions.structure.sectionCount}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  handleFieldChange('dimensions.structure.sectionCount', v);
                  handleFieldChange('dimensions.length.sectionCount', v);
                }} style={inputStyle} />
            </Field>
            <Field label="收尾">
              <select value={config.dimensions.structure.ending} onChange={e => handleFieldChange('dimensions.structure.ending', e.target.value)} style={inputStyle}>
                {ENDING_OPTS.map(o => <option key={o} value={o}>{ENDING_LABELS[o] ?? o}</option>)}
              </select>
            </Field>
          </div>

          {/* D 长度 */}
          <h3 style={sectionTitleStyle}>D · 长度</h3>
          <div style={gridStyle}>
            <Field label="目标字数">
              <input type="number" min={300} max={10000} value={config.dimensions.length.targetWords}
                onChange={e => handleFieldChange('dimensions.length.targetWords', parseInt(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="单章字数">
              <input type="number" min={100} max={1500} value={config.dimensions.length.perSectionWords}
                onChange={e => handleFieldChange('dimensions.length.perSectionWords', parseInt(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="变体数">
              <input type="number" min={1} max={5} value={config.dimensions.length.variants}
                onChange={e => handleFieldChange('dimensions.length.variants', parseInt(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="关键金句">
              <input type="number" min={0} max={10} value={config.dimensions.length.keyQuotes}
                onChange={e => handleFieldChange('dimensions.length.keyQuotes', parseInt(e.target.value))} style={inputStyle} />
            </Field>
          </div>

          {/* E 质检 */}
          <h3 style={sectionTitleStyle}>E · 质检</h3>
          <div style={gridStyle}>
            <Field label="引用上限">
              <input type="number" min={0} max={20} value={config.dimensions.quality.citationLimit}
                onChange={e => handleFieldChange('dimensions.quality.citationLimit', parseInt(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="数据真实性">
              <select value={config.dimensions.quality.dataFidelity} onChange={e => handleFieldChange('dimensions.quality.dataFidelity', e.target.value)} style={inputStyle}>
                {FIDELITY_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="AI 味自检">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)' }}>
                <input type="checkbox" checked={config.dimensions.quality.aiTasteCheck}
                  onChange={e => handleFieldChange('dimensions.quality.aiTasteCheck', e.target.checked)} />
                开启（生成后独立 prompt 评估）
              </label>
            </Field>
          </div>
          <Field label="禁用词（一行一词 / 逗号分隔）">
            <textarea
              rows={3}
              value={config.dimensions.quality.bannedWords.join('\n')}
              onChange={e => handleBannedWordsChange(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            />
          </Field>

          {/* LLM 参数 */}
          <h3 style={sectionTitleStyle}>LLM 参数</h3>
          <div style={gridStyle}>
            <Field label="model">
              <input value={config.llmParams.model} onChange={e => handleFieldChange('llmParams.model', e.target.value)} style={inputStyle} />
            </Field>
            <Field label={`temperature: ${config.llmParams.temperature.toFixed(2)}`}>
              <input type="range" min={0} max={10} value={Math.round(config.llmParams.temperature * 10)}
                onChange={e => handleFieldChange('llmParams.temperature', parseInt(e.target.value) / 10)} style={{ width: '100%' }} />
            </Field>
            <Field label={`topP: ${config.llmParams.topP.toFixed(2)}`}>
              <input type="range" min={0} max={10} value={Math.round(config.llmParams.topP * 10)}
                onChange={e => handleFieldChange('llmParams.topP', parseInt(e.target.value) / 10)} style={{ width: '100%' }} />
            </Field>
          </div>
        </div>
      )}

      {/* 导入 YAML 模态 */}
      {showImport && (
        <div onClick={() => setShowImport(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: 640, width: '100%', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--ink)' }}>导入 YAML</h3>
            <textarea
              value={importYaml}
              onChange={e => setImportYaml(e.target.value)}
              placeholder="粘贴 YAML 内容..."
              rows={12}
              style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => setShowImport(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleImport}>导入</button>
            </div>
          </div>
        </div>
      )}

      {/* 导出 YAML 模态 */}
      {showExport && (
        <div onClick={() => setShowExport(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: 800, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>YAML 预览</h3>
              <span style={{ flex: 1 }} />
              <button className="btn btn-sm" onClick={handleExportYaml} disabled={!yamlPreview}>📋 复制到剪贴板</button>
            </div>
            {yamlPreview ? (
              <pre style={{
                background: 'var(--bg-subtle)', padding: 16, borderRadius: 6,
                fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.7,
                color: 'var(--text)', overflow: 'auto', maxHeight: '60vh',
              }}>
                {yamlPreview}
              </pre>
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                加载中…
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => setShowExport(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {!editingName && (
        <div className="callout" style={{ marginTop: 16 }}>
          💡 从上方选一个 preset 开始编辑 · 修改不会自动保存（按「保存」提交）· 或点「🪄 从样本提炼风格」让 AI 反推
        </div>
      )}

      {/* 从样本提炼风格 modal */}
      <InferStyleModal
        open={showInfer}
        onClose={() => setShowInfer(false)}
        onSaved={(newName) => {
          loadList();
          loadConfig(newName);
        }}
        toast={toast}
      />

      {/* 试写屏 modal */}
      <TryWriteModal
        open={showTryWrite}
        presetName={editingName ?? activeName}
        onClose={() => setShowTryWrite(false)}
        toast={toast}
      />

      {/* 风格迁移 modal */}
      <MigrateModal
        open={showMigrate}
        presets={presets.map(p => ({ name: p.name, description: p.description }))}
        onClose={() => setShowMigrate(false)}
        onSaved={(newName) => {
          loadList();
          loadConfig(newName);
        }}
        toast={toast}
      />

      {/* 历史版本 modal */}
      <HistoryModal
        open={showHistory}
        presetName={editingName ?? ''}
        history={history}
        onClose={() => setShowHistory(false)}
        onRollback={(name) => {
          loadList();
          loadConfig(name);
        }}
        toast={toast}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'var(--bg-subtle)', border: '1px solid var(--line)',
  borderRadius: 5, fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--primary)',
  margin: '20px 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderTop: '1px solid var(--line-soft)', paddingTop: 16,
};

const gridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
        marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>{label}</div>
      {children}
    </div>
  );
}

// ============================================
// 实时风格预览生成（不调 LLM）
// ============================================
function generateStylePreview(config: WritingConfig): string {
  const s = config.dimensions.style;
  const sn = config.dimensions.sentence;
  const st = config.dimensions.structure;
  const l = config.dimensions.length;
  const q = config.dimensions.quality;

  const tone = s.tone > 60 ? '温暖' : s.tone > 30 ? '中性' : '冷峻';
  const stance = { neutral: '中立陈述', advisory: '顾问式', critical: '批判', coach: '教练' }[s.stance] ?? s.stance;
  const viewpoint = { first: '我', second: '你', third: '他们', mixed: '混合' }[s.viewpoint] ?? s.viewpoint;
  const density = { low: '大白话', medium: '术语+解读', high: '专业' }[s.termDensity] ?? s.termDensity;
  const rhythm = { short: '短句主导', mixed: '长短交替', long: '长句主导' }[sn.rhythm] ?? sn.rhythm;
  const rhetoric = sn.rhetoric.length > 0 ? sn.rhetoric.join('/') : '无';
  const heading = { 'numbered-question': '数字+提问', question: '纯提问', statement: '陈述', parallel: '对仗' }[st.headingStyle] ?? st.headingStyle;
  const pos = { title: '标题', opening: '首段', middle: '中段', ending: '结尾' }[st.corePosition] ?? st.corePosition;
  const arg = { 'total-detail-total': '总分总', progressive: '递进', parallel: '并列', contrast: '对照' }[st.argumentPattern] ?? st.argumentPattern;
  const ending = { 'call-to-action': '行动呼吁', quote: '金句', open: '留白', summary: '总结' }[st.ending] ?? st.ending;

  return `你是一个 ${tone} 的${stance}顾问，人设是「${s.persona}」，主用 ${viewpoint} 视角说话，术语密度 ${density}。

你的句式是 ${rhythm}，短句占比 ${Math.round(sn.shortRatio * 100)}%，段落 ${sn.paragraphLength} 字左右，常用修辞：${rhetoric}。

文章结构走 ${arg}，分 ${st.sectionCount} 个章节，标题用 ${heading} 风格，核心观点在${pos}出现，结尾是 ${ending}。

目标字数 ${l.targetWords} 字（每章约 ${l.perSectionWords} 字），含 ${l.keyQuotes} 个金句。

引用上限 ${q.citationLimit} 处，禁用词 ${q.bannedWords.length > 0 ? `「${q.bannedWords.join('、')}」` : '无'}，数据真实性 ${q.dataFidelity}。`;
}
