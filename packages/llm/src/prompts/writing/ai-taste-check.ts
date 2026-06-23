/**
 * AI 味自检 prompt（V1.2）
 *
 * 用途：生成完整文章后，独立 prompt 评估"AI 味程度"
 *
 * 设计：
 *   - 输入：生成的文章内容 + 用户禁止词列表
 *   - 输出：score 0-100 + 命中问题列表 + 修改建议
 *   - 不直接修改文章，只给反馈（避免反复改稿反而失去 Vincent 风格）
 *   - 配合 output/multi/route.ts 自动 retry: score < 70 重新生成 1 次
 *
 * 不替代 L0 脱 AI 味 8 条（那在 system prompt 里），而是**事后**独立评分
 */

export const AI_TASTE_CHECK_SYSTEM = `你是 Vincent 的写作风格审计师。

**任务**：评估给定文章的"AI 味"程度，给出 0-100 分 + 具体问题清单。

**评分维度（每项 0-25 分）**：

1. **语言自然度**（25 分）
   - 有没有"首先/其次/最后"机械罗列？（-5）
   - 有没有"从...可以看出"/"事实上"/"实际上"废话铺垫？（-3）
   - 有没有大量"的"字结构连用？（-3）
   - 句式是否均匀对称到失去节奏？（-5）
   - 读出声是否通顺？

2. **观点锐度**（25 分）
   - 有没有"两者都有道理"/"具体情况具体分析"中庸腔？（-10）
   - 有没有空洞术语堆砌（赋能 / 闭环 / 抓手 / 颗粒度 / 底层逻辑）？（-5/词）
   - 有没有"我们认为"/"我认为"开头泛泛而谈？（-3）
   - 是否有 Vincent 自己的判断（vs 通用观点）？（+5）

3. **数据真实性**（25 分）
   - 具体数字是否标注来源？（未标注 -5/数字）
   - 是否虚构"我们做过调研"/"研究表明"？（-10）
   - 是否有"按行业惯例推算"诚实标注？（+5）
   - 是否捏造研究机构 + 年份 + 数字？（-10）

4. **结构节奏**（25 分）
   - 开头 200 字是否直接切入？（废话铺垫 -10）
   - 是否每段都有判断（不是流水账）？（-5）
   - 长段落 > 150 字是否拆分？（-3/段）
   - 结尾是否有可执行建议 + 开放问题（不是道德总结）？（-5）

**0-100 评分规则**：
- 90-100：完美（极少见）
- 70-89：可用
- 50-69：需修改
- 30-49：AI 味重
- 0-29：AI 生成文章（必须重写）

**禁止词额外检查**：如果用户给了 bannedWords 列表，文中每出现 1 次扣 5 分。

**输出严格 JSON，不要 markdown 代码块**：
{
  "score": 0-100,
  "passed": true/false,  // score >= 70
  "issues": [
    {
      "category": "语言自然度 | 观点锐度 | 数据真实性 | 结构节奏 | 禁用词",
      "severity": "low | medium | high",
      "location": "第 X 段 / 全文",
      "quote": "原文片段（10-30 字）",
      "problem": "问题描述",
      "suggestion": "修改建议"
    }
  ],
  "highlights": [
    {
      "location": "第 X 段",
      "quote": "原文片段",
      "why": "为什么这是好的"
    }
  ],
  "summary": "一句话总结（如'语言自然度好但数据真实性有问题'）"
}`.trim();

export interface AITasteCheckResult {
  score: number;
  passed: boolean;
  issues: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high';
    location: string;
    quote: string;
    problem: string;
    suggestion: string;
  }>;
  highlights: Array<{
    location: string;
    quote: string;
    why: string;
  }>;
  summary: string;
}

import { getActiveKernelsForInjection } from '@insight-os/db';
import { callLLM } from '../../client.js';

export interface AITasteCheckInput {
  content: string;             // 待评估文章
  bannedWords?: string[];      // 用户禁用词
  outputType?: string;         // 'article_full' | 'speech' | 'book_note' | 'email'
  maxTokens?: number;
}

/**
 * 评估文章的 AI 味程度
 */
export async function aiTasteCheck(
  input: AITasteCheckInput
): Promise<{ ok: boolean; data?: AITasteCheckResult; error?: string }> {
  if (!input.content || input.content.trim().length < 50) {
    return { ok: false, error: '文章内容太短（< 50 字）' };
  }

  const bannedWordsBlock = input.bannedWords && input.bannedWords.length > 0
    ? `\n\n## 用户禁用词（每出现 1 次扣 5 分）\n${input.bannedWords.join('、')}`
    : '';

  const outputTypeBlock = input.outputType
    ? `\n\n## 输出类型\n${input.outputType}（不同类型要求略不同：邮件要简洁，演讲要口语化，文章要有锐度）`
    : '';

  const userPrompt = `## 待评估文章

${input.content}
${bannedWordsBlock}
${outputTypeBlock}

请按评分维度评估并输出 JSON。`;

  const kernel = getActiveKernelsForInjection();
  const result = await callLLM<AITasteCheckResult>(
    AI_TASTE_CHECK_SYSTEM,
    userPrompt,
    {
      temperature: 0.2,  // 评估要稳定
      maxTokens: input.maxTokens ?? 1500,
      jsonMode: true,
      kernel,
    }
  );

  if (!result.ok || !result.data) {
    return { ok: false, error: result.error ?? 'AI 味自检失败' };
  }
  return { ok: true, data: result.data };
}