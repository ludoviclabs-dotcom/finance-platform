import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "../fixtures/auth";

/**
 * PR-M2C — Cockpit Ressources stratégiques (Module 2).
 *
 * Parcours principal : catalogue → fiche → expositions → assessments →
 * méthodologie. Les assertions dépendantes des données sont gardées (le
 * référentiel ressources s'alimente hors requête via Evidence Kernel et peut
 * être vide ou en `schema_not_ready` selon l'environnement).
 */
test.describe("PR-M2C — Cockpit Ressources stratégiques", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/resources");
    await page.waitForLoadState("networkidle");
  });

  test("Le catalogue se charge avec le titre et le badge BETA", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Ressources stratégiques/i })).toBeVisible();
    await expect(page.locator("[data-testid^='feature-status-badge-']").first()).toBeVisible();

    const anyState = page.locator(
      "[data-testid='resources-content'], [data-testid='resources-schema-not-ready'], [data-testid='resources-error']",
    );
    await expect(anyState.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Les onglets naviguent entre les cinq surfaces du module", async ({ page }) => {
    await page.getByTestId("resource-tab-exposures").click();
    await expect(page).toHaveURL(/\/resources\/exposures/);
    await expect(page.getByRole("heading", { name: /Expositions ressources/i })).toBeVisible();

    await page.getByTestId("resource-tab-assessments").click();
    await expect(page).toHaveURL(/\/resources\/assessments/);
    await expect(page.getByRole("heading", { name: /Assessments ressources/i })).toBeVisible();

    await page.getByTestId("resource-tab-methodology").click();
    await expect(page).toHaveURL(/\/resources\/methodology/);
    await expect(page.getByRole("heading", { name: /Méthodologie/i })).toBeVisible();

    await page.getByTestId("resource-tab-catalog").click();
    await expect(page).toHaveURL(/\/resources$/);
  });

  test("La méthodologie affiche le disclaimer non officiel et les poids décomposés", async ({ page }) => {
    await page.goto("/resources/methodology");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("resource-methodology-disclaimer")).toBeVisible();
    await expect(page.getByTestId("methodology-risk-weights")).toBeVisible();
    await expect(page.getByTestId("methodology-confidence-weights")).toBeVisible();
    await expect(page.getByText(/n['’]est PAS un score officiel/i)).toBeVisible();
  });

  test("Expositions et assessments rendent un état explicite (jamais un blanc)", async ({ page }) => {
    await page.goto("/resources/exposures");
    await page.waitForLoadState("networkidle");
    const exposuresState = page.locator(
      "[data-testid='exposures-content'], [data-testid='exposures-schema-not-ready'], [data-testid='exposures-error']",
    );
    await expect(exposuresState.first()).toBeVisible({ timeout: 10_000 });

    await page.goto("/resources/assessments");
    await page.waitForLoadState("networkidle");
    const assessmentsState = page.locator(
      "[data-testid='assessments-content'], [data-testid='assessments-schema-not-ready'], [data-testid='assessments-error']",
    );
    await expect(assessmentsState.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Parcours principal : catalogue → fiche décomposée (si des ressources existent)", async ({ page }) => {
    const content = page.locator("[data-testid='resources-content']");
    if (await content.isVisible().catch(() => false)) {
      const firstCard = page.locator("[data-testid^='resource-card-']").first();
      if (await firstCard.isVisible().catch(() => false)) {
        await firstCard.click();
        await expect(page).toHaveURL(/\/resources\/.+/);

        const fiche = page.locator(
          "[data-testid='resource-content'], [data-testid='resource-schema-not-ready'], [data-testid='resource-error']",
        );
        await expect(fiche.first()).toBeVisible({ timeout: 10_000 });

        // Fiche prête : les sections décomposées et le lien retour sont présents.
        const ready = page.locator("[data-testid='resource-content']");
        if (await ready.isVisible().catch(() => false)) {
          await expect(page.getByTestId("resource-value-chain")).toBeVisible();
          await expect(page.getByTestId("resource-regulations")).toBeVisible();
          await expect(page.getByTestId("module-links")).toBeVisible();
        }
      }
    }
  });
});
