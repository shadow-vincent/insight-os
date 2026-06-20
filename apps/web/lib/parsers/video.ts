/**
 * 视频字幕解析 - W4 实现
 *
 * 支持：YouTube / B 站 URL + .srt/.vtt 字幕文件
 *
 * W4 集成：
 * - YouTube: youtube-transcript npm
 * - B 站: bilibili API 解析字幕
 * - .srt/.vtt: 自写 parser
 */

import type { ParseResult, SourceType, ParsedSegment } from './types.js';
import type { SubtitleCue } from './chunker.js';

/**
 * YouTube 字幕（占位 - W4 集成）
 */
export async function parseYouTube(url: string): Promise<ParseResult> {
  return {
    segments: [{
      text: `[YouTube 字幕开发中] ${url}\n\nW4 集成 youtube-transcript npm`,
      metadata: { url, status: 'pending' },
    }],
    sourceType: 'youtube',
    detectedKind: 'url',
    totalChars: 0,
  };
}

/**
 * B 站字幕（占位 - W4 集成）
 */
export async function parseBilibili(url: string): Promise<ParseResult> {
  return {
    segments: [{
      text: `[B 站字幕开发中] ${url}\n\nW4 集成 B 站 API 字幕`,
      metadata: { url, status: 'pending' },
    }],
    sourceType: 'bilibili',
    detectedKind: 'url',
    totalChars: 0,
  };
}

/**
 * SRT 字幕文件解析
 */
export function parseSrt(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = text.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // 第一行可能是序号，跳过
    let timeLine = lines[0];
    if (!timeLine.includes('-->')) {
      timeLine = lines[1];
    }

    const match = timeLine.match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) continue;

    const start = (+match[1]) * 3600 + (+match[2]) * 60 + (+match[3]);
    const end = (+match[5]) * 3600 + (+match[6]) * 60 + (+match[7]);
    const cueText = lines.slice(lines.indexOf(timeLine) + 1).join(' ');

    cues.push({ start, end, text: cueText });
  }

  return cues;
}

/**
 * VTT 字幕文件解析（结构类似 SRT，多了 header）
 */
export function parseVtt(text: string): SubtitleCue[] {
  // VTT 第一行是 WEBVTT 头，剥掉
  const body = text.replace(/^WEBVTT.*?\n\n/s, '');
  return parseSrt(body);
}