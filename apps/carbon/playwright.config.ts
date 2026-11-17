import { defineConfig, devices } from "@playwright/test";

/**
 * playwright.config.ts — Configuration E2E CarbonCo.
 *
 * Variables d'environnement requises pour les tests :
 *   E2E_BASE_URL      — URL du frontend (défaut : http://localhost:3003)
 *   E2E_USER_EMAIL    — Email du compte de test (défaut : ludoviclabs@gmail.com)
 *   E2E_USER_PASSWORD — Mot de passe du compte de test
 *   NEXT_PUBLIC_API_BASE_URL — URL du backend API, inlinée au BUILD du front
 *                      (défaut : http://localhost:8000, cf. lib/api.ts). En CI
 *                      elle est alimentée par le secret E2E_API_URL.
 *                      `E2E_API_URL` seule n'est lue par aucun code.
 */
export default defineConfig({
  /*
    `./e2e/tests` et non `./e2e` : deux jeux voisins vivent désormais sous
    `e2e/` — `e2e/public` (sans secret, joué sur PR) et `e2e/authenticated`
    (Preview, environnement protégé). Un `testDir` à la racine les aspirerait
    tous les trois, et `npm run e2e` exécuterait ici des scénarios écrits pour
    une autre cible et un autre déclencheur.

    Le périmètre de cette configuration est donc inchangé : tous les specs
    historiques sont déjà dans `e2e/tests`.
  */
  testDir: "./e2e/tests",
  fullyParallel: false, // séquentiel : partage de session auth, 1 compte de test
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // Garde-fous CI : sans eux, un backend absent donne une cascade d'échecs
  // lents (≈15 s/test x 137 tests, retry compris) jusqu'au timeout du job, avec
  // un reporter muet et aucun rapport. On s'arrête après 5 échecs, on borne la
  // durée totale (à ajuster une fois la suite verte) et on garde un rapport.
  timeout: 30_000,
  maxFailures: process.env.CI ? 5 : undefined,
  globalTimeout: process.env.CI ? 8 * 60_000 : undefined,
  reporter: process.env.CI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : "list",

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
