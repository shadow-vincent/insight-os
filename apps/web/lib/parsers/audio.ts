/**
 * 音频转写 - W5 实现
 *
 * 支持：mp3 / m4a / wav / 小宇宙 URL
 *
 * W5 集成阿里 FunASR 本地 HTTP 服务
 */

import type { ParseResult, SourceType } from './types.js';

/**
 * 音频文件转写（占位 - W5 集成）
 */
export async function parseAudio(filePath: string): Promise<ParseResult> {
  return {
    segments: [{
      text: `[音频转写开发中] ${filePath}\n\nW5 集成阿里 FunASR 本地服务（paraformer-zh）`,
      metadata: { filePath, status: 'pending_asr' },
    }],
    sourceType: 'audio',
    detectedKind: 'audio',
    totalChars: 0,
    fileName: filePath,
  };
}

/**
 * 小宇宙播客（占位 - W5 集成）
 */
export async function parseXiaoyuzhou(url: string): Promise<ParseResult> {
  return {
    segments: [{
      text: `[小宇宙播客开发中] ${url}\n\nW5 集成小宇宙 API + FunASR 转写`,
      metadata: { url, status: 'pending' },
    }],
    sourceType: 'xiaoyuzhou',
    detectedKind: 'url',
    totalChars: 0,
  };
}