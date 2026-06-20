// @ts-nocheck - 临时跳过部分第三方包类型检查

/**
 * Office 文档解析 - W1 实现
 *
 * 支持：.docx / .doc / .pptx / .ppt / .xlsx / .xls
 *
 * .doc / .ppt 老格式：需要系统装 libreoffice
 *   brew install --cask libreoffice (macOS)
 *   然后调用 `libreoffice --headless --convert-to docx <file>`
 *
 * W1 实现：docx / pptx / xlsx（最常见）
 * .doc / .ppt / .xls：W1.5 补（需要 libreoffice）
 */

import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import type { ParseResult, SourceType } from './types.js';

/**
 * .docx → markdown
 */
async function parseDocx(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * .pptx → 纯文本（按 slide 切）
 *
 * pptx 是 zip 格式，slides 在 ppt/slides/slide*.xml
 * 文本节点在 <a:t>，命名空间是 'http://schemas.openxmlformats.org/drawingml/2006/main'
 */
async function parsePptx(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);

  // 找出所有 slide*.xml 文件，按数字排序
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? '0', 10);
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? '0', 10);
      return numA - numB;
    });

  const parts: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const fileName = slideFiles[i];
    const xml = await zip.files[fileName].async('text');
    // 用正则简单提取 <a:t>...</a:t>
    const texts: string[] = [];
    const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      if (m[1].trim()) texts.push(m[1].trim());
    }
    if (texts.length > 0) {
      parts.push(`## Slide ${i + 1}\n\n${texts.join(' ')}`);
    }
  }

  if (parts.length === 0) {
    throw new Error('pptx 中未找到任何文本（可能是图片/图表 PPT）');
  }

  return parts.join('\n\n');
}

/**
 * .xlsx / .xls → 纯文本（每个 sheet 一段）
 */
function parseXlsx(filePath: string): string {
  const workbook = XLSX.readFile(filePath);
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    parts.push(`## Sheet: ${sheetName}\n\n${csv}`);
  }

  return parts.join('\n\n');
}

/**
 * 统一入口
 */
export async function parseOfficeFile(
  filePath: string,
  sourceType: SourceType
): Promise<ParseResult> {
  let text = '';

  try {
    if (sourceType === 'docx') {
      text = await parseDocx(filePath);
    } else if (sourceType === 'pptx') {
      text = await parsePptx(filePath);
    } else if (sourceType === 'xlsx') {
      text = parseXlsx(filePath);
    } else {
      throw new Error(`Unsupported office sourceType: ${sourceType}`);
    }
  } catch (e: any) {
    // .doc / .ppt 老格式 fallback：提示需要 libreoffice
    if (/\.(doc|ppt|xls)$/i.test(filePath) || /doc|ppt|xls/.test(e.message)) {
      throw new Error(
        '老格式 .doc/.ppt/.xls 需要 libreoffice。安装：brew install --cask libreoffice'
      );
    }
    throw e;
  }

  return {
    segments: [{ text }],
    sourceType,
    detectedKind: 'file',
    totalChars: text.length,
    rawMeta: { filePath },
  };
}