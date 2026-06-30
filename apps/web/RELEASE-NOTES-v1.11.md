# Insight OS · V1.11 Release Notes

**发布日期**：2026-06-30
**代号**：`v1.11-full-client-side`

## 一句话总结

把 V1.10 留作"fallback"的 4 个 server API 路径全部改成 **client IDB 优先** —— Vercel demo 现在能 100% 演示（编辑/同步/加工/重打包）。

---

## 关键变化

### 1. /kernel 全功能 client side
- **编辑/新建**（KernelEditor）→ 写 IDB `userKernels` 表
- **归档/恢复/标记「重新想过了」** → IDB update
- **种子预置**（5 default + 6 six-layers）→ 直接 client 端写 IDB（不再调 server）
- **保存 infer 候选** → 写 IDB
- **唯一限制**：infer-from-assets 仍要 LLM（Vercel demo 配 API key 后 work；不配则提示去 settings）

### 2. /sources sync client side RSS 抓取
- **新模块** `lib/idb/client-rss.ts`：
  - 解析 RSS 2.0 (`<item>`)
  - 解析 Atom (`<entry>`)
  - 解析 Reddit JSON (`.rss` → `.json` 转换)
- 抓到的 item 直接写 IDB `sourceItems` 表
- 同步完成后 source 表自动更新 `lastFetchedAt / newItemsCount / totalItemsCount / lastError`

### 3. 添加素材 + LLM 加工
- **新模块** `operations.ts: callLLMDirect()` — client 端直调 OpenAI 兼容 API
- **新模块** `operations.ts: clientIntakeLightCard()` — 素材 → LLM 评分 → 升级 candidate
- **handleSubmit 流程**：
  1. 读 IDB `preferences.llm-config`
  2. 有 API key → 调 LLM 抽 1-3 张 light 卡（写 IDB，状态 candidate）
  3. 无 API key → 写一条 inbox 卡（等后续 LLM 配置）
- 评分 ≥75 自动标 `isKernelCandidate: 1`

### 4. 重打包 Electron V1.10
- `desktop/package.json` 版本：1.7.1 → 1.10.0
- 重 build `.app`（1.5GB，arm64）
- 启动测试：port 3100 返回 200 + 今日加工 渲染
- **旧 V1.7.1 .dmg 已替换**（之前错位是 Tauri 残留，V1.10 build 是真正的 Electron Insight OS）

---

## 不变的部分

- **V1.10 架构**：所有数据存用户浏览器 IndexedDB
- **Vercel demo URL**：`https://insight-os-omega.vercel.app/?demo=1`
- **本地 dev port**：`npm run dev` → 4191（web）/ `npm run dev` (desktop) → 3100
- **packages 改动后必须 `node build-packages.mjs`**

---

## 已知问题（V1.12 处理）

| 问题 | 影响 | 计划 |
|---|---|---|
| V1.9.1 Twitter 公共实例 404 | info source 抓不到 | V1.12 自部署 RSSHub |
| V1.9.2 Reddit 限流 | 抓取连续 429 | V1.12 backoff |
| /kernel infer-from-assets 需 LLM | 没 API key 失败 | V1.12 提供 mock infer |
| `/api/inbox/intake` 仍写 server SQLite | 本地 dev OK，Vercel 上"完整 intake" 不可用 | V1.12 client-side 完整版 |

---

## 测试

### Vercel demo（推荐分享）
```bash
访问 https://insight-os-omega.vercel.app/?demo=1
自动加载 demo 数据 → 所有 7 页可操作
```

### 本地 dev
```bash
cd apps/web
npm run dev   # http://localhost:4191
```

### 桌面版
```bash
# 自用（dev 模式）
cd apps/desktop && npm run dev   # http://localhost:3100

# 打包 .app
cd apps/desktop && npx electron-builder --mac --dir
open "dist/mac-arm64/Insight OS.app"
```

---

## 文件结构

```
新增/改造：
apps/web/lib/idb/
  ├── client-rss.ts           # V1.11.2 客户端 RSS 抓取 + 解析
  ├── kernel-seeds.ts         # V1.11.1 kernel 预置模板 (5+6)
  └── operations.ts           # V1.11.3 callLLMDirect + clientIntakeLightCard

apps/web/components/
  └── KernelEditor.tsx        # V1.11.1 写 IDB 优先

apps/web/app/kernel/
  └── KernelListClient.tsx    # V1.11.1 5 actions 全部 IDB

apps/web/app/sources/
  └── SourcesClient.tsx       # V1.11.2 handleSync/handleSyncAll 走 client RSS

apps/web/components/today/
  └── TodayProcessingPageClient.tsx  # V1.11.3 handleSubmit LLM 评分

apps/desktop/
  └── package.json            # V1.11.4 1.7.1 → 1.10.0
```

---

## 下一步

- **V1.12**：自部署 RSSHub + Reddit backoff + /kernel infer mock + 完整 client intake
- **V2.0**：输出包 + 商业化形态（月费/年费/一次性，Vincent 未定）
- **M3**：Supabase 云同步（仅为付费用户）

---

**Privacy note**：demo 数据全部公开示例（不是 Vincent 真实数据）。本地 dev 走 SQLite 自用，Vercel demo 走 IndexedDB（每个用户各自抽屉）。API key 存在用户浏览器 IDB，server 不存。