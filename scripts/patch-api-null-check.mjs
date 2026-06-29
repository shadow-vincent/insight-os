#!/usr/bin/env node
/**
 * 批量给 apps/web/app/api/ 下所有 .ts 文件加 getDb() null check
 *
 * 模式：`const db = getDb();` 后面加 `if (!db) return NextResponse.json({...});`
 *
 * V1.10: Vercel serverless 下 getDb() 返回 null，API routes 必须 early return
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(__dirname, '../apps/web/app/api');

const EMPTY_RESPONSE = `
    // V1.10: Vercel serverless 下 db 不可用，返回空
    return NextResponse.json({ ok: true, data: [], count: 0 });
  }`;

let count = 0;
let errors = [];

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

  // 模式 A: `const db = getDb();`（不在 try/catch 内）
  const patternA = /(\s+)(const db = getDb\(\);)(\n)/g;
  content = content.replace(patternA, (match, ws, decl, nl) => {
    return `${ws}${decl}${nl}${ws}if (!db) return NextResponse.json({ ok: true, data: [], count: 0 });${nl}`;
  });

  if (content !== orig) {
    fs.writeFileSync(file, content, 'utf8');
    count++;
  }
}

walk(API_DIR);
console.log(`[patch-api-null-check] patched ${count} files`);