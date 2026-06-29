/**
 * V1.10 IndexedDB 模块统一导出
 *
 * 注意：不要 re-export './db' 和 './migrate'（它们 import Dexie），
 * 否则 layout.tsx 通过 '@/lib/idb' import 会触发 Dexie 在 Vercel server load。
 *
 * 只 export client-only 的 IndexedDBProvider。
 * db.ts / migrate.ts 仅 client 内部用，通过 dynamic import 调用。
 */

export { IndexedDBProvider } from './IndexedDBProvider';