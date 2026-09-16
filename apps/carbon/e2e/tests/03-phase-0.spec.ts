/**
 * Tests E2E Phase 0 — Alignement discours/réalité
 *
 * Vérifie :
 * 1. Homepage sans mentions interdites
 * 2. Pages de transparence /couverture et /etat-du-produit accessibles
 * 3. Pages archivées retournent 404
 * 4. Footer contient les liens de transparence
 *
 * Les statuts attendus sur /couverture et /etat-du-produit sont lus dans le
 * registre data/feature-status.json (source de vérité unique) : la spec ne
 * code plus « ESRS E1 = Live » en dur (QA 2026-09-16 — ce test ne passait que
 * parce que la légende de la page contient le mot « Live »).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { test, expect } from "@playwright/test";
import { SANS_API } from "../fixtures/tags";

type FeatureStatus = "live" | "verification" | "beta" | "planifie";

interface Registry {
  features: Array<{ id: string; label: string; statut: FeatureStatus }>;
  esrs: Array<{ id: string; statut: FeatureStatus }>;
}

const REGISTRY = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "data", "feature-status.json"), "utf-8"),
) as Registry;

/** Libellés des badges de /couverture (app/couverture/page.tsx, STATUS_CONFIG). */
const COUVERTURE_LABEL: Record<FeatureStatus, string> = {
  live: "Live",
  verification: "En vérification",
  beta: "Beta",
  planifie: "Planifié",
};

/** Titres de section de /etat-du-produit (app/etat-du-produit/page.tsx, STATUS_META). */
const ETAT_SECTION: Record<FeatureStatus, RegExp> = {
  live: /Disponible aujourd.hui/,
  verification: /En cours de vérification/,
  beta: /Beta — En cours de stabilisation/,
  planifie: /Planifié — Sur la roadmap/,
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

test.describe("Phase 0 — Homepage sans claims faux", { tag: SANS_API }, () => {
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

  test("la homepage affiche les 3 plans tarifaires (VSME, Business, Enterprise)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const pricing = page.locator("section#pricing");
    await pricing.scrollIntoViewIfNeeded();
    for (const plan of ["VSME", "Business", "Enterprise"]) {
      await expect(pricing.getByText(plan, { exact: true }).first()).toBeVisible();
    }

    // Plan Souverain ne doit pas exister
    const souverain = page.locator("text=Souverain");
    await expect(souverain).toHaveCount(0);
  });
});

// ─── Test 2 : Page /couverture ────────────────────────────────────────────────

test.describe("Phase 0 — Page /couverture", { tag: SANS_API }, () => {
  test("la page /couverture est accessible et affiche le tableau ESRS", async ({ page }) => {
    const response = await page.goto("/couverture");
    expect(response?.status()).toBeLessThan(400);

    await page.waitForLoadState("networkidle");

    // Titre principal
    await expect(page.locator("h1")).toContainText("CarbonCo couvre vraiment");

    // Le tableau doit exister
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 8_000 });

    // Chaque standard affiche, sur SA ligne, le statut du registre.
    for (const { id, statut } of REGISTRY.esrs) {
      const row = table.locator("tbody tr").filter({
        has: page.locator("td:first-child").getByText(id, { exact: true }),
      });
      await expect(row, `ligne ${id}`).toHaveCount(1);
      await expect(row.locator("td").nth(2), `statut de ${id}`).toHaveText(COUVERTURE_LABEL[statut]);
    }
  });

  test("la page /couverture liste tous les standards du registre (≥ 12)", async ({ page }) => {
    await page.goto("/couverture");
    await page.waitForLoadState("networkidle");

    expect(REGISTRY.esrs.length).toBeGreaterThanOrEqual(12);
    await expect(page.locator("tbody tr")).toHaveCount(REGISTRY.esrs.length);
  });
});

// ─── Test 3 : Page /etat-du-produit ──────────────────────────────────────────

test.describe("Phase 0 — Page /etat-du-produit", { tag: SANS_API }, () => {
  test("la page /etat-du-produit affiche une section par statut présent dans le registre", async ({ page }) => {
    const response = await page.goto("/etat-du-produit");
    expect(response?.status()).toBeLessThan(400);

    await page.waitForLoadState("networkidle");

    const used = new Set(REGISTRY.features.map((f) => f.statut));
    for (const [statut, title] of Object.entries(ETAT_SECTION) as [FeatureStatus, RegExp][]) {
      const section = page.getByText(title);
      if (used.has(statut)) {
        await expect(section.first(), `section ${statut}`).toBeVisible({ timeout: 8_000 });
      } else {
        await expect(section, `section ${statut} (vide, donc masquée)`).toHaveCount(0);
      }
    }
  });

  test("la page /etat-du-produit range les connecteurs ERP dans leur statut réel", async ({ page }) => {
    await page.goto("/etat-du-produit");
    await page.waitForLoadState("networkidle");

    const erp = REGISTRY.features.find((f) => f.id === "connecteurs-erp");
    expect(erp, "feature connecteurs-erp absente du registre").toBeDefined();
    // Ne jamais prétendre que c'est disponible.
    expect(erp!.statut).not.toBe("live");

    // Dans la page, la carte suit le titre de SA section et précède la suivante.
    const html = await page.content();
    const cardAt = html.search(new RegExp(escapeRegExp(erp!.label)));
    const sectionAt = html.search(ETAT_SECTION[erp!.statut]);
    expect(cardAt, "carte Connecteurs ERP absente").toBeGreaterThan(-1);
    expect(sectionAt, `section ${erp!.statut} absente`).toBeGreaterThan(-1);
    expect(cardAt).toBeGreaterThan(sectionAt);
    for (const other of Object.values(ETAT_SECTION)) {
      const otherAt = html.search(other);
      if (otherAt > sectionAt) expect(cardAt, `carte hors de sa section`).toBeLessThan(otherAt);
    }
  });
});

// ─── Test 4 : Pages archivées → jamais affichées ─────────────────────────────

test.describe("Phase 0 — Pages archivées jamais affichées", { tag: SANS_API }, () => {
  for (const archivedRoute of ["/social", "/dpp", "/finance"]) {
    test(`${archivedRoute} : 404, ou renvoi vers /login pour un visiteur`, async ({ page }) => {
      // Les pages appellent notFound(), mais elles vivent sous le layout (app)
      // dont la garde d'authentification est CLIENTE : un visiteur non
      // connecté reçoit d'abord la coquille (200), puis la garde le renvoie
      // vers /login. On attend donc cette navigation au lieu de lire l'URL
      // immédiatement après le chargement.
      const response = await page.goto(archivedRoute);
      if (response?.status() === 404) return;
      await expect(page, `${archivedRoute} doit renvoyer 404 ou vers /login`).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(archivedRoute)}$`),
        { timeout: 15_000 },
      );
    });
  }
});

// ─── Test 5 : Footer — liens transparence ────────────────────────────────────

/** Pied de page du site (la page d'accueil contient d'autres <footer> de cartes). */
function siteFooter(page: import("@playwright/test").Page) {
  return page.locator("footer").filter({ has: page.locator("a[href='/couverture']") });
}

test.describe("Phase 0 — Footer contient les liens de transparence", { tag: SANS_API }, () => {
  test("le footer contient un lien vers /couverture", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const footer = siteFooter(page);
    await expect(footer).toHaveCount(1);
    await expect(footer.locator("a[href='/couverture']").first()).toBeVisible({ timeout: 8_000 });
  });

  test("le footer contient un lien vers /etat-du-produit", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Deux liens : la rubrique « État du produit » et la mention finale.
    const links = siteFooter(page).locator("a[href='/etat-du-produit']");
    await expect(links.first()).toBeVisible({ timeout: 8_000 });
  });

  test("aucun pied de page ne dit 'Hébergé en France' sans précision", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const footerText = (await page.locator("footer").allTextContents()).join("\n");

    // "Hébergé en France" seul est interdit — "Hébergé en EU" est acceptable
    expect(footerText).not.toMatch(/Hébergé en France(?!\s*\()/i);
  });
});
