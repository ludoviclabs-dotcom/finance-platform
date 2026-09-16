/**
 * Tests E2E — double entrée vers le cockpit de démonstration Demo Studio.
 *
 *   A. Entrée publique : bouton "Voir la démo guidée" sur /demo (démo
 *      cinématique) authentifie silencieusement (POST /auth/demo) puis
 *      redirige vers /demo/asterion-motion.
 *   B. Entrée sidebar : un utilisateur authentifié voit l'entrée "Demo Studio"
 *      (groupe "Démonstration", badge "DÉMO"), cliquable, menant au cockpit.
 *
 * A est public (projet Playwright `sans-api`). B exige un vrai compte
 * (E2E_USER_PASSWORD, projet `avec-api`) : depuis la PR #181, la session démo
 * est isolée et renvoie vers /demo, sans sidebar applicative.
 *
 * Ne modifie ni /demo (démo cinématique) ni 13-demo.spec.ts.
 */

import { expect, test } from "@playwright/test";
import { loginAsTestUser } from "../fixtures/auth";
import { SANS_API } from "../fixtures/tags";

test.describe("Demo Studio — double entrée", () => {
  test("entrée publique : 'Voir la démo guidée' sur /demo mène au cockpit", { tag: SANS_API }, async ({ page }) => {
    await page.goto("/demo");
    await page.getByTestId("guided-demo-link").click();
    await expect(page).toHaveURL(/\/demo\/asterion-motion/, { timeout: 15_000 });
    await expect(page.getByTestId("demo-asterion")).toBeVisible();
  });

  test("entrée sidebar : 'Demo Studio' visible et fonctionnelle pour un utilisateur authentifié", async ({ page }) => {
    await loginAsTestUser(page);

    // Groupe "Démonstration" séparé des modules métier, badge "DÉMO" visible.
    const demoLink = page.getByRole("link", { name: /Demo Studio/i });
    await expect(demoLink).toBeVisible();
    await expect(demoLink).toContainText(/DÉMO/i);

    await demoLink.click();
    await expect(page).toHaveURL(/\/demo\/asterion-motion/);
    await expect(page.getByTestId("demo-asterion")).toBeVisible();
  });
});
