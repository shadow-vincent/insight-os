/**
 * SQLite 客户端（better-sqlite3 + Drizzle）
 *
 * 数据库位置：./storage/insight.db（相对于 apps/web 运行时）
 * v0.1 用同步的 better-sqlite3，单用户本地使用够用
 *
 * V1.10: Vercel serverless 兼容 —— 用 createRequire + try/catch 把 better-sqlite3
 * 改成 lazy require（避免 ESM 顶层 import 在 serverless 加载 native binding 失败）
 *
 * 启动时自动建表（如果表不存在）—— 单用户本地应用不需要 migrate
 */
export declare function getDb(): any;
export declare function getRawSqlite(): Database.Database;
/**
 * 关闭连接（测试用）
 */
export declare function closeDb(): void;
