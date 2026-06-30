'use client';

/**
 * V1.12 统一 data-source helper
 *
 * 修 V1.10 留下的"两套代码"问题：
 * - V1.10 之前：本地 dev 走 server SQLite（V1.10 之前所有 page 客户端调 server API）
 * - V1.10 之后：page 客户端硬切 IDB-first + V1.11.16/18 双源 hack（"两套"散落 10+ 处）
 *
 * V1.12 真实解法：
 * - 抽统一 readSource / writeSource helper
 * - 内部判断：本地 dev 走 server SQLite；Vercel / EdgeOne 走 IDB
 * - 调用方零分支、零 try-catch
 *
 * 设计原则：
 * - 单一代码路径（page 客户端只调 helper，不判断环境）
 * - 自动降级（server 不可用 → IDB）
 * - Vercel 端必须传 fallback（IDB），不传 throw（强约束）
 * - 本地 dev 不传 fallback 也 OK（直接走 server，server 失败就 throw 错误）
 *
 * 使用方式：
 * // 读
 * const data = await readSource('/api/assets', {
 *   fallback: () => getAssets()  // Vercel 端用 IDB
 * });
 *
 * // 写
 * const result = await writeSource('/api/feedback', payload, {
 *   fallback: (p) => addFeedback(p)
 * });
 *
 * // 列表（带 query）
 * const data = await readSource('/api/candidates?status=in_use', {
 *   fallback: () => getAssets({ status: 'in_use' })
 * });
 */

/**
 * 判断当前是否部署在 serverless 环境（Vercel / EdgeOne Pages）
 * - 本地 dev 4191 / Electron .app: false → 走 server SQLite
 * - Vercel / EdgeOne Pages: true → 走 IDB
 */
export function isServerlessDeployment(): boolean {
  if (typeof window === 'undefined') return false;  // SSR 阶段
  const host = window.location.hostname;
  return (
    host.endsWith('.vercel.app') ||
    host.endsWith('.edgeone.app') ||
    host.endsWith('.edgeone.app.cn') ||
    process.env.NEXT_PUBLIC_DEPLOYMENT === 'serverless'  // 显式标记
  );
}

export interface ReadSourceOptions<T> {
  /** Vercel 端用 IDB 读 */
  fallback?: () => Promise<T>;
  /** 额外 URL 参数（GET 请求时附加） */
  query?: Record<string, string | number | boolean | undefined>;
  /** 自定义 method（默认 GET） */
  method?: 'GET' | 'POST';
}

export interface WriteSourceOptions<T> {
  /** Vercel 端用 IDB 写 */
  fallback?: (payload: any) => Promise<T>;
  /** 自定义 method（默认 POST） */
  method?: 'POST' | 'PATCH' | 'DELETE';
}

/**
 * 读数据源
 * - 本地 dev: server SQLite (HTTP fetch)
 * - Vercel: IDB (fallback 函数)
 * - 自动降级：本地 dev server 不可用 → fallback
 */
export async function readSource<T = any>(
  endpoint: string,
  options: ReadSourceOptions<T> = {}
): Promise<T> {
  const { fallback, query, method = 'GET' } = options;

  // 1) 本地 dev 优先：调 server SQLite
  if (!isServerlessDeployment()) {
    try {
      const url = query ? buildUrl(endpoint, query) : endpoint;
      const res = await fetch(url, { method, cache: 'no-store' });
      const data = await res.json();
      // server 返 NO_SQLITE（极端 case）→ fallback
      if (data?.code === 'NO_SQLITE' && fallback) {
        return fallback();
      }
      return data as T;
    } catch (e) {
      // server 不可用（用户跑 Vercel build 但误判为本地）→ fallback
      if (fallback) return fallback();
      throw e;
    }
  }

  // 2) Vercel / EdgeOne：必须用 IDB fallback
  if (!fallback) {
    throw new Error(
      `readSource: serverless 部署必须提供 IDB fallback (endpoint: ${endpoint})`
    );
  }
  return fallback();
}

/**
 * 写数据源
 * - 本地 dev: server SQLite (HTTP POST/PATCH/DELETE)
 * - Vercel: IDB (fallback 函数)
 * - 自动降级：本地 dev server 不可用 → fallback
 */
export async function writeSource<T = any>(
  endpoint: string,
  payload?: any,
  options: WriteSourceOptions<T> = {}
): Promise<T> {
  const { fallback, method = 'POST' } = options;

  // 1) 本地 dev 优先：调 server SQLite
  if (!isServerlessDeployment()) {
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'content-type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = await res.json();
      if (data?.code === 'NO_SQLITE' && fallback) {
        return fallback(payload);
      }
      return data as T;
    } catch (e) {
      if (fallback) return fallback(payload);
      throw e;
    }
  }

  // 2) Vercel / EdgeOne：必须用 IDB fallback
  if (!fallback) {
    throw new Error(
      `writeSource: serverless 部署必须提供 IDB fallback (endpoint: ${endpoint}, method: ${method})`
    );
  }
  return fallback(payload);
}

// ===== 辅助函数 =====

function buildUrl(endpoint: string, query: Record<string, any>): string {
  const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  }
  return url.pathname + url.search;
}

/**
 * 检查 server 是否可用（用于 mutation 之前预检，避免网络错误）
 */
export async function isServerAvailable(): Promise<boolean> {
  if (isServerlessDeployment()) return false;
  try {
    const res = await fetch('/api/system/status', { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}