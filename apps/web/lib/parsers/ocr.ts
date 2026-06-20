/**
 * OCR 解析 - W2 实现
 *
 * 占位：返回 "功能开发中"
 * W2 集成 PaddleOCR 本地 HTTP 服务
 */

import type { ParseResult, SourceType } from './types.js';

export async function parseImage(
  filePath: string,
  _sourceType: SourceType
): Promise<ParseResult> {
  // W2 实现：调用 http://localhost:8765/ocr 上传图片，返回识别文本
  // 现在占位
  return {
    segments: [{
      text: `[OCR 解析开发中] 图片：${filePath}\n\nW2 集成 PaddleOCR 后即可识别中文 / 表格 / 公式`,
      metadata: { filePath, status: 'pending_ocr' },
    }],
    sourceType: _sourceType,
    detectedKind: 'image',
    totalChars: 0,
    fileName: filePath,
  };
}