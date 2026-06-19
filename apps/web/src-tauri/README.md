# Tauri 桌面 App 集成

## 架构

```
┌─ Insight OS.app (macOS)
│
├─ Tauri WebView (主窗口)
│   └─ 加载 http://localhost:4191 (或 standalone build 静态文件)
│
├─ Sidecar: Next.js prod server (后台进程)
│   └─ 监听 4191，serve Next build 产物
│
└─ 共享 ~/.local/share/com.insightos.app/ (Linux)
       ~/Library/Application Support/com.insightos.app/ (macOS)
       %APPDATA%\com.insightos.app\ (Windows)
       └─ config.json / insight.db
```

**关键决策**：
- **WebView** + **系统 webview**（macOS 用 WKWebView，不打包 Chromium）→ 体积小（~10MB vs Electron 80MB+）
- **Next.js standalone build** + **sidecar** 启动 → 单个 .app 包含所有东西
- **数据本地**（Application Support 目录）→ 隐私好，离线可用

## 开发

### 1. 装依赖

```bash
# 1) Rust toolchain (Tauri 2 需要)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# 2) Tauri CLI
cargo install tauri-cli --version "^2.0" --locked

# 3) macOS 额外 (Windows / Linux 不需要)
xcode-select --install
```

### 2. Dev 模式（热更新）

```bash
# 在项目根
cargo tauri dev
# 或
cd apps/web && npm run tauri:dev
```

会自动：
- 启动 Next.js dev server (npm run dev)
- 打开 Tauri 窗口加载 http://localhost:4191
- 代码改动 → WebView 自动 HMR

### 3. 生产 build

```bash
# 1) 先 build Next.js standalone
npm run build
# → apps/web/.next/standalone/apps/web/

# 2) 用 Tauri 打 .dmg
cd apps/web && npm run tauri:build
# → apps/web/src-tauri/target/release/bundle/dmg/Insight Asset OS_1.0.0_aarch64.dmg
```

## 文件结构

```
apps/web/
├── src-tauri/                      # Tauri 项目
│   ├── Cargo.toml                  # Rust 依赖
│   ├── tauri.conf.json             # Tauri 配置
│   ├── build.rs                    # Rust build script
│   ├── src/
│   │   ├── main.rs                 # 入口
│   │   └── lib.rs                  # 业务逻辑 + tauri::command
│   ├── capabilities/
│   │   └── default.json            # 权限声明
│   └── icons/                       # 应用图标（占位，需替换）
├── .next/standalone/apps/web/       # Next.js standalone build 产物
└── package.json                    # + tauri / tauri:dev / tauri:build scripts
```

## 配置说明

### `tauri.conf.json` 关键字段

- `build.devUrl`: dev 模式 WebView 加载地址（`http://localhost:4191`）
- `build.frontendDist`: 生产 build 加载的静态文件目录（`../.next/standalone/apps/web`）
- `app.windows[0]`: 主窗口配置（标题/尺寸/最小尺寸）
- `app.security.csp`: Content Security Policy（必须允许 `http://localhost:*` 因为 dev 模式走 devUrl）
- `bundle.targets`: 打包目标（`dmg` + `app` for macOS）
- `plugins.updater`: 自动更新（GitHub Releases）

### `capabilities/default.json` 权限

- `core:default` / `core:app:default` / `core:window:default`：基础权限
- `shell:allow-open`：允许打开外部 URL
- `updater:default`：自动更新

## 调试

### Tauri 窗口 DevTools

dev 模式：右键 → Inspect Element
或 `tauri::WebviewWindow::open_devtools()`

### Rust 日志

```bash
RUST_LOG=debug cargo tauri dev
```

### macOS 签名

第一次发 .dmg 需要 Apple Developer ID：
1. 申请 Apple Developer ID ($99/year)
2. 在 Keychain 装 developer cert
3. `tauri.conf.json` 里加 `signingIdentity: "Developer ID Application: Your Name (TEAMID)"`
4. `cargo tauri build` 自动签名

未签名 .dmg 用户安装时需要 Gatekeeper 绕过（`xattr -d com.apple.quarantine /Applications/Insight\ Asset\ OS.app`）。

## 隐私

- 配置文件：`~/Library/Application Support/com.insightos.app/config.json`
- 数据库：`~/Library/Application Support/com.insightos.app/insight.db`
- **不向任何远程服务器上传数据**（除非用户主动配 LLM API）

## 已知限制

- 第一次 cargo build 慢（要编译 webview2-com、tauri 等，约 5-10 分钟）
- macOS 11+ 最低要求（Big Sur 之前的系统不支持 WKWebView 现代 API）
- Linux 需装 webkit2gtk-4.1（apt install webkit2gtk-4.1-dev）
- Windows 需装 WebView2 Runtime（Win11 自带，Win10 要装）

## 升级路径

- v1.0: 基础桌面 app + macOS .dmg
- v1.1: 自动更新（GitHub Releases）
- v1.2: Windows .msi + Linux .AppImage
- v1.3: 系统托盘 + 快捷键
- v2.0: 多窗口 + 离线 LLM (llama.cpp 集成)
