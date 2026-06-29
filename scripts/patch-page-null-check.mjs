#!/usr/bin/env node
// Add getDb() null check to all apps/web/app/**/page.tsx files
// Pattern: find 'const db = getDb();' followed by db. usage
// Add: 'if (!db) return null;' after getDb()

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '../apps/web/app');

let count = 0;
let skipped = 0;
const errors = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'api') continue;
      walk(full);
    } else if (entry.name === 'page.tsx') {
      try {
        patch(full);
      } catch (e) {
        errors.push(`${full}: ${e.message}`);
      }
    }
  }
}

function patch(file) {
  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('if (!db)')) {
    skipped++;
    return;
  }

  if (!content.includes('const db = getDb()')) {
    skipped++;
    return;
  }

  const lines = content.split('\n');
  let newLines = [];
  for (let i = 0; i < lines.length; i++) {
    newLines.push(lines[i]);
    const trimmed = lines[i].trim();
    if (trimmed === 'const db = getDb();') {
      let nextLineIdx = i + 1;
      let nextLine = lines[nextLineIdx] || '';
      while (nextLineIdx < lines.length && nextLine.trim() === '') {
        nextLineIdx++;
        nextLine = lines[nextLineIdx] || '';
      }
      if (nextLine.includes('db.') && !nextLine.includes('try')) {
        const indent = lines[i].match(/^\s*/)?.[0] || '';
        newLines.push(`${indent}if (!db) return null;`);
      }
    }
  }

  content = newLines.join('\n');

  if (content !== fs.readFileSync(file, 'utf8')) {
    fs.writeFileSync(file, content, 'utf8');
    count++;
  } else {
    skipped++;
  }
}

walk(APP_DIR);
console.log(`[patch-page-null-check] patched ${count} files, skipped ${skipped}`);
if (errors.length > 0) {
  console.error('[errors]:');
  errors.forEach(e => console.error(`  ${e}`));
}