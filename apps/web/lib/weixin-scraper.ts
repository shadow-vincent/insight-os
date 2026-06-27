/**
 * 公众号文章 Playwright 抓取器
 *
 * 为什么需要：
 * 公众号长文默认折叠，HTML 服务端只返回摘要。剩余内容需要 JS 渲染
 * 后点击"轻触阅读原文"才能拿到。这是结构性反爬，纯 fetch 拿不到。
 *
 * 流程：
 * 1. 启动 chromium（lazy，进程内复用）
 * 2. newContext + newPage（移动 UA）
 * 3. 打开 URL，等 js_content 渲染
 * 4. 如果有"轻触阅读原文"按钮 → 点击 → 等全文展开
 * 5. 提取 innerText
 *
 * 缓存：
 * 抓过的 URL 存到 apps/web/storage/cache/import-url/{hash}.json
 * 7 天内不重抓（公众号内容通常不会变）
 */

import { chromium, type Browser } from 'playwright';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WECHAT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003130) NetType/WIFI Language/zh_CN';

// dev 模式下 process.cwd() 已经是 apps/web，所以直接 storage/cache/import-url 即可
const CACHE_DIR = resolve(process.cwd(), 'storage/cache/import-url');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

let _browser: Browser | null = null;
let _browserInitPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;
  if (_browserInitPromise) return _browserInitPromise;

  _browserInitPromise = chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }).then(b => {
    _browser = b;
    b.on('disconnected', () => { _browser = null; _browserInitPromise = null; });
    return b;
  }).catch(e => {
    _browserInitPromise = null;
    throw e;
  });

  return _browserInitPromise;
}

function cachePath(url: string): string {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  return resolve(CACHE_DIR, `${hash}.json`);
}

export function readWeixinCache(url: string): CachedResult | null {
  return readCache(url);
}

function readCache(url: string): CachedResult | null {
  try {
    const p = cachePath(url);
    if (!existsSync(p)) return null;
    const raw = readFileSync(p, 'utf-8');
    const cached = JSON.parse(raw) as CachedResult;
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCache(url: string, result: CachedResult): void {
  try {
    const p = cachePath(url);
    writeFileSync(p, JSON.stringify(result, null, 2), 'utf-8');
  } catch (e) {
    // 缓存失败不影响主流程
    console.warn('[weixin-scraper] cache write failed:', e);
  }
}

interface CachedResult {
  title: string;
  content: string;
  length: number;
  sourceType: 'weixin_article';
  unfolded: boolean;
  cachedAt: number;
}

export interface ScrapeResult {
  ok: boolean;
  title: string;
  content: string;
  length: number;
  unfolded: boolean;
  error?: string;
}

/**
 * 用 Playwright 抓取公众号文章
 * 失败时返回 { ok: false, error }，不抛异常
 */
export async function scrapeWeixinArticle(url: string, opts: {
  forceRefresh?: boolean;
  timeoutMs?: number;
} = {}): Promise<ScrapeResult> {
  // 1. 缓存命中
  if (!opts.forceRefresh) {
    const cached = readCache(url);
    if (cached) {
      return {
        ok: true,
        title: cached.title,
        content: cached.content,
        length: cached.length,
        unfolded: cached.unfolded,
      };
    }
  }

  // 2. Playwright 抓取
  const timeoutMs = opts.timeoutMs ?? 30000;
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: WECHAT_UA,
    viewport: { width: 375, height: 812 },
    locale: 'zh-CN',
    extraHTTPHeaders: {
      Referer: 'https://mp.weixin.qq.com/',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  const page = await context.newPage();

  try {
    // 打开
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    // 等 js_content 出现（公众号正文容器）
    await page.waitForSelector('#js_content', { timeout: 10000 }).catch(() => {});

    // 给 JS 渲染时间
    await page.waitForTimeout(1500);

    // 检查是否有"轻触阅读原文"折叠按钮
    const foldButton = await page.$('#wx_expand_article_button');
    let unfolded = false;
    if (foldButton) {
      const beforeLen = await page.$eval('#js_content', el => el.textContent?.length || 0);
      try {
        await foldButton.click({ timeout: 3000 });
        // 等内容增长（最长等 15s）
        const start = Date.now();
        while (Date.now() - start < 15000) {
          await page.waitForTimeout(500);
          const afterLen = await page.$eval('#js_content', el => el.textContent?.length || 0);
          if (afterLen > beforeLen * 1.3) {
            unfolded = true;
            break;
          }
        }
      } catch {
        // 点击失败（按钮消失 / 元素遮挡），继续走
      }
    }

    // 提取 title 和 content
    const result = await page.evaluate(() => {
      const title =
        document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        document.querySelector('title')?.textContent ||
        document.querySelector('h1')?.textContent ||
        '';
      const content = document.querySelector('#js_content')?.textContent || '';
      return { title: title.trim(), content: content.trim() };
    });

    const text = cleanContent(result.content);
    const finalTitle = result.title
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);

    if (!text || text.length < 30) {
      return {
        ok: false,
        title: finalTitle,
        content: '',
        length: 0,
        unfolded,
        error: 'Playwright 抓取到空内容（可能被反爬 / 页面未渲染）',
      };
    }

    // 缓存
    writeCache(url, {
      title: finalTitle,
      content: text,
      length: text.length,
      sourceType: 'weixin_article',
      unfolded,
      cachedAt: Date.now(),
    });

    return {
      ok: true,
      title: finalTitle,
      content: text,
      length: text.length,
      unfolded,
    };
  } catch (e: any) {
    return {
      ok: false,
      title: '',
      content: '',
      length: 0,
      unfolded: false,
      error: `Playwright 抓取失败: ${e.message || e.name || 'unknown'}`,
    };
  } finally {
    await context.close();
  }
}

/**
 * 清理文本：去装饰文案、合并空白
 */
function cleanContent(text: string): string {
  return text
    // 公众号装饰文案
    .replace(/预览时标签不可点/g, '')
    .replace(/继续滑动看下一个/g, '')
    .replace(/向上滑动看下一个/g, '')
    .replace(/Scan to Follow/g, '')
    .replace(/轻触阅读原文/g, '')
    .replace(/Scan with Weixin[^，。\n]{0,30}/g, '')
    .replace(/微信扫一扫[^，。\n]{0,30}/g, '')
    // 多余空白
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * 关闭 browser（测试 / 进程退出时调用）
 */
export async function closeWeixinBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
    _browserInitPromise = null;
  }
}
