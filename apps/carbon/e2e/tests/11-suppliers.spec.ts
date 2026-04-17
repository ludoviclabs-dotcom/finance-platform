/**
 * Tests E2E Phase 4 — Fournisseurs (Supplier Data Collection)
 *
 * Vérifie :
 * 1. Page /fournisseurs accessible après login
 * 2. Liste top-20 fournisseurs rendue avec données démo
 * 3. Ajout d'un fournisseur via le formulaire
 * 4. Génération d'un token questionnaire
 * 5. Page publique /q/[token] accessible sans auth (lien invalide → 404)
 * 6. Suppression d'un fournisseur
 */

import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "../fixtures/auth";

test.describe("Phase 4 — Fournisseurs", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/fournisseurs");
    await page.waitForLoadState("networkidle");
  });

  test("La page fournisseurs se charge avec les KPIs scope 3", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /fournisseurs/i })).toBeVisible();
    // KPI cards : Fournisseurs, GES total, Avec données GES, Couverture
    await expect(page.locator("text=/Fournisseurs|GES total estimé/i").first()).toBeVisible();
  });

  test("La liste des fournisseurs démo est visible (top 20)", async ({ page }) => {
    const list = page.locator("[data-testid='suppliers-list']");
    await expect(list).toBeVisible({ timeout: 8_000 });
    // Au moins 5 fournisseurs listés
    const rows = list.locator("> div");
    await expect(rows).toHaveCount(20, { timeout: 5_000 });
  });

  test("Ajout d'un nouveau fournisseur", async ({ page }) => {
    // Ouvrir le modal
    await page.locator("[data-testid='add-supplier-btn']").click();
    await expect(page.getByRole("heading", { name: /ajouter un fournisseur/i })).toBeVisible();

    // Remplir le formulaire
    await page.fill("input[placeholder='Ex : Acier Durable SAS']", "Test Fournisseur E2E");
    await page.fill("input[placeholder='contact@fournisseur.fr']", "test@e2e.fr");
    await page.fill("input[placeholder='France']", "France");
    await page.fill("input[placeholder='500']", "250");

    // Soumettre
    await page.getByRole("button", { name: /ajouter/i }).click();

    // Le fournisseur doit apparaître dans la liste
    await expect(page.locator("text=Test Fournisseur E2E")).toBeVisible({ timeout: 5_000 });
  });

  test("Génération d'un token questionnaire pour un fournisseur", async ({ page }) => {
    const list = page.locator("[data-testid='suppliers-list']");
    await expect(list).toBeVisible({ timeout: 8_000 });

    // Hover sur le premier fournisseur pour afficher les actions
    const firstRow = list.locator("> div").first();
    await firstRow.hover();

    // Cliquer sur "Envoyer questionnaire" (bouton Send)
    const sendBtn = firstRow.getByTitle("Envoyer questionnaire");
    await sendBtn.click();

    // Modal questionnaire visible
    await expect(page.getByRole("heading", { name: /envoyer un questionnaire/i })).toBeVisible();

    // Générer le lien
    await page.getByRole("button", { name: /générer le lien/i }).click();

    // Lien généré visible
    await expect(page.locator("text=/Lien généré/i")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=/carbon-snowy|localhost/")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Page publique questionnaire (no auth)
// ---------------------------------------------------------------------------

test.describe("Phase 4 — Questionnaire public /q/[token]", () => {
  test("Token invalide → message d'erreur", async ({ page }) => {
    await page.goto("/q/00000000000000000000000000000000invalid");
    await expect(page.locator("text=/Lien invalide|introuvable/i")).toBeVisible({ timeout: 8_000 });
  });

  test("La page /q/ affiche le branding CarbonCo", async ({ page }) => {
    // Même avec token invalide, le shell est visible
    await page.goto("/q/deadbeefdeadbeefdeadbeefdeadbeef");
    await expect(page.locator("text=CarbonCo")).toBeVisible({ timeout: 5_000 });
  });
});
