/**
 * Parser 类型定义 - V1.1 inbox 多场景输入
 */

export type SourceType =
  | 'manual'           // 手动粘贴
  | 'web'              // 任意网页
  | 'weixin_article'   // 公众号
  | 'note'             // 随手记
  | 'transcript'       // 会议转录
  | 'quote'            // 引文金句
  // V1.1 新增
  | 'image'            // 截图 OCR
  | 'youtube'          // YouTube 字幕
  | 'bilibili'         // B 站字幕
  | 'subtitle'         // .srt/.vtt 字幕文件
  | 'audio'            // mp3/m4a/wav 音频转写
  | 'xiaoyuzhou'       // 小宇宙播客
  | 'weread'           // 微信读书
  | 'kindle'           // Kindle 高亮
  | 'epub'             // epub/mobi/azw3 电子书
  | 'docx'             // Word
  | 'pptx'             // PPT
  | 'xlsx'             // Excel
  | 'pdf'              // PDF（已有）
  | 'markdown';        // md（已有）

export type InputKind = 'text' | 'url' | 'file' | 'image' | 'audio';

/**
 * 解析后的统一文本段
 * chunker 切分后每段会被独立抽卡
 */
export interface ParsedSegment {
  text: string;
  title?: string;            // 用于章节标题、视频分段等
  metadata?: Record<string, any>;
}

export interface ParseResult {
  segments: ParsedSegment[];
  sourceType: SourceType;
  detectedKind: InputKind;
  totalChars: number;
  fileName?: string;
  fileMime?: string;
  rawMeta?: Record<string, any>;
}

export interface ParseError {
  ok: false;
  error: string;
  code: string;
}