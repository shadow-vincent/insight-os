/**
 * 3 套 ship-ready 写作风格预设
 *
 * 1. Vincent 标准版 — 公众号长文 · 顾问式 · 2500 字
 * 2. 客户沟通版 — 邮件/短报告 · 温和 · 800 字
 * 3. 学术严谨版 — 论文/研究报告 · 数据驱动 · 4000 字
 */

import type { WritingConfig } from './writing-config.js';

// ============================================
// 预设 1 · Vincent 标准版
// ============================================

export const PRESET_VINCENT_STANDARD: WritingConfig = {
  name: 'vincent-standard',
  outputType: 'article_full',
  description: '专业顾问的对外发声 · 公众号长文 · 偏观点输出',
  forkedFrom: null,
  updatedAt: 1719000000000, // 首次 ship 时间
  dimensions: {
    style: {
      tone: 70,
      stance: 'advisory',
      persona: '资深独立顾问',
      viewpoint: 'second',
      termDensity: 'medium',
      temperature: 0.6,
    },
    sentence: {
      rhythm: 'mixed',
      shortRatio: 0.4,
      paragraphLength: 120,
      rhetoric: ['analogy', 'rhetorical'],
    },
    structure: {
      headingStyle: 'numbered-question',
      corePosition: 'opening',
      argumentPattern: 'total-detail-total',
      sectionCount: 5,
      ending: 'call-to-action',
    },
    length: {
      targetWords: 2500,
      sectionCount: 5,
      perSectionWords: 500,
      variants: 1,
      keyQuotes: 3,
    },
    quality: {
      citationLimit: 5,
      bannedWords: ['赋能', '抓手', '闭环', '对齐', '打通', '颗粒度', '底层逻辑'],
      dataFidelity: 'strict',
      aiTasteCheck: true,
      fewShotRefs: [],
    },
  },
  llmParams: {
    model: 'deepseek-chat',
    temperature: 0.6,
    topP: 0.9,
  },
};

// ============================================
// 预设 2 · 客户沟通版
// ============================================

export const PRESET_CLIENT_COMM: WritingConfig = {
  name: 'client-comm',
  outputType: 'email',
  description: '温和·叙事化·邮件 / 简短报告',
  forkedFrom: 'vincent-standard',
  updatedAt: 1719000000000,
  dimensions: {
    style: {
      tone: 80,
      stance: 'advisory',
      persona: '资深独立顾问',
      viewpoint: 'second',
      termDensity: 'low',
      temperature: 0.5,
    },
    sentence: {
      rhythm: 'short',
      shortRatio: 0.7,
      paragraphLength: 80,
      rhetoric: ['analogy', 'story'],
    },
    structure: {
      headingStyle: 'statement',
      corePosition: 'opening',
      argumentPattern: 'total-detail-total',
      sectionCount: 3,
      ending: 'summary',
    },
    length: {
      targetWords: 800,
      sectionCount: 3,
      perSectionWords: 250,
      variants: 1,
      keyQuotes: 1,
    },
    quality: {
      citationLimit: 2,
      bannedWords: ['赋能', '抓手', '闭环'],
      dataFidelity: 'loose',
      aiTasteCheck: true,
      fewShotRefs: [],
    },
  },
  llmParams: {
    model: 'deepseek-chat',
    temperature: 0.5,
    topP: 0.9,
  },
};

// ============================================
// 预设 3 · 学术严谨版
// ============================================

export const PRESET_ACADEMIC: WritingConfig = {
  name: 'academic',
  outputType: 'article_full',
  description: '严谨·数据驱动·论文 / 研究报告',
  forkedFrom: 'vincent-standard',
  updatedAt: 1719000000000,
  dimensions: {
    style: {
      tone: 30,
      stance: 'neutral',
      persona: '研究员',
      viewpoint: 'third',
      termDensity: 'high',
      temperature: 0.3,
    },
    sentence: {
      rhythm: 'long',
      shortRatio: 0.2,
      paragraphLength: 200,
      rhetoric: ['data', 'metaphor'],
    },
    structure: {
      headingStyle: 'numbered-question',
      corePosition: 'opening',
      argumentPattern: 'progressive',
      sectionCount: 6,
      ending: 'summary',
    },
    length: {
      targetWords: 4000,
      sectionCount: 6,
      perSectionWords: 650,
      variants: 1,
      keyQuotes: 2,
    },
    quality: {
      citationLimit: 15,
      bannedWords: ['赋能', '抓手'],
      dataFidelity: 'strict',
      aiTasteCheck: true,
      fewShotRefs: [],
    },
  },
  llmParams: {
    model: 'deepseek-chat',
    temperature: 0.3,
    topP: 0.85,
  },
};

/** 全部 ship-ready presets 列表 */
export const SHIP_READY_PRESETS = [
  PRESET_VINCENT_STANDARD,
  PRESET_CLIENT_COMM,
  PRESET_ACADEMIC,
] as const;
