# Insight Asset OS · V1.3.0

资产图谱（Knowledge Graph）完全重做 — 主题配色 + force-directed 自由聚类 + 浅色沉浸主题。

## 🎯 这版核心：让图谱"会说话"

V1.0~V1.2 的图谱是**一片蓝色海洋** — 所有节点都是同一个证据等级色（E0~E5 渐变），用户看到的是 50 个蓝色点 + 看图例才知道谁是谁。V1.3.0 把"分类"语义从颜色里**显式**出来：

- 节点颜色 = **主题分类**（12 色映射：经营能力 / AI 落地 / 组织治理 / 组织治理示例 / AI 时代的判断力 / 数字化转型 / 课程开发…）
- 同一主题节点自动**聚类**到一起（force-directed 算法）
- hover 一个节点时**邻域高亮，其他 dim 到 0.18**（探索感）

## ✨ 新增功能

### 1. 主题色系统（topic-color）

**API 端**（`/api/graph`）：

- 加 `topicColor(name)` 函数：12 色 palette + 稳定 hash → 同一主题总是同一颜色（跨刷新稳定）
- 每个节点现在带 `color` + `primaryTopic` 字段
- 不破坏现有 API（additive，旧的 client 忽略新字段不影响）

**前端**（`GraphClient.tsx`）：

- 节点 fill 直接用 `n.color`
- 主题色让 12 类资产一眼可辨

### 2. force-directed 自由聚类（pedigree 模式）

旧版是**固定布局**（中心 + 上排 ancestor + 下排 descendant + 周围 sibling），新版本用 **d3-force 算法**：

- `forceManyBody().strength(-340)` — 节点相互排斥
- `forceCollide().radius(nodeSize + 22)` — 防重叠
- `forceX/Y` 弱拉回中心（strength 0.02）
- **自定义主题簇力**：同名主题相互吸引（force 0.15，距离阈值 200）
- 中心节点固定 (cx, cy)，邻域节点自动收敛
- 400-500 tick 后稳定布局
- clamp 到画布内（margin 40）防止溢出

**效果**：hover 一个节点，邻域高亮 + 其他 dim 0.18 → 一眼看出"AI 落地类节点" / "组织治理类节点" 自然成簇

### 3. 浅色沉浸主题

之前 app shell 是浅色但图谱区是深色（`backgroundColor: '#0a0e1a'`），**视觉割裂**。V1.3.0 统一浅色：

- 主图背景：`linear-gradient(180deg, #fafbfd → #eef2f8)`
- 装饰网格点：`rgba(99, 102, 241, 0.06)` 紫调
- filter / detail panel：`rgba(255, 255, 255, 0.6)` 半透白
- 节点描边、halo 强度按浅背景重新调过

### 4. 字体分层（typography hierarchy）

通过 `next/font/google` 引入 3 套字体，CSS variable 暴露：

- **Playfair Display** — 详情面板标题（衬线字体，区分正文）
- **Inter** — 正文 + UI
- **JetBrains Mono** — stat 数字（强化数据感）

### 5. 三栏布局

```
┌──────────────┬────────────────────────┬──────────────┐
│ FilterPanel  │    Main SVG Canvas     │ DetailPanel  │
│  260px       │      flex: 1           │   340px      │
│              │                        │              │
│ - 主题 chip   │ - force-directed      │ - Playfair    │
│ - count       │ - center halo         │   标题       │
│ - 全部       │ - hover dim           │ - stats 网格  │
│              │ - theme cluster       │ - topic tags  │
│ - 图例       │                        │ - CTA         │
│              │                        │              │
└──────────────┴────────────────────────┴──────────────┘
```

### 6. 节点四重编码（4 dimensions）

| 维度 | 编码 |
|---|---|
| **颜色** | 主题分类（聚类感）|
| **大小** | 反馈数 + 关联数（影响力）|
| **距离** | 关系强度（力导向算法）|
| **文字** | 资产短标题（≤ 16 字）|

### 7. Hover 探索态（安静态）

hover 一个节点 → 只有它 + 它的血脉保持高亮，其他降透明度 0.18。**这是知识图谱最关键的交互**，缺了就是静态 PPT。

### 8. 详情面板（slide-in）

右侧 340px 固定显示当前中心节点：

- Playfair Display 大标题
- 主题 chip（主色背景 22% 透明）
- evidenceLevel / priority pill
- oneSentenceInsight
- stats 网格（关联数 / 反馈数 / 主题数 / 强度）
- 主题 tags（点击切换主题过滤）
- CTA "查看完整详情 →"（按钮颜色 = 主题色）

## 📊 测试

- **API**：GET /api/graph 新增 `color` + `primaryTopic` 字段
- **Production build**：34 个 API + 10 页面 smoke test 全通过
- **图谱渲染**：52 节点 / 29 关联 / 9 主题，全部正常显示 + force-directed 收敛
- **dmg 打包**：372 MB（Apple Silicon arm64）

## 🚀 升级方式

如果你装了 V1.2.0 或 V1.2.1：

1. 下载 `Insight OS-1.3.0-arm64.dmg`
2. 双击挂载 → 把 `Insight OS.app` 拖到 `/Applications/` → 选**替换**
3. 第一次启动如弹 Gatekeeper 警告：
   ```bash
   xattr -cr '/Applications/Insight OS.app'
   codesign --force --deep --sign - '/Applications/Insight OS.app'
   open '/Applications/Insight OS.app'
   ```
4. **数据保留**：`~/Library/Application Support/InsightOS/` 完整保留所有资产/主题/反馈/写作配置

如果你从 V1.2.0 → V1.3.0 直接跳：**先装 V1.2.1 修黑屏**，再装 V1.3.0（两个 release 都要装）。

## 💡 视觉对比

### 旧版（V1.2.x）

```
所有节点 = 同一个证据等级色（灰→蓝→红渐变）
布局 = 固定三段（上中下）
没有 hover dim
字体 = 系统 sans-serif
背景 = #fafbfd 浅色但中心节点是深色（割裂）
```

### 新版（V1.3.0）

```
节点颜色 = 主题分类（12 色映射）
布局 = force-directed 自由聚类（按主题成簇）
hover 邻域高亮 + 其他 dim 0.18
字体 = Playfair Display + Inter + JetBrains Mono
背景 = 浅色沉浸主题，跟 app shell 一致
```

## 🛠️ 技术细节

- **d3-force 3.0.0** + **d3-quadtree 3.0.1** 安装在 root `package.json`
- **API 端 topicColor hash**（djb2）：同名同色，跨刷新稳定
- **clamp margin 40**：防止节点溢出可视区
- **PedigreeView 4 个 force** 调参：charge -340 / collide +22 / x/y pull 0.02 / theme 0.15 distance 200

## 📝 文件清单

- **修改**：5 个文件
  - `apps/web/app/api/graph/route.ts` — 加 topicColor + color/primaryTopic 字段
  - `apps/web/app/graph/GraphClient.tsx` — 完全重写（force-directed + 三栏 + halo + slide-in）
  - `apps/web/app/graph/page.tsx` — 删重复 h1
  - `apps/web/app/layout.tsx` — 加 Playfair / Inter / JetBrains Mono via next/font
  - `apps/desktop/package.json` — version 1.2.1 → 1.3.0
- **新增**：2 个 deps（d3-force, d3-quadtree）

## 🐛 已知问题

- center halo 在某些低 zoom 下可能略显眼（暂未优化）
- theme cluster 力对 1-hop 距离节点效果最佳，远距离节点散开更明显
- ABI 128 rebuild 仅给 packaged 模式用，dev 模式需 `npm rebuild better-sqlite3` 切回 ABI 131

## 📅 版本路线

- **V1.0.0** — 基础资产库 + 主题分类 + 反馈
- **V1.1.0** — 多源 intake（Office + PDF）+ 候选池
- **V1.1.1** — 桌面 .app db 移到 userData（修数据丢失 bug）
- **V1.2.0** — 完整写作工作台（writing-config + 反推 + L2 模板 + AI partner + 多模态）
- **V1.2.1** — 黑屏 hotfix（better-sqlite3 ABI rebuild）
- **V1.3.0** — 图谱重做（主题配色 + force-directed + 浅色主题）← **当前**
- **V1.4.0** — Insight Kernel（核心内核层 + 反向校准 + Weekly Reflection，规划中）

---

**核心升级**：图谱从"静态 PPT"变成"探索工具" — 你能看出"AI 落地类 / 组织治理类 / 判断力类"自然成簇，能 hover 一个节点看完整邻域，能切换主题过滤。这是知识图谱该有的样子。