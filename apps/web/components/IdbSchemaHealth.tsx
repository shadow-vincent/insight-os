'use client';

/**
 * V1.11.13.1: IDB Schema 健康检查
 *
 * 在 layout mount 时检查 IndexedDB schema 是否最新（v3 = 包含 assetBodies 表）
 * 如果是旧 schema，提示用户升级。
 *
 * 为什么不能自动升级：自动删库 + reload 会让用户已加载的 demo 数据丢失，
 * 必须先告诉用户"会清空当前数据，是否继续"。
 */

import { useEffect, useState } from 'react';

export function IdbSchemaHealth() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'need-upgrade'>('checking');
  const [detail, setDetail] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const req = indexedDB.open('insight-os');
        req.onsuccess = () => {
          const db = req.result;
          const stores = Array.from(db.objectStoreNames);
          db.close();
          if (stores.includes('assetBodies')) {
            setStatus('ok');
          } else {
            setStatus('need-upgrade');
            setDetail(`当前 v${stores.length >= 12 ? 2 : 1} schema（${stores.length} 表），缺 assetBodies`);
          }
        };
        req.onerror = () => setStatus('ok'); // 还没创建库，没事
      } catch (e) {
        setStatus('ok');
      }
    })();
  }, []);

  const doUpgrade = async () => {
    if (!confirm('升级会清空当前浏览器 IndexedDB 中的 demo 数据（本地版用导入 JSON 备份过的不受影响）。继续？')) {
      return;
    }
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('insight-os');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
      // 清迁移标记 + demo 标记，强制下次访问重新加载
      try { localStorage.removeItem('migrated-v1.10'); } catch (e) {}
      try { localStorage.removeItem('demo-loaded'); } catch (e) {}
      window.location.reload();
    } catch (e) {
      alert('升级失败: ' + e);
    }
  };

  if (status === 'checking' || status === 'ok') return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: 8,
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxWidth: 360,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>🔧 IDB schema 需要升级</div>
      <div style={{ color: '#78350f', marginBottom: 8 }}>{detail}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={doUpgrade}
          style={{
            padding: '4px 12px',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          升级到 v3（清空 demo 数据）
        </button>
        <button
          onClick={() => setStatus('ok')}
          style={{
            padding: '4px 12px',
            background: 'transparent',
            color: '#78350f',
            border: '1px solid #92400e',
            borderRadius: 4,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          稍后
        </button>
      </div>
    </div>
  );
}