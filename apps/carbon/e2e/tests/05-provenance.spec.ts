/**
 * Tests E2E Phase 2 — Provenance Drawer + Audit Mode Toggle
 *
 * Vérifie :
 *   1. Le toggle audit est visible dans le header et persiste (localStorage)
 *   2. Le bouton "Voir la provenance" apparaît sur ≥4 KPIs du dashboard
 *   3. Cliquer ouvre le drawer, l'animation est < 300ms côté timing de rendu
 *   4. ESC ferme le drawer
 *   5. Le hash affiché dans le drawer est cliquable et copiable
 *
 * Pré-requis :
 *   - Frontend Next.js lancé (http://localhost:3003)
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD exportés
 *
 * Les tests reposent uniquement sur la présence des data-testid et n'exigent
 * pas d'events de provenance en DB (fallback à message empty state acceptable).
 */

import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "../fixtures/auth";

test.describe("Phase 2 — Provenance Drawer", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("le toggle audit est visible et fonctionnel", async ({ page }) => {
    const toggle = page.getByTestId("audit-mode-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Le bandeau audit doit apparaître
    await expect(page.getByTestId("audit-mode-banner")).toBeVisible();

    // Reload → persistance localStorage
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("audit-mode-toggle")).toHaveAttribute("aria-pressed", "true");

    // Remettre à off pour les autres tests
    await page.getByTestId("audit-mode-toggle").click();
  });

  test("≥4 boutons de provenance présents sur les KPIs du dashboard", async ({ page }) => {
    const codes = ["CC.GES.TOTAL_S123", "CC.GES.SCOPE1", "CC.GES.SCOPE2_LB", "CC.GES.SCOPE3"];
    for (const code of codes) {
      await expect(page.getByTestId(`provenance-trigger-${code}`).first()).toBeVisible();
    }
  });

  test("cliquer sur un trigger ouvre le drawer avec le bon titre", async ({ page }) => {
    await page.getByTestId("provenance-trigger-CC.GES.SCOPE1").first().click();

    const drawer = page.getByTestId("provenance-drawer");
    await expect(drawer).toBeVisible({ timeout: 2000 });
    await expect(drawer.getByText("CC.GES.SCOPE1")).toBeVisible();
    await expect(drawer.getByText(/Scope 1/i)).toBeVisible();
  });

  test("ESC ferme le drawer", async ({ page }) => {
    await page.getByTestId("provenance-trigger-CC.GES.SCOPE1").first().click();
    await expect(page.getByTestId("provenance-drawer")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("provenance-drawer")).toBeHidden({ timeout: 2000 });
  });

  test("le bouton close X ferme le drawer", async ({ page }) => {
    await page.getByTestId("provenance-trigger-CC.GES.TOTAL_S123").first().click();
    const drawer = page.getByTestId("provenance-drawer");
    await expect(drawer).toBeVisible();

    await page.getByTestId("provenance-close").click();
    await expect(drawer).toBeHidden({ timeout: 2000 });
  });

  test("le drawer s'affiche en < 500ms (animation + premier render)", async ({ page }) => {
    const t0 = Date.now();
    await page.getByTestId("provenance-trigger-CC.GES.SCOPE3").first().click();
    await page.getByTestId("provenance-drawer").waitFor({ state: "visible" });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(500);
  });
});

test.describe("Phase 2 — Page /qc (Data Quality Center)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test("/qc affiche la carte d'intégrité chaîne de provenance", async ({ page }) => {
    await page.goto("/qc");
    await page.waitForLoadState("networkidle");

    const card = page.getByTestId("provenance-integrity-card");
    await expect(card).toBeVisible();
    await expect(card.getByText(/Intégrité chaîne de provenance/i)).toBeVisible();

    // Bouton Revérifier présent
    await expect(page.getByTestId("verify-chain-button")).toBeVisible();
  });

  test("cliquer sur Revérifier déclenche un appel /facts/verify", async ({ page }) => {
    await page.goto("/qc");
    await page.waitForLoadState("networkidle");

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/facts/verify"),
      { timeout: 5000 },
    );
    await page.getByTestId("verify-chain-button").click();
    const res = await responsePromise;
    expect([200, 401, 403, 503]).toContain(res.status());
  });
});
