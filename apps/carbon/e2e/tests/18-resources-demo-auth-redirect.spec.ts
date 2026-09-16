import { expect, test, type Page } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "../fixtures/auth";

/**
 * Parcours d'accès au cockpit Ressources stratégiques (/resources) depuis
 * une visite non authentifiée ou depuis la démonstration.
 *
 * /resources reste une route protégée : un visiteur est renvoyé vers /login
 * avec sa destination (`next`). La session démo est ISOLÉE (PR #181) : elle
 * n'ouvre que des surfaces publiques de démonstration et le proxy renvoie
 * toute route métier vers /demo. Depuis /login?next=/resources, le bouton
 * démo ouvre donc le parcours fictif /demo/asterion-resources, jamais le
 * cockpit réel (QA 2026-09-16 : cette spec attendait encore /dashboard et
 * /resources après l'accès démo).
 */

const DEMO_HOME = /\/demo$/;
const DEMO_RESOURCES_TOUR = /\/demo\/asterion-resources$/;

/** La bannière cookies (première visite) ne doit masquer aucun bouton. */
async function dismissCookieBanner(page: Page) {
  const banner = page.getByRole("region", { name: "Consentement cookies" });
  await banner.waitFor({ state: "visible", timeout: 2_000 }).catch(() => {});
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button", { name: "Essentiels uniquement", exact: true }).click();
  }
}

async function openLogin(page: Page, url: string) {
  await page.goto(url);
  await dismissCookieBanner(page);
}

async function startDemoFromLogin(page: Page, url = "/login") {
  await openLogin(page, url);
  await page.getByTestId("login-demo-button").click();
}

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
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
    await expect(page.getByTestId("login-demo-button")).toBeVisible();
  });
});

test.describe("Bannière contextuelle sur /login", () => {
  test("next=/resources affiche le contexte Ressources stratégiques", async ({ page }) => {
    await openLogin(page, "/login?next=%2Fresources");
    await expect(page.getByTestId("login-demo-context")).toBeVisible();
    await expect(page.getByTestId("login-demo-context")).toContainText(
      /Ressources stratégiques/i,
    );
    await expect(page.getByTestId("login-demo-button")).toContainText(
      /Ouvrir le cockpit de démonstration/i,
    );
  });

  test("sans next, libellé démo par défaut (comportement historique)", async ({ page }) => {
    await openLogin(page, "/login");
    await expect(page.getByTestId("login-demo-context")).toHaveCount(0);
    await expect(page.getByTestId("login-demo-button")).toContainText(/Accès démo/i);
  });
});

test.describe("Accès démo → surface de démonstration adaptée", () => {
  test("depuis /login?next=/resources → parcours /demo/asterion-resources, session démo posée", async ({
    page,
    context,
  }) => {
    await startDemoFromLogin(page, "/login?next=%2Fresources");
    await expect(page).toHaveURL(DEMO_RESOURCES_TOUR, { timeout: 15_000 });
    await expect(page.getByTestId("demo-asterion-resources")).toBeVisible();

    const demoCookie = (await context.cookies()).find((c) => c.name === "cc_demo_session");
    expect(demoCookie?.httpOnly).toBe(true);
  });

  test("sans next → accueil de la démo /demo", async ({ page }) => {
    await startDemoFromLogin(page);
    await expect(page).toHaveURL(DEMO_HOME, { timeout: 15_000 });
  });

  test("erreur POST /api/auth/demo → message visible, aucun faux succès", async ({ page }) => {
    await page.route("**/api/auth/demo", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Accès démo indisponible pour le moment." }),
          })
        : route.continue(),
    );
    await startDemoFromLogin(page, "/login?next=%2Fresources");

    const errorEl = page.getByTestId("login-demo-error");
    await expect(errorEl).toBeVisible({ timeout: 8_000 });
    // Jamais de navigation après un échec réel : on reste sur /login.
    await expect(page).toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/demo/);
  });
});

test.describe("Anti-open-redirect — next malveillant sans effet sur la démo", () => {
  for (const [label, next] of [
    ["URL externe absolue", "https%3A%2F%2Fevil.example"],
    ["protocol-relative (//)", "%2F%2Fevil.example"],
    ["schéma javascript:", "javascript%3Aalert(1)"],
  ] as const) {
    test(`${label} → jamais suivi, accueil de la démo`, async ({ page }) => {
      await startDemoFromLogin(page, `/login?next=${next}`);
      await expect(page).toHaveURL(DEMO_HOME, { timeout: 15_000 });
      expect(page.url()).not.toContain("evil.example");
    });
  }
});

test.describe("Démonstration isolée — jamais le cockpit réel", () => {
  test("/demo/asterion-resources reste public, sans lien vers l'application", async ({ page }) => {
    await page.goto("/demo/asterion-resources");
    await expect(page.getByTestId("demo-asterion-resources")).toBeVisible();
    await expect(page.getByTestId("demo-explore-link")).toHaveCount(0);
  });

  test("session démo : /resources et ses sous-routes renvoient vers /demo", async ({ page }) => {
    await startDemoFromLogin(page);
    await expect(page).toHaveURL(DEMO_HOME, { timeout: 15_000 });

    for (const route of ["/resources", "/resources/silicon-metal", "/dashboard"]) {
      await page.goto(route);
      await expect(page, route).toHaveURL(DEMO_HOME, { timeout: 15_000 });
    }
  });

  test("session démo : /login propose de quitter la démo ou d'y revenir", async ({ page }) => {
    await startDemoFromLogin(page, "/login?next=%2Fresources");
    await expect(page).toHaveURL(DEMO_RESOURCES_TOUR, { timeout: 15_000 });

    await openLogin(page, "/login?next=%2Fresources");
    await expect(page.getByTestId("login-demo-session")).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: /Revenir à la démo/i }).click();
    await expect(page).toHaveURL(DEMO_RESOURCES_TOUR, { timeout: 15_000 });

    await openLogin(page, "/login");
    await page.getByTestId("login-demo-exit").click();
    await expect(page.getByTestId("login-demo-session")).toHaveCount(0, { timeout: 8_000 });
    await page.goto("/resources");
    await expect(page).toHaveURL(/\/login\?next=%2Fresources/, { timeout: 8_000 });
  });
});

test.describe("Connexion normale — destination préservée (nécessite un compte de test)", () => {
  test.skip(!TEST_PASSWORD, "E2E_USER_PASSWORD non défini");

  test("connexion normale depuis /login?next=/resources → /resources", async ({ page }) => {
    // Login inline (plutôt que le fixture loginAsTestUser, qui présume /dashboard
    // et navigue lui-même vers /login sans next) : préserve ?next=%2Fresources.
    await openLogin(page, "/login?next=%2Fresources");
    await page.fill("#login-email", TEST_EMAIL);
    await page.fill("#login-password", TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/resources$/, { timeout: 10_000 });
  });
});
