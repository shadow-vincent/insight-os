import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { externalDir: true },
  // monorepo root：让 Next.js 15 + Vercel 能从仓库根解析 @insight-os/* workspaces 包
  // 配合 transpilePackages 主动 transpile 这些 monorepo 包
  // 不写这两个的话 Vercel build 报 "Module not found: Can't resolve '@insight-os/db'"
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: [
    '@insight-os/core',
    '@insight-os/db',
    '@insight-os/indexer',
    '@insight-os/llm',
  ],
  typescript: { ignoreBuildErrors: true },
  // server 端运行时直接 require 这些包，不让 webpack bundle
  // （pdfjs-dist / pdf-parse 内部是 .mjs，webpack 5 跑会报 "Object.defineProperty called on non-object"）
  // drizzle-orm 也加：next 15 build 不会正确生成 vendor-chunks/drizzle-orm.js，懒加载会 ENOENT
  serverExternalPackages: ['pdfjs-dist', 'pdf-parse', 'jszip', 'mammoth', 'xlsx', 'better-sqlite3', 'openai', 'drizzle-orm', '@paralleldrive/cuid2'],
};

export default nextConfig;