'use client';

/**
 * /settings/sync — iCloud 同步设置（v1.5 MVP）
 *
 * 策略：导出 / 导入 ZIP 到本地（用户拖到 iCloud Drive 即可同步）
 * V2.0 计划：File System Provider 真正的 iCloud Container 集成
 */

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ToastProvider';

interface SyncStatus {
  ok: boolean;
  counts: Record<string, number>;
  lastSyncAt: number | null;
  iCloudTip: { mac: string; windows: string; cross: string };
}

export default function SyncSettingsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/sync/status');
      const data = await res.json();
      if (data.ok) setStatus(data);
    } catch (e) {
      console.error(e);
    }
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
    if (!file) return;
    if (!confirm(`确定从 "${file.name}" 导入？\n\n⚠️ 当前数据将被覆盖（已存在的实体按 last-write-wins 处理）。\n建议先导出当前数据备份。`)) {
      e.target.value = '';
      return;
    }
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/sync/import', { method: 'POST', body: form });
      const data = await res.json();
      if (data.ok) {
        toast.success(`导入完成：新增 ${data.counts.inserted} · 更新 ${data.counts.updated} · 失败 ${data.counts.skipped}`);
        if (data.errors.length > 0) {
          toast.error(`${data.errors.length} 个文件导入失败：${data.errors[0]}`);
        }
        loadStatus();
      } else {
        toast.error(`导入失败：${data.error}`);
      }
    } catch (e: any) {
      toast.error(`导入失败：${e.message}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="page-title">☁️ 数据同步</h1>
      <p className="page-subtitle">导出 / 导入 ZIP · 拖到 iCloud Drive 即可多端同步</p>

      {/* 当前状态 */}
      {status && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>📊 当前数据</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {Object.entries(status.counts).map(([k, v]) => (
              <div key={k} style={{
                padding: 12, background: 'var(--bg-subtle)', borderRadius: 6,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{k}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作区 */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>🔄 导出 / 导入</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* 导出 */}
          <div style={{
            padding: 20, border: '1px solid var(--line)', borderRadius: 8,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
              导出 ZIP
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
              把所有数据打包成 ZIP · 拖到 iCloud Drive 即可同步到其他设备
            </div>
            <button
              className="btn btn-primary"
              onClick={handleExport}
              disabled={exporting}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {exporting ? '导出中…' : '📤 导出全部数据'}
            </button>
          </div>

          {/* 导入 */}
          <div style={{
            padding: 20, border: '1px solid var(--line)', borderRadius: 8,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📥</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
              导入 ZIP
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
              上传之前导出的 ZIP · 同一 id 按 last-write-wins 覆盖
            </div>
            <button
              className="btn btn-accent"
              onClick={handleImportClick}
              disabled={importing}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {importing ? '导入中…' : '📥 从本地导入'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={handleFileSelected}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* iCloud 同步说明 */}
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

      {/* 限制 */}
      <div style={{
        padding: 16, background: 'var(--warning-bg)', borderRadius: 8,
        fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6,
      }}>
        <strong>⚠️ MVP 限制（V2.0 改进）：</strong>
        <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
          <li>不包含 LLM API key（隐私安全，导入后需重新配置）</li>
          <li>当前不做 diff 预览（V1.6 加）</li>
          <li>不自动监听 iCloud 目录（用户手动导出 / 导入）</li>
        </ul>
      </div>
    </div>
  );
}
