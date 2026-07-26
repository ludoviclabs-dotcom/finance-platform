import { expect, test } from "@playwright/test";

import { loginAsTestUser } from "../fixtures/auth";

test.describe("ProofTwin CarbonCo", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test("sidebar navigation, scene, filters and drawer work", async ({ page }) => {
    await page.getByRole("link", { name: /ProofTwin/i }).click();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/proof-twin/);
    await expect(page.getByTestId("proof-twin-page")).toBeVisible();
    await expect(page.getByTestId("proof-audit-strip")).toBeVisible();
    await expect(page.getByTestId("proof-twin-node-site")).toBeVisible();
    await expect(page.getByTestId("proof-twin-node-energy")).toBeVisible();
    await expect(page.getByTestId("proof-twin-node-esrs-report")).toBeVisible();

    await page.getByTestId("proof-filter-scope-scope3").click();

    await expect(page.getByTestId("proof-twin-node-suppliers")).toBeVisible();
    await expect(page.getByTestId("proof-twin-node-energy")).toHaveCount(0);

    await page.getByTestId("proof-twin-node-suppliers").click();
    await expect(page.getByTestId("proof-drawer")).toBeVisible();
    await expect(page.getByText("Ce que je vois")).toBeVisible();
    await expect(page.getByText("Pourquoi c'est important")).toBeVisible();
    await expect(page.getByText("Limite connue")).toBeVisible();

    await page.getByTestId("proof-drawer-close").click();
    await expect(page.getByTestId("proof-drawer")).toHaveCount(0);
  });
});
