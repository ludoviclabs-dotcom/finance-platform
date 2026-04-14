import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The app contains text-heavy French marketing/legal pages where apostrophes
      // are normal prose rather than JSX mistakes.
      "react/no-unescaped-entities": "off",
      // These new React compiler-oriented rules surface a broader refactor backlog.
      // We keep lint focused on actionable Next/TS issues for now.
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);
