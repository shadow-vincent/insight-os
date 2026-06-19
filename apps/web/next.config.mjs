/** @type {import('next').NextConfig} */
const nextConfig = {
  // 跨 workspace 包的导入：必须显式 transpile，否则 next 的 webpack 找不到
  transpilePackages: [
    '@insight-os/db',
    '@insight-os/core',
    '@insight-os/indexer',
    '@insight-os/llm',
  ],
  // 解决 monorepo 下 node_modules 解析问题
  experimental: {
    externalDir: true,
  },
  // v1.0 桌面 app 集成：Tauri 启动时把 Next 跑成 standalone server
  output: 'standalone',
};

export default nextConfig;
