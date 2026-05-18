import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Vitest — unit tests for parsers, chunking, RAG, generation orchestration, export.
 *
 * Scope: pure server-side logic. No Next.js runtime, no live LLM calls (mock router),
 * no DB connection (use in-memory fixtures). LLM-dependent paths use mocked SDK.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
    reporters: ["default"],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
