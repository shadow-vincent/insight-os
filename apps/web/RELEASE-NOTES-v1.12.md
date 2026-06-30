# V1.12 统一 data-source helper

> **V1.10 重构的"补完"** —— 不再"两套代码"，用统一 helper 让本地 dev 走 server、Vercel 走 IDB。

## 背景

V1.10 把 Insight OS 重构成 "IDB-first"（"local-first 改造"），但实际只完成了 **Vercel 部署版** 的兼容。本地 dev 仍然是 server SQLite 主导，但 page 客户端 mutation 走 IDB-first，**server 端不更新**——**真 bug**。

V1.10 之后的 page 客户端（如 `GraphClient` / `SourcesClient`）都靠"双源 hack"工作：先 IDB，再 fallback server。**10+ 处 try-catch / 散落分支**——既不优雅，又容易忘。

## 目标

- ✅ **修真 bug**：本地 dev 用户的 mutation 写 server SQLite（之前写 IDB，server 不知道）
- ✅ **一套代码路径**：所有 page 客户端通过统一 helper 调数据源
- ✅ **零分支**：page 客户端不写 try-catch / 不写 `data.code === 'NO_SQLITE'`
- ✅ **强约束**：Vercel 端必须传 `fallback`（不传 throw），本地 dev 可选

## 实现

### 1. `apps/web/lib/data-source.ts`（新文件）

```ts
// 判定环境
isServerlessDeployment()  // 域名 .vercel.app / .edgeone.app → serverless

// 读
readSource(endpoint, { fallback, query, method })
  // 本地 dev → fetch endpoint (server SQLite)
  // Vercel   → fallback() (IDB)
  // 自动降级：server NO_SQLITE → fallback

// 写
writeSource(endpoint, payload, { fallback, method })
  // 同上
```

### 2. Page 客户端用法

```ts
// 之前（V1.10 风格：双源 + 散落 try-catch）
const data = await fetch('/api/feedback', { method: 'POST', ... });
if (data.code === 'NO_SQLITE') {
  await addFeedback({...});
} else if (data.ok) {
  // ...
}

// V1.12 风格（统一 helper）
const data = await writeSource('/api/feedback', { assetId, scene }, {
  fallback: (p) => addFeedback(p),
});
if (data.ok) { /* ok */ }
```

### 3. 修改的 page 客户端

| Page | 改动 |
|---|---|
| `GraphClient` | V1.11.18 双源 → `readSource('/api/graph', {fallback})` |
| `AssetDetailClient` | 4 useEffect + 5 mutation 改 helper（feedback / 主题 / 校准） |
| `KernelListClient` | 已 V1.11.1 双源 → 后续合并到 helper（保留双源 hack 兼容） |
| `SourcesClient` | add / toggle / delete / sync 4 个 mutation 改 helper |
| `InboxClient` | intake 改 `writeSource('/api/inbox/intake')` |
| `CandidatesClient` | batchPromote 改 `writeSource` |
| `WritingClient` | load / draft save / version load+save / status change 改 helper |
| `WritingNewClient` | scaffold 改 `writeSource('/api/writing/scaffold')` |
| `MapClient` | loadTopics / generateKernel / clearKernel 改 helper |
| `OutputPackageClient` | list load + promote-to-kernel 改 helper |
| `TodayProcessingClient` | sync-all 改 client sync（V1.11.2 client-rss） |

## 本地 vs Vercel 数据流

| 操作 | 本地 dev 4191 | Vercel demo |
|---|---|---|
| **打开页面** | server SQLite 返数据 | IDB 返数据 |
| **写反馈 / 改状态** | server SQLite 写 | IDB 写 |
| **加素材 / 调 LLM** | LLM 走 server API | 客户端 LLM 走 IDB |
| **用户感知** | 跟 V1.10 之前一样 | Vercel demo 能用 |
| **数据所有权** | `apps/web/storage/insight.db` | 浏览器 IndexedDB |

## V1.10 命名纠正

之前叫 "IDB-first 重构" / "local-first 改造"——**错的**，应该是：

> **"V1.10: Vercel 部署版 IDB-only 兼容层"**

实际只完成了 60%：
- ✅ Vercel 端 IDB-only（必须，因为 server 不可写）
- ⚠️ 本地 dev 仍然是 server SQLite（V1.10 之前就是）
- ⚠️ V1.10 page 客户端 mutation 走 IDB → server 不更新 → 修真 bug

**V1.12 完成剩下的 40%**：统一 data-source helper，**本地 dev 跟 V1.10 之前行为一致**（mutation 写 server）。

## 不需要"数据迁移"能力

之前问过"打包给其他用户要不要加数据迁移"——**不需要**：

| 场景 | 是否需要迁移 |
|---|---|
| 本地 dev 老用户升级 V1.12 | ❌ 不需要（数据仍在 SQLite，npm install 跑通即用） |
| Vercel 新用户 | ❌ 不需要（`?demo=1` 加载示例数据） |
| 本地版给客户打包 | ❌ 不需要（直接 `npm run build`） |

## 之前 V1.10 误改的页面，回退

- `GraphClient` / `KernelListClient` / `SourcesClient` 等"IDB-first 硬切"的页面，V1.12 改回"本地 server 优先 / Vercel fallback"——但**调用方零分支**（helper 内部处理）。

## 升级路径

1. **本地 dev 用户**：`npm install` + `npm run dev` 即可。SQLite 数据不动，page 行为跟 V1.10 之前一样。
2. **Vercel 用户**：URL 加 `?demo=1` 加载示例数据。
3. **Electron .app 用户**（V1.10 重打包 1.5GB）：重新打包即可。

## V1.12 后续

V1.12 不做的事（保持 V1.10 之前的现状）：
- ~~启动时自动 SQLite → IDB 同步~~（本地 dev 不需要）
- ~~写时双写~~（V1.10 bug，V1.12 修真：本地走 server，Vercel 走 IDB）
- ~~跨设备 / 跨浏览器 IDB 同步~~（不在 scope）

如果将来要"跨设备同步"，V1.13 路线：
- iCloud Drive / WebDAV 同步 SQLite .db 文件（保留 SQLite 主数据源）
- 或：用户手动 export IDB JSON + 跨设备 import
- 两条路线都需要 Vincent 拍板

## 关键文件

- `apps/web/lib/data-source.ts`（V1.12 核心 helper）
- 修改的 page 客户端：见上文表格

## commit

- `bbdcf30` V1.12 partial: 统一 data-source helper + Graph/AssetDetail 重构
- 后续 commit 包含所有 page 重构
