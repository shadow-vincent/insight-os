/**
 * 5 维度配置 → 自然语言段
 *
 * 把用户的 5 维度配置（A 风格 / B 句式 / C 结构 / D 长度 / E 质检）
 * 序列化成 LLM 可读的自然语言，注入到 prompt 中。
 *
 * 设计：不用 JSON 表格，用自然语言段落，让 LLM 更容易理解每个维度的"含义"
 * 而不是"参数值"。
 */

import type { WritingConfig } from '@insight-os/core';

// ============================================
// 中文标签映射（人话）
// ============================================

const STANCE_LABELS = {
  neutral: '中立陈述',
  advisory: '顾问式建议（推荐这个，给理由）',
  critical: '批判（指出问题，不留情面）',
  coach: '教练（提问引导，让读者自己想到）',
} as const;

const VIEWPOINT_LABELS = {
  first: '第一人称（"我"）',
  second: '第二人称为主（"你"）',
  third: '第三人称（"他们"/"人们"）',
  mixed: '混合（不固定）',
} as const;

const TERM_DENSITY_LABELS = {
  low: '低（少用术语，多用大白话）',
  medium: '中（必要术语 + 通俗解读）',
  high: '高（专业读者，能用术语就用）',
} as const;

const RHYTHM_LABELS = {
  short: '短句主导（30-50 字/句）',
  mixed: '长短交替（默认推荐）',
  long: '长句主导（80+ 字/句）',
} as const;

const RHETORIC_LABELS = {
  metaphor: '比喻',
  analogy: '类比',
  rhetorical: '反问',
  story: '故事',
  data: '数据/案例',
} as const;

const HEADING_LABELS = {
  'numbered-question': '数字+提问（如"3 个误区"）',
  question: '纯提问',
  statement: '陈述型',
  parallel: '对仗型',
} as const;

const POSITION_LABELS = {
  title: '标题中',
  opening: '首段',
  middle: '中段',
  ending: '结尾',
} as const;

const ARGUMENT_LABELS = {
  'total-detail-total': '总分总（先抛观点，再展开，最后回扣）',
  progressive: '层层递进（一步步深入）',
  parallel: '并列展开（几个独立点）',
  contrast: '正反对照（两方对比）',
} as const;

const ENDING_LABELS = {
  'call-to-action': '行动呼吁（具体可做）',
  quote: '金句收尾',
  open: '留白（让读者自己想）',
  summary: '总结',
} as const;

const FIDELITY_LABELS = {
  strict: '严格（所有数字必须可核实）',
  loose: '宽松（行业通用数据可接受）',
  none: '不约束',
} as const;

// ============================================
// 主入口
// ============================================

/**
 * 把 5 维度配置序列化为自然语言段
 * 输出会作为 L3 配置层注入到 L2 模板的 {{dimensions}} 占位符
 */
export function serializeDimensions(dims: WritingConfig['dimensions']): string {
  const { style, sentence, structure, length, quality } = dims;

  const toneLabel = style.tone > 60 ? '温暖' : style.tone > 30 ? '中性' : '冷峻';
  const shortPct = Math.round(sentence.shortRatio * 100);

  return `
# 5 维度配置（用户定制 · 当前激活: ${style.persona}）

## A 风格

- **语气温度**: ${style.tone}/100（${toneLabel}）
- **立场**: ${STANCE_LABELS[style.stance]}
- **人设**: 你是"${style.persona}"在说话
- **视角**: ${VIEWPOINT_LABELS[style.viewpoint]}
- **术语密度**: ${TERM_DENSITY_LABELS[style.termDensity]}
- **LLM 创造性** (temperature): ${style.temperature.toFixed(2)}

## B 句式

- **节奏**: ${RHYTHM_LABELS[sentence.rhythm]}
- **短句占比**: ${shortPct}%
- **段落字数**: ${sentence.paragraphLength} 中文字（LLM 实际浮动 ±30%）
- **修辞偏好**: ${sentence.rhetoric.length > 0 ? sentence.rhetoric.map(r => RHETORIC_LABELS[r]).join('、') : '无特殊偏好'}

## C 结构

- **标题风格**: ${HEADING_LABELS[structure.headingStyle]}
- **核心位置**: 核心观点在${POSITION_LABELS[structure.corePosition]}就出现
- **论证模式**: ${ARGUMENT_LABELS[structure.argumentPattern]}
- **章节数**: ${structure.sectionCount}
- **收尾**: ${ENDING_LABELS[structure.ending]}

## D 长度

- **目标字数**: ${length.targetWords} 字
- **章节数**: ${length.sectionCount}
- **单章字数**: ${length.perSectionWords} 字
- **变体数**: ${length.variants}（同一输出的不同开头）
- **关键金句**: ${length.keyQuotes} 个

## E 质检

- **引用上限**: ${quality.citationLimit} 处（含德鲁克或其他任何人的直接引用）
- **禁用词**: ${quality.bannedWords.length > 0 ? quality.bannedWords.join('、') : '无'}
- **数据真实性**: ${FIDELITY_LABELS[quality.dataFidelity]}
- **AI 味自检**: ${quality.aiTasteCheck ? '开启（生成后会用独立 prompt 评估）' : '关闭'}
- **few-shot 引用**: ${quality.fewShotRefs.length} 个
`.trim();
}
