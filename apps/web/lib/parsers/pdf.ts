/**
 * PDF 解析
 *
 * pdf-parse 2.x 是 class API（不再 export default function）
 */

import { readFileSync } from 'node:fs';
// @ts-ignore - pdf-parse 无官方 .d.ts 在 ESM 路径
import { PDFParse } from 'pdf-parse';
import type { ParseResult, SourceType } from './types.js';

/**
 * PDF → 纯文本
 */
export async function parsePdf(filePath: string, sourceType: SourceType): Promise<ParseResult> {
  const buffer = readFileSync(filePath);

  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    const fullText = result.text || '';

    if (fullText.trim().length === 0) {
      throw new Error('PDF 无可提取文本（可能是扫描版 PDF / 图片 PDF）');
    }

    return {
      segments: [{ text: fullText }],
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