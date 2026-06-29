#!/usr/bin/env node
// 在 apps/web/node_modules/@insight-os/ 下建 symlink 指向 monorepo packages/*
// 解决 Vercel / monorepo 部署时 npm install 不会自动给子目录建 workspaces link 的问题
import fs from 'fs';
import path from 'path';

const PACKAGES = ['core', 'db', 'indexer', 'llm'];

// 推断 monorepo root：向上找有 workspaces 字段的 package.json
function findMonorepoRoot(startDir) {
  let dir = path.resolve(startDir);
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces) return dir;
      } catch {}
    }
    dir = path.dirname(dir);
  }
  return null;
}

const monorepoRoot = findMonorepoRoot(process.cwd());
if (!monorepoRoot) {
  console.log('[monorepo-links] monorepo root not found, skip');
  process.exit(0);
}

const appsWebNodeModules = path.join(monorepoRoot, 'apps', 'web', 'node_modules', '@insight-os');

// 如果 apps/web 不存在（不部署 web），跳过
const appsWebDir = path.join(monorepoRoot, 'apps', 'web');
if (!fs.existsSync(appsWebDir)) {
  console.log('[monorepo-links] apps/web not found, skip');
  process.exit(0);
}

fs.mkdirSync(appsWebNodeModules, { recursive: true });

let linked = 0;
for (const pkg of PACKAGES) {
  const target = path.join(monorepoRoot, 'packages', pkg);
  const linkPath = path.join(appsWebNodeModules, pkg);

  // 删掉旧的（可能是真实目录 from file: install，也可能是 symlink）
  try {
    fs.rmSync(linkPath, { recursive: true, force: true });
  } catch {}

  if (!fs.existsSync(target)) {
    console.log(`[monorepo-links] skip @insight-os/${pkg}: source not found at ${target}`);
    continue;
  }

  try {
    fs.symlinkSync(target, linkPath, 'dir');
    console.log(`[monorepo-links] linked @insight-os/${pkg} -> ${target}`);
    linked++;
  } catch (e) {
    console.log(`[monorepo-links] fail @insight-os/${pkg}: ${e.message}`);
  }
}

console.log(`[monorepo-links] done: ${linked}/${PACKAGES.length} linked`);