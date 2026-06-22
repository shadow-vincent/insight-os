# Insight Asset OS · V1.2.1

紧急修复 V1.2.0 安装后打开应用黑屏的问题。

## 🚨 这次必须升

V1.2.0 用户反馈：**安装后打开应用就黑屏**（窗口一片黑 / 看到错误页面 / 几秒后退应用）。**V1.2.1 修好**。

## 🐛 Root Cause

`better-sqlite3` native module 在 V1.2.0 打包时**没 rebuild 成 Electron 32 的 ABI**：

| 项目 | V1.2.0 实际 | V1.2.1 修 |
|---|---|---|
| 系统 Node.js（build 用） | 23.x (ABI 131) | — |
| Electron 32 内置 Node.js（packaged 跑）| 20.x (ABI 128) | — |
| better-sqlite3 编译 | ❌ ABI 131 | ✅ ABI 128 |
| next-server 启动 | 端口能 LISTEN，但 SSR 100% 失败 | 正常返回 HTTP 200 |
| 用户看到的 | 错误页面 + 深色 backgroundColor → "黑屏" | 正常浅色应用 |

**为什么会"看着像黑屏"**：
1. `backgroundColor: '#0a0e1a'`（深色）—— 加载前显示黑底
2. `waitForPort()` 只检测端口 LISTEN，next-server 启了就过——但 ABI 不匹配时 SSR 100% 500
3. next-server stderr 没暴露给用户——用户看不到"ABI 不匹配"的具体原因
4. catch err 直接 `app.quit()` —— 没有任何错误提示

## ✅ V1.2.1 修法（4 件套）

1. **build 流程串 `rebuild:native`** — `npm run build:desktop` 现在自动 rebuild better-sqlite3 成 Electron ABI
2. **`waitForHttpOk()` 新增** — waitForPort 后再 HTTP 探测 `/api/health` 非 5xx 才开 window
3. **`backgroundColor` 改浅色** — `#0a0e1a` → `#f7f9fc`，跟 app shell 一致，加载失败也不黑屏
4. **`dialog.showErrorBox()` 错误对话框** — catch err 时弹具体诊断（ABI / 端口 / web-pkg）

## 🔬 验证

修复后跑 packaged 模式 next start：
- `curl /` → **HTTP 200**（之前 500）
- `curl /api/graph` → **HTTP 200**（之前 500）
- next-server stderr → **完全空**（之前 `ERR_DLOPEN_FAILED`）

## 🚀 升级方式

如果你已装 V1.2.0：

1. 下载 `Insight OS-1.2.1-arm64.dmg`
2. **先卸载 V1.2.0**：`/Applications/Insight OS.app` 拖入废纸篓
3. 双击挂载 .dmg → 把 `Insight OS.app` 拖入 `/Applications/`
4. 第一次启动运行 Gatekeeper 修法（如果弹窗）：
   ```bash
   xattr -cr '/Applications/Insight OS.app'
   codesign --force --deep --sign - '/Applications/Insight OS.app'
   open '/Applications/Insight OS.app'
   ```
5. **数据保留**：`~/Library/Application Support/InsightOS/` 不变，资产/写作配置/历史全部保留

## 💡 给打包者（自己）

V1.2.2+ 之后必须保证：
- **永远先跑 `npm run rebuild:native` 再 `electron-builder`**
- build:desktop 已串好这一步，不用手动跑
- 加新 native module 时也要 rebuild（比如 sharp / bcrypt / canvas）

## 🛠️ 其他改进

- main.js `waitForHttpOk()` 在所有 packaged 用户场景下都生效（不限于 ABI 问题）
- 错误对话框让以后 native module / 端口冲突等问题**第一次启动就能看到原因**，不用猜

## 💾 数据安全（重要）

**升级 V1.2.0 → V1.2.1 不会丢任何数据**：

- ✅ macOS 直接覆盖 `/Applications/Insight OS.app` 即可（**不需要先卸载**）
- ✅ `~/Library/Application Support/InsightOS/` 整个目录不受影响
- ✅ 所有资产卡 / 主题 / 反馈 / 写作配置 / 输出历史 → **完整保留**

底层逻辑（main.js 第 148-151 行）：
```js
const newDb = path.join(storageDir, 'insight.db');
if (fs.existsSync(newDb)) {
  console.log('[main] userData db exists, skip migration');
  return;
}
```
启动时检查 userData db 存在就 skip migration，所以 V1.0/V1.1.0/V1.1.1/V1.2.0 累积的 db **永远不会被覆盖**。

**操作步骤**：
1. 下载 `Insight OS-1.2.1-arm64.dmg`
2. 双击挂载 → 把 `Insight OS.app` **拖到 `/Applications/`** 直接覆盖
3. macOS 提示"已有版本，是否替换" → 选 **替换**
4. 启动前如弹 Gatekeeper 警告，跑：
   ```bash
   xattr -cr '/Applications/Insight OS.app'
   codesign --force --deep --sign - '/Applications/Insight OS.app'
   open '/Applications/Insight OS.app'
   ```
5. 打开应用 → 数据齐全，**黑屏问题修复**

## 📦 技术细节

```bash
# 验证修复
$ file apps/web/node_modules/better-sqlite3/build/Release/better_sqlite3.node
Mach-O 64-bit bundle arm64

$ npm run rebuild:native
> @insight-os/web@0.1.0 rebuild
> npx electron-rebuild -f -w better-sqlite3 -v 32.2.5
Building modules: better-sqlite3
✔ Rebuild Complete

$ file apps/web/node_modules/better-sqlite3/build/Release/better_sqlite3.node
# → 重新编译后 ABI 变成 128（之前是 131）
```

---

**这是 hotfix release**，功能与 V1.2.0 完全一致，仅修桌面 .app 启动 bug。