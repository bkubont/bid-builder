/**
 * Database connection. One pool per server process, created on first use so
 * `next build` doesn't need a database.
 *
 * Configure with DATABASE_URL, e.g. mysql://user:password@host:3306/dbname
 */
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

export type Db = MySql2Database<typeof schema>;

const globalForDb = globalThis as unknown as { __bidBuilderDb?: Db; __bidBuilderPool?: mysql.Pool };

export function createDb(url: string): { db: Db; pool: mysql.Pool } {
  const pool = mysql.createPool({
    uri: url,
    // Store and read timestamps as UTC regardless of the server's time zone.
    timezone: "Z",
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE || 5),
    // Return DATE columns as "YYYY-MM-DD" strings, not JS Dates.
    dateStrings: ["DATE"],
    charset: "utf8mb4",
  });
  return { db: drizzle(pool, { schema, mode: "default" }), pool };
}

export function getDb(): Db {
  if (!globalForDb.__bidBuilderDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
    const { db, pool } = createDb(url);
    // Reuse across hot reloads in development.
    globalForDb.__bidBuilderDb = db;
    globalForDb.__bidBuilderPool = pool;
  }
  return globalForDb.__bidBuilderDb;
}

export { schema };
