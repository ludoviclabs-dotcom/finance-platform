/**
 * Tests E2E — cockpit de démonstration produit /demo/asterion-motion.
 *
 * Vérifie (hors-ligne, données canoniques — aucun backend requis) :
 *   1. Le cockpit monte avec ses badges fictifs et l'étape 1/10.
 *   2. Navigation avant/arrière + compteur d'étapes + clavier (→).
 *   3. L'étape IA rend les 4 statuts déterministes (ReviewGate réel).
 *   4. Le mode réalisateur affiche le contrôle lecture/pause.
 *   5. Recommencer ramène à l'étape 1/10.
 *
 * La route est publique (canned data) : ne dépend d'aucune session ni API.
 */

import { expect, test } from "@playwright/test";

test.describe("Cockpit /demo/asterion-motion", () => {
  test.beforeEach(async ({ page }) => {
    // Émule prefers-reduced-motion : rendu stabilisé (état final immédiat) — teste
    // aussi le chemin d'accessibilité requis, et évite les faux « not stable »
    // dus aux transitions pendant les clics rapides.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/demo/asterion-motion");
    await expect(page.getByTestId("demo-asterion")).toBeVisible();
    // Ferme la bannière cookies (choix privé : essentiels uniquement) — sinon
    // elle intercepte les clics sur les commandes en bas de page.
    await page
      .getByRole("button", { name: /Essentiels uniquement/i })
      .click({ timeout: 3000 })
      .catch(() => {});
  });

  test("monte avec les badges fictifs et l'étape 1/10", async ({ page }) => {
    const badges = page.getByTestId("demo-badges");
    await expect(badges).toContainText("IA SIMULÉE");
    await expect(badges).toContainText("DÉMONSTRATION FICTIVE");
    await expect(page.getByTestId("demo-step-counter")).toHaveText("1 / 10");
    await expect(page.getByTestId("demo-step-situation")).toBeVisible();
  });

  test("navigue en avant/arrière et au clavier", async ({ page }) => {
    await page.getByTestId("demo-next").click();
    await expect(page.getByTestId("demo-step-counter")).toHaveText("2 / 10");
    await page.getByTestId("demo-prev").click();
    await expect(page.getByTestId("demo-step-counter")).toHaveText("1 / 10");
    // Clavier : flèche droite avance.
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("demo-step-counter")).toHaveText("2 / 10");
  });

  test("l'étape IA rend les 4 statuts déterministes", async ({ page }) => {
    // Saut direct à l'étape IA (index 7 = étape 8).
    await page.getByTestId("demo-step-dot-7").click();
    await expect(page.getByTestId("ai-activity-trace")).toBeVisible();
    await expect(page.getByText("Partiellement étayé").first()).toBeVisible();
    await expect(page.getByText("Contredit par les preuves").first()).toBeVisible();
    await expect(page.getByText("Non étayé").first()).toBeVisible();
    // 4 pastilles de statut de support.
    await expect(page.getByTestId("review-gate-support-status")).toHaveCount(4);
  });

  test("le mode réalisateur affiche le contrôle lecture/pause", async ({ page }) => {
    await page.getByTestId("demo-mode-director").click();
    await expect(page.getByTestId("demo-director")).toBeVisible();
    await expect(page.getByTestId("demo-director-toggle")).toBeVisible();
  });

  test("recommencer ramène à l'étape 1/10", async ({ page }) => {
    await page.getByTestId("demo-next").click();
    await page.getByTestId("demo-next").click();
    await expect(page.getByTestId("demo-step-counter")).toHaveText("3 / 10");
    await page.getByTestId("demo-reset").click();
    await expect(page.getByTestId("demo-step-counter")).toHaveText("1 / 10");
  });
});
