/**
 * Tests E2E — double entrée vers le cockpit de démonstration Demo Studio.
 *
 *   A. Entrée publique : bouton "Voir la démo guidée" sur /demo (démo
 *      cinématique) authentifie silencieusement (POST /auth/demo) puis
 *      redirige vers /demo/asterion-motion.
 *   B. Entrée sidebar : un utilisateur authentifié voit l'entrée "Demo Studio"
 *      (groupe "Démonstration", badge "DÉMO"), cliquable, menant au cockpit.
 *
 * L'authentification utilise le bouton "Accès démo (sans compte)" existant du
 * login (POST /auth/demo) — aucun identifiant secret requis, contrairement aux
 * specs qui dépendent de E2E_USER_EMAIL/E2E_USER_PASSWORD.
 *
 * Ne modifie ni /demo (démo cinématique) ni 13-demo.spec.ts.
 */

import { expect, test } from "@playwright/test";

test.describe("Demo Studio — double entrée", () => {
  test("entrée publique : 'Voir la démo guidée' sur /demo mène au cockpit", async ({ page }) => {
    await page.goto("/demo");
    await page.getByTestId("guided-demo-link").click();
    await expect(page).toHaveURL(/\/demo\/asterion-motion/, { timeout: 15_000 });
    await expect(page.getByTestId("demo-asterion")).toBeVisible();
  });

  test("entrée sidebar : 'Demo Studio' visible et fonctionnelle pour un utilisateur authentifié", async ({ page }) => {
    // Authentification via la session démo existante (aucun secret requis).
    await page.goto("/login");
    await page.getByRole("button", { name: /Accès démo/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Groupe "Démonstration" séparé des modules métier, badge "DÉMO" visible.
    const demoLink = page.getByRole("link", { name: /Demo Studio/i });
    await expect(demoLink).toBeVisible();
    await expect(demoLink).toContainText(/DÉMO/i);

    await demoLink.click();
    await expect(page).toHaveURL(/\/demo\/asterion-motion/);
    await expect(page.getByTestId("demo-asterion")).toBeVisible();
  });
});
