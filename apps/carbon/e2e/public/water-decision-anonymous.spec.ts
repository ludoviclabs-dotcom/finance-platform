import { expect, test } from "@playwright/test";

/**
 * e2e/public/water-decision-anonymous.spec.ts — ce qu'un visiteur NON
 * authentifié obtient sur les surfaces protégées (Wave E-Interface, commit F3).
 *
 * Aucune connexion n'est tentée : c'est justement l'objet du test. Le seul
 * comportement vérifié ici est le refus — redirection vers la connexion ou
 * absence de contenu — et l'absence de toute donnée d'entreprise dans ce que
 * le visiteur reçoit.
 *
 * Ce que ce fichier ne prétend pas couvrir : ni les six facettes chargées, ni
 * le calculateur, ni le résultat. Ils exigent une session, donc un
 * environnement protégé, et sont décrits dans le workflow authentifié —
 * lequel n'a pas été exécuté.
 */

const PROTECTED_ROUTES = ["/water/decision", "/water"];

/** Aucun de ces marqueurs ne doit apparaître pour un visiteur anonyme. */
const TENANT_MARKERS = ["company_id", "tenant_id", "decision-synthesis"];

test.describe("accès anonyme aux surfaces protégées", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`refuse ou redirige ${route}`, async ({ page }) => {
      await page.goto(route);
      // La garde du groupe `(app)` s'exécute côté client après hydratation.
      await page.waitForURL(/\/login/, { timeout: 15_000 });

      expect(page.url()).toContain("/login");
      // La destination est conservée pour l'après-connexion, sans plus.
      expect(decodeURIComponent(page.url())).toContain(`next=${route}`);
    });
  }

  test("ne laisse fuiter aucune donnée d’entreprise avant la redirection", async ({ page }) => {
    await page.goto("/water/decision");
    await page.waitForURL(/\/login/, { timeout: 15_000 });

    const html = await page.content();
    for (const marker of TENANT_MARKERS) {
      expect(html, `donnée protégée visible sans authentification : ${marker}`).not.toContain(
        marker,
      );
    }
    // Ni les facettes, ni le calculateur ne sont rendus.
    await expect(page.locator('[data-testid="wd-synthesis"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="wd-calculator"]')).toHaveCount(0);
  });

  test("n’expose aucune réponse d’API protégée au visiteur anonyme", async ({ page }) => {
    const protectedResponses: string[] = [];
    page.on("response", (response) => {
      const url = response.url();
      if (/\/water\/(decision-synthesis|financial-scenarios)/.test(url) && response.ok()) {
        protectedResponses.push(`${response.status()} ${url}`);
      }
    });

    await page.goto("/water/decision");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(protectedResponses).toEqual([]);
  });

  test("la page publique reste accessible sans authentification", async ({ page }) => {
    // Contre-épreuve : le refus ci-dessus vient bien de la garde, pas d'une
    // application inaccessible.
    const response = await page.goto("/water-intelligence");
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/water-intelligence");
  });
});
