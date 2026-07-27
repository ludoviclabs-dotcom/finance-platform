import { expect, test } from "@playwright/test";

/**
 * e2e/public/water-intelligence.spec.ts — surface publique Water Intelligence,
 * servie sur `/water` (Wave E-Interface, commit F3 ; URL promue en Phase A).
 *
 * Ces scénarios sont exécutables sur pull request parce qu'ils n'ont besoin de
 * RIEN : ni compte, ni jeton, ni cookie préfabriqué, ni base, ni backend. La
 * page est un Server Component qui lit des documents locaux.
 *
 * Ce qu'ils ne font pas, et ne feront pas : aucune connexion, aucun scénario
 * financier authentifié, aucune donnée d'entreprise. Ces vérifications-là sont
 * l'objet du workflow protégé, lancé à la main sur un environnement.
 *
 * La matrice (téléphone / tablette / ordinateur × clair / sombre × mouvement
 * réduit) est portée par `playwright.public.config.ts` : chaque test ci-dessous
 * est exécuté dans les six combinaisons.
 */

/** Identifiants de la fixture P02. Aucun ne doit atteindre le rendu public. */
const FIXTURE_MARKERS = [
  "FIXTURE_SOURCE",
  "fixture-release-v1",
  "fixture.stress_index",
  "fixture-1.0.0",
];

/** Vocabulaire d'entreprise : rien de tout cela n'a sa place sur le public. */
const TENANT_MARKERS = ["company_id", "tenant_id", "site_id"];

/**
 * Apostrophe indifférente.
 *
 * Le JSX écrit `&apos;` (U+0027) là où la prose de la page emploie ailleurs
 * l'apostrophe typographique (U+2019). Un test qui n'accepterait qu'une des
 * deux échouerait sur une correction purement typographique, sans qu'aucun
 * comportement n'ait changé.
 */
const APOS = "['’]";

test.describe("page publique Water Intelligence", () => {
  test("répond 200 et rend son titre", async ({ page }) => {
    const response = await page.goto("/water");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Water Intelligence" })).toBeVisible();
  });

  test("n’expose aucun identifiant de fixture", async ({ page }) => {
    await page.goto("/water");
    const html = await page.content();
    for (const marker of FIXTURE_MARKERS) {
      expect(html, `identifiant de fixture rendu publiquement : ${marker}`).not.toContain(marker);
    }
  });

  test("n’expose aucune donnée d’entreprise", async ({ page }) => {
    await page.goto("/water");
    const html = await page.content();
    for (const marker of TENANT_MARKERS) {
      expect(html, `champ tenant rendu publiquement : ${marker}`).not.toContain(marker);
    }
  });

  test("annonce un état public cohérent : un pilote signé, un périmètre nommé", async ({
    page,
  }) => {
    await page.goto("/water");
    await expect(page.getByTestId("wi-hero-badge-pilot")).toBeVisible();

    // « Publié » n'apparaît JAMAIS sans son périmètre : sans lui, le badge se
    // lirait comme « les données Eau sont en ligne ».
    await expect(page.getByTestId("wi-hero-badge-scope")).toContainText("34172");
    await expect(page.getByTestId("wi-hero-badge-scope")).toContainText("2020");

    // Le compteur d'observations est LU au document, jamais écrit en dur : il
    // vaut zéro tant que le workflow de génération n'a pas tourné.
    await expect(page.getByTestId("wi-hero-observations")).toHaveText(/^[0-9]+$/);
  });

  test("montre les sources avec un état DISTINCT par famille de blocage", async ({ page }) => {
    await page.goto("/water");
    const sources = page.locator("#sources");
    await expect(sources).toBeVisible();

    // Sept sources qui afficheraient toutes le même état seraient exactes et
    // inutiles : aucune n'échoue pour la même raison, et l'une publie.
    for (const label of [
      "Publié — pilote limité",
      "Validé — reporté pour budget",
      "Enregistrement requis",
      "Décodage différé",
    ]) {
      await expect(sources.getByText(label).first()).toBeVisible();
    }

    await expect(
      sources.getByText(/licences vérifiées, une publication autorisée/i).first(),
    ).toBeVisible();
  });

  test("ouvre le panneau d’une source et y trouve son blocage", async ({ page }) => {
    await page.goto("/water");
    const trigger = page.getByTestId("wi-source-trigger-HUBEAU_ADES");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    const panel = page.getByTestId("wi-source-panel-HUBEAU_ADES");
    await expect(panel).toBeVisible();
    // Le report d'ADES est un report de BUDGET, pas un doute sur la source.
    await expect(panel).toContainText(/budget/i);
  });

  test("offre une navigation ancrée qui atteint réellement ses sections", async ({ page }) => {
    await page.goto("/water");
    const nav = page.getByRole("navigation", { name: "Sections de la page" });
    await expect(nav).toBeVisible();

    const links = nav.getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(8);

    for (let index = 0; index < count; index += 1) {
      const href = await links.nth(index).getAttribute("href");
      expect(href, "une ancre de navigation sans cible").toMatch(/^#[a-z-]+$/);
      const target = page.locator(`#${href!.slice(1)}`);
      await expect(target, `ancre morte : ${href}`).toHaveCount(1);
    }
  });

  test("rend Territory Readiness plutôt qu’un fond de carte trompeur", async ({ page }) => {
    await page.goto("/water");
    const carte = page.locator("#carte");
    await expect(carte).toBeVisible();

    // Aucune couche publiée : la carte n'est pas montée, et l'absence est
    // nommée AVEC sa raison — un fond vide se lirait comme une couverture
    // nulle, ce qui n'est pas la même chose qu'une absence de publication.
    await expect(carte.getByText(/couches géographiques différées/i).first()).toBeVisible();
    await expect(carte.getByText(/couverture nulle/i).first()).toBeVisible();
    await expect(carte.locator("svg")).toHaveCount(0);
  });

  test("expose un lien d’évitement et un contenu principal atteignable au clavier", async ({
    page,
  }) => {
    await page.goto("/water");
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveText(/Aller au contenu principal/i);

    await page.keyboard.press("Enter");
    await expect(page.locator("#contenu")).toBeVisible();
  });

  test("garde un focus visible sur les liens de navigation", async ({ page }) => {
    await page.goto("/water");
    const firstNavLink = page
      .getByRole("navigation", { name: "Sections de la page" })
      .getByRole("link")
      .first();
    await firstNavLink.focus();
    const outline = await firstNavLink.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return `${style.outlineStyle}|${style.outlineWidth}|${style.boxShadow}`;
    });
    expect(outline, "aucun indicateur de focus calculé").not.toBe("none|0px|none");
  });

  test("ne déborde jamais horizontalement", async ({ page }) => {
    await page.goto("/water");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    // Une marge d'un pixel absorbe les arrondis de rendu, pas un débordement.
    expect(overflow).toBeLessThanOrEqual(1);
  });

  /*
    Les deux tests suivants vérifient que la MATRICE est réelle.

    Un projet dont l'émulation ne prend pas — parce que l'option a changé de
    place entre deux versions de Playwright, par exemple — continue de passer
    au vert tout en ne testant rien de plus que le projet d'à côté. Ces deux
    tests refusent ce silence : ils comparent l'état émulé au nom du projet.
  */
  test("applique réellement le thème du projet", async ({ page }, testInfo) => {
    await page.goto("/water");
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    const expected = testInfo.project.name.includes("sombre") ? "dark" : "light";
    expect(theme, `projet ${testInfo.project.name}`).toBe(expected);
  });

  test("applique réellement la préférence de mouvement du projet", async ({ page }, testInfo) => {
    await page.goto("/water");
    const reduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(reduced).toBe(testInfo.project.name === "desktop-mouvement-reduit");
  });

  test("n’entretient aucune animation perpétuelle", async ({ page }) => {
    await page.goto("/water");
    const infinite = await page.evaluate(() =>
      Array.from(document.querySelectorAll("*")).filter((element) => {
        const style = window.getComputedStyle(element);
        return style.animationName !== "none" && style.animationIterationCount === "infinite";
      }).length,
    );
    expect(infinite).toBe(0);
  });
});
