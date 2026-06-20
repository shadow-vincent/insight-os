/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { externalDir: true },
  typescript: { ignoreBuildErrors: true },
  // server 端运行时直接 require 这些包，不让 webpack bundle
  // （pdfjs-dist / pdf-parse 内部是 .mjs，webpack 5 跑会报 "Object.defineProperty called on non-object"）
  serverExternalPackages: ['pdfjs-dist', 'pdf-parse', 'jszip', 'mammoth', 'xlsx', 'better-sqlite3'],
  // 桌面 app 用 next start (3000 端口) + Electron 加载
};

export default nextConfig;