/**
 * Tests E2E T3.4 — Wizard VSME en 10 étapes.
 *
 * Vérifie le parcours complet (< 30 min chrono, ici quelques secondes sur le
 * jeu démo) : période → import/énergie → … → génération du rapport → Terminer →
 * redirection vers /vsme/completude. Vérifie aussi la persistance (reprise).
 *
 * E2E sur master (e2e.yml) : nécessite l'app + l'API démarrées.
 */

import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "../fixtures/auth";

test.describe("T3.4 — Wizard VSME 10 étapes", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/vsme/wizard");
    await page.waitForLoadState("networkidle");
  });

  test("Parcours complet des 10 étapes sans cul-de-sac", async ({ page }) => {
    await expect(page.getByTestId("vsme-wizard")).toBeVisible();
    await expect(page.getByRole("heading", { name: /VSME en 10 étapes/i })).toBeVisible();

    // Étape 1 — période
    await page.getByTestId("field-B1-5").fill("2025");
    await page.getByTestId("wizard-next").click();

    // Étape 2 — énergie
    await page.getByTestId("field-B3-7").fill("500");
    await page.getByTestId("field-B3-8").fill("30");
    await page.getByTestId("wizard-next").click();

    // Étapes 3 → 9 : avancer (remplissage minimal facultatif)
    for (let i = 3; i <= 9; i++) {
      await expect(page.getByTestId("wizard-next")).toBeVisible();
      await page.getByTestId("wizard-next").click();
    }

    // Étape 10 — rapport : bouton de téléchargement + Terminer
    await expect(page.getByTestId("wizard-download")).toBeVisible();
    await page.getByTestId("wizard-complete").click();

    // Redirection vers la complétude
    await page.waitForURL(/\/vsme\/completude/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /Complétude VSME/i })).toBeVisible();
  });

  test("Reprise : l'étape et l'état sont persistés au rechargement", async ({ page }) => {
    await page.getByTestId("field-B1-5").fill("2024");
    await page.getByTestId("wizard-next").click(); // sauvegarde + passe à l'étape 2
    await expect(page.locator("text=/Étape 2\\/10/")).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");
    // La reprise charge la dernière étape enregistrée (≥ 2)
    await expect(page.locator("text=/Étape [2-9]|Étape 10/")).toBeVisible();
  });
});
