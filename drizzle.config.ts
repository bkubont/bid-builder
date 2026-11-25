import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Same .env / .env.local files Next.js reads.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
