'use client';

/**
 * /settings/export
 *
 * V1.11.7: 输出与导出
 * - 嵌入图谱 PNG/PDF
 * - 博客文章图导出
 */

import Link from 'next/link';

export default function ExportPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">输出与导出</h1>
        <p className="page-subtitle">把判断资产转成可分享的图 · 贴公众号 / 朋友圈 / 发客户</p>
      </div>

      <Link href="/settings/embed" className="card card-hover" style={{ display: 'block', marginBottom: 16, padding: 18, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>📤</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>导出图谱 PNG / PDF</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              主题资产包转图片 · 本地导出 · 不需要域名
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>
        </div>
      </Link>

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
    </div>
  );
}