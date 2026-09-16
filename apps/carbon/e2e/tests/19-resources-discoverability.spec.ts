/**
 * Tests E2E — découvrabilité du module Ressources stratégiques.
 *
 *   A. Entrée sidebar « Ressources stratégiques » (groupe Pilotage, badge BETA)
 *      visible, active sur /resources, accessible au clavier, et fonctionnelle
 *      sidebar réduite (tooltip natif = title).
 *   B. Entrée « Démo Ressources » (groupe Démonstration) menant à la séquence
 *      guidée, sans écraser Demo Studio.
 *   C. Raccourci d'accès sur le tableau de bord.
 *
 * Authentification par le compte de test (E2E_USER_PASSWORD) : depuis la PR
 * #181, la session démo est isolée et renvoie vers /demo — elle n'ouvre plus
 * ni /dashboard ni la sidebar applicative que ces tests inspectent. Projet
 * Playwright `avec-api` (compte + backend requis).
 */

import { expect, test } from "@playwright/test";

import { loginAsTestUser } from "../fixtures/auth";

test.describe("Ressources — découvrabilité", () => {
  test("entrée sidebar visible, badge BETA, active sur /resources", async ({ page }) => {
    await loginAsTestUser(page);

    const link = page.getByRole("link", { name: /Ressources stratégiques/i });
    await expect(link).toBeVisible();
    await expect(link).toContainText(/BETA/i);

    await link.click();
    await expect(page).toHaveURL(/\/resources$/);
    // État actif exposé pour les lecteurs d'écran.
    await expect(page.getByRole("link", { name: /Ressources stratégiques/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Reste actif sur une sous-route.
    await page.goto("/resources/methodology");
    await expect(page.getByRole("link", { name: /Ressources stratégiques/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("accessible au clavier (focus + Entrée)", async ({ page }) => {
    await loginAsTestUser(page);
    const link = page.getByRole("link", { name: /Ressources stratégiques/i });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/resources$/);
  });

  test("fonctionne sidebar réduite (tooltip natif)", async ({ page }) => {
    await loginAsTestUser(page);
    // Réduire la sidebar : le libellé disparaît, le title (tooltip) prend le relais.
    await page.getByRole("button", { name: /Réduire/i }).click();
    const link = page.getByRole("link", { name: /Ressources stratégiques/i });
    await expect(link).toHaveAttribute("title", /Ressources stratégiques/i);
    await link.click();
    await expect(page).toHaveURL(/\/resources$/);
  });

  test("entrée Démo Ressources mène à la séquence guidée (Demo Studio préservé)", async ({ page }) => {
    await loginAsTestUser(page);

    await expect(page.getByRole("link", { name: /Demo Studio/i })).toBeVisible();
    const demoResources = page.getByRole("link", { name: /Démo Ressources/i });
    await expect(demoResources).toBeVisible();
    await demoResources.click();
    await expect(page).toHaveURL(/\/demo\/asterion-resources/);
  });

  test("raccourci d'accès sur le tableau de bord", async ({ page }) => {
    await loginAsTestUser(page);
    const card = page.getByTestId("dashboard-resources-card");
    await expect(card).toBeVisible();
    await card.getByTestId("dashboard-resources-cta").click();
    await expect(page).toHaveURL(/\/resources$/);
  });
});
