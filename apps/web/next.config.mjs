/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { externalDir: true },
  typescript: { ignoreBuildErrors: true },
  // 桌面 app 用 next start (3000 端口) + Electron 加载
};

export default nextConfig;
