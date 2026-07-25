import { defineConfig, devices } from "@playwright/test";

/**
 * playwright.authenticated.config.ts — E2E du cockpit décisionnel sur une
 * Preview, PRÉPARÉS et non exécutés (Wave E-Interface, commit F4).
 *
 * STATUT : `prepared_not_executed_environment_not_configured`.
 *
 * Cette configuration n'a jamais servi : l'environnement GitHub `e2e-preview`
 * n'existe pas et ses secrets non plus. Elle décrit ce qui sera exécuté le jour
 * où un humain aura créé cet environnement — voir
 * `docs/carbonco/water-intelligence/E2E_AUTHENTICATED_RUNBOOK.md`.
 *
 * ## Trois différences avec la configuration publique
 *
 * 1. **Aucun `webServer`.** La cible est une Preview déjà déployée, désignée par
 *    `E2E_BASE_URL`. Démarrer un serveur local ici testerait autre chose que ce
 *    qu'on croit tester.
 * 2. **`E2E_BASE_URL` n'a pas de repli.** Sans valeur, la configuration lève au
 *    chargement. Un repli sur `localhost` transformerait un secret manquant en
 *    suite qui passe au vert contre un serveur inexistant — ou pire, contre un
 *    serveur local qui n'est pas la Preview visée.
 * 3. **Un seul worker, aucune parallélisation.** Un compte de test, une session.
 */

const BASE_URL = process.env.E2E_BASE_URL;

if (!BASE_URL) {
  throw new Error(
    "E2E_BASE_URL est obligatoire : cette configuration cible une Preview déployée, " +
      "jamais un serveur local. Voir E2E_AUTHENTICATED_RUNBOOK.md.",
  );
}

export default defineConfig({
  testDir: "./e2e/authenticated",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,

  use: {
    baseURL: BASE_URL,
    /*
      Traces et captures seulement en cas d'échec : elles portent l'écran d'une
      session authentifiée sur un compte réel, et le workflow borne déjà leur
      rétention à trois jours.
    */
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
