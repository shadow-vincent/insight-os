/**
 * POST /api/inbox/intake
 *
 * V1.1：支持多 sourceType（粘贴 / URL / Office 6 格式 / 图片 OCR / 视频字幕 / 音频转写 / 电子书 / 微信读书 / Kindle）
 *
 * 流程：
 *   1. 接受 { rawContent / file (base64) / url, sourceType }
 *   2. 根据 sourceType 调对应 parser 提取文本
 *   3. chunker 切长文本
 *   4. 对每个 segment 调 LLM 抽卡
 *   5. 写 assets 表（type=light, status=candidate）
 *
 * 返回：{ ok, assetIds, lightCards }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, getActiveKernelsForInjection } from '@insight-os/db';
import {
  buildLightCardUserPrompt,
  LIGHT_CARD_SYSTEM,
  callLLM,
  type LightCardInput,
  type LightCardOutput,
} from '@insight-os/llm';
import { isLLMConfigured, readConfig } from '@insight-os/core';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chunkText } from '@insight-os/web/lib/parsers/chunker';
import { parseOfficeFile } from '@insight-os/web/lib/parsers/office';
import { parsePdf } from '@insight-os/web/lib/parsers/pdf';
import { parseImage } from '@insight-os/web/lib/parsers/ocr';
import { parseYouTube, parseBilibili, parseSrt, parseVtt } from '@insight-os/web/lib/parsers/video';
import { parseAudio, parseXiaoyuzhou } from '@insight-os/web/lib/parsers/audio';
import { parseEbook, parseWeRead, parseKindle } from '@insight-os/web/lib/parsers/ebook';
import type { SourceType, ParsedSegment, ParseResult } from '@insight-os/web/lib/parsers/types';

// 临时文件存放（V1.1 临时方案，V1.2 改成流式上传）
async function saveBase64ToTemp(base64: string, ext: string): Promise<string> {
  const data = base64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(data, 'base64');
  const dir = mkdtempSync(join(tmpdir(), 'insight-intake-'));
  const filePath = join(dir, `upload${ext}`);
  writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * 主入口
 */
export async function POST(req: NextRequest) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json({
        ok: false,
        error: 'LLM 未配置',
        code: 'LLM_NOT_CONFIGURED',
      }, { status: 400 });
    }

    const body = await req.json();
    const { rawContent, file, fileName, url, sourceType } = body;

    const srcType = (sourceType as SourceType) ?? 'manual';

    // ========== Step 1: 解析文本 ==========
    let parseResult: ParseResult;

    if (file && fileName) {
      // 文件上传（base64）
      const ext = fileName.match(/\.[^.]+$/)?.[0] ?? '';
      const tmpPath = await saveBase64ToTemp(file, ext);

      if (srcType === 'docx' || srcType === 'pptx' || srcType === 'xlsx') {
        parseResult = await parseOfficeFile(tmpPath, srcType);
      } else if (srcType === 'image') {
        parseResult = await parseImage(tmpPath, srcType);
      } else if (srcType === 'audio') {
        parseResult = await parseAudio(tmpPath);
      } else if (srcType === 'epub') {
        parseResult = await parseEbook(tmpPath);
      } else if (srcType === 'weread') {
        parseResult = await parseWeRead(tmpPath);
      } else if (srcType === 'kindle') {
        parseResult = await parseKindle(tmpPath);
      } else if (srcType === 'subtitle') {
        // SRT/VTT 字幕
        const buf = require('node:fs').readFileSync(tmpPath, 'utf-8');
        const cues = ext === '.vtt' ? parseVtt(buf) : parseSrt(buf);
        const text = cues.map(c => c.text).join('\n');
        parseResult = {
          segments: chunkText(text, srcType, { subtitles: cues }),
          sourceType: srcType,
          detectedKind: 'file',
          totalChars: text.length,
          fileName,
        };
      } else if (srcType === 'pdf') {
        // PDF 用 pdfjs-dist 解析
        parseResult = await parsePdf(tmpPath, srcType);
      } else if (srcType === 'markdown') {
        // md 直接读
        const text = require('node:fs').readFileSync(tmpPath, 'utf-8');
        parseResult = {
          segments: chunkText(text, srcType),
          sourceType: srcType,
          detectedKind: 'file',
          totalChars: text.length,
          fileName,
        };
      } else {
        // 其他当 txt 处理
        const text = require('node:fs').readFileSync(tmpPath, 'utf-8');
        parseResult = {
          segments: chunkText(text, 'manual'),
          sourceType: 'manual',
          detectedKind: 'text',
          totalChars: text.length,
          fileName,
        };
      }
    } else if (url) {
      // URL
      if (srcType === 'youtube') {
        parseResult = await parseYouTube(url);
      } else if (srcType === 'bilibili') {
        parseResult = await parseBilibili(url);
      } else if (srcType === 'xiaoyuzhou') {
        parseResult = await parseXiaoyuzhou(url);
      } else if (srcType === 'weixin_article' || srcType === 'web') {
        // 走原 weixin-scraper（已有）
        const { scrapeWeixinArticle } = await import('@insight-os/web/lib/weixin-scraper');
        const article = await scrapeWeixinArticle(url, {});
        parseResult = {
          segments: chunkText(article.content || '', 'manual'),
          sourceType: srcType,
          detectedKind: 'url',
          totalChars: (article.content || '').length,
          rawMeta: { url, title: article.title },
        };
      } else {
        parseResult = {
          segments: chunkText(url, 'manual'),
          sourceType: 'manual',
          detectedKind: 'url',
          totalChars: url.length,
        };
      }
    } else if (rawContent && typeof rawContent === 'string' && rawContent.trim().length >= 10) {
      // 纯文本粘贴
      parseResult = {
        segments: chunkText(rawContent, srcType),
        sourceType: srcType,
        detectedKind: 'text',
        totalChars: rawContent.length,
      };
    } else {
      return NextResponse.json({
        ok: false,
        error: '需要 rawContent / file / url 至少一个',
      }, { status: 400 });
    }

    // ========== Step 2: 逐段 LLM 抽卡 ==========
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const cfg = readConfig();
    const vaultDir = cfg.paths.vaultPath + '/04_管理洞察';

    const assetIds: string[] = [];
    const lightCards: LightCardOutput[] = [];
    const errors: string[] = [];

    for (let i = 0; i < parseResult.segments.length; i++) {
      const segment = parseResult.segments[i];
      const segmentLabel = segment.title || `段 ${i + 1}/${parseResult.segments.length}`;

      // 守门：内容太少直接报错，不写库
      if (segment.text.trim().length < 50) {
        errors.push(`[${segmentLabel}] 内容过短（${segment.text.trim().length} 字），跳过`);
        continue;
      }

      try {
        const userPrompt = buildLightCardUserPrompt({
          rawContent: segment.text.slice(0, 8000),
          sourceType: (srcType as LightCardInput['sourceType']) ?? 'manual',
        });
        const kernel = getActiveKernelsForInjection();
        const result = await callLLM<LightCardOutput>(
          LIGHT_CARD_SYSTEM,
          userPrompt,
          { temperature: 0.4, maxTokens: 1500 ,
          kernel,}
        );

        if (!result.ok || !result.data) {
          errors.push(`[${segmentLabel}] LLM 失败: ${result.error}`);
          continue;
        }

        const lc = result.data;
        const id = `lc_${randomUUID().slice(0, 8)}`;
        const filePath = resolve(vaultDir, '_light_cards', `资产卡_轻量_${lc.title.slice(0, 20)}_${id}.md`);

        db.insert(assets)
          .values({
            id,
            type: 'light',
            status: lc.recommended_next_action === 'archive' ? 'archived' : 'candidate',
            title: lc.title,
            evidenceLevel: 'E0',
            priority: lc.priority,
            tagsJson: JSON.stringify(lc.keywords ?? []),
            source: `${srcType} · ${new Date().toISOString().slice(0, 10)} · ${segmentLabel}`,
            sourceType: 'knowledge_card',
            oneSentenceInsight: lc.initial_insight,
            antiCommonSense: lc.anti_common_sense,
            filePath,
            fileMtime: now,
            fileHash: `lc_${now}_${i}`,
            feedbackCount: 0,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        assetIds.push(id);
        lightCards.push(lc);
      } catch (e: any) {
        errors.push(`[${segmentLabel}] ${e.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      assetIds,
      lightCards,
      segmentsCount: parseResult.segments.length,
      sourceType: srcType,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}