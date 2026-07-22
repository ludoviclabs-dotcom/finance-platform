import { expect, test } from "@playwright/test";

/**
 * PR-M2D — séquence « Dépendances industrielles étendues » (/demo/asterion-resources).
 * Route publique, données fictives, aucun appel externe. Reduced-motion activé
 * (état final stabilisé + chemin a11y). La séquence Asterion Motion existante
 * (/demo/asterion-motion) n'est pas touchée.
 */
test.describe("Séquence /demo/asterion-resources (Module 2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/demo/asterion-resources");
    await expect(page.getByTestId("demo-asterion-resources")).toBeVisible();
    await page
      .getByRole("button", { name: /Essentiels uniquement/i })
      .click({ timeout: 3000 })
      .catch(() => {});
  });

  test("monte avec les badges fictifs et l'étape 1/10", async ({ page }) => {
    const badges = page.getByTestId("demo-badges");
    await expect(badges).toContainText("IA SIMULÉE");
    await expect(badges).toContainText("ZÉRO APPEL EXTERNE");
    await expect(badges).toContainText("DÉMONSTRATION FICTIVE");
    await expect(page.getByTestId("demo-step-counter")).toHaveText("1 / 10");
    await expect(page.getByTestId("demo-step-res-detected")).toBeVisible();
  });

  test("navigue en avant/arrière et au clavier", async ({ page }) => {
    await page.getByTestId("demo-next").click();
    await expect(page.getByTestId("demo-step-counter")).toHaveText("2 / 10");
    await page.getByTestId("demo-prev").click();
    await expect(page.getByTestId("demo-step-counter")).toHaveText("1 / 10");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("demo-step-counter")).toHaveText("2 / 10");
  });

  test("le beat risque décompose l'indice (risque ≠ confiance, jamais une jauge)", async ({ page }) => {
    await page.getByTestId("demo-step-dot-5").click(); // 0-based 5 => beat 6 (risque)
    await expect(page.getByTestId("resource-index-card")).toBeVisible();
    await expect(page.getByTestId("index-risk")).toBeVisible();
    await expect(page.getByTestId("index-confidence")).toBeVisible();
    await expect(page.getByTestId("assessment-dimensions")).toBeVisible();
  });

  test("le beat données manquantes montre « Donnée manquante »", async ({ page }) => {
    await page.getByTestId("demo-step-dot-7").click(); // beat 8 (missing)
    await expect(page.getByTestId("res-beat-missing")).toBeVisible();
    await expect(page.getByText(/Donnée manquante/).first()).toBeVisible();
  });

  test("le beat décision est humaine et append-only", async ({ page }) => {
    await page.getByTestId("demo-step-dot-9").click(); // beat 10 (decision)
    await expect(page.getByTestId("res-beat-decision")).toBeVisible();
    await page.getByTestId("res-decision-keep").click();
    await expect(page.getByTestId("res-decision-note")).toContainText(/append-only/i);
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
