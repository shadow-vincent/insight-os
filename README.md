# Insight Asset OS

> 把零散经验转化为**可调用、可输出、可验证、可进化**的管理思想资产。

Insight Asset OS 是为**独立咨询顾问 / 自由职业者 / 知识工作者**打造的个人管理思想沉淀工具。

它帮你把散落的笔记、文章、案例沉淀成"判断力资产"——每张卡都有**反常识点 + 证据等级**，每个主题都有**思想内核 + 核心判断**。

<p align="center">
  <video src="https://raw.githubusercontent.com/shadow-vincent/insight-os/main/apps/web/public/demo-promo.mp4" controls width="800"></video>
</p>

## 核心特性

- 🧠 **思想内核**：每个主题 1 句核心判断 + 3-5 条反常识
- ✍️ **写作工作流**：1 句核心 + 几张卡 = 写作骨架 + 陪练 + 反哺
- 📊 **资产地图 + 图谱**：判断结构 + 血脉关系可视化
- 💬 **洞察助手**：用自然语言问"我有几张高等级卡"、"组织治理核心思想是什么"
- 🗂️ **资产→写作→反馈→升级** 完整回路：每张卡都能"看见自己怎么变"

## 5 分钟上手

### 1. 启动应用

#### Web 版（开发模式）
```bash
git clone https://github.com/shadow-vincent/insight-os.git
cd insight-os
npm install
npm run dev
# 浏览器打开 http://localhost:4191
```

#### Mac 桌面版
下载最新的 `.dmg` 文件：
👉 [GitHub Releases](https://github.com/shadow-vincent/insight-os/releases)

**⚠️ macOS 11+ Gatekeeper 拦未签名 Electron .app —— 装完必须跑这 3 行再启动：**

```bash
xattr -cr '/Applications/Insight OS.app' && codesign --force --deep --sign - '/Applications/Insight OS.app' && open '/Applications/Insight OS.app'
```

不跑会报 "`Insight OS` 已损坏，无法打开"。一行命令搞定（清 quarantine + ad-hoc 重新签名 + 启动）。

如果 `codesign` 报 `command not found`：
```bash
xcode-select --install
```
装完 Xcode CLI 再跑上面那行。

### 2. 完成首次引导

启动后会自动跳到 `/onboarding` 引导页：
1. **配 LLM Key**（可选，没配也能用基础功能）
2. **选 Vault 路径**（指向你的知识库根目录）
3. **装入示例数据**（8 张示例卡 + 2 个主题 + 1 个内核 + 1 个示例写作）

### 3. 开始用

- **仪表盘** — 看"今日待办"3 栏（待校准 / 可输出 / 待反馈）
- **资产库** — 所有沉淀的判断卡
- **写作** — 从 1 句核心 + 几张卡开始写
- **资产地图** — 按主题查看所有判断
- **资产图谱** — 看判断的"血脉关系"
- **洞察助手**（右下角 ✨）— 自然语言问任何问题

## 系统要求

- **Node.js 20+**（dev mode）
- **macOS 11+**（桌面 app）
- **SQLite 3**（内置）
- **LLM API key**（可选，**任何兼容 OpenAI API 协议的服务**：本地 Ollama / 自部署 vLLM / MiniMax / DeepSeek / Qwen / GLM / OpenAI / Claude …）

## 配置

应用通过 Web UI 配置（`/settings`），存到：
- **Web 版**：`apps/web/storage/config.json`
- **桌面版**：`~/Library/Application Support/InsightOS/config.json`（macOS）

```json
{
  "llm": {
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKey": "sk-...",
    "model": "deepseek-chat",
    "enabled": true
  },
  "paths": {
    "vaultPath": "~/Documents/knowledge_base"
  }
}
```

## 项目结构

```
insight-os/
├── apps/
│   └── web/                      # Next.js 15 前端
│       ├── app/                  # 路由 + API
│       ├── components/           # UI 组件
│       ├── lib/                  # 工具库
│       └── storage/              # SQLite + config
├── packages/
│   ├── core/                     # 配置 / 归一化
│   ├── db/                       # SQLite schema + client
│   ├── llm/                      # LLM client + prompts
│   └── indexer/                  # Markdown indexer
├── scripts/                      # 工具脚本
└── tests/                        # node --test 单测
```

## 开发

```bash
# 安装
npm install

# Dev server (Next.js)
npm run dev

# Production build
npm run build
npm start

# 单测
npm test

# Indexer: 扫描 Vault 同步到 DB
npm run index
```

## 技术栈

- **前端**：Next.js 15 + React 19 + TypeScript
- **UI**：自建设计系统（CSS variables + 双主题 blue/green）
- **数据**：SQLite + Drizzle ORM
- **LLM**：**任何兼容 OpenAI API 协议的服务**（本地 Ollama / 自部署 vLLM / MiniMax / DeepSeek / Qwen / GLM / OpenAI / Claude …）
- **图谱**：react-force-graph-2d
- **桌面 app**：Electron 32（macOS arm64 .dmg 已发布）

## 路线图

- ✅ v0.1 资产库 + 收集箱 + 候选池 + 输出
- ✅ v0.2 资产地图 + 主题归类
- ✅ v0.3 全文搜索 + ⌘K
- ✅ v0.4 仪表盘 + 主题切换
- ✅ v0.5 资产图谱
- ✅ v0.6 血脉图（Page Graph）
- ✅ v0.7 洞察助手（multi_step ReAct）
- ✅ v0.8 思想内核（topic kernel）
- ✅ v0.9 写作工作流（4 步向导 + 陪练）
- ✅ v0.10 今日待办 + 进化时间线 + 写作复盘
- ✅ v1.0 Onboarding + Seed 数据
- ✅ v1.1 Electron 桌面 app（macOS arm64 .dmg）
- 🚧 v1.2 自动更新 + GitHub Releases

## 常见问题

**Q: 必须配 LLM Key 才能用吗？**

A: 不是。基础功能（资产库 / 主题 / 写作 / 图谱）都可用。LLM 用于：思想内核提炼 / 写作骨架 / 资产升级 / 洞察助手。

**Q: 不用 DeepSeek 行不行？**

A: **任何兼容 OpenAI API 协议的服务都行**——本地 Ollama / 自部署 vLLM / MiniMax / DeepSeek / Qwen / GLM / OpenAI / Claude 都接。在 `/onboarding` 选"自定义"填 base URL + model 即可。

**Q: 数据存在哪？安全吗？**

A: Web 版存在 `apps/web/storage/insight.db`（SQLite 本地文件）。桌面版存在 `~/Library/Application Support/InsightOS/`。**所有数据都本地**，不上云。

**Q: 怎么备份？**

A: 复制 `apps/web/storage/insight.db` 到安全位置。或用 `tar czf backup-$(date +%F).tar.gz apps/web/storage/04_管理洞察 apps/web/storage/insight.db`。

**Q: 怎么升级？**

A: Web 版：`git pull && npm install && npm run build && pm2 restart`。桌面版：会自动检查 GitHub Releases 提示。

**Q: 别人能试用吗？**

A: 1) 下载 macOS .dmg 装上 2) 启动前先跑 3 行 Gatekeeper 命令（见上文）3) 启动后会进 onboarding 4) 1 分钟内 3 步走完 5) 看到示例数据 6) 开始用。

**Q: 启动报 "Insight OS 已损坏，无法打开" 怎么办？**

A: macOS 11+ Gatekeeper 拦未签名 Electron .app。修复 3 行命令：
```bash
xattr -cr '/Applications/Insight OS.app' && codesign --force --deep --sign - '/Applications/Insight OS.app' && open '/Applications/Insight OS.app'
```

## 贡献

欢迎 PR、Issue、Feature Request。**先开 Issue 讨论**，再发 PR。

## License

[MIT](./LICENSE) © Vincent

---

**Made with 🧠 by Insight Asset OS**
