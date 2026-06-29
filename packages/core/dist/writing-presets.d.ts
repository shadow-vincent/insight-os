/**
 * 3 套 ship-ready 写作风格预设
 *
 * 1. Vincent 标准版 — 公众号长文 · 顾问式 · 2500 字
 * 2. 客户沟通版 — 邮件/短报告 · 温和 · 800 字
 * 3. 学术严谨版 — 论文/研究报告 · 数据驱动 · 4000 字
 */
import type { WritingConfig } from './writing-config.js';
export declare const PRESET_VINCENT_STANDARD: WritingConfig;
export declare const PRESET_CLIENT_COMM: WritingConfig;
export declare const PRESET_ACADEMIC: WritingConfig;
/** 全部 ship-ready presets 列表 */
export declare const SHIP_READY_PRESETS: readonly [WritingConfig, WritingConfig, WritingConfig];
