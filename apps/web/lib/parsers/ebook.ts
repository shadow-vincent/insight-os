/**
 * 读书笔记 / 电子书 - W3 + W5 实现
 *
 * 支持：epub / mobi / azw3 / 微信读书 / Kindle
 */

import type { ParseResult, SourceType } from './types.js';

/**
 * 电子书解析（占位 - W3 集成）
 */
export async function parseEbook(filePath: string): Promise<ParseResult> {
  return {
    segments: [{
      text: `[电子书解析开发中] ${filePath}\n\nW3 集成 epub2 npm + calibre（mobi/azw3）`,
      metadata: { filePath, status: 'pending' },
    }],
    sourceType: 'epub',
    detectedKind: 'file',
    totalChars: 0,
    fileName: filePath,
  };
}

/**
 * 微信读书笔记（占位 - W5 集成）
 */
export async function parseWeRead(filePath: string): Promise<ParseResult> {
  return {
    segments: [{
      text: `[微信读书解析开发中] ${filePath}\n\nW5 解析官方 .md 导出`,
      metadata: { filePath, status: 'pending' },
    }],
    sourceType: 'weread',
    detectedKind: 'file',
    totalChars: 0,
    fileName: filePath,
  };
}

/**
 * Kindle 高亮（占位 - W5 集成）
 */
export async function parseKindle(filePath: string): Promise<ParseResult> {
  return {
    segments: [{
      text: `[Kindle 高亮解析开发中] ${filePath}\n\nW5 解析官方 .txt 导出`,
      metadata: { filePath, status: 'pending' },
    }],
    sourceType: 'kindle',
    detectedKind: 'file',
    totalChars: 0,
    fileName: filePath,
  };
}