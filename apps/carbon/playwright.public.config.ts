import { defineConfig, devices } from "@playwright/test";

/**
 * playwright.public.config.ts — E2E de la surface PUBLIQUE, exécutables sur
 * pull request (Wave E-Interface, commit F3).
 *
 * ## Pourquoi une seconde configuration plutôt qu'un projet de plus
 *
 * `playwright.config.ts` pointe sur `./e2e`, où vivent les scénarios
 * authentifiés : ils exigent un compte, une API et des secrets. Ajouter un
 * projet dans ce fichier laisserait `npm run e2e` exécuter les deux jeux, et
 * une PR de contributeur externe déclencherait alors une suite qui a besoin de
 * secrets qu'elle n'aura pas — un échec permanent, donc un signal que plus
 * personne ne lit.
 *
 * Cette configuration ne voit QUE `./e2e/public`. La séparation est physique,
 * pas conventionnelle : aucun test authentifié ne peut y être exécuté par
 * inadvertance.
 *
 * ## Aucun secret, et rien qui en réclame
 *
 * Pas de `E2E_USER_EMAIL`, pas de `E2E_USER_PASSWORD`, pas de `E2E_API_URL`,
 * pas de `storageState`. La page publique est un Server Component qui lit des
 * documents locaux : elle se rend sans backend, et c'est précisément ce qui
 * rend ces tests exécutables sur une PR.
 *
 * ## Les matrices sont des projets, pas des boucles dans les tests
 *
 * Téléphone, tablette, ordinateur, clair, sombre et mouvement réduit sont
 * déclarés ici. Un test écrit une fois est donc exécuté six fois, et l'échec
 * nomme la combinaison fautive au lieu de la noyer dans une assertion.
 */

const PORT = Number(process.env.E2E_PUBLIC_PORT ?? 3010);
const BASE_URL = process.env.E2E_PUBLIC_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e/public",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "desktop-clair",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "desktop-sombre",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
    },
    {
      /*
        `reducedMotion` n'est pas une option de `use` en Playwright 1.59 : elle
        passe par `contextOptions`, transmis tel quel à `browser.newContext`.
      */
      name: "desktop-mouvement-reduit",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
        contextOptions: { reducedMotion: "reduce" },
      },
    },
    {
      /*
        Tablette construite sur Chromium plutôt que sur le descripteur `iPad`,
        qui bascule sur WebKit : le job n'installe qu'un navigateur, et un
        second téléchargement pour une largeur d'écran ne se justifie pas.
      */
      name: "tablette",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 834, height: 1112 },
        hasTouch: true,
        colorScheme: "light",
      },
    },
    {
      name: "mobile-clair",
      use: { ...devices["Pixel 5"], colorScheme: "light" },
    },
    {
      name: "mobile-sombre",
      use: { ...devices["Pixel 5"], colorScheme: "dark" },
    },
  ],

  /*
    Le serveur est démarré par Playwright, y compris en CI : le workflow n'a
    alors qu'à construire. `AUTH_JWT_SECRET` n'est PAS fourni — `lib/verify-jwt`
    retombe sur sa valeur de développement, et aucune route publique ne la
    sollicite. Le job n'a donc besoin d'aucun secret pour démarrer.
  */
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
