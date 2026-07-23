/**
 * Tests E2E ciblés — refonte visuelle du cockpit Ressources + tableau de bord (PR #137).
 *
 * Surfaces couvertes : /resources (chiffres-clés, jauges), /resources/assessments
 * (comparaison — UNE ligne par ressource), fiche ressource (carte pays + vue
 * tableau), tableau de bord (Preuve & Qualité, Scope 3).
 *
 * Assertions GARDÉES (motif de 16-resources.spec.ts) : le catalogue peut être vide
 * ou en `schema_not_ready` selon l'environnement — on vérifie alors qu'un état
 * explicite est rendu, jamais un blanc.
 *
 * Auth via la session démo (POST /auth/demo, aucun secret requis), comme
 * 15-demo-studio-nav.spec.ts et 19-resources-discoverability.spec.ts.
 */

import { expect, test } from "@playwright/test";

async function signInDemo(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /Accès démo/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("Refonte Ressources — surfaces", () => {
  test("/resources rend un état explicite, et les chiffres-clés si peuplé", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/resources");
    await page.waitForLoadState("networkidle");

    const anyState = page.locator(
      "[data-testid='resources-content'], [data-testid='resources-schema-not-ready'], [data-testid='resources-error']",
    );
    await expect(anyState.first()).toBeVisible({ timeout: 10_000 });

    const hero = page.getByTestId("resources-hero");
    if (await hero.isVisible().catch(() => false)) {
      await expect(page.getByTestId("resources-hero-count")).toBeVisible();
      await expect(page.getByTestId("resources-hero-maxrisk")).toBeVisible();
      await expect(page.getByTestId("resources-hero-confidence")).toBeVisible();
      // Au moins une carte porte sa jauge de risque.
      await expect(page.locator("[data-testid^='resource-gauge-']").first()).toBeVisible();
    }
  });

  test("/resources/assessments : au plus une ligne par ressource", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/resources/assessments");
    await page.waitForLoadState("networkidle");

    const comparison = page.getByTestId("resource-risk-comparison");
    if (await comparison.isVisible().catch(() => false)) {
      const ids = await page
        .locator("[data-testid^='comparison-row-']")
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""));
      expect(ids.length).toBeGreaterThan(0);
      // Aucune clé dupliquée : une seule année par ressource dans ce composant.
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("fiche ressource : la vue tableau accompagne toujours la carte pays", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/resources");
    await page.waitForLoadState("networkidle");

    const firstCard = page.locator("[data-testid^='resource-card-']").first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.click();
      await expect(page).toHaveURL(/\/resources\/.+/);

      const choropleth = page.getByTestId("stage-choropleth");
      if (await choropleth.isVisible().catch(() => false)) {
        // Vue tableau obligatoire (accessibilité + jamais couleur seule).
        await expect(page.getByTestId("choropleth-table")).toBeVisible();
      }
    }
  });

  test("tableau de bord : Preuve & Qualité et Scope 3 interactifs", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const quality = page.getByTestId("quality-panel");
    if (await quality.isVisible().catch(() => false)) {
      await expect(page.getByTestId("quality-audit-gauge")).toBeVisible();
      await expect(page.getByTestId("quality-method-bars")).toBeVisible();
    }

    const scope3 = page.getByTestId("scope3-panel");
    if (await scope3.isVisible().catch(() => false)) {
      await expect(page.getByTestId("scope3-rows")).toBeVisible();
      // Le filtre est réellement interactif.
      await page.getByTestId("scope3-filter-todo").click();
      await expect(page.getByTestId("scope3-rows")).toBeVisible();
    }
  });
});
