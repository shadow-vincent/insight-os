# Insight OS Desktop App

macOS 桌面 app，基于 Electron 32 打包。包含 Next.js 15 全栈 + SQLite + LLM 集成。

## 下载

从 [GitHub Releases](https://github.com/shadow-vincent/insight-os/releases/latest) 下载最新 `.dmg`。

## 安装

1. 双击 `Insight OS-1.0.0-arm64.dmg`
2. 把 `Insight OS.app` 拖入 `/Applications/`
3. 在 `/Applications/` 双击 `Insight OS.app` 启动
4. 首次启动进 3 步 onboarding → 1 分钟上手

## 数据存储

macOS 走标准 Application Support 路径：

```
~/Library/Application Support/insight-os-desktop/storage/insight.db
```

卸载 app 不会自动删除数据。如需完全清理，删除整个 `insight-os-desktop` 目录即可。

## 本地构建

```bash
# 根目录
npm install
npm run build:packages    # esbuild 把 packages/{db,core,llm,indexer} 编译到 dist/
npm run build:desktop     # Next.js build + electron-builder 打包 .dmg
```

构建产物在 `apps/desktop/dist/Insight OS-1.0.0-arm64.dmg`。

## 仅打包目录（快速重建）

```bash
npm run build:desktop:dir
```

跳过 .dmg 打包，输出未压缩的 `.app` 到 `apps/desktop/dist/mac-arm64/`。开发调试用。

## 仅 native module 重建

better-sqlite3 是 native module，需要针对 Electron 32 ABI 重新编译：

```bash
npm run rebuild:native
```

## macOS Gatekeeper

未签名的 .dmg 首次启动会被 Gatekeeper 拦截。绕过方法：

```bash
xattr -d com.apple.quarantine /Applications/Insight\ OS.app
```

或者在「系统设置 → 隐私与安全性」点「仍要打开」。

## 系统要求

- macOS 11+（Big Sur 或更新）
- Apple Silicon（arm64）— Intel 计划 v1.1
- 不需要预装 Node.js（Electron 自带）

## 已知问题

- 首次构建慢（5-10 分钟编译 Next.js 全栈 + Electron 打包），之后增量打包快
- Windows / Linux 计划 v1.1
- 自动更新计划 v1.2（electron-updater + GitHub Releases 端点）

## 反馈

- [GitHub Issues](https://github.com/shadow-vincent/insight-os/issues)
- 邮件: vincent4895856@gmail.com