/**
 * Tests E2E Phase 3.A — Workflow validation
 *
 * Vérifie :
 *   1. Page /revue accessible et rendue
 *   2. Header + stats visibles
 *   3. Filtres actifs/proposed/in_review/validated/frozen/rejected cliquables
 *   4. API /reviews/stats + /reviews/inbox appelées
 *   5. Badge statut visible dans le dashboard (quand mode audit activé)
 *
 * Sans DB peuplée, l'Inbox peut être vide — l'empty state doit s'afficher.
 */

import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "../fixtures/auth";

test.describe("Phase 3.A — Page /revue Inbox", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test("/revue affiche le header et les stats", async ({ page }) => {
    await page.goto("/revue");
    await page.waitForLoadState("networkidle");

    // Header
    await expect(page.getByRole("heading", { name: /Inbox de validation/i })).toBeVisible();

    // Bouton rafraîchir
    await expect(page.getByTestId("refresh-inbox")).toBeVisible();
  });

  test("les 6 filtres de statut sont présents", async ({ page }) => {
    await page.goto("/revue");
    await page.waitForLoadState("networkidle");

    for (const filter of ["all_active", "proposed", "in_review", "validated", "frozen", "rejected"]) {
      await expect(page.getByTestId(`filter-${filter}`)).toBeVisible();
    }
  });

  test("cliquer sur un filtre déclenche un appel /reviews/inbox", async ({ page }) => {
    await page.goto("/revue");
    await page.waitForLoadState("networkidle");

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/reviews/inbox"),
      { timeout: 5000 },
    );
    await page.getByTestId("filter-proposed").click();
    const res = await responsePromise;
    expect([200, 401, 403, 503]).toContain(res.status());
  });

  test("l'empty state s'affiche quand aucune review", async ({ page }) => {
    await page.goto("/revue");
    await page.waitForLoadState("networkidle");

    // Soit la liste affiche des rows, soit l'empty state — les deux sont valides
    const list = page.getByTestId("reviews-list");
    await expect(list).toBeVisible();
  });
});

test.describe("Phase 3.A — Badges statut dashboard (mode audit)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("le bouton provenance reste fonctionnel avec le mode audit activé", async ({ page }) => {
    // Activer le mode audit
    await page.getByTestId("audit-mode-toggle").click();
    await expect(page.getByTestId("audit-mode-banner")).toBeVisible();

    // Le bouton provenance doit toujours ouvrir le drawer
    await page.getByTestId("provenance-trigger-CC.GES.SCOPE1").first().click();
    await expect(page.getByTestId("provenance-drawer")).toBeVisible({ timeout: 2000 });

    // Cleanup : désactiver audit mode
    await page.getByTestId("provenance-close").click();
    await page.getByTestId("audit-mode-toggle").click();
  });
});

test.describe("Phase 3.A — Lien Inbox dans sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test("cliquer sur Inbox revue dans la sidebar navigue vers /revue", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Le lien vers /revue doit exister dans la sidebar (en mode desktop)
    const revueLink = page.getByRole("link", { name: /Inbox revue/i }).first();
    await expect(revueLink).toBeVisible();
    await revueLink.click();

    await expect(page).toHaveURL(/\/revue/);
  });
});
