// Build monorepo packages to dist/ for production (next start can't run .ts)
// Run: node build-packages.mjs

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
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
