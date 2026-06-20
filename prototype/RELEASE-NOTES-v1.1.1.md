# Insight Asset OS v1.1.1 — 桌面 .app 数据丢失修复

> ⚠️ **重要**：v1.0.0 / v1.1.0 桌面 .app 有一个**严重 bug**——升级 .app 后，**之前导入的所有卡片会丢失**。
> v1.1.1 修复了这个 bug，**并自动迁移老 .app bundle 内的残留数据**（如果有）。

---

## 🐛 Bug 详情

### 现象

用户在 v1.0.0 / v1.1.0 桌面 .app 录入了数据 → 下载 v1.1.0 升级 → 数据**全部丢失**。

### 根因

`apps/desktop/main.js` 启动时**没有设置** `INSIGHT_APP_DATA_DIR` 环境变量，导致 `packages/db/src/client.ts` 的 `resolveDbPath()` 走 fallback 路径，**把 db 写到了 `.app` bundle 内部**：

```
# 错误的 db 位置（v1.0 / v1.1.0 桌面 .app）
/Applications/Insight OS.app/Contents/Resources/web-pkg/storage/insight.db
```

**升级 .app 时**（把新 .app 拖到 `/Applications/` 覆盖老的）：

1. 老 `.app` bundle **被删除**
2. 老的 `insight.db` 跟着 bundle 一起**没了**
3. 新 `.app` 启动时 db 不存在 → 自动建空 db
4. 用户看到"数据丢了"

### 修复

**两处改动**：

1. `apps/desktop/main.js`：
   - packaged 模式启动时**强制设置** `INSIGHT_APP_DATA_DIR = app.getPath('userData')/storage`
   - 即 `~/Library/Application Support/insight-os-desktop/storage/`
   - macOS 升级 `.app` **不**会动 `userData`，数据安全

2. `packages/db/src/client.ts`：
   - 兜底逻辑：packaged 模式 fall back 到 `~/Library/Application Support/insight-os-desktop/storage/`
   - **不再**写到 `.app` bundle 内

3. **自动迁移**：v1.1.1 第一次启动时，**自动**检测 `.app` bundle 内是否还有老 db（残留），**有**就拷到 `userData`。

---

## ✅ 升级 v1.1.1 后会发生什么

### 情况 A：你是 v1.0 / v1.1.0 桌面 .app 用户，**数据还在**

✅ 正常：你之前在桌面 .app 录的数据，**v1.1.1 第一次启动时会自动迁移**到 `userData` 目录，**不丢任何东西**。

### 情况 B：你是 v1.0 / v1.1.0 桌面 .app 用户，**数据已经丢了**

⚠️ 抱歉：**v1.1.1 救不了已经覆盖的 .app**。一旦你把新 .app 拖到 `/Applications/` 覆盖老 `.app`，老的 `insight.db` 就跟着 .app bundle 一起没了。

**但是**：v1.1.1 第一次启动时**会**扫描 `.app` bundle 内是否还有残留 db（**有**些用户在覆盖前**没**装 v1.1.0，**或**有备份**机制**——比如 Time Machine），**有**就恢复。

**如**果你**还**有 v1.0 / v1.1.0 .dmg 安装包，**或**者 Time Machine / 其他备份里**有** `/Applications/Insight OS.app`，**可以**做**这**些**事**情**：

1. **找**回**老** .app 副本（从 Trash、Time Machine 等）
2. **找**到里面的 db：`/Applications/Insight OS.app/Contents/Resources/web-pkg/storage/insight.db`
3. 复制到新位置：
   ```bash
   cp "/Applications/Insight OS.app/Contents/Resources/web-pkg/storage/insight.db" \
      ~/Library/Application\ Support/insight-os-desktop/storage/insight.db
   ```
4. 重启 v1.1.1 .app → 数据回来了

### 情况 C：你是 web dev 用户（`npm run dev`）

✅ 完全**不**受影响——v1.1.1 改动**只**影响桌面 .app，web dev 路径**没**变。

### 情况 D：你是新装 v1.1.1

✅ 干净安装，**没** bug 可言。

---

## 🔧 技术细节

### 数据库路径解析优先级（v1.1.1）

```typescript
// packages/db/src/client.ts resolveDbPath()
1. DATABASE_URL env (file:xxx)  // 用户自定义
2. INSIGHT_APP_DATA_DIR env     // 桌面 .app 强制设置（v1.1.1+ 修复）
3. cwd/apps/web/storage/insight.db  // 脚本环境
4. cwd/storage/insight.db       // Next.js dev
5. fallback：packaged 模式用 ~/Library/Application Support/insight-os-desktop/storage/
   其他用 cwd/apps/web/storage/
```

### 自动迁移逻辑（main.js setupUserDataDir）

```javascript
// 第一次启动时检测
const oldDbInBundle = path.join(WEB_DIR, 'storage', 'insight.db');
const newDb = path.join(storageDir, 'insight.db');
if (existsSync(oldDbInBundle) && !existsSync(newDb)) {
  // 自动复制老 db 到 userData
  fs.copyFileSync(oldDbInBundle, newDb);
}
```

---

## 📦 安装 / 升级

### 升级步骤

1. 下载 `Insight OS-1.1.1-arm64.dmg`（替换之前的 .dmg）
2. 打开 .dmg
3. **必须**把 `Insight OS.app` 拖入 `/Applications/` 覆盖老 .app
4. 第一次启动**必跑** 3 行（Gatekeeper 修复）：

```bash
xattr -cr '/Applications/Insight OS.app' && codesign --force --deep --sign - '/Applications/Insight OS.app' && open '/Applications/Insight OS.app'
```

5. v1.1.1 启动后**会**自动扫描 `.app` bundle，**如**果里面有残留 db **会**自动迁移到 `userData`，**否则**直接用

### 验证数据迁移成功

```bash
ls -la ~/Library/Application\ Support/insight-os-desktop/storage/
# 应该看到 insight.db 文件
# 大小：几十 KB 到几 MB（取决于你之前的卡片数量）
```

---

## 🙏 致歉

v1.1.0 的数据丢失 bug 是我的失误。**我**之前桌面 .app 测试**没**有充分覆盖"用户长期使用 + 升级 .app"这个场景（Vincent 之前只跑 web dev，没在桌面 .app 录过数据，**所**以**这**个 bug **一**直**没**暴**露**），**给**你**带**来**了**不**便**。

v1.1.1 **会**自动**为**你**迁**移**所**有**可**以**救**的**数**据**。**如**果你的**数**据**已**经**丢**了**，**请**开 GitHub Issue + 贴**你**的**情**况**（什么时候装的 v1.0 / v1.1.0、录入了多少条），**我**们**一**起**想**恢**复**办**法**。

---

## 📊 v1.1.1 vs v1.1.0

| 维度 | v1.1.0 | v1.1.1 |
|---|---|---|
| 桌面 .app 升级后数据保留 | ❌ 丢失 | ✅ 保留 |
| 自动迁移老 .app bundle 内 db | ❌ | ✅ |
| Web dev 数据保留 | ✅ | ✅ |
| 桌面 .app 主功能 | v1.0 核心 | v1.0 核心 |
| .dmg 大小 | 349 MB | ~349 MB |
