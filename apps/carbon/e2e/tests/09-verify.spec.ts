/**
 * Tests E2E Phase 3.B — Page publique /verify (sans authentification).
 *
 * Vérifie :
 *   1. /verify (sans hash) affiche un formulaire
 *   2. Hash invalide dans l'URL → message d'erreur
 *   3. Hash valide inexistant → "hash non reconnu"
 *   4. Le formulaire redirige vers /verify/{hash}
 *   5. Aucune auth requise (pas de redirection login)
 */

import { test, expect } from "@playwright/test";

test.describe("Phase 3.B — Page publique /verify (sans auth)", () => {
  test("/verify (sans hash) affiche le formulaire de saisie", async ({ page }) => {
    await page.goto("/verify");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("verify-form")).toBeVisible();
    await expect(page.getByTestId("verify-hash-input")).toBeVisible();
    await expect(page.getByTestId("verify-submit")).toBeVisible();
  });

  test("/verify reste accessible sans authentification", async ({ page }) => {
    await page.goto("/verify");
    // Pas de redirection vers /login
    await expect(page).toHaveURL(/\/verify(\/|$)/);
  });

  test("hash invalide dans l'input affiche une erreur", async ({ page }) => {
    await page.goto("/verify");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("verify-hash-input").fill("invalid-hash");
    await page.getByTestId("verify-submit").click();

    await expect(page.getByTestId("verify-hash-error")).toBeVisible();
  });

  test("hash valide soumis redirige vers /verify/{hash}", async ({ page }) => {
    await page.goto("/verify");
    await page.waitForLoadState("networkidle");

    // Hash fictif mais syntaxiquement valide (64 chars hex)
    const fakeHash = "a".repeat(64);
    await page.getByTestId("verify-hash-input").fill(fakeHash);
    await page.getByTestId("verify-submit").click();

    await expect(page).toHaveURL(new RegExp(`/verify/${fakeHash}$`));
  });

  test("/verify/{hash-invalide-longueur} affiche Hash invalide", async ({ page }) => {
    await page.goto("/verify/too-short");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("verify-invalid")).toBeVisible();
  });

  test("/verify/{hash-valide-inconnu} affiche 'hash non reconnu' ou API indisponible", async ({ page }) => {
    const unknownHash = "0".repeat(64);
    await page.goto(`/verify/${unknownHash}`);
    await page.waitForLoadState("networkidle");

    // Selon l'état API : soit "unknown" (DB OK mais hash absent), soit "api-unreachable" (pas de backend)
    const unknown = await page.getByTestId("verify-unknown").count();
    const unreachable = await page.getByTestId("verify-api-unreachable").count();
    expect(unknown + unreachable).toBeGreaterThanOrEqual(1);
  });

  test("la page affiche le hash recherché", async ({ page }) => {
    const hash = "b".repeat(64);
    await page.goto(`/verify/${hash}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("verify-hash-display")).toContainText(hash);
  });
});
