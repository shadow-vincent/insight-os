/**
 * 长文本 chunker
 *
 * 按 sourceType 自动选择切分策略：
 * - 短文本（< 8000 字）：单段
 * - 书（epub / pdf / docx / pptx）：按章节 / 段落切
 * - 视频字幕：按 5 分钟一段
 * - 文章：单段
 *
 * 切完每段独立抽卡
 */

import type { ParsedSegment, SourceType } from './types.js';

const SHORT_TEXT_LIMIT = 8000;  // 单段上限
const VIDEO_CHUNK_SECONDS = 300; // 视频 5 分钟一段

/**
 * 主入口
 */
export function chunkText(
  fullText: string,
  sourceType: SourceType,
  options?: {
    title?: string;
    // 字幕专用
    subtitles?: SubtitleCue[];
  }
): ParsedSegment[] {
  const text = fullText.trim();

  // 短文本直接返回
  if (text.length <= SHORT_TEXT_LIMIT) {
    return [{ text, title: options?.title }];
  }

  // 视频字幕
  if (sourceType === 'youtube' || sourceType === 'bilibili' || sourceType === 'subtitle' || sourceType === 'xiaoyuzhou') {
    if (options?.subtitles && options.subtitles.length > 0) {
      return chunkSubtitles(options.subtitles);
    }
    // 无字幕结构（纯文本）按段落切
    return chunkByParagraphs(text);
  }

  // 长文档（书 / 长 PDF / docx / pptx / epub）
  if (sourceType === 'epub' || sourceType === 'pdf' || sourceType === 'docx' ||
      sourceType === 'pptx' || sourceType === 'xlsx' || sourceType === 'markdown') {
    return chunkLongDocument(text);
  }

  // 默认按段落切
  return chunkByParagraphs(text);
}

/**
 * 字幕 chunk（按时间窗口）
 */
function chunkSubtitles(cues: SubtitleCue[]): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let bucket: SubtitleCue[] = [];
  let bucketStart = cues[0]?.start ?? 0;
  let bucketEnd = 0;

  function flush() {
    if (bucket.length === 0) return;
    const text = bucket.map(c => c.text).join(' ');
    const minSec = Math.floor(bucketStart / 60);
    const title = `${Math.floor(minSec / 60)}:${String(minSec % 60).padStart(2, '0')}`;
    segments.push({ text, title, metadata: { startSec: bucketStart, endSec: bucketEnd } });
  }

  for (const cue of cues) {
    if (cue.start - bucketStart >= VIDEO_CHUNK_SECONDS && bucket.length > 0) {
      flush();
      bucket = [];
      bucketStart = cue.start;
    }
    bucket.push(cue);
    bucketEnd = cue.end;
  }
  flush();
  return segments;
}

/**
 * 长文档 chunk（按章节 / 段落）
 */
function chunkLongDocument(text: string): ParsedSegment[] {
  // 先尝试按章节切（# / ## / 章节 等标识）
  const chapterChunks = chunkByChapters(text);
  if (chapterChunks.length >= 2) return chapterChunks;

  // 没有章节标识，按段落切 + 合并到 SHORT_TEXT_LIMIT
  return chunkByParagraphs(text);
}

/**
 * 按章节切（识别 # / ## / 第三章 / Chapter X 等）
 */
function chunkByChapters(text: string): ParsedSegment[] {
  const lines = text.split('\n');
  const chapters: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    // Markdown 标题
    const mdMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    // 中文章节
    const cnMatch = trimmed.match(/^(第[一二三四五六七八九十百千]+[章节]|Chapter\s+\d+|CHAPTER\s+[IVX]+)/);
    if (mdMatch || cnMatch) {
      if (current) chapters.push(current);
      const title = mdMatch ? mdMatch[2] : trimmed;
      current = { title, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) chapters.push(current);

  // 过滤掉太短的章节
  return chapters
    .filter(c => c.body.join('').trim().length > 100)
    .map(c => ({
      text: `${c.title}\n\n${c.body.join('\n').trim()}`,
      title: c.title,
    }));
}

/**
 * 按段落切 + 合并到 SHORT_TEXT_LIMIT
 */
function chunkByParagraphs(text: string): ParsedSegment[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const segments: ParsedSegment[] = [];
  let bucket: string[] = [];
  let bucketLen = 0;

  function flush() {
    if (bucket.length === 0) return;
    segments.push({ text: bucket.join('\n\n') });
    bucket = [];
    bucketLen = 0;
  }

  for (const p of paragraphs) {
    if (bucketLen + p.length > SHORT_TEXT_LIMIT && bucket.length > 0) {
      flush();
    }
    bucket.push(p);
    bucketLen += p.length;
  }
  flush();
  return segments;
}

/**
 * 字幕 cue 结构（来自 SRT/VTT parser）
 */
export interface SubtitleCue {
  start: number;  // 秒
  end: number;    // 秒
  text: string;
}