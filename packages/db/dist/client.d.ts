/**
 * SQLite 客户端（better-sqlite3 + Drizzle）
 *
 * 数据库位置：./storage/insight.db（相对于 apps/web 运行时）
 * v0.1 用同步的 better-sqlite3，单用户本地使用够用
 *
 * 启动时自动建表（如果表不存在）—— 单用户本地应用不需要 migrate
 */
import Database from 'better-sqlite3';
import * as schema from './schema.ts';
export declare function getDb(): import("drizzle-orm/better-sqlite3").BetterSQLite3Database<typeof schema> & {
    $client: Database.Database;
};
export declare function getRawSqlite(): Database.Database;
/**
 * 关闭连接（测试用）
 */
export declare function closeDb(): void;
