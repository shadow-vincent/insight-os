'use client';

/**
 * /settings/embed — embed widget 设置（v1.5）
 *
 * 生成一行 <script> 嵌入代码，让用户复制到自己博客
 * 同时给公开 URL 直链
 */

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';

export default function EmbedSettingsPage() {
  const toast = useToast();
  const [userId] = useState('vincent');  // V1.5 固定，V1.6 加用户设置
  const [topicFilter, setTopicFilter] = useState<string>('');

  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${userId}/graph`;
  const embedCode = `<iframe src="${publicUrl}" width="100%" height="540" frameborder="0" style="border:1px solid #e2e8f0;border-radius:10px;max-width:720px"></iframe>`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label}已复制`);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="page-title">📤 嵌入图谱 · Embed Widget</h1>
      <p className="page-subtitle">把"判断力图谱"嵌到博客 / 个人主页 / Notion</p>

      {/* 公开 URL */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>🔗 公开 URL</h2>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 12px' }}>
          任何人都可以通过这个 URL 看你的判断力图谱（无需登录）
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            readOnly
            value={publicUrl}
            style={{
              flex: 1, padding: '8px 12px', fontSize: 13,
              border: '1px solid var(--line)', borderRadius: 6,
              background: 'var(--bg-subtle)', color: 'var(--ink)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <button className="btn btn-primary" onClick={() => copy(publicUrl, 'URL')}>
            📋 复制
          </button>
        </div>
        <a href={publicUrl} target="_blank" style={{
          display: 'inline-block', marginTop: 8, fontSize: 12, color: 'var(--primary)', textDecoration: 'none',
        }}>
          ↗ 预览公开图谱
        </a>
      </div>

      {/* Embed 代码 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>📋 嵌入代码</h2>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 12px' }}>
          复制这段 HTML 到你的博客 / Notion / 个人主页
        </p>
        <div style={{ position: 'relative' }}>
          <pre style={{
            padding: 16, fontSize: 12, lineHeight: 1.6,
            background: 'var(--bg-subtle)', color: 'var(--ink)',
            borderRadius: 6, border: '1px solid var(--line)',
            fontFamily: 'JetBrains Mono, monospace',
            overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {embedCode}
          </pre>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => copy(embedCode, '嵌入代码')}
          style={{ marginTop: 12 }}
        >
          📋 复制嵌入代码
        </button>
      </div>

      {/* 使用说明 */}
      <div className="card" style={{ padding: 20, marginBottom: 16, background: 'var(--primary-soft)', border: '1px solid var(--primary)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)', margin: '0 0 12px' }}>💡 使用场景</h2>
        <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>
          <li><strong>咨询师个人主页：</strong>展示"我会什么、我想什么"给潜在客户看</li>
          <li><strong>公众号文章配图：</strong>用"我的方法论图谱"作头图</li>
          <li><strong>销售线索磁石：</strong>嵌入 unlisted 公开图谱，访客看到 → 加微信</li>
          <li><strong>团队方法论展示：</strong>（V2.0 团队版）整个工作室的判断合集</li>
        </ul>
      </div>

      {/* V2.0 路线 */}
      <div style={{
        padding: 16, background: 'var(--warning-bg)', borderRadius: 8,
        fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6,
      }}>
        <strong>V1.5 MVP：</strong>
        <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
          <li>用户 ID 固定为 "vincent"（V1.6 加自定义）</li>
          <li>主题过滤 V1.6 加</li>
          <li>嵌入代码是 iframe（V2.0 改成 &lt;script&gt; 嵌入式）</li>
          <li>未做主题色 / 隐私级别配置（V1.6 加）</li>
        </ul>
      </div>
    </div>
  );
}
