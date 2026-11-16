import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Run in a US timezone so date bugs (UTC vs local) show up in tests.
process.env.TZ = "America/Detroit";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"] },
});
