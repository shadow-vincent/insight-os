#!/usr/bin/env node
// Patch: 修所有 null check 返回带通用字段
// 之前：{ ok: true, data: [], count: 0 } → 客户端期望 data.candidates 等字段找不到
// 现在：{ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], ... }
// 任何客户端的 data.X || data.data || [] 都能兜底

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(__dirname, '../apps/web/app/api');

const COMMON_EMPTY = `{ ok: true, data: [], count: 0, candidates: [], items: [], sources: [], outputs: [], topics: [], list: [], all: [], kernels: [], assets: [], feedbacks: [], kernelCandidates: [], counts: {}, recent: [], newItemsCount: 0, totalItemsCount: 0, totalCount: 0, weekly: null, week: null, stats: {} }`;

let count = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      patch(full);
    }
  }
}

function patch(file) {
  let content = fs.readFileSync(file, 'utf8');
  const orig = content;

  // 替换之前 patch 加的简单 null check
  content = content.replace(
    /return NextResponse\.json\(\{ ok: true, data: \[\], count: 0 \}\);/g,
    `return NextResponse.json(${COMMON_EMPTY});`
  );

  if (content !== orig) {
    fs.writeFileSync(file, content, 'utf8');
    count++;
  }
}

walk(API_DIR);
console.log(`[patch-null-check-universal] patched ${count} files`);