/**
 * POST /api/writing/rewrite
 *
 * 改写 / 润色：用户选中文本 → 调 LLM 按 style 改写
 *
 * body: { text: string, style: 'professional' | 'casual' | 'concise' | 'expanded' | 'english' | 'chinese', context?: string }
 * return: { ok, original, rewritten, style }
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@insight-os/llm';
import { getActiveKernelsForInjection } from '@insight-os/db';

export const dynamic = 'force-dynamic';

const STYLE_GUIDES: Record<string, { system: string; userSuffix: string; emoji: string; label: string }> = {
  professional: {
    emoji: '👔',
    label: '改写得更专业',
    system: '你是一位资深的咨询顾问 / 行业专家。你要把用户的口语化或松散表达改写为专业、有结构、术语精准的表达。保持核心意思不变。',
    userSuffix: '\n\n请只输出改写后的文本，不要加任何解释、标题或代码块。',
  },
  casual: {
    emoji: '💬',
    label: '改写得更口语',
    system: '你是 Vincent 的人格化写作助手。你要把用户的书面 / 专业表达改写为更口语化、像朋友聊天的表达。保持核心意思不变。',
    userSuffix: '\n\n请只输出改写后的文本，不要加任何解释、标题或代码块。',
  },
  concise: {
    emoji: '✂️',
    label: '改写得更简洁',
    system: '你是一位编辑。你要把用户的表达压缩到原长度的 50-70%，删掉冗余、套话、修饰，保留核心信息。不要改变原意。',
    userSuffix: '\n\n请只输出改写后的文本，不要加任何解释、标题或代码块。',
  },
  expanded: {
    emoji: '➕',
    label: '改写得更长',
    system: '你是一位资深写手。你要把用户简短的表达扩展为更详细、有论据、有例子的段落。保持核心观点，但增加说服力。',
    userSuffix: '\n\n请只输出改写后的文本，不要加任何解释、标题或代码块。',
  },
  english: {
    emoji: '🌐',
    label: '翻译成英文',
    system: '你是专业的中英翻译。你要把用户的中文表达翻译为地道的英文（适合 LinkedIn / Medium 风格）。保留原意和语气。',
    userSuffix: '\n\n请只输出翻译后的英文，不要加任何解释或注释。',
  },
  chinese: {
    emoji: '🀄',
    label: '翻译成中文',
    system: '你是专业的中英翻译。你要把用户的英文表达翻译为地道的中文（适合公众号 / 知乎风格）。保留原意和语气。',
    userSuffix: '\n\n请只输出翻译后的中文，不要加任何解释或注释。',
  },
};

export async function POST(req: NextRequest) {
  try {
    const { text, style, context } = await req.json() as {
      text: string;
      style: keyof typeof STYLE_GUIDES;
      context?: string;
    };

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ ok: false, error: 'text 必须为非空字符串' }, { status: 400 });
    }
    if (!style || !STYLE_GUIDES[style]) {
      return NextResponse.json({
        ok: false,
        error: `style 必须为 ${Object.keys(STYLE_GUIDES).join(' / ')}`,
      }, { status: 400 });
    }

    const guide = STYLE_GUIDES[style];
    const userPrompt = context
      ? `【上下文（仅供参考，不必复述）】\n${context}\n\n【待改写文本】\n${text}${guide.userSuffix}`
      : `【待改写文本】\n${text}${guide.userSuffix}`;

    const kernel = getActiveKernelsForInjection();
    const result = await callLLM<string>(guide.system, userPrompt, {
      temperature: 0.4,
      maxTokens: Math.min(Math.max(text.length * 2, 200), 1500),
      jsonMode: false,
      kernel,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? '改写失败' }, { status: 500 });
    }
    // callLLM 返 string 时 result.data 是 string
    const rewritten = typeof result.data === 'string'
      ? result.data
      : (result.data as any)?.text ?? text;

    return NextResponse.json({ ok: true, original: text, rewritten, style });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
