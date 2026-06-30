'use client';

/**
 * Demo 数据加载器
 *
 * 触发：URL 带 ?demo=1 时自动跑
 * 行为：
 *   1. dynamic import Dexie（不在 module load 时加载）
 *   2. fetch /demo-data.json
 *   3. 写入用户浏览器 IndexedDB（11 张表）
 *   4. 标记 localStorage demo-loaded=true
 *   5. 跳转 /
 *
 * 用途：分享现场 demo 用，让 Vercel URL 看起来有真实数据
 *       示例数据是公开的（不是 Vincent 私人笔记）
 */

import { useEffect } from 'react';

export function DemoLoader() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') !== '1') return;

    // 已加载过 → 跳转
    if (localStorage.getItem('demo-loaded') === 'true') {
      // 不重复加载
      return;
    }

    (async () => {
      try {
        const DexieModule = await import('dexie');


        const db = await getSharedDexie();
const res = await fetch('/demo-data.json');
        if (!res.ok) throw new Error('demo-data.json fetch failed');
        const data = await res.json();

        await db.transaction(
          'rw',
          [db.assets, db.outputs, db.feedback, db.topics, db.assetTopics,
           db.sources, db.sourceItems, db.topicKernels, db.userKernels,
           db.writingDrafts, db.writingVersions],
          async () => {
            if (data.assets?.length) await db.assets.bulkPut(data.assets);
            if (data.outputs?.length) await db.outputs.bulkPut(data.outputs);
            if (data.feedback?.length) await db.feedback.bulkPut(data.feedback);
            if (data.topics?.length) await db.topics.bulkPut(data.topics);
            if (data.assetTopics?.length) await db.assetTopics.bulkPut(data.assetTopics);
            if (data.sources?.length) await db.sources.bulkPut(data.sources);
            if (data.sourceItems?.length) await db.sourceItems.bulkPut(data.sourceItems);
            if (data.topicKernels?.length) await db.topicKernels.bulkPut(data.topicKernels);
            if (data.userKernels?.length) await db.userKernels.bulkPut(data.userKernels);
            if (data.writingDrafts?.length) await db.writingDrafts.bulkPut(data.writingDrafts);
            if (data.writingVersions?.length) await db.writingVersions.bulkPut(data.writingVersions);
          }
        );

        localStorage.setItem('demo-loaded', 'true');
        // 跳转去除 ?demo=1 参数
        window.location.href = '/';
      } catch (e) {
        console.error('[DemoLoader] failed:', e);
      }
    })();
  }, []);

  return null;
}