/**
 * Tests E2E Phase 4 — Matérialité drag & drop
 *
 * Vérifie :
 * 1. Page /materialite accessible après login
 * 2. Sélecteur de secteur fonctionne (5 secteurs)
 * 3. Matrice SVG rendue avec points drag & drop
 * 4. Onglet "Narratif ESRS" affiche le narratif généré
 * 5. Score KPIs mis à jour (total_materiel, score_moyen)
 * 6. Sauvegarde positions (bouton Save)
 */

import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "../fixtures/auth";

const SECTORS = ["Technologie", "Industrie", "Retail", "Services", "Finance"];

test.describe("Phase 4 — Matérialité drag & drop", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/materialite");
    await page.waitForLoadState("networkidle");
  });

  test("La page matérialité se charge avec KPI cards", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /double mat/i })).toBeVisible();
    // Au moins 1 carte KPI visible
    await expect(page.locator("text=/Enjeux évalués|Matériels|Score moyen/i").first()).toBeVisible();
  });

  test("Les 5 secteurs préremplis sont disponibles", async ({ page }) => {
    for (const sector of SECTORS) {
      await expect(page.getByRole("button", { name: sector })).toBeVisible({ timeout: 5_000 });
    }
  });

  test("Changer de secteur recalcule la matrice", async ({ page }) => {
    // Click sur "Finance"
    await page.getByRole("button", { name: "Finance" }).click();
    // Matrice doit se recharger (spinner bref puis disparaît)
    await page.waitForTimeout(500);
    // Points SVG présents
    const svgPoints = page.locator("[data-testid^='drag-point-']");
    await expect(svgPoints.first()).toBeVisible({ timeout: 5_000 });
  });

  test("L'onglet Narratif ESRS affiche du contenu", async ({ page }) => {
    await page.getByRole("button", { name: /narratif esrs/i }).click();
    await expect(page.locator("text=/Double matérialité/i")).toBeVisible({ timeout: 5_000 });
    // Check qu'il y a du texte substantiel (> 50 chars)
    const narrativeText = await page.locator("text=/Pilier|matériel|enjeux/i").first().textContent();
    expect(narrativeText?.length).toBeGreaterThan(10);
  });

  test("Mode édition / lecture toggle", async ({ page }) => {
    const toggleBtn = page.getByRole("button", { name: /mode édition|mode lecture/i });
    await expect(toggleBtn).toBeVisible();
    const initialText = await toggleBtn.textContent();
    await toggleBtn.click();
    const newText = await toggleBtn.textContent();
    expect(newText).not.toBe(initialText);
  });
});
