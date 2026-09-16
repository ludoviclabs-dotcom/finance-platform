import { defineConfig, devices } from "@playwright/test";

import { SANS_API } from "./e2e/fixtures/tags";

/**
 * playwright.config.ts — Configuration E2E CarbonCo.
 *
 * Variables d'environnement requises pour les tests :
 *   E2E_BASE_URL      — URL du frontend (défaut : http://localhost:3003)
 *   E2E_USER_EMAIL    — Email du compte de test (défaut : ludoviclabs@gmail.com)
 *   E2E_USER_PASSWORD — Mot de passe du compte de test
 *   E2E_API_URL       — (workflow) URL du backend API ; aucun spec ne la lit :
 *                       le workflow l'injecte au build dans
 *                       NEXT_PUBLIC_API_BASE_URL (défaut : http://localhost:8000)
 *
 * ## Deux projets : `sans-api` et `avec-api`
 *
 * La suite est partitionnée par l'étiquette `@sans-api` (e2e/fixtures/tags.ts) :
 *
 *   - `sans-api` : tests qui n'ont besoin NI du backend FastAPI NI d'un compte
 *     (pages publiques, démo fictive, redirections, en-têtes de sécurité). Ils
 *     passent contre un simple `next build && next start`, et c'est ce projet
 *     que le workflow `e2e.yml` joue à chaque push sur master.
 *   - `avec-api` : tout le reste — login réel (E2E_USER_PASSWORD), données
 *     servies par l'API (NEXT_PUBLIC_API_BASE_URL au build). Joué par le
 *     workflow seulement quand ces secrets existent.
 *
 * Les deux projets sont disjoints (grep / grepInvert) : `npm run e2e` exécute
 * toujours l'intégralité des specs, une seule fois chacune. Un nouveau test
 * est « avec-api » par défaut ; l'étiqueter `@sans-api` est un engagement :
 * il doit passer sans backend ni compte.
 */

const SANS_API_GREP = new RegExp(SANS_API);

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
  // `html` en CI : c'est le dossier `playwright-report/` que le workflow publie.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

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
      name: "sans-api",
      grep: SANS_API_GREP,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "avec-api",
      grepInvert: SANS_API_GREP,
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
