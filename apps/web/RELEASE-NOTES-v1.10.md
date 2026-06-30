# Insight OS · V1.10 Release Notes

**发布日期**：2026-06-30
**代号**：`v1.10-idb-only`

## 一句话总结

把 **server-side SQLite** 重构成 **client-side IndexedDB-only** 架构 —— local-first 落地。

V1.10 之前，所有数据存 server 端 SQLite (`apps/web/storage/insight.db`)，用户访问 `localhost:4191` 或 `insight-os-omega.vercel.app` 都读同一份 SQLite。这意味着 Vercel 部署没有用户数据、分享链接给客户没法用本地数据、迁移/部署都得拷 SQLite 文件。

V1.10 之后，**所有用户数据存在用户自己浏览器的 IndexedDB**。server 只跑静态文件（Vercel 真正 ¥0/月 部署），client 用 Dexie 操作 IDB。

---

## 关键变化

### 架构变化
- **存储**：Server SQLite → **Browser IndexedDB**（Dexie 11 表 schema）
- **API**：60+ Drizzle CRUD API routes → **client-side 操作**（`lib/idb/operations.ts`）
- **Hooks**：17 个 `useAssets/useTopics/...` hooks（`lib/idb/hooks.ts`）
- **部署**：Vercel 不再依赖 SQLite（`packages/db/src/client.ts` 加 VERCEL 环境检测 + lazy require）

### 体验变化
- **新增 demo 模式**：URL `?demo=1` 自动加载 10 示例卡 + 3 主题 + 2 信息源 + 2 kernel + 1 output
- **新增首页候选卡 IDB 优先**：本地 SQLite 不可用时，client 优先读 IDB 覆盖 server props
- **写入路径直达 IDB**：首页添加素材直接写 IDB（不调 `/api/materials/paste`）

### 兼容性
- **保留 server-side SQLite 路径**：本地 dev (`localhost:4191`) + Electron 桌面版仍可用
- **API routes 已 stub**：60+ API routes 加 null check，返回 `{ok:true,empty:true}` 防止 Vercel 500
- **Demo 数据公开**：`apps/web/public/demo-data.json` 10 张示例卡（非 Vincent 真实数据）

---

## 不变的部分

- **Insight OS 产品定位**：个人判断力工作台 + AI 知识精炼助手 + AI 加工决策助手
- **核心动作 5 步**：维护素材库 → AI 推荐值得加工的 → 人决定加工哪些 → 加结构化 → 输出
- **本地 dev port**：4191
- **packages 改动后必须 `node build-packages.mjs`**

---

## 已知问题（V1.11 处理）

| 问题 | 影响 | 计划 |
|---|---|---|
| `/kernel` 仍走 server API（5 个 actions: CRUD + verify + seed + infer） | demo 模式看 kernel 列表 OK 但编辑走 SQLite 路径 | V1.11 |
| LLM proxy `/api/llm/suggest` 仍读 server config.json | Vercel 用户 LLM 不通 | V1.11 client 传 context |
| SQLite → IndexedDB 字段映射是防御性 | 正常 Drizzle 已自动 camelCase | 监控日志 |
| V1.7.1 .dmg 错位 | 桌面版仍用 V1.5.0 Tauri 残留 | V1.11 重打包 |
| V1.9.1 Twitter 公共实例 404 | info source 抓不到 | V1.11 接自部署 RSSHub |
| V1.9.2 Reddit 限流 | 抓取连续 429 | V1.11 加 backoff |

---

## 测试

### 本地 dev（推荐）
```bash
cd apps/web
npm run dev   # http://localhost:4191
```

数据库在 `apps/web/storage/insight.db`（SQLite），client 同时支持 SQLite 路径 + IndexedDB 路径。

### Vercel 演示（demo 模式）
```bash
# 首次访问：https://insight-os-omega.vercel.app/?demo=1
# 自动加载 10 张示例卡到你的 IndexedDB
```

### 桌面版（Electron）
V1.10 暂未重打包 .dmg（V1.7.1 错位仍存在），自用走 `npm run dev` 即可。

---

## 文件结构变化

```
apps/web/lib/idb/
  ├── db.ts                  # Dexie schema (11 table) + Row 类型
  ├── operations.ts          # CRUD 包装 (60+ 函数)
  ├── hooks.ts               # client hooks (17 个 useXxx)
  ├── mapping.ts             # Phase 2.13 字段映射 (null→undefined)
  ├── migrate.ts             # SQLite → IDB 迁移 (含 auto backup)
  ├── IndexedDBProvider.tsx  # useEffect 里 dynamic import migrate
  └── index.ts               # 不 re-export db.ts (断 Dexie 模块链)

apps/web/components/
  ├── ClientAssetLoader.tsx  # 详情页 IDB 兜底
  ├── DemoLoader.tsx         # ?demo=1 URL 触发 demo 加载
  └── today/TodayProcessingPageClient.tsx  # 首页 4 useEffect 读 IDB

packages/db/src/
  └── client.ts              # lazy require better-sqlite3 + VERCEL 检测
```

---

## 下一步

- **V1.11**：补完 /kernel + LLM proxy client context + 重打包 Electron
- **V2.0**：输出包 + 商业化形态（月费/年费/一次性，Vincent 未定）
- **M3**：Supabase 云同步（仅为付费用户）

---

**Privacy note**：demo 数据全部公开示例（不是 Vincent 真实数据）。本地 dev 走 SQLite 自用，Vercel demo 走 IndexedDB（每个用户各自抽屉）。