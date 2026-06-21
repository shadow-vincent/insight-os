/**
 * PDF 解析
 *
 * pdf-parse 2.x 是 class API（不再 export default function）
 */

import { readFileSync } from 'node:fs';
// @ts-ignore - pdf-parse 无官方 .d.ts 在 ESM 路径
import { PDFParse } from 'pdf-parse';
import type { ParseResult, SourceType } from './types.js';
import { chunkText } from './chunker';

/**
 * PDF → 纯文本 + 自动 chunk
 */
export async function parsePdf(filePath: string, sourceType: SourceType): Promise<ParseResult> {
  let buffer: Buffer;
  try {
    buffer = readFileSync(filePath);
  } catch (e: any) {
    throw new Error(`无法读取 PDF 文件: ${e.message}`);
  }

  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    let result: Awaited<ReturnType<typeof parser.getText>>;
    try {
      result = await parser.getText();
    } catch (e: any) {
      // pdf-parse 解析失败：文件损坏、加密、非标准 PDF
      throw new Error(`PDF 解析失败（文件可能损坏或加密）：${e.message ?? e}`);
    }

    const fullText = result.text || '';

    if (fullText.trim().length === 0) {
      throw new Error('PDF 无可提取文本（可能是扫描版 PDF / 图片 PDF，需要 OCR）');
    }

    // 长 PDF（> 8000 字）按章节切，避免 LLM 截断
    return {
      segments: chunkText(fullText, sourceType, { title: 'PDF' }),
      sourceType,
      detectedKind: 'file',
      totalChars: fullText.length,
      rawMeta: {
        filePath,
        numPages: result.total ?? 0,
      },
    };
  } finally {
    await parser.destroy();
  }
}