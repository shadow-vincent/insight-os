// Build monorepo packages to dist/ for production (next start can't run .ts)
// Run: node build-packages.mjs

import { build } from 'esbuild';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const packages = [
  { name: 'db', entries: ['src/index.ts', 'src/schema.ts', 'src/client.ts'] },
  { name: 'core', entries: ['src/index.ts'] },
  { name: 'llm', entries: ['src/index.ts'] },
  { name: 'indexer', entries: ['src/index.ts'] },
];

// Packages with nested entry points (like prompts/)
const nestedEntries = {
  llm: ['src/prompts/light-card.ts', 'src/prompts/calibrate.ts', 'src/prompts/asset-upgrade.ts',
        'src/prompts/output-generate.ts', 'src/prompts/output-composite.ts',
        'src/prompts/topic-kernel.ts', 'src/prompts/writing-scaffold.ts',
        'src/prompts/writing-companion.ts', 'src/prompts/assistant.ts'],
};

const sharedExternals = [
  'next', 'react', 'react-dom', 'next/server',
  'drizzle-orm', 'better-sqlite3', '@insight-os/*',
  'yaml', 'zod',
  'fs', 'path', 'crypto', 'os', 'util', 'stream', 'http', 'https', 'url',
];

async function buildEntry(pkgDir, entry, distDir) {
  const entryName = entry.replace(/^src\//, '').replace(/\.ts$/, '.js');
  const outFile = join(distDir, entryName);
  console.log(`Building ${relative(__dirname, join(pkgDir, entry))} -> dist/${entryName}`);
  await build({
    entryPoints: [join(pkgDir, entry)],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: false,
    external: sharedExternals,
    logLevel: 'warning',
  });
}

/**
 * 生成 .d.ts（用 tsc）
 * esbuild 不生成 .d.ts，apps/web tsc 编译需要类型声明
 */
function generateDts(pkgDir, distDir, pkgName) {
  try {
    const tsconfigPath = join(pkgDir, '.tsconfig.build.json');
    const tsconfig = {
      compilerOptions: {
        target: 'es2022',
        module: 'esnext',
        moduleResolution: 'node',
        declaration: true,
        emitDeclarationOnly: true,
        outDir: distDir,
        strict: false,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        noEmit: false,
      },
      include: [join(pkgDir, 'src/**/*')],
      exclude: [join(pkgDir, 'node_modules'), join(pkgDir, 'dist')],
    };
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    execSync(`npx tsc -p "${tsconfigPath}"`, { stdio: 'inherit', cwd: pkgDir });

    // 给 db 包手动 emit client.d.ts（tsc 不会自动 emit re-export 的 d.ts）
    if (pkgName === 'db') {
      const clientTsconfig = { ...tsconfig, include: [join(pkgDir, 'src/client.ts')] };
      const clientTsconfigPath = join(pkgDir, '.tsconfig.client.json');
      writeFileSync(clientTsconfigPath, JSON.stringify(clientTsconfig, null, 2));
      execSync(`npx tsc -p "${clientTsconfigPath}"`, { stdio: 'inherit', cwd: pkgDir });
      unlinkSync(clientTsconfigPath);
    }

    // 清理临时 tsconfig
    unlinkSync(tsconfigPath);
    if (pkgName === 'db') {
      tryUnlink(join(pkgDir, '.tsconfig.client.json'));
    }

    // 修复 d.ts 里的 .ts 后缀 import（tsc 不会自动转）
    // 比如 index.d.ts 里写 `export * from './schema.ts'`，但实际文件是 schema.d.ts
    // 必须改成 `export * from './schema'`
    fixDtsImports(distDir);

    console.log(`  Generated d.ts for ${relative(__dirname, pkgDir)}`);
  } catch (e) {
    console.warn(`  d.ts generation failed for ${relative(__dirname, pkgDir)}: ${e.message}`);
  }
}

/**
 * 把 d.ts 文件里的 .ts 后缀 import 改成无后缀
 * 原因：tsc emit d.ts 时保留 src 的 .ts 后缀，但 dist 里实际是 .d.ts（无后缀）
 */
function fixDtsImports(distDir) {
  const entries = readdirSync(distDir);
  for (const name of entries) {
    if (!name.endsWith('.d.ts')) continue;
    const filePath = join(distDir, name);
    let content = readFileSync(filePath, 'utf8');
    // 把 './xxx.ts' 或 '../xxx.ts' 改成 './xxx' 或 '../xxx'
    const before = content;
    content = content.replace(/(from\s+['"])(\.\.?\/[^'"]+)\.ts(['"])/g, '$1$2$3');
    // 同样处理 import type 和动态 import
    content = content.replace(/(import\(['"])(\.\.?\/[^'"]+)\.ts(['"])/g, '$1$2$3');
    if (content !== before) {
      writeFileSync(filePath, content, 'utf8');
    }
  }
}

function tryUnlink(p) {
  try { unlinkSync(p); } catch { /* ignore */ }
}

for (const pkg of packages) {
  const pkgDir = join(__dirname, 'packages', pkg.name);
  if (!existsSync(pkgDir)) continue;
  const distDir = join(pkgDir, 'dist');
  mkdirSync(distDir, { recursive: true });

  for (const entry of pkg.entries) {
    await buildEntry(pkgDir, entry, distDir);
  }
  for (const entry of (nestedEntries[pkg.name] || [])) {
    await buildEntry(pkgDir, entry, distDir);
  }

  // 生成 .d.ts（让 apps/web TS 编译能找到类型）
  generateDts(pkgDir, distDir, pkg.name);

  // Update package.json to point to dist
  const pkgJsonPath = join(pkgDir, 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  pkgJson.main = './dist/index.js';
  pkgJson.exports = pkgJson.exports || {};
  for (const key of Object.keys(pkgJson.exports)) {
    const v = pkgJson.exports[key];
    if (typeof v === 'string' && v.includes('/src/')) {
      pkgJson.exports[key] = v.replace(/\/src\//, '/dist/').replace(/\.ts$/, '.js');
    }
  }
  writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
  console.log(`Updated ${pkg.name}/package.json`);
}

console.log('\nDone. Now: cd apps/web && npm run build && cd ../desktop && npx electron-builder --mac');
