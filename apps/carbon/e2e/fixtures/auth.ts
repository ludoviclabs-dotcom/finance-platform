import { type Page, expect } from "@playwright/test";

/**
 * Credentials du compte de test.
 * Définis via variables d'environnement — jamais en dur dans le code.
 */
export const TEST_EMAIL =
  process.env.E2E_USER_EMAIL ?? "ludoviclabs@gmail.com";
export const TEST_PASSWORD = process.env.E2E_USER_PASSWORD ?? "";

/**
 * loginAsTestUser — Effectue le login via l'UI et attend la redirection dashboard.
 * À appeler dans beforeEach des tests qui nécessitent une session active.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  if (!TEST_PASSWORD) {
    throw new Error(
      "E2E_USER_PASSWORD non défini. Exporte la variable avant de lancer les tests."
    );
  }

  await page.goto("/login");

  await page.fill("#login-email", TEST_EMAIL);
  await page.fill("#login-password", TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // Attend la redirection vers le dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

/**
 * logout — Clique sur le bouton logout et attend le retour sur /login.
 */
export async function logout(page: Page): Promise<void> {
  // Le bouton logout est dans le Header ou la Sidebar
  const logoutBtn = page.getByRole("button", { name: /d[eé]connexion|logout/i }).first();
  await logoutBtn.click();
  await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
}
