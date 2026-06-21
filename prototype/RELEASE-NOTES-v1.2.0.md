# Insight Asset OS · V1.2.0

写作场景的完整工作台 — 5 维度风格配置 + LLM 反推 + 质量保证 + 多场景模板。

## 🎯 这版核心：让「写作风格」成为可管理的资产

之前 LLM 输出文章的"味道"完全靠 prompt 临时指定，调一次忘一次。V1.2.0 把写作风格变成 **5 维度 YAML 配置**（风格 / 句式 / 结构 / 长度 / 质检），可以保存、复制、迁移、回滚、跨 preset 混合。

## ✨ 新增功能

### 1. 写作风格配置（writing-config）
- **5 维度 YAML**：风格（语气/立场/人设/视角/术语密度）· 句式（节奏/短句比/段落/修辞）· 结构（标题/核心位置/论证/章节/收尾）· 长度（字数/单章/金句）· 质检（引用上限/禁用词/数据真实性）
- **3 套 ship-ready 预设**：vincent-standard（公众号长文 · 顾问式）· client-comm（邮件 · 温和）· academic（论文 · 数据驱动）
- **active preset** 切换：切换后所有生成（联合输出 / 多类型 / 试写屏）自动用新 preset 的 5 维度
- **YAML 存储**：`~/Library/Application Support/InsightOS/writing-configs/*.yaml`
- **导入导出**：YAML 字符串 import/export，可分享给别人

### 2. 风格反推（从样本提炼）
- **粘贴文本**：粘贴 1-5 篇文章样本（每篇 ≥ 100 字），LLM 反推 5 维度 + 200 字风格总结 + 置信度（low/medium/high）+ 建议 preset 名
- **资产库 tab**：从 outputs 表里选 article_full / article_outline / writing 类型的文章反推（一次最多 5 篇）
- **smartSample 长文采样**：超过 3500 字自动用「首 40% + 中 30% + 尾 30%」均匀采样，保留立意/论据/收尾结构
- **few-shot 自动接入**：反推后自动把样本 outputs 关联到 preset，生成时 LLM 引用作者原话

### 3. 试写屏（用 preset 真生成）
- 在 `/settings/writing` 选一个 preset → 点 **📝 试写一篇** → 粘贴内容（≥ 50 字）→ 选 output type → **🪄 真生成一篇**
- 10-30s 出完整文章 + AI 味评分（0-100）+ 数据真实性扫描（数字 + 推荐查证源）
- 调字段时不用猜，10s 真生成立刻验证味道

### 4. 6 种 L2 模板（output type）
- **article_full**（1500-2500 字公众号长文，V1.0 已有）
- **speech**（3000-5000 字演讲稿，15-25 分钟口语化）· NEW
- **book_note**（1000-1500 字读书笔记，作者原话 + 我的延展）· NEW
- **email**（500-1000 字邮件，3 段结构 + 明确 CTA）· NEW
- **talk_script**（老类型，向后兼容）
- **article_outline**（老类型，向后兼容）

### 5. 质量保证层
- **AI 味自检**：生成后独立 prompt 评估（语言自然度 / 观点锐度 / 数据真实性 / 结构节奏 4 维度，0-100 评分）
- **数据真实性扫描**：正则扫所有数字，标注 cited / inferred / uncited / industry-common 状态
- **AI partner 改稿**：选段 → 输入指令（更口语化 / 更短 / 加金句 / 用比喻 等 9 个 quick instruction）→ AI 改写 + reasoning
- **数据查证推荐**：未标注数字 LLM 推荐 source-link / rephrase / remove

### 6. 工具
- **风格迁移（多 src 混合）**：从多个源 preset 拉取不同维度，覆盖到目标 preset · 例如"A 的 style + B 的 structure + C 的 quality"
- **版本控制**：每次保存自动建 .bak（最近 5 个版本）· 可查看 / 回滚
- **Preset 市场**：`/writing-config-market` 浏览所有 preset · 按分类 / 标签筛选 · 一键 fork
- **实时风格预览**：编辑 preset 时不调 LLM，5 维度 → 自然语言段实时显示
- **variants 批量生成**：1-3 个完整版并行生成

### 7. 写作流程（V1.2 阶段 C）
- **状态机**：scaffold（骨架）→ draft（草稿）→ published（已发布）· 切换时自动备份
- **生成骨架**：选 3-5 张资产 → 4-6 节大纲 + 反常识开场钩子 + 收尾行动建议
- **写作仪表盘**：`/writing` 列表所有 writing 状态的文章
- **写作详情页**：`/writing/[id]` 显示骨架 / 正文 / 已发布不同视图

### 8. 多模态输入（V1.2 阶段 C）
- **图片 + 文本 → vision LLM**：上传 1-3 张图片（可 ⌘V 粘贴截图）→ 选 output type（analyze / article_full / speech / book_note / email）
- 支持 gpt-4o / claude-3.5 / gemini-1.5 vision 模型
- 注意：deepseek-flash 不支持 vision，请用其他模型

## 📊 测试

- **34 个 API + 10 个页面** smoke test 全部通过
- **生产 build**：30 个静态页面 + 102 kB shared chunks
- **dmg 打包**：433 MB（Apple Silicon arm64）

## 🛠️ 修复 Bug

- **桌面 .app 数据丢失**（V1.1.1 修复）：打包 .app db 现在存到 userData dir，不在 .app bundle
- **macOS Gatekeeper**：仍需运行 3 行命令
  ```bash
  xattr -cr '/Applications/Insight OS.app'
  codesign --force --deep --sign - '/Applications/Insight OS.app'
  open '/Applications/Insight OS.app'
  ```
- **chunker 长文切分**：mammoth `\n` 兼容 + 中文标点 + `estLen` 长度预估
- **slug 中文支持**：保留中文 + 重复自动 `-2` 后缀
- **few-shot smartSample**：超 3500 字智能采样（首中尾均匀保留结构）
- **asset UI 字段缺失**：drizzle 0.36.4 类型签名 bug 全部加 `as any` cast

## 🚀 升级方式

1. 下载 `Insight OS-1.2.0-arm64.dmg`（433 MB）
2. 双击挂载 .dmg → 把 `Insight OS.app` 拖入 `/Applications/`
3. 第一次启动运行 Gatekeeper 修法（3 行命令）
4. 旧版本数据自动迁移到 `~/Library/Application Support/InsightOS/`

## 💡 配置建议

- **第一次用**：到 `/settings/writing` → **🪄 从样本提炼风格** → 粘贴你写过的 3-5 篇 → 自动生成你的专属 preset
- **调字段**：用 **📝 试写一篇** 实时验证（10-30s），不要纯靠想象
- **多场景**：3 套 ship-ready 预设覆盖 80% 场景，需要更专业时复制 + 改 preset
- **多模态**：图片 / 截图当 prompt 参考（需 vision 模型，如 gpt-4o）

## 🐛 已知问题

- 同一时间多个长 LLM 调用可能排队（deepseek-flash 慢），建议串行使用试写屏
- 打包 .app 第一次启动需要 Gatekeeper 修法（macOS 限制）
- vision model 必须独立配置（不是默认 deepseek-flash）

## 📝 文件清单

- **新增**：17 个文件（4 个 LLM prompt + 7 个 API route + 6 个 UI modal/page + 1 个 smoke test 脚本）
- **修改**：8 个文件（writing-config / schema / sidebar / output-composite / output-generate 等）

---

**总功能数 25+** · 完整 ship-ready 的写作工作台