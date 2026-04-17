import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Vitest must NOT scan Playwright e2e specs — they have a different runner,
    // different fixtures, and would fail with "test is not defined" / "page is not defined".
    // Default include: '**/*.{test,spec}.?(c|m)[jt]s?(x)' would match e2e/tests/**.
    include: [
      "tests/**/*.{test,spec}.?(c|m)[jt]s?(x)",
      "components/**/*.{test,spec}.?(c|m)[jt]s?(x)",
      "lib/**/*.{test,spec}.?(c|m)[jt]s?(x)",
      "app/**/*.{test,spec}.?(c|m)[jt]s?(x)",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "e2e/**", // Playwright tests live here — run via `npm run e2e`
      ".next/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
