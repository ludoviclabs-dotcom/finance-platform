import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "../fixtures/auth";

test.describe("Navigation post-login", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test("dashboard charge sans erreur 5xx", async ({ page }) => {
    const errors: string[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("navigation vers /copilot charge la page IA", async ({ page }) => {
    await page.goto("/copilot");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/copilot/);
    // La page ne doit pas rediriger vers /login
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("navigation vers /scopes charge sans erreur", async ({ page }) => {
    await page.goto("/scopes");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/scopes/);
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("navigation vers /reports charge sans erreur", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/reports/);
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("titre de la page est présent", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveTitle(/.+/); // titre non vide
  });
});

test.describe("Pages publiques (sans auth)", () => {
  test("/login est accessible sans session", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("/mentions-legales est accessible", async ({ page }) => {
    const res = await page.goto("/mentions-legales");
    expect(res?.status()).toBeLessThan(400);
  });

  test("/confidentialite est accessible", async ({ page }) => {
    const res = await page.goto("/confidentialite");
    expect(res?.status()).toBeLessThan(400);
  });

  test("/cookies est accessible", async ({ page }) => {
    const res = await page.goto("/cookies");
    expect(res?.status()).toBeLessThan(400);
  });

  test("/cgu est accessible", async ({ page }) => {
    const res = await page.goto("/cgu");
    expect(res?.status()).toBeLessThan(400);
  });
});

test.describe("Copilot IA — golden path", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test("envoi d'un message → réponse visible dans l'interface", async ({ page }) => {
    await page.goto("/copilot");
    await page.waitForLoadState("networkidle");

    // Cherche le champ de saisie du copilot
    const input = page
      .getByRole("textbox")
      .or(page.locator("textarea"))
      .first();

    await expect(input).toBeVisible({ timeout: 8_000 });

    await input.fill("Qu'est-ce que le scope 1 en comptabilité carbone ?");

    // Soumet (Enter ou bouton Send)
    const sendBtn = page.getByRole("button", { name: /envoyer|send/i }).first();
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
    } else {
      await input.press("Enter");
    }

    // Une réponse doit apparaître dans un délai raisonnable (streaming)
    // On attend qu'un nouvel élément de message apparaisse
    await expect(
      page.locator("[data-role='assistant'], [data-message-role='assistant']")
        .or(page.locator(".message-assistant, .assistant-message"))
    ).toBeVisible({ timeout: 30_000 });
  });
});
