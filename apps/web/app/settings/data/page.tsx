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
import { getSharedDexie } from '@/lib/idb/shared-dexie';
import Link from 'next/link';

export default function DataPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [importingMd, setImportingMd] = useState(false);
  const [importMdResult, setImportMdResult] = useState<{ ok: boolean; text: string } | null>(null);
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

  // V1.11.8: 从 JSON 导入
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // 验证格式（必须有 version 字段，是 exportAllAsJson 导出格式）
      if (!json.version && !json.assets) {
        throw new Error('JSON 格式不对（缺少 version 或 assets 字段）');
      }
      // V1.11.8: 同时写 IDB + 调 server API 写 SQLite（双写）
      // 1. 写 IDB（让本地浏览器也有数据）
      try {
        const DexieModule = await import('dexie');

        const db = await getSharedDexie();
if (json.assets?.length) await db.assets.bulkPut(json.assets);
        if (json.outputs?.length) await db.outputs.bulkPut(json.outputs);
        if (json.feedback?.length) await db.feedback.bulkPut(json.feedback);
        if (json.topics?.length) await db.topics.bulkPut(json.topics);
        if (json.assetTopics?.length) await db.assetTopics.bulkPut(json.assetTopics);
        if (json.sources?.length) await db.sources.bulkPut(json.sources);
        if (json.sourceItems?.length) await db.sourceItems.bulkPut(json.sourceItems);
        if (json.topicKernels?.length) await db.topicKernels.bulkPut(json.topicKernels);
        if (json.userKernels?.length) await db.userKernels.bulkPut(json.userKernels);
        if (json.writingDrafts?.length) await db.writingDrafts.bulkPut(json.writingDrafts);
        if (json.writingVersions?.length) await db.writingVersions.bulkPut(json.writingVersions);
      } catch (idbErr: any) {
        console.warn('[handleImportJson] IDB 写入失败（可忽略）:', idbErr);
      }

      // 2. 调 server API 写 SQLite
      const res = await fetch('/api/migrate/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (data.ok) {
        const summary = Object.entries(data.counts || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
        setImportResult({ ok: true, text: `✓ 导入成功 · ${summary}` });
        setTimeout(() => window.location.reload(), 2000);
      } else if (data.code === 'NO_SQLITE') {
        setImportResult({ ok: true, text: `✓ 已导入浏览器 IDB（Vercel 部署版无 SQLite，本地版打开自动同步）` });
      } else {
        setImportResult({ ok: false, text: `✗ 导入失败: ${data.error}` });
      }
    } catch (e: any) {
      setImportResult({ ok: false, text: `✗ 解析失败: ${e.message}` });
    } finally {
      setImporting(false);
      e.target.value = ''; // 清 file input 允许重选同文件
    }
  };

  // V1.11.13: 从 .md 文件导入
  const handleImportMd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImportingMd(true);
    setImportMdResult(null);
    try {
      const { parseMdCards } = await import('@/lib/idb/parse-md');
      const { addAsset, addAssetBody } = await import('@/lib/idb/operations');

      const cards = [];
      for (const file of Array.from(files)) {
        const content = await file.text();
        const parsed = parseMdCards([{ name: file.name, content }]);
        const card = parsed[0];

        // 写 IDB assets row
        await addAsset({
          id: card.id,
          type: 'asset',
          status: 'in_use',
          title: card.title,
          evidenceLevel: card.evidenceLevel,
          priority: 'B',
          tagsJson: JSON.stringify(card.tags),
          source: card.source || card.fileName,
          sourceType: card.sourceType,
          oneSentenceInsight: card.oneSentenceInsight,
          antiCommonSense: card.antiCommonSense,
          filePath: `/imported/${card.fileName}`,
          fileMtime: card.createdAt,
          fileHash: card.id,
          feedbackCount: 0,
          scoreTotal: 70,
          scoreBreakdownJson: JSON.stringify({ imported: 70 }),
          outputCount: 0,
          isKernelCandidate: 0,
          isKernelApproved: 0,
          relatedIdsJson: '[]',
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
        });

        // 写 IDB assetBodies.body（V1.11.13 完整 .md 内容）
        await addAssetBody(card.id, card.body, card.fileName);
        cards.push(card);
      }

      const summary = cards.map(c => c.title).slice(0, 3).join('、');
      const more = cards.length > 3 ? ` 等 ${cards.length} 张` : '';
      setImportMdResult({ ok: true, text: `✓ 导入 ${cards.length} 张 · ${summary}${more}` });
    } catch (e: any) {
      setImportMdResult({ ok: false, text: `✗ 导入失败: ${e.message}` });
    } finally {
      setImportingMd(false);
      e.target.value = '';
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

      {/* V1.11.13: 导入本地 .md 卡片 */}
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>📄 导入 .md 卡片</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>
          从本地知识库选择 .md 卡片导入。解析 frontmatter（title / tags / evidence_level）+ 完整 body 存到浏览器 IDB。
          <br />
          <strong>支持</strong>：本地版 Insight OS 用的 .md 格式（YAML frontmatter + markdown body）
        </p>
        <input
          type="file"
          accept=".md,text/markdown"
          multiple
          onChange={handleImportMd}
          disabled={importingMd}
          style={{ display: 'block', marginBottom: 12, fontSize: 13 }}
        />
        {importingMd && (
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>导入中…</div>
        )}
        {importMdResult && (
          <div style={{ fontSize: 13, color: importMdResult.ok ? '#16a34a' : '#dc2626', marginTop: 8 }}>
            {importMdResult.text}
          </div>
        )}
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

      {/* V1.11.8: 从 JSON 导入（Vercel demo → 本地版）*/}
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>📥 从 JSON 导入</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>
          如果你之前在 Vercel demo 体验后导出了 JSON（`insight-os-backup-*.json`），选这个文件导入到本地版 SQLite。
          <br />
          <strong>注意</strong>：仅本地版生效（Vercel 部署版没 SQLite）。
        </p>
        <input
          type="file"
          accept="application/json"
          onChange={handleImportJson}
          disabled={importing}
          style={{ display: 'block', marginBottom: 12, fontSize: 13 }}
        />
        {importing && (
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>导入中…</div>
        )}
        {importResult && (
          <div style={{ fontSize: 13, color: importResult.ok ? '#16a34a' : '#dc2626', marginTop: 8 }}>
            {importResult.text}
          </div>
        )}
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