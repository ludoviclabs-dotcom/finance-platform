import { defineConfig, devices } from "@playwright/test";

/**
 * playwright.config.ts — Configuration E2E CarbonCo.
 *
 * Variables d'environnement requises pour les tests :
 *   E2E_BASE_URL      — URL du frontend (défaut : http://localhost:3003)
 *   E2E_USER_EMAIL    — Email du compte de test (défaut : ludoviclabs@gmail.com)
 *   E2E_USER_PASSWORD — Mot de passe du compte de test
 *   E2E_API_URL       — URL du backend API (défaut : http://localhost:8000)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // séquentiel : partage de session auth, 1 compte de test
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3003",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    // Accepte les certificats auto-signés en dev
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Démarre le serveur Next.js automatiquement en local (pas en CI — géré par le workflow)
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3003",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
