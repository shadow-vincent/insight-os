#!/usr/bin/env node
/**
 * 批量索引脚本
 *
 * 用法:
 *   node scripts/index-assets.mjs                  # 索引一次
 *   node scripts/index-assets.mjs --watch          # 启动时索引一次，每 5 分钟再扫
 *
 * 环境变量:
 *   INSIGHT_VAULT_PATH  指向你的 knowledge_base 根目录
 *                       默认 /Users/vincent/Documents/knowledge_base
 */

import { indexVault } from '../packages/indexer/src/indexer.ts';

const watch = process.argv.includes('--watch');
const vaultPath = process.env.INSIGHT_VAULT_PATH ?? '/Users/vincent/Documents/knowledge_base';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Insight OS · 资产索引器');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Vault: ${vaultPath}/04_管理洞察`);
console.log('');

async function run() {
  const start = Date.now();
  const result = indexVault({ vaultPath });
  const elapsed = Date.now() - start;

  console.log(`  扫描: ${result.scanned} 个文件`);
  console.log(`  新增: ${result.indexed}`);
  console.log(`  更新: ${result.updated}`);
  console.log(`  未变: ${result.unchanged}`);
  console.log(`  耗时: ${elapsed}ms`);

  if (result.errors.length > 0) {
    console.log('');
    console.log('  ⚠️  错误:');
    for (const e of result.errors) {
      console.log(`    - ${e.file}: ${e.error}`);
    }
  }
  console.log('');
}

await run();

if (watch) {
  console.log('  监听模式：每 5 分钟扫一次（Ctrl+C 退出）');
  setInterval(run, 5 * 60 * 1000);
}
