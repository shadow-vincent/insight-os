'use client';

/**
 * /settings/data
 *
 * V1.11.7: 数据与迁移 (iCloud 同步 + 资产库路径 + 老版本数据迁移)
 *
 * 数据生命周期 3 个动作：
 * - iCloud 同步：导出/导入 ZIP 搬出搬入
 * - 资产库路径：数据放哪（vault 根路径）
 * - 老版本迁移：V1.10 之前的 SQLite → IndexedDB
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DataPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [vaultPath, setVaultPath] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setConfig(data.config);
          setVaultPath(data.config.paths.vaultPath);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveVault = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paths: { vaultPath } }),
      });
      const data = await res.json();
      if (data.ok || res.status === 404) {
        setMessage({ type: 'success', text: '✓ 资产库路径已保存' });
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

  const handleMigrate = async () => {
    setMigrating(true);
    setMessage(null);
    try {
      const { migrateFromSqlite } = await import('@/lib/idb/migrate');
      const result = await migrateFromSqlite();
      if (result.source === 'empty') {
        setMessage({ type: 'info', text: 'ℹ️ 你的 SQLite 是空的（或没找到数据库），跳过迁移' });
      } else if (result.source === 'skip') {
        setMessage({ type: 'info', text: '⏭️ 已经迁移过，跳过' });
      } else if (result.success) {
        const summary = Object.entries(result.migrated).map(([k, v]) => `${k}: ${v}`).join(' · ');
        setMessage({ type: 'success', text: `✓ 迁移成功 · ${summary}` });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage({ type: 'error', text: `迁移失败: ${result.error}` });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">数据与迁移</h1>
        <p className="page-subtitle">数据放哪 / 搬入 / 搬出</p>
      </div>

      {message && (
        <div className={`callout ${message.type === 'success' ? 'callout-success' : message.type === 'info' ? 'callout-info' : 'callout-error'}`} style={{ marginBottom: 16 }}>
          {message.text}
        </div>
      )}

      {/* iCloud 同步（跳转老 sub-page）*/}
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>☁️ iCloud 同步</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>
          导出 / 导入 ZIP · 拖到 iCloud Drive 即可多端同步
        </p>
        <Link href="/settings/sync" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          打开同步工具 →
        </Link>
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
        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 18, borderTop: '1px solid var(--line-soft)' }}>
          <button className="btn btn-primary" onClick={handleSaveVault} disabled={saving}>
            {saving ? '保存中…' : '💾 保存路径'}
          </button>
        </div>
      </div>

      {/* V1.11: 老版本数据迁移 */}
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>📦 老版本数据迁移</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>
          如果你从 V1.10 之前的版本升级，本地 SQLite 里有数据。点下面的按钮把老数据导入到浏览器 IndexedDB。
          <br />
          <strong>注意</strong>：Vercel 部署版没 SQLite，请用本地 dev 或 Electron 桌面版迁移。
        </p>
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className="btn btn-primary"
          style={{
            opacity: migrating ? 0.5 : 1,
          }}
        >
          {migrating ? '迁移中…' : '📦 开始迁移'}
        </button>
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