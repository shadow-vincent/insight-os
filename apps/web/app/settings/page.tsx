'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/useTheme';

interface SanitizedConfig {
  llm: {
    baseUrl: string;
    apiKeyMasked: string;
    apiKeyConfigured: boolean;
    model: string;
    enabled: boolean;
  };
  paths: {
    vaultPath: string;
  };
  writing?: {
    activePreset: string;
  };
  lastUpdated: number;
}

const PRESETS = [
  { name: 'DeepSeek Flash', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'DeepSeek Pro', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-reasoner' },
  { name: 'OpenAI 4o-mini', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: '本地 LLM', baseUrl: 'http://localhost:11434/v1', model: 'llama3' },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [config, setConfig] = useState<SanitizedConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyChanged, setApiKeyChanged] = useState(false);
  const [model, setModel] = useState('');
  const [vaultPath, setVaultPath] = useState('');
  const [enabled, setEnabled] = useState(false);
  // v1.7: 全局偏好
  const [temperature, setTemperature] = useState(0.5);
  const [articleLength, setArticleLength] = useState<'short' | 'medium' | 'deep' | 'ultra'>('deep');

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setConfig(data.config);
          setBaseUrl(data.config.llm.baseUrl);
          setModel(data.config.llm.model);
          setVaultPath(data.config.paths.vaultPath);
          setEnabled(data.config.llm.enabled);
          if (data.config.preferences) {
            setTemperature(data.config.preferences.llmTemperature ?? 0.5);
            setArticleLength(data.config.preferences.articleLength ?? 'deep');
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: any = {
        llm: { baseUrl, model, enabled },
        paths: { vaultPath },
        preferences: { llmTemperature: temperature, articleLength },
      };
      if (apiKeyChanged && apiKey) {
        body.llm.apiKey = apiKey;
      }
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setConfig(data.config);
        setApiKey('');
        setApiKeyChanged(false);
        setMessage({ type: 'success', text: '配置已保存，立即生效' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || '保存失败' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/config/test', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: 'success', text: `✓ LLM 连接成功 · ${data.model}` });
      } else {
        setMessage({ type: 'error', text: `✗ 连接失败: ${data.error}` });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  const lastUpdated = config?.lastUpdated
    ? new Date(config.lastUpdated).toLocaleString('zh-CN')
    : '从未';

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">设置</h1>
        <p className="page-subtitle">主题外观 · LLM 接入 · 资产库路径 · 写作风格</p>
      </div>

      {/* 写作风格配置入口 */}
      <Link href="/settings/writing" className="card card-hover" style={{ display: 'block', marginBottom: 16, padding: 18, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>✎</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>写作风格配置</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              当前激活: <strong style={{ color: 'var(--primary)' }}>{config?.writing?.activePreset ?? 'vincent-standard'}</strong>
              {' · '}3 套 ship-ready 预设 · 自定义 5 维度
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>
        </div>
      </Link>

      {/* 判断协议入口（v1.4 Insight Kernel） */}
      <Link href="/settings/kernel" className="card card-hover" style={{ display: 'block', marginBottom: 16, padding: 18, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🧠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>判断协议 · Insight Kernel</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              你的"判断宪法" · 4 类 × 4 字段 · 每次 LLM 调用自动注入
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>
        </div>
      </Link>

      {/* iCloud 同步入口（v1.5） */}
      <Link href="/settings/sync" className="card card-hover" style={{ display: 'block', marginBottom: 16, padding: 18, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>☁️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>数据同步 · iCloud</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              导出 / 导入 ZIP · 拖到 iCloud Drive 即可多端同步
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>
        </div>
      </Link>

      {/* 嵌入图谱入口（v1.5） */}
      <Link href="/settings/embed" className="card card-hover" style={{ display: 'block', marginBottom: 16, padding: 18, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>📤</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>导出图谱 PNG / PDF</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              本地导出 · 不需要域名 · 贴公众号/朋友圈/发客户
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>
        </div>
      </Link>

      {/* 博客文章图导出（V1.5 真实使用场景） */}
      <Link href="/settings/blog-poster" className="card card-hover" style={{ display: 'block', marginBottom: 16, padding: 18, textDecoration: 'none', color: 'inherit', background: 'var(--primary-soft)', border: '1px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>📰</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)' }}>博客文章图导出（推荐）</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
              整篇博客 → 1080 宽长图 · 标题+正文+引用+嵌入 widget+CTA · 公众号/朋友圈专用
            </div>
          </div>
          <span style={{ color: 'var(--primary)', fontSize: 16 }}>→</span>
        </div>
      </Link>

      {/* 主题切换 */}
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>🎨 主题外观</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>两套主题任选 · 切换立即生效</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ThemeCard
            id="blue"
            label="深蓝冷白"
            desc="工具感 / 现代 SaaS"
            swatch="#1a365d"
            bg="#f7f9fc"
            active={theme === 'blue'}
            onSelect={setTheme}
          />
          <ThemeCard
            id="green"
            label="深墨绿米白"
            desc="咨询专业感 / 麦肯锡调"
            swatch="#1f5d4c"
            bg="#faf8f3"
            active={theme === 'green'}
            onSelect={setTheme}
          />
        </div>
      </div>

      {/* 状态条 */}
      <div className="card" style={{ padding: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: 4,
            background: config?.llm.enabled ? 'var(--success)' : 'var(--text-3)',
            boxShadow: config?.llm.enabled ? '0 0 0 4px var(--success-soft, rgba(46, 125, 50, 0.15))' : 'none',
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            {config?.llm.enabled ? 'LLM 已启用' : 'LLM 未启用'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {config?.llm.apiKeyConfigured
              ? `Key: ${config.llm.apiKeyMasked} · 上次更新 ${lastUpdated}`
              : '尚未配置 API Key'}
          </div>
        </div>
        <button
          className="btn"
          onClick={handleTest}
          disabled={testing || !config?.llm.enabled}
          style={{ fontSize: 13 }}
        >
          {testing ? '测试中…' : '🔌 测试连接'}
        </button>
      </div>

      {/* 快速预设 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>⚡ 快速预设</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              点击预设自动填入 Base URL 和 Model，再填 API Key 即可
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map(p => {
            const active = baseUrl === p.baseUrl && model === p.model;
            return (
              <button
                key={p.name}
                className={active ? 'btn btn-primary' : 'btn'}
                onClick={() => {
                  setBaseUrl(p.baseUrl);
                  setModel(p.model);
                }}
                style={{ fontSize: 13 }}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* LLM 配置 */}
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>🤖 LLM 接入</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>
          支持任意 OpenAI 兼容接口：OpenAI / DeepSeek / 本地 LLM / Anthropic 代理
        </p>

        <Field label="Base URL" hint="API 根地址（OpenAI 兼容）">
          <input
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
            className="form-input"
          />
        </Field>

        <Field
          label="API Key"
          hint={config?.llm.apiKeyConfigured
            ? `当前: ${config.llm.apiKeyMasked}（留空表示不修改）`
            : '尚未配置'}
        >
          <input
            type="password"
            value={apiKey}
            onChange={e => {
              setApiKey(e.target.value);
              setApiKeyChanged(true);
            }}
            placeholder={config?.llm.apiKeyConfigured ? '•••••••（留空不修改）' : 'sk-...'}
            className="form-input"
          />
        </Field>

        <Field label="Model" hint="模型名（取决于你的服务支持什么）">
          <input
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="deepseek-chat"
            className="form-input"
          />
        </Field>

        <Field label="启用">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
            启用 LLM（启用后才能跑校准 / 升级 / 输出生成）
          </label>
        </Field>

        <Field
          label="LLM 温度"
          hint="低 = 稳定可预测，高 = 随机有惊喜。推荐 0.5（写作场景平衡点）"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.05}
              value={temperature}
              onChange={e => setTemperature(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 40, textAlign: 'right' }}>
              {temperature.toFixed(2)}
            </span>
          </div>
        </Field>

        <Field
          label="写作默认篇幅"
          hint="所有「主题文章 / 系列生成」都用这个篇幅（单篇任务可临时改）"
        >
          <select
            value={articleLength}
            onChange={e => setArticleLength(e.target.value as any)}
            className="form-input"
            style={{ maxWidth: 320 }}
          >
            <option value="short">短文（约 800-1200 字）</option>
            <option value="medium">中等（约 1500-2000 字）</option>
            <option value="deep">深度长文（约 2500-3500 字）</option>
            <option value="ultra">超深度（约 4000+ 字）</option>
          </select>
        </Field>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--line-soft)' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '💾 保存'}
          </button>
        </div>
      </div>

      {/* 资产库路径 */}
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>📁 资产库路径</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>
          指向你的 knowledge_base 根目录，应用会扫描 04_管理洞察/ 下的所有资产卡
        </p>

        <Field label="Vault 根路径" hint="指向你的知识库根目录，应用会扫描 04_管理洞察/ 下的所有资产卡">
          <input
            value={vaultPath}
            onChange={e => setVaultPath(e.target.value)}
            placeholder="~/Documents/knowledge_base"
            className="form-input"
          />
        </Field>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--line-soft)' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '💾 保存'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`callout ${message.type === 'success' ? 'callout-success' : 'callout-error'}`}>
          {message.text}
        </div>
      )}

      <style jsx>{`
        .form-input {
          width: 100%;
          padding: 11px 14px;
          background: var(--bg-subtle);
          border: 1px solid var(--line);
          border-radius: 6px;
          font-size: 14px;
          color: var(--ink);
          font-family: 'JetBrains Mono', monospace;
          transition: all 120ms;
        }
        .form-input:focus {
          outline: none;
          background: white;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-soft);
        }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-3)',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </label>
      {hint && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{hint}</div>}
      {children}
    </div>
  );
}

function ThemeCard({
  id, label, desc, swatch, bg, active, onSelect,
}: {
  id: 'blue' | 'green';
  label: string;
  desc: string;
  swatch: string;
  bg: string;
  active: boolean;
  onSelect: (t: 'blue' | 'green') => void;
}) {
  return (
    <div
      onClick={() => onSelect(id)}
      style={{
        cursor: 'pointer',
        border: active ? '2px solid var(--primary)' : '1px solid var(--line)',
        borderRadius: 8,
        padding: 16,
        background: 'var(--bg-panel)',
        boxShadow: active ? '0 0 0 3px var(--primary-soft)' : 'none',
        transition: 'all 120ms',
      }}
    >
      {/* 缩略图：背景 + 主色条 */}
      <div style={{
        height: 60,
        borderRadius: 4,
        background: bg,
        border: '1px solid var(--line-soft)',
        marginBottom: 12,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 8, left: 8, right: 8, height: 8,
          background: swatch, borderRadius: 2, opacity: 0.85,
        }} />
        <div style={{
          position: 'absolute', top: 24, left: 8, width: 40, height: 6,
          background: 'var(--text-3)', borderRadius: 2, opacity: 0.4,
        }} />
        <div style={{
          position: 'absolute', top: 34, left: 8, width: 60, height: 6,
          background: 'var(--text-3)', borderRadius: 2, opacity: 0.3,
        }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: swatch,
          border: '2px solid var(--bg-panel)',
          boxShadow: '0 0 0 1px var(--line)',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{desc}</div>
        </div>
        {active && (
          <span style={{
            fontSize: 11, color: 'var(--primary)', fontWeight: 700,
            padding: '3px 9px', background: 'var(--primary-soft)', borderRadius: 10,
          }}>当前</span>
        )}
      </div>
    </div>
  );
}
