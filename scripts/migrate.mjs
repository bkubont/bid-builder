// Applies pending database migrations (drizzle/*.sql). Safe to run on every
// start: already-applied migrations are skipped.
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

// Read .env / .env.local like Next.js does (hosting env vars still win).
nextEnv.loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set; cannot run migrations.");
  process.exit(1);
}

const connection = await mysql.createConnection({ uri: url, multipleStatements: true, timezone: "Z" });
try {
  await migrate(drizzle(connection), {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  console.log("Database is up to date.");
} catch (error) {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
