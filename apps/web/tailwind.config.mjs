/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Insight OS v0.2 · 深蓝主调设计系统
      colors: {
        // 背景层级（从深到浅）
        bg: {
          canvas: '#f7f9fc',   // 页面背景
          panel: '#ffffff',    // 卡片背景
          raised: '#ffffff',   // 浮起元素（modal/popover）
          subtle: '#eef2f7',   // sidebar / 二级背景
        },
        // 描边
        line: {
          DEFAULT: '#e2e8f0',
          soft: '#eef2f7',
          strong: '#cbd5e1',
        },
        // 文字层级
        text: {
          DEFAULT: '#1a2332',  // 正文
          2: '#475569',         // 次要
          3: '#64748b',         // 辅助
          muted: '#94a3b8',     // 占位
        },
        ink: '#0f172a',       // 标题（最深）
        // 品牌主色（深蓝咨询感）
        primary: {
          DEFAULT: '#1a365d',
          hover: '#142847',
          soft: 'rgba(26, 54, 93, 0.07)',
          line: 'rgba(26, 54, 93, 0.2)',
        },
        // 强调色（橙色，用于行动按钮/警告）
        accent: {
          DEFAULT: '#ea580c',
          soft: 'rgba(234, 88, 12, 0.08)',
        },
        // 状态色
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        // 证据等级颜色
        ev: {
          E0: '#94a3b8',
          E1: '#cbd5e1',
          E2: '#60a5fa',
          E3: '#3b82f6',
          E4: '#2563eb',
          E5: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'PingFang SC', 'Hiragino Sans GB', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      // 圆角尺度（更紧凑）
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
      },
      // 阴影（更克制）
      boxShadow: {
        sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
        DEFAULT: '0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)',
        md: '0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)',
        lg: '0 12px 24px -6px rgba(15, 23, 42, 0.10), 0 4px 8px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
};
