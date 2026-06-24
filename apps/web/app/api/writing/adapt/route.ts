/**
 * POST /api/writing/adapt
 *
 * 多平台适配：把现有文章改写为其他平台风格
 * 支持：wechat（公众号）/ zhihu（知乎）/ jike（即刻）/ xiaohongshu（小红书）/ video（视频脚本）
 *
 * body: { writingId, targetPlatform, content?: string, title?: string }
 * return: { ok, platform, content, tips: string[] }
 *
 * 改写后建议用户另存为新版本（前端会弹"另存为版本"按钮）
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@insight-os/llm';
import { getActiveKernelsForInjection, outputs, writingVersions } from '@insight-os/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const PLATFORM_GUIDES: Record<string, { emoji: string; label: string; system: string; tips: string[] }> = {
  wechat: {
    emoji: '📰',
    label: '公众号长文',
    system: `你是 Vincent 的写作助手，擅长把任何文章改写为适合微信公众号的版本。

公众号长文风格：
- 长度 1500-3000 字（原文 70-120% 长度）
- 标题：钩子感强，14-22 字，能引发好奇或共鸣
- 开头：钩子段（一个具体场景 / 一句反常识 / 一个数字）
- 段落：每段 3-5 行，长段落拆成 2-3 个
- 用"你"而不是"我们"
- 结尾：明确收束 + 行动召唤
- 适度用 emoji 当分隔（不要满屏 emoji）
- 不要用 markdown 标题符号（# ##）因为公众号不识别

请只输出改写后的完整文章（标题 + 正文），不要加任何解释、注释、代码块。`,
    tips: [
      '公众号不识别 markdown 标题符号，# ## 会被原样显示',
      '段落控制在 3-5 行，公众号读者偏好短段落',
      '开头要有钩子（场景 / 反常识 / 数字）',
      '结尾要有明确行动召唤（关注 / 转发 / 留言）',
    ],
  },
  zhihu: {
    emoji: '🟦',
    label: '知乎',
    system: `你是 Vincent 的写作助手，擅长把任何文章改写为适合知乎的回答。

知乎回答风格：
- 长度 800-1500 字（原文 50-70% 长度）
- 开头：必须先亮结论（"先说结论：..."），再给理由
- 中间：用 "1. 2. 3." 或 "- " 列表式分段
- 论据：要有具体案例、数据、引用（不能空谈）
- 引用原文要标注来源（"德鲁克在《...》中提到..."）
- 知乎读者偏好"显得专业"，多用术语 + 引用
- 偶尔用"泻药"开头（"泻药，人在机场，刚下飞机"）作为反讽

请只输出改写后的完整回答（不要加 "泻药" 除非原文是轻松风格），不要加任何解释、注释、代码块。`,
    tips: [
      '开头必须先亮结论（先说结论：...）',
      '用列表分段，知乎偏好"扫读体验"',
      '要有具体案例 / 数据 / 引用，不能空谈',
      '适当用术语显得专业',
    ],
  },
  jike: {
    emoji: '☕',
    label: '即刻',
    system: `你是 Vincent 的写作助手，擅长把任何文章改写为适合即刻的短帖。

即刻风格：
- 长度 200-500 字（原文 15-30% 长度）
- 一句话观点开头（"我最近在想..." / "有个反常识判断..."）
- 短段落（每段 1-2 句）
- 口语化，不要装
- 关键句加 emoji 强调（不要满屏）
- 结尾：开放式问题 / 留个 hook
- 不要标题（一段到底）

请只输出改写后的短帖（不要标题），不要加任何解释、注释、代码块。`,
    tips: [
      '一句话观点开头，不要写长引子',
      '短段落（1-2 句），即刻读者扫读',
      '口语化，"我" "你" "咱们" 自由切换',
      '结尾开放式问题，引导评论',
    ],
  },
  xiaohongshu: {
    emoji: '📕',
    label: '小红书',
    system: `你是 Vincent 的写作助手，擅长把任何文章改写为适合小红书的笔记。

小红书风格：
- 长度 300-800 字
- 标题：13-20 字，必须有 emoji 关键词（"🔥" "❗" "💡"）
- 开头：痛点场景（"姐妹们 / 兄弟们 / 打工人..."）
- 段落：emoji 开头分段（💡 ✅ ⚠️ 🔥）
- 口语化，像跟朋友说话
- 结尾：互动引导（"评论区告诉我..."）
- 适度用 emoji 当段落开头

请只输出改写后的完整笔记（标题 + 正文），不要加任何解释、注释、代码块。`,
    tips: [
      '标题必须有 emoji 关键词 + 13-20 字',
      '开头痛点场景（"姐妹们 / 兄弟们"）',
      '每段用 emoji 开头分段',
      '口语化，像跟朋友说话',
    ],
  },
  video: {
    emoji: '🎬',
    label: '视频脚本',
    system: `你是 Vincent 的写作助手，擅长把任何文章改写为适合短视频的口播脚本。

视频脚本风格：
- 长度 1000-1500 字（1-2 分钟口播）
- 第一句：强 hook（"你是不是也..." / "99% 的人都..."）
- 短句（每句 5-15 字）
- 段落用 [停顿] 或 [强调 X] 标注
- 关键句重复（"记住，X"）
- 结尾：行动召唤（"点赞关注，下期讲..."）
- 全部口语化

请只输出改写后的脚本（不要分镜），不要加任何解释、注释、代码块。`,
    tips: [
      '第一句强 hook（"你是不是也..."）',
      '短句 5-15 字，口播节奏',
      '关键句重复，记忆点强化',
      '结尾行动召唤（点赞 / 关注）',
    ],
  },
};

export async function POST(req: NextRequest) {
  try {
    const { writingId, targetPlatform, content, title } = await req.json() as {
      writingId: string;
      targetPlatform: keyof typeof PLATFORM_GUIDES;
      content?: string;
      title?: string;
    };

    if (!targetPlatform || !PLATFORM_GUIDES[targetPlatform]) {
      return NextResponse.json({
        ok: false,
        error: `targetPlatform 必须为 ${Object.keys(PLATFORM_GUIDES).join(' / ')}`,
      }, { status: 400 });
    }

    // 拿原文（从 body 或从 db）
    let sourceContent = content;
    let sourceTitle = title;
    if (!sourceContent && writingId) {
      const { getDb } = await import('@insight-os/db');
      const db = getDb();
      const row = db.select().from(outputs).where(eq(outputs.id, writingId)).get();
      if (!row) {
        return NextResponse.json({ ok: false, error: 'writingId 不存在' }, { status: 404 });
      }
      const c = row.content as any;
      sourceContent = c?.primary_version ?? JSON.stringify(row.content);
      sourceTitle = sourceTitle ?? row.title;
    }
    if (!sourceContent) {
      return NextResponse.json({ ok: false, error: '必须提供 writingId 或 content' }, { status: 400 });
    }

    const guide = PLATFORM_GUIDES[targetPlatform];
    const userPrompt = sourceTitle
      ? `【原文标题】\n${sourceTitle}\n\n【原文内容】\n${sourceContent}\n\n【目标平台】${guide.label}\n\n请改写。`
      : `【原文内容】\n${sourceContent}\n\n【目标平台】${guide.label}\n\n请改写。`;

    const kernel = getActiveKernelsForInjection();
    const result = await callLLM<string>(guide.system, userPrompt, {
      temperature: 0.6,
      maxTokens: Math.min(Math.max(sourceContent.length * 2, 500), 3500),
      jsonMode: false,
      kernel,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? '改写失败' }, { status: 500 });
    }
    const adapted = typeof result.data === 'string'
      ? result.data
      : (result.data as any)?.text ?? sourceContent;

    // 改写前自动 snapshot
    if (writingId) {
      try {
        const { getDb } = await import('@insight-os/db');
        const db = getDb();
        const now = Math.floor(Date.now() / 1000);
        const verId = `ver_${writingId}_${now}_pre_adapt`;
        db.insert(writingVersions).values({
          id: verId,
          writingId,
          content: sourceContent,
          title: sourceTitle ?? null,
          note: `多平台适配前自动快照（适配到 ${targetPlatform}）`,
          createdBy: 'system',
          createdAt: now,
        }).run();
      } catch { /* snapshot 失败不影响主流程 */ }
    }

    return NextResponse.json({
      ok: true,
      platform: targetPlatform,
      original: { content: sourceContent, title: sourceTitle ?? null },
      adapted: { content: adapted, title: sourceTitle ?? null },
      tips: guide.tips,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
