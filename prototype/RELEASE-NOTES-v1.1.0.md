# Insight Asset OS v1.1.0 — 多源采集 + 资产管理

> v1.0 是「沉淀判断力」——v1.1 让采集**零摩擦**，让管理**零误操作**。

v1.1.0 是 v1.0.0 之后的**第一个迭代版本**，聚焦两件事：

1. **采集侧**：Office 6 格式（.docx/.pptx/.xlsx）+ PDF 解析入库
2. **管理侧**：候选池批量入库 + 资产库合并 / 删除 / 优化

⚠️ 注意：v1.1.0 的**主链路**集中在 Web 端（npm run dev / npm start），**桌面 .app 仍 work** 但新功能**仅**在 Web 验证。V1.2 才考虑桌面集成。

---

## 🆕 v1.1 新增

### 📥 多源采集（收集箱升级）

| 快捷 | 状态 | 能力 |
|---|---|---|
| 📄 Office | ✅ 已 work | .docx / .pptx / .xlsx / .doc / .ppt / .xls（pptx 自写 jszip 解析） |
| 📋 PDF | ✅ 已 work | pdf-parse 2.x class API + 中英文混排 |
| 📷 OCR | 🚧 V1.1 W2 | PaddleOCR 本地服务 |
| 🎬 视频字幕 | 🚧 V1.1 W4 | YouTube / B 站 + SRT/VTT |
| 📕 电子书 | 🚧 V1.1 W3 | epub / mobi / azw3 |
| 🎙️ 音频转写 | 🚧 V1.1 W5 | mp3 / m4a / wav（FunASR 本地服务） |
| 🎙️ 小宇宙 | 🚧 V1.1 W5 | 小宇宙播客单集 |
| 📱 微信读书 | 🚧 V1.1 W5 | 微信读书 .md 导出 |

> 快捷按钮栏自动识别，**未就绪的按钮标"X.X WN"+ 灰一点**，点击直接提示"X 月 W 实现中"——不再走"先选文件再报错"的两步操作。

**核心改进**：

- **detectFileType() 共享**：拖入 + 点击选择 都用同一识别逻辑
- **chunker 切分**：长文本（> 2000 字）自动按章节 / 5 分钟 / 段落切分，逐段调 LLM 抽卡
- **50 字守门**：每段 < 50 字不写库（避免"乱码卡"再次出现）
- **serverExternalPackages**：`pdfjs-dist` / `pdf-parse` / `jszip` / `mammoth` / `xlsx` / `better-sqlite3` 都加进白名单，绕过 webpack 5 .mjs `Object.defineProperty` 错
- **PDF 工作流验证**：茅台 2026 Q1 财报 → "营收增长 6.54%，净利润仅增 1.47%，经销商净减少 255 家"（PDF 中文混排 + 表格解析 OK）

### 🗂️ 资产管理（候选池 + 资产库升级）

| 功能 | API | UI |
|---|---|---|
| 单张入库（已存在） | POST `/api/candidates/[id]/promote` | 不再 reload（setList 局部更新） |
| **批量入库** | **POST `/api/candidates/promote-batch`** | 候选池行前 checkbox + 顶部"批量入库 N 张"按钮（最多 20 张） |
| **删除候选** | **DELETE `/api/candidates/[id]`** | 行内红色 ✕ 按钮 + 自定义确认 modal |
| **删除资产** | **DELETE `/api/assets/[id]`** | 卡片左上角 ✕ 按钮 + 自定义确认 modal（区分有/无 .md） |
| **合并资产** | **POST `/api/assets/merge`** | 资产库多选 → 顶部"合并 →"按钮 → MergeModal（自动合并 title/insight/tags，可编辑） |

**合并语义**：旧 N 张 `archived` + tag 标 `merged:newId`（**不**真删，保留回溯链）。

### 🔧 工程质量

- 12 个真类型错清零（`output/multi` / `graph` / `outputs` / `topics` route，drizzle `.all()` 补 `as AssetRow[]`）
- 1 个错误处理补漏（`/api/assets` 加 try/catch）
- config 路径统一到 `~/Library/Application Support/InsightOS/config.json`（macOS）/ `~/.local/share/insightos/`（Linux）/ `%APPDATA%/InsightOS/`（Windows），自动迁移旧路径
- build-packages.mjs 自动生成 `.d.ts`（修 monorepo production 模式 `next start` 找不到类型）
- `serverExternalPackages` 解决 pdfjs-dist 触发 webpack 5 .mjs 报错

### 🎨 UI 一致性

- **资产库删除**改用 toast + inline confirm modal（不再用浏览器原生 `alert()` / `confirm()`）
- **单张入库 / 资产合并**改 fetch + setList（**不**再 `window.location.reload()`，保留滚动位置 + 更快）
- **stub 快捷按钮**直接 toast 提示，**不**走"先弹文件再报错"的两步操作

---

## 📦 安装

### macOS（Apple Silicon）

下载 `Insight OS-1.1.0-arm64.dmg`，打开后**必须**把 `Insight OS.app` 拖入 `/Applications/` 文件夹（不拖入启动会报资源路径错误）。

### 第一次启动必跑 3 行（Gatekeeper 修复）

未签名 .app 在 macOS 11+ 启动会报"Insight OS 已损坏，无法打开"。装完后**第一次启动前**必跑：

```bash
xattr -cr '/Applications/Insight OS.app' && codesign --force --deep --sign - '/Applications/Insight OS.app' && open '/Applications/Insight OS.app'
```

含义：
- `xattr -cr` — 清 quarantine 标记
- `codesign --force --deep --sign -` — ad-hoc 重新签名（macOS 12+ 必须）
- `open` — 启动

如果 `codesign` 报 `command not found` → `xcode-select --install`

### 首次使用

1. 打开 .app → 设置页（`/settings`）填入 LLM API 信息
   - API Base：`https://api.minimax.chat/v1`（或任何兼容 OpenAI API 协议的服务）
   - API Key：你的 key
   - Model：`MiniMax-M2.7`（或你的模型名）
2. `/inbox` 把看到 / 听到 / 想到的随手丢进来（粘贴 / 拖文件 / URL）
3. AI 自动整理 → 候选池（`/candidates`）确认入库
4. 资产库（`/assets`）选卡 → 联合输出 / 合并
5. 主题页（`/topics`）看自己的思想演化 + 内核

---

## 🐛 已知问题

- v1.1.0 的 4 个 W2-W5 快捷按钮（OCR / 视频 / 音频 / 电子书 / 微信读书）**暂未实现**，UI 上标"W2/W3/W4/W5"
- 桌面 .app 默认 config 目录在 macOS `~/Library/Application Support/InsightOS/`
- 桌面 .app 启动后 LLM API key 需在设置页填入，**不**从 Web dev 同步
- 资产库 / 候选库**无**分页（1000+ 张会卡，后续 V1.2 加）

---

## 📊 版本对比

| 维度 | v1.0.0 | v1.1.0 |
|---|---|---|
| 数据采集 | 粘贴 / URL / 手动 | + Office 6 格式 / PDF 解析 |
| 候选池管理 | 列表浏览 | + 批量入库（最多 20 张）+ 单张删除 |
| 资产库管理 | 浏览 + 详情 | + 合并（N → 1）+ 单张删除 + 局部刷新 |
| 删除确认 | 浏览器原生 confirm | 自定义 modal（区分有/无 .md） |
| 错误反馈 | alert | toast（与全局风格统一） |
| Web 端 | ✅ | ✅ |
| 桌面 .app | ✅ | ✅（V1.1 主功能 Web 验证，桌面集成 V1.2） |
| 节点数 | 7 | 7（不变） |
| LLM | 任意 OpenAI 协议 | 任意 OpenAI 协议 |
| npm 命令 | npm run dev | npm run dev |
| .dmg 大小 | 334 MB | ~340 MB |

---

## 🛠️ 从源码运行

```bash
git clone https://github.com/shadow-vincent/insight-os.git
cd insight-os
npm install
npm run build:packages
npm run dev   # http://localhost:4191
```

桌面 .dmg 自行打包：

```bash
cd apps/web && npm run build && cd ..
cd apps/desktop && npx electron-builder --mac
# 产物在 apps/desktop/dist/Insight OS-1.1.0-arm64.dmg
```

---

## 📝 反馈

- GitHub Issues: https://github.com/shadow-vincent/insight-os/issues
- 微信群 / 公众号：见项目主页

如果你也想做类似的工具，**可以**直接 fork + 改起来——MIT License。
