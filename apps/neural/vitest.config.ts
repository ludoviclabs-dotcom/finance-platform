import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Vitest — unit tests for bank-comms gates + evidence guard resolver.
 *
 * Scope : pure server-side logic only (gates, deterministic resolver,
 * catalog parsers). No Next.js runtime, no LLM, no DB. The fallback
 * path of each check*() module IS the deterministic path — testing
 * it covers the contract that "LLM cannot contradict gates".
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
    reporters: ["default"],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
