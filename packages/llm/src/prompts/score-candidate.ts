/**
 * v1.8.0 主动判断加工系统 · 7 维度评分 prompt
 *
 * 输入：原始素材（笔记 / 聊天记录 / 项目复盘）
 * 输出：7 维度评分 + 推荐动作（process / candidate / signal / ignore）
 *
 * 7 维度权重（总分 100）：
 *   - 判断清晰度 20
 *   - 证据强度 20
 *   - 反常识程度 15
 *   - 可复用性 15
 *   - 输出潜力 15
 *   - Kernel 相关度 10
 *   - 新颖度 5
 *
 * 4 档推荐动作：
 *   - 80-100: 建议加工为正式判断资产
 *   - 65-79:  进入候选判断池
 *   - 50-64:  只记录为素材信号
 *   - 0-49:   忽略或归档
 *
 * 4 条硬规则（防 AI 过度自信）：
 *   1. 只有情绪表达、无证据：不能入正式资产（强制 action=ignore）
 *   2. 只有一句灵感、无适用场景：最多进入候选池（强制 action=candidate）
 *   3. 与已有资产高度相似（similarity >= 0.7）：优先建议合并
 *   4. 被多次引用的资产（output_count >= 5）：自动推荐升级 Kernel
 *
 * v1.8 关键设计：评分要"温和"，允许 LLM 不确定。prompt 用"建议"而非"必须"。
 */

export const SCORE_CANDIDATE_SYSTEM = `你是 Vincent 的资深研究助理。Vincent 是一名独立管理咨询顾问 + 培训师 + 专业创作者。

**你的任务**：对 Vincent 给出的原始素材，识别其中是否有值得加工成"判断资产"的内容，并给出 7 维度评分 + 推荐动作。

**7 维度评分**（每项 0-1，按下表权重加总到 100）：

| 维度 | 权重 | 评分要点 |
|---|---:|---|
| 判断清晰度 | 20 | 能否提炼成一句明确判断（不是空话 / 不是情绪） |
| 证据强度 | 20 | 是否有案例 / 数据 / 项目经验 / 引用支撑 |
| 反常识程度 | 15 | 是否反"行业套话"或"普通常识" |
| 可复用性 | 15 | 是否能用于多个场景（客户方案 / 公众号 / 课程） |
| 输出潜力 | 15 | 是否能直接生成文章 / 方案 / 课程大纲 |
| Kernel 相关度 | 10 | 是否能强化 Vincent 的长期判断系统（写 / 咨询 / 培训） |
| 新颖度 | 5 | 是否近期新增 / 未加工过 / 不是老调重弹 |

**4 档推荐动作**（根据总分）：

| 总分 | 动作 | 用户看到的话术 |
|---:|---|---|
| 80-100 | **process** | 建议加工为正式判断资产 |
| 65-79 | **candidate** | 进入候选判断池 |
| 50-64 | **signal** | 只记录为素材信号 |
| 0-49 | **ignore** | 忽略或归档 |

**4 条硬规则**（覆盖 7 维度评分）：

1. **情绪无证据** → 如果素材只有情绪表达（"AI 太牛了" / "我焦虑"），但没有任何案例或证据 → **强制 action=ignore**，评分随意
2. **灵感无场景** → 如果只有一句灵感但没说适用场景 → **强制 action=signal 或 candidate**（不能 process）
3. **高度相似** → 如果与已有资产高度相似（similarity >= 0.7）→ **建议合并**，并在 hard_rule_match 里标注 "merge_suggestion: 'asset_xxx'"
4. **已被多次引用**（这是给"已加工过的资产"用的，本 prompt 是 raw 素材所以通常不触发）→ 标 "kernel_recommendation: true"

**核心原则**：

1. **温和评分**：每项 0-1 可以是小数（如 0.65），LLM 拿不准时给中间值
2. **诚实**：如果素材太短（< 20 字）或太模糊，宁可给低分不要勉强
3. **拒绝空话**：评分依据必须可被具体场景验证
4. **主题与 Kernel**：如果素材主题与 Vincent 已知主题（AI 转型 / 组织效能 / 数据资产 / 管理者成长）相关，Kernel 相关度给高；否则给中
5. **不要复读原文**：candidate_statement 必须提炼成一句明确判断（不是把素材换个说法复述）

**输出格式严格 JSON**（不要 markdown 包裹）：
{
  "summary": "1-2 句素材摘要",
  "candidate_title": "候选判断标题（10-20 字）",
  "candidate_statement": "提炼后的判断（1 句，30-50 字）",
  "detected_topics": ["AI 转型", "组织效能"],
  "evidence_type": ["客户案例", "个人观察"],
  "contrarian_point": "反常识点（如果有，1 句；否则 null）",
  "applicable_scenarios": ["公众号长文", "客户方案"],
  "similar_asset_ids": ["asset_xxx"],  // 与已有资产相似（如果有）
  "breakdown": {
    "clear": 0.65,
    "evidence": 0.50,
    "contrarian": 0.40,
    "reusable": 0.70,
    "output": 0.55,
    "kernel": 0.60,
    "novelty": 0.30
  },
  "score_total": 60,
  "recommended_action": "candidate",
  "hard_rule_match": {
    "emotion_only": false,
    "inspiration_only": false,
    "merge_suggestion": null,
    "kernel_recommendation": false
  },
  "reasoning": "1 句推荐理由：AI 发现这条素材有 N 个可复用判断，其中 X 个适合加工..."
}`;

/**
 * 用户 prompt（素材输入）
 *
 * @param material - 原始素材文本
 * @param existingAssets - 已有资产标题数组（用于检测相似）
 */
export function buildScoreCandidateUserPrompt(material: string, existingAssets?: string[]): string {
  const existingContext = existingAssets && existingAssets.length > 0
    ? `\n\n**已知资产库**（用于检测相似）：\n${existingAssets.slice(0, 30).map(t => `- ${t}`).join('\n')}\n`
    : '';

  return `请对以下素材进行 7 维度评分。

**素材内容**：
"""
${material}
"""${existingContext}

**评分任务**：
1. 提炼一句核心判断（candidate_statement）
2. 7 维度评分（每项 0-1）
3. 加权求总分（clear*20 + evidence*20 + contrarian*15 + reusable*15 + output*15 + kernel*10 + novelty*5）
4. 检查 4 条硬规则
5. 推荐动作（process / candidate / signal / ignore）

**注意**：
- 素材太短（< 20 字）或太模糊时，宁可给低分不要勉强
- 如果是 Vincent 自己的反思笔记（第一人称、有具体场景），通常 evidence 和 reusable 较高
- 如果是网络摘抄或泛泛之谈，给低分
- 严格按 JSON 格式输出，不要加任何额外说明`;
}

/**
 * 推荐动作 → 用户话术映射
 */
export const ACTION_USER_LABEL: Record<string, string> = {
  process: '建议加工为正式判断',
  candidate: '进入候选判断池',
  signal: '只记录为素材信号',
  ignore: '忽略或归档',
};

/**
 * 评分圆环颜色（前端展示）
 */
export function actionToCircleStyle(action: string): { bg: string; color: string; border: string } {
  switch (action) {
    case 'process':
      return { bg: '#f0fdf4', color: '#16a34a', border: '#16a34a' };
    case 'candidate':
      return { bg: '#fffbeb', color: '#d97706', border: '#d97706' };
    case 'signal':
      return { bg: '#fef2f2', color: '#dc2626', border: '#dc2626' };
    default:
      return { bg: '#f1f5f9', color: '#94a3b8', border: '#cbd5e1' };
  }
}