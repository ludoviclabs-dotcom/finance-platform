import { test, expect } from "@playwright/test";
import { loginAsTestUser, logout, TEST_EMAIL, TEST_PASSWORD } from "../fixtures/auth";

test.describe("Authentification", () => {
  test("login avec credentials valides → redirection dashboard", async ({ page }) => {
    await loginAsTestUser(page);

    // Dashboard chargé
    await expect(page).toHaveURL(/\/dashboard/);
    // Layout app présent (sidebar ou header)
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 8_000 });
  });

  test("login avec mauvais mot de passe → message d'erreur", async ({ page }) => {
    await page.goto("/login");

    await page.fill("#login-email", TEST_EMAIL);
    await page.fill("#login-password", "mauvais-mot-de-passe-xyz");
    await page.click('button[type="submit"]');

    // Message d'erreur visible
    const errorEl = page.locator("#login-error");
    await expect(errorEl).toBeVisible({ timeout: 8_000 });
    // Reste sur /login
    await expect(page).toHaveURL(/\/login/);
    // Pas de redirection vers dashboard
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test("accès direct /dashboard sans session → redirection /login", async ({ page }) => {
    // Navigation directe sans login préalable
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("token absent dans localStorage après login (sécurité)", async ({ page }) => {
    await loginAsTestUser(page);

    // Vérifie qu'aucun token JWT n'est stocké dans localStorage
    const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    const tokenKeys = localStorageKeys.filter(
      (k) => k.toLowerCase().includes("token") || k.toLowerCase().includes("auth")
    );
    expect(tokenKeys).toHaveLength(0);
  });

  test("logout → retour sur /login + accès dashboard refusé", async ({ page }) => {
    await loginAsTestUser(page);
    await logout(page);

    // Tente de retourner sur le dashboard
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("champs email et password présents sur la page login", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("toggle visibilité mot de passe fonctionne", async ({ page }) => {
    await page.goto("/login");

    const passwordInput = page.locator("#login-password");
    const toggleBtn = page.getByRole("button", { name: /afficher|masquer/i });

    // Par défaut : type password
    await expect(passwordInput).toHaveAttribute("type", "password");

    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });
});

test.describe("Sécurité — headers & CSP", () => {
  test("page login ne contient pas de violations CSP console", async ({ page }) => {
    const cspViolations: string[] = [];

    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        msg.text().toLowerCase().includes("content security policy")
      ) {
        cspViolations.push(msg.text());
      }
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    expect(cspViolations).toHaveLength(0);
  });

  test("réponse /login contient header x-frame-options ou CSP frame-ancestors", async ({ page }) => {
    const response = await page.goto("/login");
    const headers = response?.headers() ?? {};

    const hasFrameOptions = "x-frame-options" in headers;
    const csp = headers["content-security-policy"] ?? headers["content-security-policy-report-only"] ?? "";
    const hasFrameAncestors = csp.includes("frame-ancestors");

    expect(hasFrameOptions || hasFrameAncestors).toBe(true);
  });
});

test.describe("Sécurité — cookie refresh token", () => {
  test("cookie cc_refresh présent et httpOnly après login", async ({ page, context }) => {
    await loginAsTestUser(page);

    const cookies = await context.cookies();
    const refreshCookie = cookies.find((c) => c.name === "cc_refresh");

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.sameSite).toMatch(/lax/i);
  });

  test("cookie cc_refresh absent après logout", async ({ page, context }) => {
    await loginAsTestUser(page);
    await logout(page);

    const cookies = await context.cookies();
    const refreshCookie = cookies.find((c) => c.name === "cc_refresh");

    expect(refreshCookie).toBeUndefined();
  });
});
