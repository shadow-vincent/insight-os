'use client';

/**
 * /settings/integrations
 *
 * V1.11.7: 外部服务接入 (LLM + RSSHub)
 * 从原 /settings page.tsx 抽出来
 */

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
  lastUpdated: number;
}

export default function IntegrationsPage() {
  const { theme, setTheme } = useTheme();
  const [config, setConfig] = useState<SanitizedConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingRSSHub, setTestingRSSHub] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyChanged, setApiKeyChanged] = useState(false);
  const [model, setModel] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [temperature, setTemperature] = useState(0.5);
  const [articleLength, setArticleLength] = useState<'short' | 'medium' | 'deep' | 'ultra'>('deep');
  const [rsshubBase, setRSSHubBase] = useState('https://rsshub.app');
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    // V1.10: 优先 IDB 读 LLM config
    (async () => {
      try {
        const DexieModule = await import('dexie');

        const db = await getSharedDexie();
const idbCfg = await db.preferences.get('llm-config');
        if (idbCfg?.value?.baseUrl) setBaseUrl(idbCfg.value.baseUrl);
        if (idbCfg?.value?.model) setModel(idbCfg.value.model);
      } catch { /* IDB 不可用时回退 */ }
    })();

    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setConfig(data.config);
          setBaseUrl((prev) => prev || data.config.llm.baseUrl);
          setModel((prev) => prev || data.config.llm.model);
          setEnabled(data.config.llm.enabled);
          if (data.config.preferences) {
            setTemperature(data.config.preferences.llmTemperature ?? 0.5);
            setArticleLength(data.config.preferences.articleLength ?? 'deep');
            setRSSHubBase(data.config.preferences.rsshubBase ?? 'https://rsshub.app');
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // V1.10 Phase 2.12: 同步写 IDB
      if (apiKeyChanged && apiKey) {
        try {
          const DexieModule = await import('dexie');

          const db = await getSharedDexie();
await db.preferences.put({ key: 'llm-config', value: { baseUrl, apiKey, model }, updatedAt: Date.now() });
        } catch (idbErr: any) {
          console.warn('[integrations] IDB save failed:', idbErr);
        }
      }

      const body: any = {
        llm: { baseUrl, model, enabled },
        preferences: { llmTemperature: temperature, articleLength, rsshubBase },
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
      if (data.ok || res.status === 404) {
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

  const handleTestRSSHub = async () => {
    setTestingRSSHub(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/config/test-rsshub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsshubBase }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, text: `✓ RSSHub 可用 · 抓取 ${data.itemCount} 条样例` });
      } else {
        setTestResult({ ok: false, text: `✗ 失败: ${data.error}` });
      }
    } catch (e: any) {
      setTestResult({ ok: false, text: e.message });
    } finally {
      setTestingRSSHub(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">外部服务接入</h1>
        <p className="page-subtitle">LLM 校准 / 输出生成 · RSSHub 信息源抓取</p>
      </div>

      {message && (
        <div className={`callout ${message.type === 'success' ? 'callout-success' : message.type === 'info' ? 'callout-info' : 'callout-error'}`} style={{ marginBottom: 16 }}>
          {message.text}
        </div>
      )}

      {/* LLM 接入 */}
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>🤖 LLM 接入</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>
          支持任意 OpenAI 兼容接口：OpenAI / DeepSeek / 本地 LLM / Anthropic 代理
        </p>

        <Field label="Base URL" hint="API 根地址（OpenAI 兼容）">
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" className="form-input" />
        </Field>

        <Field label="API Key" hint={config?.llm.apiKeyConfigured ? `当前: ${config.llm.apiKeyMasked}（留空表示不修改）` : '尚未配置'}>
          <input
            type="password"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setApiKeyChanged(true); }}
            placeholder={config?.llm.apiKeyConfigured ? '•••••••（留空不修改）' : 'sk-...'}
            className="form-input"
          />
        </Field>

        <Field label="Model" hint="模型名（取决于你的服务支持什么）">
          <input value={model} onChange={e => setModel(e.target.value)} placeholder="deepseek-chat" className="form-input" />
        </Field>

        <Field label="启用">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            启用 LLM（启用后才能跑校准 / 升级 / 输出生成）
          </label>
        </Field>

        <Field label="LLM 温度" hint="低 = 稳定可预测，高 = 随机有惊喜。推荐 0.5（写作场景平衡点）">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="range" min={0} max={1.2} step={0.05} value={temperature} onChange={e => setTemperature(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 40, textAlign: 'right' }}>{temperature.toFixed(2)}</span>
          </div>
        </Field>

        <Field label="写作默认篇幅" hint="所有「主题文章 / 系列生成」都用这个篇幅（单篇任务可临时改）">
          <select value={articleLength} onChange={e => setArticleLength(e.target.value as any)} className="form-input" style={{ maxWidth: 320 }}>
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
          <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? '测试中…' : '🔍 测试 LLM 连接'}
          </button>
        </div>
      </div>

      {/* RSSHub 接入 */}
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>📡 RSSHub 接入</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>
          Twitter / 公众号等封闭生态走 RSSHub。默认用公共实例（限流严），可自部署后填自己的 URL。
        </p>

        <Field label="RSSHub Base URL" hint="默认 https://rsshub.app。自部署：https://rsshub.yourdomain.com（末尾不要 /）">
          <input value={rsshubBase} onChange={e => setRSSHubBase(e.target.value)} placeholder="https://rsshub.app" className="form-input" />
        </Field>

        <Field label="测试连接" hint="点击后访问 /twitter/user/elonmusk 验证 RSSHub 可用">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={handleTestRSSHub} disabled={testingRSSHub} type="button">
              {testingRSSHub ? '测试中…' : '🔍 测试连接'}
            </button>
            {testResult && (
              <span style={{ fontSize: 12, color: testResult.ok ? '#16a34a' : '#dc2626' }}>{testResult.text}</span>
            )}
          </div>
        </Field>
      </div>
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