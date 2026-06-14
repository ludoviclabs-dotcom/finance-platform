/**
 * Tests E2E — Démo cinématique /demo + page publique /demo/verify/[hash].
 *
 * Vérifie :
 *   1. Le CTA "Voir la démo en 2 min" depuis "/" mène à /demo
 *   2. /demo monte soit l'expérience animée, soit le snapshot statique (reduced-motion)
 *   3. Le bouton "Passer" amène directement au CTA final (replay visible)
 *   4. /demo/verify/<DEMO_HASH> affiche la vérification réussie + le hash
 *
 * Timeouts généreux : la démo dure ~100 s en lecture nominale.
 */

import { test, expect } from "@playwright/test";

/** Identique à DEMO_HASH_FULL (apps/carbon/components/demo/demo-types.ts). */
const DEMO_HASH = "9f23a1b2c3d4e5f60718293a4b5c6d7e8f9012a3b4c5d6e7f80912a3b4c5d6e7f";

test.describe("Démo cinématique /demo", () => {
  test("le lien 'Voir la démo en 2 min' depuis l'accueil mène à /demo", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: /Voir la démo/ }).click();
    await expect(page).toHaveURL(/\/demo/);
  });

  test("/demo monte l'expérience animée ou le snapshot statique", async ({ page }) => {
    await page.goto("/demo");
    await page.waitForLoadState("networkidle");

    const experience = await page.getByTestId("demo-experience").count();
    const snapshot = await page.getByTestId("demo-static-snapshot").count();
    expect(experience + snapshot).toBeGreaterThanOrEqual(1);
  });

  test("le bouton 'Passer' mène au CTA final avec option de rejouer", async ({ page }) => {
    await page.goto("/demo");
    await page.waitForLoadState("networkidle");

    // Sélecteur tolérant : on ne clique que si le bouton "Passer" est monté.
    const skip = page.getByTestId("demo-skip");
    if ((await skip.count()) > 0) {
      await skip.first().click();
    }

    await expect(page.getByTestId("demo-cta")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("demo-replay")).toBeVisible({ timeout: 15000 });
  });

  test("/demo/verify/<hash> affiche la vérification réussie et le hash", async ({ page }) => {
    await page.goto(`/demo/verify/${DEMO_HASH}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("demo-verify-success")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("demo-verify-hash")).toContainText(DEMO_HASH);
  });
});
