#!/usr/bin/env node
/**
 * 批量为现有资产卡归类
 *
 * 流程: 读所有 assets → 调 LLM → 写 asset_topics
 *
 * 用法: node scripts/classify-all.mjs [--limit N]
 *
 * 配置文件查找顺序:
 *   1) INSIGHT_CONFIG_PATH 环境变量
 *   2) <monorepo-root>/storage/config.json
 *   3) <monorepo-root>/apps/web/storage/config.json（Next.js dev 写入的位置）
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// 显式查找 config.json（脚本环境下 cwd 不一定对）
const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, '..');

function findConfigPath() {
  if (process.env.INSIGHT_CONFIG_PATH) {
    return process.env.INSIGHT_CONFIG_PATH;
  }
  const candidates = [
    join(MONOREPO_ROOT, 'storage', 'config.json'),
    join(MONOREPO_ROOT, 'apps', 'web', 'storage', 'config.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

const configPath = findConfigPath();
if (configPath) {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (config.llm) {
      if (config.llm.baseUrl) process.env.LLM_BASE_URL = config.llm.baseUrl;
      if (config.llm.apiKey) process.env.LLM_API_KEY = config.llm.apiKey;
      if (config.llm.model) process.env.LLM_MODEL = config.llm.model;
      console.log(`  配置: ${configPath.replace(MONOREPO_ROOT + '/', '')}`);
    }
  } catch (e) {
    console.error(`  ✗ 读取配置失败: ${e.message}`);
  }
} else {
  console.error('  ⚠️  未找到 config.json，将依赖环境变量');
}

// 必须在设置环境变量后才能 import 这些模块（它们读 process.env）
const { getDb, assets, topics, assetTopics } = await import('@insight-os/db');
const { eq } = await import('drizzle-orm');
const { callLLM } = await import('@insight-os/llm');
const { isLLMConfigured } = await import('@insight-os/core');

const limitArg = process.argv.find(a => a.startsWith('--limit'));
const LIMIT = limitArg ? Number(process.argv[process.argv.indexOf(limitArg) + 1]) : 100;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Insight OS · 批量主题归类');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (!isLLMConfigured()) {
  console.error('  ✗ LLM 未配置，请先在 .env 或 /settings 配置');
  process.exit(1);
}

const db = getDb();

// Debug: 确认 db 路径
const Database = (await import('better-sqlite3')).default;
const rawDb = new Database('apps/web/storage/insight.db', { readonly: true });
const debugCount = rawDb.prepare('SELECT COUNT(*) as n FROM assets').get();
console.log(`  [debug] 直接读 db: ${debugCount.n} 张资产`);
rawDb.close();

// 1. 加载主题
const allTopics = db.select().from(topics).orderBy(topics.sortOrder).all();
if (allTopics.length === 0) {
  console.error('  ✗ topics 表为空，请先跑 node scripts/seed-topics.mjs');
  process.exit(1);
}

console.log(`  主题: ${allTopics.length} 个`);
console.log(`  上限: ${LIMIT} 张资产`);
console.log('');

const topicList = allTopics.map(t => `- ${t.id}: ${t.name} (${t.description ?? ''})`).join('\n');

const systemPrompt = `你是 Vincent 的研究助理。Vincent 是一名独立管理咨询顾问。

**你的任务**：判断一张管理洞察资产卡属于哪些主题，输出每个主题的置信度 (0-100)。

**规则**：
1. **一张卡可以属于多个主题**（最多 3 个）
2. **置信度**：
   - 90-100: 强相关
   - 60-89: 中等相关
   - 30-59: 弱相关（可选）
3. **宁缺毋滥**：不确定的主题不选（不输出 30 以下的）
4. **只输出 JSON 数组**，不要其他文字`;

async function classifyOne(asset) {
  const userPrompt = `判断这张资产卡属于哪些主题：

## 资产卡
- 标题: ${asset.title}
- 一句话洞察: ${asset.oneSentenceInsight ?? '(无)'}
- 反常识判断: ${asset.antiCommonSense ?? '(无)'}
- 关键词: ${asset.tagsJson}

## 候选主题
${topicList}

## 输出 JSON 数组
[{ "topic_id": "topic_xxx", "confidence": 85 }]`;

  const result = await callLLM(
    systemPrompt,
    userPrompt,
    { temperature: 0.2, maxTokens: 300 }
  );

  if (!result.ok || !result.data) return [];

  // 容错：可能直接是数组，也可能在字段里
  let classifications = [];
  if (Array.isArray(result.data)) {
    classifications = result.data;
  } else if (typeof result.data === 'object' && result.data) {
    classifications = result.data.classifications
      ?? result.data.topics
      ?? result.data.results
      ?? [];
  }

  const validTopicIds = new Set(allTopics.map(t => t.id));
  return classifications
    .filter(c => c && typeof c === 'object' && validTopicIds.has(c.topic_id))
    .filter(c => typeof c.confidence === 'number' && c.confidence >= 30)
    .slice(0, 3);
}

async function main() {
  const allAssets = db.select().from(assets).where(eq(assets.type, 'asset')).all();
  const toClassify = allAssets.slice(0, LIMIT);

  console.log(`  待处理: ${toClassify.length} 张资产卡\n`);

  let success = 0;
  let failed = 0;
  let totalLinks = 0;
  const start = Date.now();

  for (let i = 0; i < toClassify.length; i++) {
    const asset = toClassify[i];
    try {
      const classifications = await classifyOne(asset);

      // 删旧关联
      db.delete(assetTopics).where(eq(assetTopics.assetId, asset.id)).run();

      // 写新关联
      const now = Math.floor(Date.now() / 1000);
      for (const c of classifications) {
        db.insert(assetTopics)
          .values({
            id: `at_${randomUUID().slice(0, 8)}`,
            assetId: asset.id,
            topicId: c.topic_id,
            confidence: Math.round(c.confidence),
            assignedBy: 'llm',
            createdAt: now,
          })
          .run();
      }

      success++;
      totalLinks += classifications.length;
      process.stdout.write(`  [${i + 1}/${toClassify.length}] ✓ ${asset.title.slice(0, 30)} (${classifications.length} 个主题)\n`);
    } catch (e) {
      failed++;
      process.stdout.write(`  [${i + 1}/${toClassify.length}] ✗ ${asset.title.slice(0, 30)}: ${e.message}\n`);
    }

    // 简单节流：每 5 张休息 1 秒
    if ((i + 1) % 5 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  成功: ${success} · 失败: ${failed} · 关联: ${totalLinks}`);
  console.log(`  耗时: ${elapsed}s`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

await main();
