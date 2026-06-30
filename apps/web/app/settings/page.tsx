'use client';

/**
 * /settings (主页)
 *
 * V1.11.7: 瘦身到 5 个 sub-page 入口卡 + 主题外观
 *
 * sub-page 分组：
 * - 🔌 外部服务接入 (/settings/integrations) — LLM + RSSHub
 * - ✎ 写作风格 (/settings/writing)            — 单
 * - 🧠 判断协议 (/settings/kernel)             — 单
 * - 📤 输出与导出 (/settings/export)           — 图谱 + 博客
 * - 💾 数据与迁移 (/settings/data)             — iCloud 同步 + 资产库路径 + 老版本迁移
 */

import Link from 'next/link';
import { useTheme } from '@/components/useTheme';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">设置</h1>
        <p className="page-subtitle">主题外观</p>
      </div>

      {/* 主题外观（主页唯一内嵌 section）*/}
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

      {/* 5 个 sub-page 入口卡 */}
      <Link href="/settings/integrations" className="card card-hover" style={{ display: 'block', marginBottom: 16, padding: 18, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🔌</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>外部服务接入</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              LLM 校准 / 输出生成 · RSSHub 信息源抓取
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>
        </div>
      </Link>

      <Link href="/settings/writing" className="card card-hover" style={{ display: 'block', marginBottom: 16, padding: 18, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>✎</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>写作风格</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              写作风格预设 · 5 维度自定义
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>
        </div>
      </Link>

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

      <Link href="/settings/export" className="card card-hover" style={{ display: 'block', marginBottom: 16, padding: 18, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>📤</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>输出与导出</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              图谱 PNG/PDF · 博客文章长图
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>
        </div>
      </Link>

      <Link href="/settings/data" className="card card-hover" style={{ display: 'block', marginBottom: 16, padding: 18, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>💾</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>数据与迁移</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              iCloud 同步 · 资产库路径 · 老版本数据迁移
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>
        </div>
      </Link>
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
  onSelect: (id: 'blue' | 'green') => void;
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={active ? 'card' : 'card card-hover'}
      style={{
        padding: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        border: active ? '2px solid var(--primary)' : '1px solid var(--line)',
        textAlign: 'left',
      }}
    >
      <div style={{ height: 60, background: bg, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 10, left: 12,
          width: 24, height: 24, borderRadius: 12,
          background: swatch,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }} />
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
        {active && <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>✓ 当前</div>}
      </div>
    </button>
  );
}