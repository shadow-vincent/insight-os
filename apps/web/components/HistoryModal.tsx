'use client';

/**
 * 历史版本 modal（V1.2）
 *
 * 列 preset 的最近 5 个 .bak 版本
 * - 可查看历史版本内容
 * - 可"回滚"到历史版本
 */

import { useEffect, useState } from 'react';

interface HistoryModalProps {
  open: boolean;
  presetName: string;
  history: Array<{ version: number; timestamp: number; size: number }>;
  onClose: () => void;
  onRollback: (newName: string) => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export default function HistoryModal({ open, presetName, history, onClose, onRollback, toast }: HistoryModalProps) {
  const [viewing, setViewing] = useState<{ timestamp: number; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (open) {
      setViewing(null);
    }
  }, [open]);

  const viewVersion = async (timestamp: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/writing-config/history?name=${encodeURIComponent(presetName)}&timestamp=${timestamp}`);
      const data = await res.json();
      if (data.ok) {
        setViewing({ timestamp, content: JSON.stringify(data.config, null, 2) });
      } else {
        toast.error(`加载失败: ${data.error}`);
      }
    } catch (e: any) {
      toast.error(`请求失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const rollback = async (timestamp: number) => {
    if (!confirm(`确认回滚到版本（${new Date(timestamp).toLocaleString('zh-CN')}）？当前版本会备份到 .bak`)) return;
    setRolling(true);
    try {
      const res = await fetch(`/api/writing-config/history?name=${encodeURIComponent(presetName)}&timestamp=${timestamp}`);
      const data = await res.json();
      if (!data.ok) {
        toast.error(`加载版本失败: ${data.error}`);
        return;
      }
      // 保存为当前 preset（覆盖）
      const config = { ...data.config, updatedAt: Date.now() };
      const saveRes = await fetch(`/api/writing-config/${encodeURIComponent(presetName)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });
      const saveData = await saveRes.json();
      if (saveData.ok) {
        toast.success(`已回滚「${presetName}」到历史版本`);
        onRollback(presetName);
        onClose();
      } else {
        toast.error(`回滚失败: ${saveData.error}`);
      }
    } catch (e: any) {
      toast.error(`请求失败: ${e.message}`);
    } finally {
      setRolling(false);
    }
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
            📜 历史版本 · {presetName}
          </h3>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
          💡 最近 5 个保存版本 · 点「查看」看完整内容 · 点「回滚」恢复（当前版本会先备份）
        </div>

        {history.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            暂无历史版本（首次保存前不会有 .bak）
          </div>
        ) : !viewing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(h => (
              <div
                key={h.version}
                style={{
                  padding: 12, background: 'var(--bg-subtle)', borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 12,
                  border: '1px solid var(--line-soft)',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', width: 32 }}>
                  v{h.version}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                    {new Date(h.timestamp).toLocaleString('zh-CN')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {h.size} 字节
                  </div>
                </div>
                <button className="btn btn-sm" onClick={() => viewVersion(h.timestamp)} disabled={loading}>
                  查看
                </button>
                {h.version > 1 && (
                  <button className="btn btn-sm" onClick={() => rollback(h.timestamp)} disabled={rolling}>
                    回滚
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-3)' }}>
              版本时间：{new Date(viewing.timestamp).toLocaleString('zh-CN')}
            </div>
            <pre style={{
              background: 'var(--bg-subtle)', padding: 14, borderRadius: 6,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, lineHeight: 1.6,
              color: 'var(--text)', overflow: 'auto', maxHeight: '60vh',
            }}>
              {viewing.content}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <button className="btn" onClick={() => setViewing(null)}>← 返回列表</button>
              <button className="btn" onClick={onClose}>关闭</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}