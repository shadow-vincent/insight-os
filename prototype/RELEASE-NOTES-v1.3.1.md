# Insight Asset OS · V1.3.1

V1.3.0 图谱重做的紧急 hotfix — 修复用户点击"骨架"文章详情页空白的问题。

## 🚨 这版必须升

V1.3.0 用户反馈：**点击任何"骨架"状态的文章 → 详情页正文空白**（看不到生成的大纲 / 章节大纲 / 收尾行动）。V1.3.1 修好。

V1.2.x 用户也可能受影响（同样的 bug，只是之前大家用 dev 模式没注意）。

## 🐛 Root Cause

**历史 scaffold 数据错列存储**：

| API | 写入列 | 时段 |
|---|---|---|
| `/api/output/scaffold`（**老**）| `content` 列（JSON.stringify 整个 scaffold）| V0.9 ~ V1.1 |
| `/api/writing/scaffold`（**新**）| `scaffold_json` 列（V1.2 schema 新加）| V1.2+ |

`GET /api/writing/[id]` 只读 `scaffoldJson` 列，**老数据全在 `content` 列里读不到** → API 返 `scaffold: null` → 详情页 scaffold 视图不渲染 → 页面空白。

18 个历史 scaffold 文章全部受影响。

## ✅ V1.3.1 修法

`/api/writing/[id]/route.ts` 加 **fallback 解析**（3 个顺序）：

```ts
// 1. scaffoldJson 列（V1.2+ 新 API 数据）
let scaffold = null;
const scaffoldRaw = row.scaffoldJson ?? row.scaffold_json ?? null;
if (scaffoldRaw) {
  try { scaffold = JSON.parse(scaffoldRaw); } catch {}
}
// 2. content 列（V0.9~V1.1 老 API 数据 — 历史 18 个 scaffold 在这）
if (!scaffold && row.content) {
  try {
    const parsed = JSON.parse(row.content);
    if (Array.isArray(parsed.sections)) scaffold = parsed;
  } catch {}
}
// 3. 都没有 → null（详情页显示空状态）
```

**无需数据迁移脚本** — fallback 兼容所有历史数据。

## 🔬 验证

| 测试项 | V1.3.0 | V1.3.1 |
|---|---|---|
| `GET /api/writing/out_c817b792` 返 `scaffold` | `null` ❌ | 完整（5 sections + openingHook + closingAction）✅ |
| 详情页渲染（骨架状态文章）| 空白 ❌ | 标题 + 开场钩子 + 5 章节 + 引用资产完整显示 ✅ |
| 新生成 scaffold 数据 | 正常 ✅ | 正常 ✅（fallback 不影响新数据路径）|

## 💾 数据安全（重要）

升级 V1.3.0 → V1.3.1 **不会丢任何数据**：

- ✅ macOS 直接覆盖 `/Applications/Insight OS.app`（不需要先卸载）
- ✅ `~/Library/Application Support/InsightOS/` 不受影响
- ✅ 所有资产 / 主题 / 反馈 / 写作配置 / **历史 scaffold 大纲** → **完整保留 + 修复后正常显示**

main.js 启动时检测 `userData/storage/insight.db` 存在就 skip migration，老数据**永远不会被覆盖**。

## 🚀 升级方式

如果你装了 V1.3.0 或更早版本：

1. 下载 `Insight OS-1.3.1-arm64.dmg`
2. 双击挂载 → 把 `Insight OS.app` 拖到 `/Applications/` → 选**替换**
3. 第一次启动如弹 Gatekeeper 警告：
   ```bash
   xattr -cr '/Applications/Insight OS.app'
   codesign --force --deep --sign - '/Applications/Insight OS.app'
   open '/Applications/Insight OS.app'
   ```
4. 打开任一骨架状态文章 → 应该看到完整大纲（之前空白的现在显示）

## 📝 文件清单

- **修改 1**：`apps/web/app/api/writing/[id]/route.ts` — 加 scaffold 解析 fallback（+16/-3 行）
- **修改 2**：`apps/desktop/package.json` — version 1.3.0 → 1.3.1（+1/-1 行）

## 📦 技术细节

```
$ file apps/desktop/dist/mac-arm64/Insight OS.app/Contents/Resources/web-pkg/node_modules/better-sqlite3/build/Release/better_sqlite3.node
Mach-O 64-bit bundle arm64

$ plutil -p apps/desktop/dist/mac-arm64/Insight OS.app/Contents/Info.plist | grep version
"CFBundleShortVersionString" => "1.3.1"
"CFBundleVersion" => "1.3.1"
```

## 🐛 已知问题

- scaffold JSON 在老数据里没有 `topicId` / `audience` 字段（fallback 时不补，因为这两字段不影响详情页骨架视图）
- 如果个别文章 history 不在 content 列也不在 scaffold_json 列（理论上不可能），fallback 会返 null

## 📅 版本路线

- **V1.0.0** — 基础资产库 + 主题分类
- **V1.1.0** — 多源 intake + 候选池
- **V1.1.1** — 桌面 .app db 移到 userData（修数据丢失）
- **V1.2.0** — 完整写作工作台
- **V1.2.1** — 黑屏 hotfix（ABI rebuild）
- **V1.3.0** — 图谱重做（主题配色 + force-directed）
- **V1.3.1** — 骨架详情页空白 hotfix（scaffold fallback）← **当前**
- **V1.4.0** — Insight Kernel（核心内核层 + 反向校准 + Weekly Reflection，规划中）

---

**Patch release**：图谱重做的体验 + 修复详情页空白 = 完整可用。所有 V1.x 历史数据兼容。