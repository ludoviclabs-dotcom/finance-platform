import { expect, test } from "@playwright/test";

test.describe("Accès démo public", () => {
  test("/login → Accès démo → /demo sans 404 ni accès métier", async ({ page, context }) => {
    await page.goto("/login");

    const cookieConsent = page.getByRole("region", { name: "Consentement cookies" });
    await cookieConsent.waitFor({ state: "visible", timeout: 2_000 }).catch(() => {});
    if (await cookieConsent.isVisible().catch(() => false)) {
      await cookieConsent
        .getByRole("button", { name: "Essentiels uniquement", exact: true })
        .click({ force: true });
    }

    await page.getByRole("button", { name: /Accès démo/i }).click();
    await expect(page).toHaveURL(/\/demo$/, { timeout: 15_000 });
    await expect(page.locator("body")).not.toContainText("404");

    const demoCookie = (await context.cookies()).find((cookie) => cookie.name === "cc_demo_session");
    expect(demoCookie?.httpOnly).toBe(true);
    expect(demoCookie?.sameSite).toBe("Lax");

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/demo$/, { timeout: 15_000 });
  });
});
