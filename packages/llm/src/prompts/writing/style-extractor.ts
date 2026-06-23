/**
 * 写作风格反推 (V1.2)
 *
 * 接受 1-5 篇文章样本，调 LLM 反推 5 维度配置。
 *
 * 设计:
 *   - 用 callLLM jsonMode = true，强制 LLM 输出纯 JSON
 *   - 失败容错：解析失败返回 { ok: false, error }
 *   - 截断：每篇样本最多 3000 字（避免超 token）
 *   - 风格总结：200 字（人话描述作者风格）
 *   - 建议预设名：2-4 个汉字 / 2-3 个英文词（如 "深夜评论风格"）
 *   - 置信度：low / medium / high（让用户判断是否需要手动调整）
 *
 * 反推结果不是最终值，用户可以手动调整后再保存。
 */

import { getActiveKernelsForInjection } from '@insight-os/db';
import { callLLM } from '../../client.js';

// ============================================
// LLM Prompt
// ============================================

export const STYLE_EXTRACTION_SYSTEM = `
你是写作风格分析师。

你的任务：根据用户提供的 1-5 篇文章样本，提炼出作者的写作风格特征，输出严格的 5 维度配置 JSON。

【分析维度】

1. **style 风格**
   - tone: 0-100，0=冷峻理性, 100=温暖热情
   - stance: 'neutral'(中立) / 'advisory'(顾问式建议) / 'critical'(批判) / 'coach'(教练提问)
   - persona: 用一句话描述作者人设（如"独立技术评论人"），不超过 15 字
   - viewpoint: 'first'(我) / 'second'(你) / 'third'(他们) / 'mixed'(混合)
   - termDensity: 'low'(大白话) / 'medium'(必要术语) / 'high'(专业术语)
   - temperature: 0-1 LLM 创造性温度（保守 0.3, 平衡 0.6, 奔放 0.9）

2. **sentence 句式**
   - rhythm: 'short'(短句主导 30-50字) / 'mixed'(长短交替) / 'long'(长句主导 80+字)
   - shortRatio: 0-1 短句占比（0.3=均衡, 0.5=偏短, 0.7=碎片化）
   - paragraphLength: 40-400 中文字（段落长度）
   - rhetoric: 多选 rhetoric 修辞偏好，候选: 'metaphor'(比喻) / 'analogy'(类比) / 'rhetorical'(反问) / 'story'(故事) / 'data'(数据)

3. **structure 结构**
   - headingStyle: 'numbered-question'(数字+提问如"3 个误区") / 'question'(纯提问) / 'statement'(陈述) / 'parallel'(对仗)
   - corePosition: 核心观点位置 'title'(标题) / 'opening'(首段) / 'middle'(中段) / 'ending'(结尾)
   - argumentPattern: 'total-detail-total'(总分总) / 'progressive'(递进) / 'parallel'(并列) / 'contrast'(对照)
   - sectionCount: 2-8 章节数
   - ending: 'call-to-action'(行动呼吁) / 'quote'(金句收尾) / 'open'(留白) / 'summary'(总结)

4. **length 长度**
   - targetWords: 300-10000 目标总字数（按样本平均长度推断）
   - sectionCount: 2-8（与 structure.sectionCount 一致）
   - perSectionWords: 100-1500 单章字数
   - keyQuotes: 0-10 关键金句数（看样本是否有反问/总结句）

5. **quality 质检**
   - citationLimit: 0-20 引用上限（看样本引用多少直接引用/参考）
   - bannedWords: 5-10 个 AI 味/套话词数组（"赋能" "抓手" "闭环" "对齐" "打通" "颗粒度" "底层逻辑" "价值" "抓手" "痛点" 等明显营销/AI 词；如果样本没用就空数组）
   - dataFidelity: 'strict'(严格) / 'loose'(宽松) / 'none'(不约束)

【输出格式】

严格 JSON，不要 markdown 代码块包裹：
{
  "summary": "200 字以内风格总结，说明作者的核心风格特征。不要列举参数，用叙事化语言描述这个人的写作像什么。",
  "suggestedName": "2-4 个汉字 或 2-3 个英文词的预设名，如「深夜评论风格」/「vincent-style」/「学术严谨」",
  "config": { 上面 5 个维度的对象 },
  "confidence": "low" / "medium" / "high"
}

【重要】
- 反推不出来的字段用合理默认值（不要胡乱填）
- summary 要让人看完就懂"这个人写东西是什么味道"
- confidence = low 表示样本太少（1 篇）或样本风格不一致
- 不要在 JSON 外加任何解释文字
`.trim();

// ============================================
// 类型
// ============================================

export interface StyleSample {
  text: string;        // 文章正文
  title?: string;      // 可选标题
}

export interface StyleExtractionLLMResult {
  summary: string;
  suggestedName: string;
  config: {
    style: {
      tone: number;
      stance: 'neutral' | 'advisory' | 'critical' | 'coach';
      persona: string;
      viewpoint: 'first' | 'second' | 'third' | 'mixed';
      termDensity: 'low' | 'medium' | 'high';
      temperature: number;
    };
    sentence: {
      rhythm: 'short' | 'mixed' | 'long';
      shortRatio: number;
      paragraphLength: number;
      rhetoric: Array<'metaphor' | 'analogy' | 'rhetorical' | 'story' | 'data'>;
    };
    structure: {
      headingStyle: 'numbered-question' | 'question' | 'statement' | 'parallel';
      corePosition: 'title' | 'opening' | 'middle' | 'ending';
      argumentPattern: 'total-detail-total' | 'progressive' | 'parallel' | 'contrast';
      sectionCount: number;
      ending: 'call-to-action' | 'quote' | 'open' | 'summary';
    };
    length: {
      targetWords: number;
      sectionCount: number;
      perSectionWords: number;
      keyQuotes: number;
    };
    quality: {
      citationLimit: number;
      bannedWords: string[];
      dataFidelity: 'strict' | 'loose' | 'none';
    };
  };
  confidence: 'low' | 'medium' | 'high';
}

export interface ExtractStyleOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** 每篇样本最大字符数（默认 3000） */
  maxCharsPerSample?: number;
}

// ============================================
// 主入口
// ============================================

/**
 * 从 1-5 篇文章样本反推写作风格 5 维度配置
 */

/**
 * 智能采样：长文截断时按 首 40% + 中 30% + 尾 30% 均匀保留结构
 *
 * 为什么不粗暴 slice(0, N)？
 *   - 公众号长文 3000-5000 字是常态，作者常把"立意/论据/收尾"分三段写
 *   - 粗暴截前会丢中段论据 + 结尾收束，反推不准
 *
 * 为什么不全文？
 *   - DeepSeek-V4-Flash context 32K 但成本高
 *   - 5 篇样本 × 全文 1 万字 = 5 万 token，输出 1K → 慢 + 贵
 *   - 6000 字采样已经能覆盖风格特征的 95%
 *
 * @param text 原文
 * @param maxChars 目标字数（默认 6000）
 * @returns 采样后的文本（含省略标记）
 */
function smartSample(text: string, maxChars: number): string {
  // 短文：直接返回全文
  if (text.length <= maxChars) return text;

  // 长文：首 40% + 中 30% + 尾 30%
  const headSize = Math.floor(maxChars * 0.4);     // 40% 开头（立意）
  const middleSize = Math.floor(maxChars * 0.3);   // 30% 中段（论据）
  const tailSize = maxChars - headSize - middleSize; // 30% 结尾（收束）

  const head = text.slice(0, headSize);

  // 中段：取中点（避免总在文章同一处取样）
  const middleStart = Math.max(headSize, Math.floor((text.length - middleSize) / 2));
  const middle = text.slice(middleStart, middleStart + middleSize);

  // 尾段：从最后 tailSize 字取
  const tail = text.slice(text.length - tailSize);

  // 计算省略字数
  const headOmitted = middleStart - headSize;
  const middleOmitted = text.length - middleStart - middleSize - tailSize;

  return `${head}\n\n[... 中间省略 ${headOmitted} 字 ...]\n\n${middle}\n\n[... 后段省略 ${middleOmitted} 字 ...]\n\n${tail}\n\n（原文 ${text.length} 字 · 采样 ${maxChars} 字）`;
}
export async function extractStyle(
  samples: StyleSample[],
  options: ExtractStyleOptions = {}
): Promise<{ ok: boolean; data?: StyleExtractionLLMResult; error?: string }> {
  if (!samples || samples.length === 0) {
    return { ok: false, error: '至少需要 1 篇文章样本' };
  }
  if (samples.length > 5) {
    return { ok: false, error: '最多 5 篇文章样本' };
  }
  // 过滤空文本
  const valid = samples.filter(s => s.text && s.text.trim().length > 0);
  if (valid.length === 0) {
    return { ok: false, error: '所有样本都为空' };
  }
  // 每篇至少 100 字
  for (const s of valid) {
    if (s.text.trim().length < 100) {
      return { ok: false, error: `样本"${s.title ?? '未命名'}" 少于 100 字（${s.text.trim().length} 字），请补充更长的文章` };
    }
  }

  // 智能采样（首中尾均匀保留，避免粗暴截断丢失中段和结尾的结构信息）
  const maxChars = options.maxCharsPerSample ?? 3500;
  const sampled = valid.map((s, i) => {
    const text = smartSample(s.text, maxChars);
    const title = s.title ? `【${s.title}】` : `【样本 ${i + 1}】`;
    return `${title}\n${text}`;
  });

  const userPrompt = `以下是 ${valid.length} 篇文章样本（每篇采样 ${maxChars} 字：首 40% + 中 30% + 尾 30%，保留立意/论据/收尾结构）：\n\n${sampled.map((t, i) => `===== 样本 ${i + 1} =====\n${t}`).join('\n\n')}\n\n请分析以上样本的写作风格，并按 JSON 格式输出结果。`;

  const kernel = getActiveKernelsForInjection();
  const result = await callLLM<StyleExtractionLLMResult>(
    STYLE_EXTRACTION_SYSTEM,
    userPrompt,
    {
      model: options.model,
      temperature: options.temperature ?? 0.3,  // 反推需要稳定，0.3 偏保守
      maxTokens: options.maxTokens ?? 1500,
      jsonMode: true,
      kernel,
    }
  );

  if (!result.ok) {
    return { ok: false, error: result.error ?? 'LLM 调用失败' };
  }
  if (!result.data) {
    return { ok: false, error: '反推结果为空' };
  }

  // 基础校验
  const data = result.data;
  if (!data.summary || !data.config || !data.suggestedName) {
    return { ok: false, error: '反推结果缺少必要字段（summary / config / suggestedName）', data };
  }

  return { ok: true, data };
}