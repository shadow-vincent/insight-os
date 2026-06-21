/**
 * 数据真实性深度校验（V1.2）
 *
 * 用途：生成文章后扫描数字 + 标"来源：待核实"占位
 *
 * 设计：
 *   - 正则扫所有数字（百分比、绝对值、年份、$等）
 *   - 对每个数字检查上下文是否有"按 XX 推算"/"研究表明"等模糊引用
 *   - 输出每个数字的来源状态：已标注 / 未标注 / 推算 / 待核实
 *   - 不强制修改文章，但返回 list 让 UI 高亮显示
 *
 * 比 L3 数据真实性规则更细：自动扫描而不是靠 LLM 自觉
 */

export interface NumberCheck {
  text: string;          // 原文片段（含数字）
  position: number;      // 在文章中的字符位置
  number: string;        // 数字本身
  context: string;       // 前后 30 字
  source: 'cited' | 'inferred' | 'uncited' | 'industry-common';
  suggestions: string[]; // 标注建议（如「请标注：数据来源？XX 报告？年份？」）
}

const NUMBER_PATTERNS = [
  /\d+\.?\d*%/g,                          // 百分比 30% / 30.5%
  /\d+\.?\d*[万亿千百]/g,                  // 中文大数 3万 / 5亿
  /\$\d+\.?\d*[KMB]?/gi,                  // 美元 $50K
  /\d+\.?\d*\s*(人|家|个|次|条|篇|年|月|日|小时|分钟|倍)/g,  // 中文单位
  /\d{4}\s*年/g,                          // 年份 2024 年
  /第\s*\d+\s*[名章节页]/g,              // 第 X 名 / 第 X 章
];

/**
 * 扫描文章中的所有数字 + 标注状态
 */
export function scanNumbers(content: string): NumberCheck[] {
  const results: NumberCheck[] = [];
  const seen = new Set<number>();  // 去重位置

  for (const pattern of NUMBER_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const position = match.index;
      if (seen.has(position)) continue;
      seen.add(position);

      const number = match[0];
      const contextStart = Math.max(0, position - 30);
      const contextEnd = Math.min(content.length, position + number.length + 30);
      const context = content.slice(contextStart, contextEnd);

      const source = inferSource(context, number);
      const suggestions = buildSuggestions(source, number, context);

      results.push({
        text: match[0],
        position,
        number,
        context,
        source,
        suggestions,
      });
    }
  }

  return results;
}

/**
 * 推断数字的来源状态
 */
function inferSource(context: string, number: string): NumberCheck['source'] {
  // 1. 已标注（有具体研究 / 来源 / 报告 / 引用）
  if (/(?:据|根据|引自|来源|出自|《[^》]+》|\d{4}\s*年[^，。]*研究|\d{4}\s*年[^，。]*报告)/.test(context)) {
    return 'cited';
  }
  // 2. 推算（按 XX 推算 / 估算 / 推断 / 大约 / 大概）
  if (/(?:按[^，。]*推算|按[^，。]*估算|推断|估计|大约|大概|约|左右|粗略|大致|差不多)/.test(context)) {
    return 'inferred';
  }
  // 3. 行业通用（一般 / 通常 / 普遍 / 行业惯例）
  if (/(?:一般|通常|普遍|行业惯例|业内|一般来说|一般情况下)/.test(context)) {
    return 'industry-common';
  }
  // 4. 未标注（默认）
  return 'uncited';
}

/**
 * 给未标注 / 推算的数字生成建议
 */
function buildSuggestions(source: NumberCheck['source'], number: string, context: string): string[] {
  if (source === 'cited' || source === 'industry-common') return [];

  if (source === 'inferred') {
    return [
      '已标注为推算（保留「按 XX 推算」/「估算」措辞即可）',
      '如能补充具体来源更好',
    ];
  }

  // uncited
  const suggestions: string[] = [];
  // 检测是不是研究 / 数据类
  if (/(调研|研究|数据|统计|显示|表明|发现)/.test(context)) {
    suggestions.push('看起来是研究/统计数据，请标注具体来源（XX 报告 + 年份）');
    suggestions.push('如果不确定来源，标注「按行业惯例推算，待核实」');
  } else if (/(增长|下降|提高|降低|增加|减少|多|少|大|小|快|慢)/.test(context)) {
    suggestions.push('比较类数字请标注「相对 XX 而言」或具体来源');
  } else {
    suggestions.push('请标注这个数字的来源（具体研究/报告/官方数据）');
    suggestions.push('如果来源不明确，标注「按 Vincent 经验推算」');
  }
  return suggestions;
}

/**
 * 把扫描结果格式化为人类可读的摘要
 */
export function summarizeNumberChecks(checks: NumberCheck[]): {
  total: number;
  cited: number;
  inferred: number;
  uncited: number;
  industryCommon: number;
  issues: string[];   // 给 LLM 的修改建议（合并去重）
} {
  const summary = {
    total: checks.length,
    cited: 0,
    inferred: 0,
    uncited: 0,
    industryCommon: 0,
    issues: [] as string[],
  };

  const issueSet = new Set<string>();
  for (const c of checks) {
    summary[c.source === 'uncited' ? 'uncited' : c.source === 'inferred' ? 'inferred' : c.source === 'industry-common' ? 'industryCommon' : 'cited']++;
    for (const s of c.suggestions) {
      issueSet.add(s);
    }
  }
  summary.issues = Array.from(issueSet);
  return summary;
}