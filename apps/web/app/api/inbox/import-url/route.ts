/**
 * POST /api/inbox/import-url
 *
 * V1.11.18: Vercel 兼容（去掉 Playwright 依赖）
 * - 之前用 Playwright 处理公众号折叠长文 → Vercel serverless 无 Playwright → 500
 * - 现在统一走纯 HTML fetch（Vercel / 本地都支持）
 * - 公众号折叠长文 Vercel 上只能取折叠版（用户可在 frontend 编辑后 intake）
 * - 本地 dev 仍可 try Playwright（如果装了）— 失败 fallback HTML
 *
 * 输入: { url }
 * 输出: { ok, url, title, content, length, sourceType, ... }
 *
 * 抓取网页正文（去广告/导航/页脚/脚本），返回 title + 纯文本
 * 让用户在前端编辑后再调 intake
 *
 * 公众号特殊处理：
 * - 通用 UA 会被反爬挡掉（"Parameter error"），用微信内置浏览器 UA
 * - 长文默认折叠，本地用 Playwright（可选）展开 / Vercel 直接用折叠版
 * - 抓过的 URL 7 天内走本地缓存（仅本地 dev）
 *
 * 其他页面：纯 HTML 抓取（去 script/style/nav 等）
 */

import { NextRequest, NextResponse } from 'next/server';

const MAX_LENGTH = 100000; // 100KB 上限（覆盖绝大多数公众号长文；防止极端情况 LLM prompt 爆炸）
const WECHAT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003130) NetType/WIFI Language/zh_CN';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, forceRefresh } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ ok: false, error: '缺少 url 参数' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ ok: false, error: 'URL 格式无效' }, { status: 400 });
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ ok: false, error: '只支持 http(s) 协议' }, { status: 400 });
    }

    const isWeixin = parsedUrl.hostname.includes('mp.weixin.qq.com');

    // ===== 公众号：本地 dev 尝试 Playwright（处理折叠长文），Vercel 直接跳过 =====
    if (isWeixin && process.env.VERCEL !== '1') {
      try {
        const { scrapeWeixinArticle, readWeixinCache } = await import('@/lib/weixin-scraper');
        const t0 = Date.now();

        if (!forceRefresh) {
          const cacheCheck = readWeixinCache(url);
          if (cacheCheck) {
            return NextResponse.json({
              ok: true,
              url,
              title: cacheCheck.title,
              content: cacheCheck.content,
              length: cacheCheck.length,
              truncated: false,
              sourceType: 'weixin_article',
              via: 'cached',
              unfolded: cacheCheck.unfolded,
              durationMs: Date.now() - t0,
            });
          }
        }

        const result = await scrapeWeixinArticle(url, { forceRefresh });
        if (result.ok) {
          let text = result.content;
          const truncated = text.length > MAX_LENGTH;
          if (truncated) text = text.slice(0, MAX_LENGTH);
          return NextResponse.json({
            ok: true,
            url,
            title: result.title,
            content: text,
            length: text.length,
            truncated,
            sourceType: 'weixin_article',
            via: 'playwright',
            unfolded: result.unfolded,
            durationMs: Date.now() - t0,
          });
        }
        console.warn(`[import-url] Playwright failed for ${url}, fallback: ${result.error}`);
      } catch (e: any) {
        // Playwright 没装 / chromium 没下 / sandbox 失败 → fallback HTML
        console.warn(`[import-url] Playwright unavailable (${e.message}), fallback to HTML`);
      }
    }

    // ===== 通用页面：纯 HTML 抓取（Vercel + 本地都支持）=====
    const userAgent = isWeixin
      ? WECHAT_UA
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,text/plain',
        ...(isWeixin && { 'Referer': 'https://mp.weixin.qq.com/' }),
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `抓取失败: HTTP ${res.status}` }, { status: 502 });
    }

    const html = await res.text();

    // 公众号反爬错误页
    if (isWeixin && html.includes('Parameter error')) {
      return NextResponse.json({
        ok: false,
        error: '公众号反爬拦截。Vercel 部署版无法用 Playwright 展开长文（仅本地 dev 支持）。请手动复制正文到粘贴框。',
        code: 'WECHIN_BLOCKED',
      }, { status: 403 });
    }

    // 提取 title
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const h1Tag = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = (ogTitle?.[1] || titleTag?.[1] || h1Tag?.[1] || parsedUrl.hostname)
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);

    // 提取正文
    let text = extractMainContent(html);

    // 截断
    const truncated = text.length > MAX_LENGTH;
    if (truncated) text = text.slice(0, MAX_LENGTH);

    return NextResponse.json({
      ok: true,
      url,
      title,
      content: text,
      length: text.length,
      truncated,
      sourceType: isWeixin ? 'weixin_article' : 'web',
      via: isWeixin ? 'html_fallback' : 'html',
    });
  } catch (e: any) {
    if (e.name === 'TimeoutError' || e.message?.includes('timeout')) {
      return NextResponse.json({ ok: false, error: '抓取超时（>15s）' }, { status: 504 });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function extractMainContent(html: string): string {
  let contentArea = html;

  const jsContentMatch = html.match(/<div[^>]*id=["']js_content["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
  if (jsContentMatch) {
    contentArea = jsContentMatch[1];
  } else {
    const sectionMatch = html.match(/<section[^>]+data-role=["']outer["'][^>]*>([\s\S]*?)<\/section>/i);
    if (sectionMatch) {
      contentArea = sectionMatch[1];
    }
  }

  let text = contentArea
    .replace(/<(script|style|noscript|iframe|svg|header|footer|nav|aside|form|button)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|noscript|iframe|svg|header|footer|nav|aside|form|button)\b[^>]*\/?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s(on\w+|style|class|id|data-\w+|src|sizes|srcset|loading|decoding|fetchpriority|itemid|itemprop|itemscope|itemtype)=["'][^"']*["']/gi, '')
    .replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*\/?>/gi, '[$1]')
    .replace(/<img\b[^>]*\/?>(?:<\/img>)?/gi, '[图片]')
    .replace(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => {
      const cleanText = txt.replace(/<[^>]+>/g, '').trim();
      if (!cleanText) return '';
      if (cleanText.includes('阅读原文') || cleanText.includes('查看原文')) {
        return `\n\n[${cleanText}] ${href}\n\n`;
      }
      return cleanText;
    })
    .replace(/<\/?(p|div|li|tr|h[1-6]|section|article|blockquote|br|hr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&yen;/g, '¥')
    .replace(/预览时标签不可点/g, '')
    .replace(/继续滑动看下一个/g, '')
    .replace(/Scan to Follow/g, '')
    .replace(/轻触阅读原文/g, '')
    .replace(/向上滑动看下一个/g, '')
    .replace(/微信扫一扫[^，。\n]{0,30}/g, '')
    .replace(/Scan with Weixin[^，。\n]{0,30}/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  return text;
}
