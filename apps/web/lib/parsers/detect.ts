/**
 * 类型识别器
 *
 * 输入：用户拖入 / 粘贴 / 输入 URL
 * 输出：SourceType + InputKind
 *
 * 识别顺序：file extension > mime > URL pattern
 */

import type { SourceType, InputKind } from './types.js';

/**
 * 文件扩展名 → SourceType 映射
 */
const EXT_MAP: Record<string, { type: SourceType; kind: InputKind }> = {
  // 文本
  '.txt':  { type: 'manual', kind: 'text' },
  '.md':   { type: 'markdown', kind: 'text' },
  '.markdown': { type: 'markdown', kind: 'text' },
  // 办公文档
  '.docx': { type: 'docx', kind: 'file' },
  '.doc':  { type: 'docx', kind: 'file' },
  '.pptx': { type: 'pptx', kind: 'file' },
  '.ppt':  { type: 'pptx', kind: 'file' },
  '.xlsx': { type: 'xlsx', kind: 'file' },
  '.xls':  { type: 'xlsx', kind: 'file' },
  // PDF
  '.pdf':  { type: 'pdf', kind: 'file' },
  // 电子书
  '.epub': { type: 'epub', kind: 'file' },
  '.mobi': { type: 'epub', kind: 'file' },
  '.azw3': { type: 'epub', kind: 'file' },
  // 字幕
  '.srt':  { type: 'subtitle', kind: 'file' },
  '.vtt':  { type: 'subtitle', kind: 'file' },
  // 音频
  '.mp3':  { type: 'audio', kind: 'audio' },
  '.m4a':  { type: 'audio', kind: 'audio' },
  '.wav':  { type: 'audio', kind: 'audio' },
  // 图片
  '.png':  { type: 'image', kind: 'image' },
  '.jpg':  { type: 'image', kind: 'image' },
  '.jpeg': { type: 'image', kind: 'image' },
  '.webp': { type: 'image', kind: 'image' },
  '.gif':  { type: 'image', kind: 'image' },
};

/**
 * Mime type → SourceType 兜底映射
 */
const MIME_MAP: Record<string, SourceType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
  'application/epub+zip': 'epub',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
};

/**
 * URL pattern → SourceType
 */
function detectUrlType(url: string): { type: SourceType; kind: InputKind } | null {
  // 公众号
  if (/mp\.weixin\.qq\.com/.test(url)) {
    return { type: 'weixin_article', kind: 'url' };
  }
  // YouTube
  if (/(?:youtube\.com|youtu\.be)/.test(url)) {
    return { type: 'youtube', kind: 'url' };
  }
  // B 站
  if (/(?:bilibili\.com|b23\.tv)/.test(url)) {
    return { type: 'bilibili', kind: 'url' };
  }
  // 小宇宙
  if (/xiaoyuzhou\.fm/.test(url)) {
    return { type: 'xiaoyuzhou', kind: 'url' };
  }
  // 微信读书
  if (/weread\.qq\.com/.test(url)) {
    return { type: 'weread', kind: 'url' };
  }
  // 其他任意 URL 当 web
  if (/^https?:\/\//.test(url)) {
    return { type: 'web', kind: 'url' };
  }
  return null;
}

/**
 * 检测 file name（包含扩展名）
 */
export function detectFromFileName(fileName: string): { type: SourceType; kind: InputKind } {
  const lower = fileName.toLowerCase();
  for (const [ext, info] of Object.entries(EXT_MAP)) {
    if (lower.endsWith(ext)) return info;
  }
  return { type: 'manual', kind: 'text' };
}

/**
 * 检测 mime type
 */
export function detectFromMime(mime: string): SourceType | null {
  return MIME_MAP[mime.toLowerCase()] ?? null;
}

/**
 * 检测 URL
 */
export function detectFromUrl(url: string): { type: SourceType; kind: InputKind } | null {
  return detectUrlType(url.trim());
}

/**
 * 文本中检测 URL（用于粘贴自动识别）
 */
export function detectUrlInText(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}