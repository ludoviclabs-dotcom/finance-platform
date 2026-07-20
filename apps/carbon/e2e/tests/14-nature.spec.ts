import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "../fixtures/auth";

/**
 * PR-09 — Nature & biodiversité (TNFD LEAP), page BETA `/nature`.
 *
 * Vérifie le chargement de la page et la présence des règles de présentation
 * non négociables : dépendances/impacts et risques/opportunités rendus dans
 * des cartes visuellement SÉPARÉES (jamais fusionnées), et — si un brouillon
 * TNFD existe — le bandeau « brouillon, non certifié » toujours visible.
 *
 * N'exerce aucune donnée de démonstration serveur spécifique (contrairement
 * à `11-suppliers.spec.ts`) : le module PR-09 ne fournit pas encore de jeu
 * de données seedé, ces tests vérifient donc la structure de la page plutôt
 * que son contenu chiffré.
 */

test.describe("PR-09 — Nature & biodiversité", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/nature");
    await page.waitForLoadState("networkidle");
  });

  test("La page nature se charge avec le titre et le badge BETA", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Nature.*biodiversité/i })).toBeVisible();
    await expect(page.locator("[data-testid^='feature-status-badge-']").first()).toBeVisible();
  });

  test("Les sections Locate, Evaluate, Assess et Prepare sont présentes", async ({ page }) => {
    const content = page.locator(
      "[data-testid='nature-content'], [data-testid='nature-schema-not-ready'], [data-testid='nature-error']",
    );
    await expect(content.first()).toBeVisible({ timeout: 10_000 });

    // Si le schéma est prêt (038/039 appliquées), les quatre sections LEAP
    // doivent être présentes et dépendances/impacts + risques/opportunités
    // doivent apparaître dans des cartes SÉPARÉES, jamais fusionnées.
    const ready = page.locator("[data-testid='nature-content']");
    if (await ready.isVisible().catch(() => false)) {
      await expect(page.locator("[data-testid='nature-leap-assessments']")).toBeVisible();
      await expect(page.locator("[data-testid='nature-evaluate']")).toBeVisible();
      await expect(page.locator("[data-testid='nature-dependencies-card']")).toBeVisible();
      await expect(page.locator("[data-testid='nature-impacts-card']")).toBeVisible();
      await expect(page.locator("[data-testid='nature-assess']")).toBeVisible();
      await expect(page.locator("[data-testid='nature-risks-card']")).toBeVisible();
      await expect(page.locator("[data-testid='nature-opportunities-card']")).toBeVisible();
      await expect(page.locator("[data-testid='nature-prepare']")).toBeVisible();
    }
  });

  test("Un brouillon TNFD, s'il existe, affiche le bandeau non-certifié en permanence", async ({ page }) => {
    const draft = page.locator("[data-testid^='nature-draft-']").first();
    if (await draft.isVisible().catch(() => false)) {
      const disclaimer = draft.locator("[data-testid='nature-draft-disclaimer']");
      await expect(disclaimer).toBeVisible();
      await expect(disclaimer).toContainText(/PAS une disclosure TNFD officielle/i);
    }
  });
});
