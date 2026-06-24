'use client';

/**
 * /settings/sync — iCloud 同步设置（V1.6 加 diff 预览）
 *
 * 流程：上传 ZIP → dryRun 返回 diff → 用户确认 → 实际导入
 */

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ToastProvider';

interface SyncStatus {
  ok: boolean;
  counts: Record<string, number>;
  lastSyncAt: number | null;
  iCloudTip: { mac: string; windows: string; cross: string };
}

interface DiffReport {
  manifest: any;
  diff: Record<string, { insert: string[]; update: string[]; skip: string[] }>;
  totalInsert: number;
  totalUpdate: number;
  totalSkip: number;
  message: string;
  dryRun: boolean;
}

const TABLE_LABELS: Record<string, string> = {
  assets: '资产卡',
  topics: '主题',
  assetTopics: '资产-主题关联',
  topicKernels: '主题 Kernel',
  userKernels: '用户 Kernel',
  outputs: '输出',
  writingDrafts: '写作草稿',
  writingVersions: '写作版本',
};

export default function SyncSettingsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [diffReport, setDiffReport] = useState<DiffReport | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/sync/status');
      const data = await res.json();
      if (data.ok) setStatus(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/sync/export');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'insight-os-backup.zip';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${(blob.size / 1024).toFixed(0)} KB · 拖到 iCloud Drive 即可同步`);
      loadStatus();
    } catch (e: any) {
      toast.error(`导出失败：${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingFile(file);
    // 先 dryRun
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/sync/import?dryRun=1', { method: 'POST', body: form });
      const data = await res.json();
      if (data.ok) {
        setDiffReport(data);
      } else {
        toast.error(`解析失败：${data.error}`);
        setPendingFile(null);
      }
    } catch (e: any) {
      toast.error(`解析失败：${e.message}`);
      setPendingFile(null);
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', pendingFile);
      const res = await fetch('/api/sync/import', { method: 'POST', body: form });
      const data = await res.json();
      if (data.ok) {
        toast.success(`导入完成：新增 ${data.counts.inserted} · 更新 ${data.counts.updated} · 失败 ${data.counts.skipped}`);
        if (data.errors.length > 0) toast.error(`${data.errors.length} 个文件导入失败`);
        setDiffReport(null);
        setPendingFile(null);
        loadStatus();
      } else {
        toast.error(`导入失败：${data.error}`);
      }
    } catch (e: any) {
      toast.error(`导入失败：${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setDiffReport(null);
    setPendingFile(null);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="page-title">☁️ 数据同步</h1>
      <p className="page-subtitle">导出 / 导入 ZIP · 拖到 iCloud Drive 即可多端同步</p>

      {status && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>📊 当前数据</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {Object.entries(status.counts).map(([k, v]) => (
              <div key={k} style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{k}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>🔄 导出 / 导入</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>导出 ZIP</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
              打包所有数据 · 拖到 iCloud Drive 即可同步到其他设备
            </div>
            <button className="btn btn-primary" onClick={handleExport} disabled={exporting} style={{ width: '100%', justifyContent: 'center' }}>
              {exporting ? '导出中…' : '📤 导出全部数据'}
            </button>
          </div>
          <div style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📥</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>导入 ZIP</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
              先 diff 预览 · 用户确认后覆盖
            </div>
            <button className="btn btn-accent" onClick={handleImportClick} disabled={importing} style={{ width: '100%', justifyContent: 'center' }}>
              {importing ? '解析中…' : '📥 从本地导入'}
            </button>
            <input ref={fileInputRef} type="file" accept=".zip,application/zip" onChange={handleFileSelected} style={{ display: 'none' }} />
          </div>
        </div>
      </div>

      {/* Diff 预览 Modal */}
      {diffReport && (
        <div
          onClick={handleCancelImport}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-panel)', borderRadius: 10, maxWidth: 640, width: '100%',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(15, 23, 42, 0.3)', overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                🔍 导入预览 · Diff
              </h3>
            </div>
            <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
              <div style={{
                padding: 12, background: diffReport.totalUpdate > 0 ? 'var(--warning-bg)' : 'var(--success-bg)',
                borderRadius: 6, marginBottom: 16, fontSize: 13, color: 'var(--ink)',
              }}>
                {diffReport.message}
              </div>

              {Object.entries(diffReport.diff).map(([key, item]) => {
                const total = item.insert.length + item.update.length + item.skip.length;
                if (total === 0) return null;
                return (
                  <div key={key} style={{
                    padding: 12, background: 'var(--bg-subtle)', borderRadius: 6,
                    marginBottom: 8, fontSize: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: 'var(--ink)' }}>{TABLE_LABELS[key] ?? key}</strong>
                      <div style={{ display: 'flex', gap: 12, fontFamily: 'JetBrains Mono, monospace' }}>
                        {item.insert.length > 0 && <span style={{ color: 'var(--success)' }}>+{item.insert.length}</span>}
                        {item.update.length > 0 && <span style={{ color: 'var(--warning)' }}>~{item.update.length}</span>}
                        {item.skip.length > 0 && <span style={{ color: 'var(--text-3)' }}>!{item.skip.length}</span>}
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: 11 }}>
                      {item.insert.length > 0 && <span>+ 新增 {item.insert.length} 个；</span>}
                      {item.update.length > 0 && <span>~ 更新 {item.update.length} 个；</span>}
                      {item.skip.length > 0 && <span>! 跳过 {item.skip.length} 个；</span>}
                    </div>
                  </div>
                );
              })}

              {diffReport.totalUpdate > 0 && (
                <div style={{
                  marginTop: 12, padding: 10, background: 'var(--accent-soft, #fee2e2)',
                  borderRadius: 6, fontSize: 12, color: 'var(--text-2)',
                }}>
                  ⚠️ 存在 {diffReport.totalUpdate} 个将被覆盖的实体。继续则按 last-write-wins 处理。
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={handleCancelImport} disabled={importing}>取消</button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={importing || (diffReport.totalInsert === 0 && diffReport.totalUpdate === 0)}
              >
                {importing ? '导入中…' : diffReport.totalUpdate > 0 ? '⚠️ 确认覆盖导入' : '✓ 确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className="card" style={{ padding: 20, marginBottom: 16, background: 'var(--primary-soft)', border: '1px solid var(--primary)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)', margin: '0 0 12px' }}>💡 iCloud 同步说明</h2>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>
            <p style={{ marginBottom: 8 }}><strong>macOS：</strong>{status.iCloudTip.mac}</p>
            <p style={{ marginBottom: 8 }}><strong>Windows：</strong>{status.iCloudTip.windows}</p>
            <p style={{ marginBottom: 0 }}><strong>跨平台：</strong>{status.iCloudTip.cross}</p>
          </div>
        </div>
      )}

      <div style={{ padding: 16, background: 'var(--warning-bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
        <strong>V1.6 改进：</strong>
        <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
          <li>✅ 导入前先做 diff 预览（新增 / 更新 / 跳过）</li>
          <li>✅ 用户确认后才执行（防误操作）</li>
        </ul>
        <strong style={{ marginTop: 8, display: 'block' }}>V2.0 改进：</strong>
        <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
          <li>iCloud 真正的 File System Provider（自动同步）</li>
          <li>WebDAV 跨平台</li>
        </ul>
      </div>
    </div>
  );
}
