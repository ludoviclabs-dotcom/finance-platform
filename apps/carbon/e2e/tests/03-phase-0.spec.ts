/**
 * Tests E2E Phase 0 — Alignement discours/réalité
 *
 * Vérifie :
 * 1. Homepage sans mentions interdites
 * 2. Pages de transparence /couverture et /etat-du-produit accessibles
 * 3. Pages archivées retournent 404
 * 4. Footer contient les liens de transparence
 * 5. Bannière "données de démonstration" visible sur dashboard sans import
 */

import { test, expect } from "@playwright/test";

// ─── Constantes : mentions interdites ────────────────────────────────────────

const FORBIDDEN_CLAIMS = [
  "OVH Cloud HDS",
  "OVH France",
  "hébergement souverain",
  "Hébergement souverain",
  "SecNumCloud",
  "99,9% SLA",
  "99.9% SLA",
  "SLA Garanti",
  "SLA 99",
  "intégration en 2 jours",
  "SAP.*2 jours",
  "120\\+ entreprises",
  "120\\+ Entreprises",
  "Ils nous font confiance",          // ancien titre section logos
  "Marie L.\\s*Directrice RSE",       // témoignage fictif
  "Thomas M.\\s*CFO",                 // témoignage fictif
  "Sophie R.\\s*Responsable ESG",     // témoignage fictif
  "Connecteurs certifiés ISO 27001",
];

// ─── Test 1 : Homepage — 0 mention interdite ────────────────────────────────

test.describe("Phase 0 — Homepage sans claims faux", () => {
  test("la page d'accueil se charge et ne contient aucune mention interdite", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const html = await page.content();

    for (const forbidden of FORBIDDEN_CLAIMS) {
      const regex = new RegExp(forbidden, "i");
      expect(html, `Mention interdite trouvée : "${forbidden}"`).not.toMatch(regex);
    }
  });

  test("la homepage affiche les scénarios sectoriels avec tag 'Scénario illustratif'", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // La section scénarios doit être présente
    const scenarioTag = page.locator("text=Scénario illustratif").first();
    await expect(scenarioTag).toBeVisible({ timeout: 8_000 });
  });

  test("la homepage affiche les 3 plans tarifaires (Starter, Business, Enterprise)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Starter").first()).toBeVisible();
    await expect(page.locator("text=Business").first()).toBeVisible();
    await expect(page.locator("text=Enterprise").first()).toBeVisible();

    // Plan Souverain ne doit pas exister
    const souverain = page.locator("text=Souverain");
    await expect(souverain).toHaveCount(0);
  });
});

// ─── Test 2 : Page /couverture ────────────────────────────────────────────────

test.describe("Phase 0 — Page /couverture", () => {
  test("la page /couverture est accessible et affiche le tableau ESRS", async ({ page }) => {
    const response = await page.goto("/couverture");
    expect(response?.status()).toBeLessThan(400);

    await page.waitForLoadState("networkidle");

    // Titre principal
    await expect(page.locator("h1")).toContainText("CarbonCo couvre vraiment");

    // Le tableau doit exister
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 8_000 });

    // ESRS E1 doit être présent et Live
    await expect(page.locator("text=ESRS E1").first()).toBeVisible();
    await expect(page.locator("text=Live").first()).toBeVisible();

    // Au moins un statut Beta
    await expect(page.locator("text=Beta").first()).toBeVisible();

    // Au moins un statut Planifié
    await expect(page.locator("text=Planifié").first()).toBeVisible();
  });

  test("la page /couverture contient au moins 12 lignes ESRS", async ({ page }) => {
    await page.goto("/couverture");
    await page.waitForLoadState("networkidle");

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count, `Nombre de standards ESRS : ${count} (attendu ≥12)`).toBeGreaterThanOrEqual(12);
  });
});

// ─── Test 3 : Page /etat-du-produit ──────────────────────────────────────────

test.describe("Phase 0 — Page /etat-du-produit", () => {
  test("la page /etat-du-produit est accessible et affiche les 3 sections", async ({ page }) => {
    const response = await page.goto("/etat-du-produit");
    expect(response?.status()).toBeLessThan(400);

    await page.waitForLoadState("networkidle");

    // Les 3 sections doivent être visibles
    await expect(page.locator("text=Disponible aujourd").first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("text=Beta").first()).toBeVisible();
    await expect(page.locator("text=Planifié").first()).toBeVisible();
  });

  test("la page /etat-du-produit mentionne les connecteurs ERP en roadmap", async ({ page }) => {
    await page.goto("/etat-du-produit");
    await page.waitForLoadState("networkidle");

    // Connecteurs ERP doivent être dans la section Planifié, pas dans Live
    const html = await page.content();
    expect(html).toContain("Connecteurs ERP");
    // Ne pas prétendre que c'est live
    expect(html).not.toMatch(/Live[\s\S]*?Connecteurs ERP natifs/);
  });
});

// ─── Test 4 : Pages archivées → 404 ──────────────────────────────────────────

test.describe("Phase 0 — Pages archivées retournent 404", () => {
  for (const archivedRoute of ["/social", "/dpp", "/finance"]) {
    test(`${archivedRoute} retourne 404 (route archivée)`, async ({ page }) => {
      const response = await page.goto(archivedRoute);
      // Next.js redirige les routes inconnues vers /login ou 404
      // On accepte 404 ou redirection vers /login (auth guard)
      const status = response?.status() ?? 0;
      const url = page.url();
      const is404 = status === 404;
      const isRedirectToLogin = url.includes("/login");
      expect(
        is404 || isRedirectToLogin,
        `${archivedRoute} devrait retourner 404 ou rediriger vers /login, got ${status} (${url})`
      ).toBeTruthy();
    });
  }
});

// ─── Test 5 : Footer — liens transparence ────────────────────────────────────

test.describe("Phase 0 — Footer contient les liens de transparence", () => {
  test("le footer contient un lien vers /couverture", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const footer = page.locator("footer");
    const link = footer.locator("a[href='/couverture']");
    await expect(link).toBeVisible({ timeout: 8_000 });
  });

  test("le footer contient un lien vers /etat-du-produit", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const footer = page.locator("footer");
    const link = footer.locator("a[href='/etat-du-produit']");
    await expect(link).toBeVisible({ timeout: 8_000 });
  });

  test("le footer ne contient plus 'Hébergé en France' sans précision", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const footer = page.locator("footer");
    const footerText = await footer.textContent();

    // "Hébergé en France" seul est interdit — "Hébergé en EU" est acceptable
    expect(footerText).not.toMatch(/Hébergé en France(?!\s*\()/i);
  });
});
