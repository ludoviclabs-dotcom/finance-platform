import { expect, test } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "../fixtures/auth";

/**
 * Parcours d'accès au cockpit Ressources stratégiques (/resources) depuis
 * une visite non authentifiée ou depuis la démonstration Asterion.
 *
 * /resources reste une route protégée (garde inchangée) ; le correctif ne
 * fait que préserver la destination (`next`) et fluidifier l'accès démo.
 * Ne modifie ni /demo/asterion-motion (14-demo-asterion.spec.ts) ni
 * /demo (13-demo.spec.ts) ni 15-demo-studio-nav.spec.ts.
 */

test.describe("Redirection préservée vers /login", () => {
  test("visite non authentifiée de /resources → /login?next=%2Fresources", async ({ page }) => {
    await page.goto("/resources");
    await expect(page).toHaveURL(/\/login\?next=%2Fresources/, { timeout: 8_000 });
  });

  test("visite non authentifiée d'une sous-route avec query → next complet préservé", async ({
    page,
  }) => {
    await page.goto("/resources/assessments?status=completed");
    await expect(page).toHaveURL(
      /\/login\?next=%2Fresources%2Fassessments%3Fstatus%3Dcompleted/,
      { timeout: 8_000 },
    );
  });

  test("/resources reste inaccessible sans authentification (jamais public)", async ({
    page,
  }) => {
    await page.goto("/resources");
    await expect(page).not.toHaveURL(/\/resources/, { timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Bannière contextuelle sur /login", () => {
  test("next=/resources affiche le contexte Ressources stratégiques", async ({ page }) => {
    await page.goto("/login?next=%2Fresources");
    await expect(page.getByTestId("login-demo-context")).toBeVisible();
    await expect(page.getByTestId("login-demo-context")).toContainText(
      /Ressources stratégiques/i,
    );
    await expect(page.getByTestId("login-demo-button")).toContainText(
      /Ouvrir le cockpit de démonstration/i,
    );
  });

  test("sans next, libellé démo par défaut (comportement historique)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-demo-context")).toHaveCount(0);
    await expect(page.getByTestId("login-demo-button")).toContainText(/Accès démo/i);
  });
});

test.describe("Accès démo → destination préservée", () => {
  test("démo depuis /login?next=/resources → /resources après POST /auth/demo", async ({
    page,
  }) => {
    await page.goto("/login?next=%2Fresources");
    await page.getByTestId("login-demo-button").click();
    await expect(page).toHaveURL(/\/resources$/, { timeout: 15_000 });
  });

  test("sans next → fallback historique /dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-demo-button").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("erreur POST /auth/demo → message visible, aucun faux succès", async ({ page }) => {
    await page.route("**/auth/demo", (route) =>
      route.fulfill({ status: 503, body: JSON.stringify({ detail: "indisponible" }) }),
    );
    await page.goto("/login?next=%2Fresources");
    await page.getByTestId("login-demo-button").click();

    const errorEl = page.getByTestId("login-demo-error");
    await expect(errorEl).toBeVisible({ timeout: 8_000 });
    // Jamais de redirection après un échec réel : on reste sur /login.
    await expect(page).toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/resources/);
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});

test.describe("Anti-open-redirect — next malveillant toujours refusé", () => {
  test("URL externe absolue → jamais suivie, fallback dashboard", async ({ page }) => {
    await page.goto("/login?next=https%3A%2F%2Fevil.example");
    await page.getByTestId("login-demo-button").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    expect(page.url()).not.toContain("evil.example");
  });

  test("protocol-relative (//) → jamais suivi, fallback dashboard", async ({ page }) => {
    await page.goto("/login?next=%2F%2Fevil.example");
    await page.getByTestId("login-demo-button").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    expect(page.url()).not.toContain("evil.example");
  });

  test("schéma javascript: → jamais suivi, fallback dashboard", async ({ page }) => {
    await page.goto("/login?next=javascript%3Aalert(1)");
    await page.getByTestId("login-demo-button").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});

test.describe("Démonstration Asterion → cockpit réel (Explorer dans l'application)", () => {
  test("/demo/asterion-resources reste public (aucune session requise)", async ({ page }) => {
    await page.goto("/demo/asterion-resources");
    await expect(page.getByTestId("demo-asterion-resources")).toBeVisible();
  });

  test("visiteur non authentifié : Explorer → session démo puis /resources", async ({ page }) => {
    await page.goto("/demo/asterion-resources");
    await expect(page.getByTestId("demo-asterion-resources")).toBeVisible();
    await page
      .getByRole("button", { name: /Essentiels uniquement/i })
      .click({ timeout: 3000 })
      .catch(() => {});

    const demoRequest = page.waitForRequest((req) => req.url().includes("/auth/demo"));
    await page.getByTestId("demo-explore-link").click();
    await demoRequest;
    await expect(page).toHaveURL(/\/resources/, { timeout: 15_000 });
  });

  test("visiteur déjà authentifié : Explorer → /resources sans nouvel appel /auth/demo", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByTestId("login-demo-button").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page.goto("/demo/asterion-resources");
    await expect(page.getByTestId("demo-asterion-resources")).toBeVisible();
    await page
      .getByRole("button", { name: /Essentiels uniquement/i })
      .click({ timeout: 3000 })
      .catch(() => {});

    let demoCalls = 0;
    page.on("request", (req) => {
      if (req.url().includes("/auth/demo")) demoCalls += 1;
    });
    await page.getByTestId("demo-explore-link").click();
    await expect(page).toHaveURL(/\/resources/, { timeout: 15_000 });
    expect(demoCalls).toBe(0);
  });
});

test.describe("Connexion normale — destination préservée (nécessite un compte de test)", () => {
  test.skip(!TEST_PASSWORD, "E2E_USER_PASSWORD non défini");

  test("connexion normale depuis /login?next=/resources → /resources", async ({ page }) => {
    // Login inline (plutôt que le fixture loginAsTestUser, qui présume /dashboard
    // et navigue lui-même vers /login sans next) : préserve ?next=%2Fresources.
    await page.goto("/login?next=%2Fresources");
    await page.fill("#login-email", TEST_EMAIL);
    await page.fill("#login-password", TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/resources$/, { timeout: 10_000 });
  });
});
