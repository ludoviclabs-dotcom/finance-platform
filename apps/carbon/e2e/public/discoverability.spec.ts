import { expect, test } from "@playwright/test";

/**
 * e2e/public/discoverability.spec.ts — Water Intelligence est-il ATTEIGNABLE
 * depuis les surfaces principales ? (feat/water-intelligence-discoverability)
 *
 * Les tests unitaires vérifient que les composants portent les bonnes cibles.
 * Ceux-ci vérifient qu'un visiteur y arrive réellement, dans un vrai navigateur,
 * sur les six combinaisons de la matrice publique — et notamment que le menu
 * s'ouvre au clavier, ce qui est le point le plus facile à casser sans s'en
 * apercevoir.
 *
 * Aucun secret, aucune session : tout est public.
 */

/** Le menu déroulant n'existe qu'au-dessus du point de rupture `lg`. */
async function isDesktopNav(page: import("@playwright/test").Page) {
  return page.locator('[data-testid="nav-resources-trigger"]').isVisible();
}

test.describe("découvrabilité depuis la page d’accueil", () => {
  test("la section Intelligence environnementale est rendue", async ({ page }) => {
    await page.goto("/");
    const section = page.locator('[data-testid="environmental-intelligence"]');
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { level: 2 })).toContainText(/environnementale/i);
  });

  test("la carte Eau mène à /water", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator('[data-testid="env-card-water-cta"]');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/water");
    await expect(cta).toContainText("Explorer Water Intelligence");

    await cta.click();
    await page.waitForURL(/\/water$/);
    await expect(page.getByRole("heading", { level: 1, name: "Water Intelligence" })).toBeVisible();
  });

  test("la carte Métaux critiques reste présente et mène à /materials", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator('[data-testid="env-card-materials-cta"]');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/materials");
  });

  test("les statuts affichés sont ceux du module, sans promesse de données vivantes", async ({
    page,
  }) => {
    await page.goto("/");
    const card = page.locator('[data-testid="env-card-water"]');
    await expect(card).toContainText("Pilote public approuvé — périmètre limité");
    /*
      Ces libellés ont changé le 2026-07-28 : « Données publiques en attente de
      validation humaine » est devenu faux le jour où une décision a été
      signée. La carte décrit désormais la DÉCISION — un fait durable — et pas
      l'état du document publié, qui change au premier run du workflow de
      génération et à chaque retour arrière.
    */
    await expect(card).toContainText("7 sources officielles instrumentées, licences vérifiées");
    await expect(card).toContainText("1 source approuvée à la publication, sur 1 commune et 1 année");

    const text = ((await card.textContent()) ?? "").toLowerCase();
    for (const forbidden of [
      "temps réel",
      "actuellement alimentée",
      "surveillance active",
      "conformité automatique",
      "couverture mondiale complète",
    ]) {
      expect(text, `promesse interdite : ${forbidden}`).not.toContain(forbidden);
    }
  });

  test("les deux cockpits authentifiés sont nommés avec leur condition d’accès", async ({
    page,
  }) => {
    await page.goto("/");
    const priv = page.locator('[data-testid="env-water-private"]');
    await expect(priv).toContainText("Connexion requise");
    await expect(page.locator('[data-testid="env-water-cockpit-link"]')).toHaveAttribute(
      "href",
      "/water/cockpit",
    );
    await expect(page.locator('[data-testid="env-water-decision-link"]')).toHaveAttribute(
      "href",
      "/water/decision",
    );
  });

  test("aucun lien public ne porte d’identifiant de tenant", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page.locator("a[href]").evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("href") ?? ""),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, `identifiant dans une URL publique : ${href}`).not.toMatch(
        /company_id|tenant_id|site_id/,
      );
    }
  });
});

test.describe("menu Ressources", () => {
  test("ouvre, expose les deux modules et se ferme avec Échap", async ({ page }) => {
    await page.goto("/");

    if (await isDesktopNav(page)) {
      const trigger = page.locator('[data-testid="nav-resources-trigger"]');
      await expect(trigger).toHaveAttribute("aria-expanded", "false");

      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      const panel = page.locator('[data-testid="nav-resources-panel"]');
      await expect(panel.locator('a[href="/materials"]')).toBeVisible();
      await expect(panel.locator('a[href="/water"]')).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      // Le focus revient au déclencheur, sinon la tabulation repart du document.
      await expect(trigger).toBeFocused();
    } else {
      // Tiroir mobile : les mêmes cibles, à plat, sans second niveau à déplier.
      await page.getByRole("button", { name: "Menu" }).click();
      const group = page.locator('[data-testid="nav-resources-mobile"]');
      await expect(group).toBeVisible();
      await expect(group.locator('a[href="/materials"]')).toBeVisible();
      await expect(group.locator('a[href="/water"]')).toBeVisible();
    }
  });

  test("s’ouvre au clavier seul et mène à Water Intelligence", async ({ page }) => {
    await page.goto("/");
    test.skip(!(await isDesktopNav(page)), "menu déroulant absent sous le point de rupture lg");

    const trigger = page.locator('[data-testid="nav-resources-trigger"]');
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-testid="nav-resources-panel"]')).toBeVisible();

    // L'ouverture place le focus sur la première entrée ; la seconde est
    // atteinte à la flèche, sans souris.
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('[data-testid="nav-resources-item-1"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/water$/);
  });

  test("ne laisse aucun lien tabulable tant qu’il est fermé", async ({ page }) => {
    await page.goto("/");
    test.skip(!(await isDesktopNav(page)), "menu déroulant absent sous le point de rupture lg");
    await expect(page.locator('[data-testid="nav-resources-panel"]')).toHaveCount(0);
  });
});

test.describe("autres points d’entrée", () => {
  test("le pied de page mène aux deux modules", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.locator('a[href="/water"]')).toHaveCount(1);
    await expect(footer.locator('a[href="/materials"]')).toHaveCount(1);
  });

  test("le sitemap déclare la surface publique, jamais les cockpits", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    expect(response?.status()).toBe(200);
    const xml = await page.content();
    expect(xml).toMatch(/<loc>[^<]*\/water<\/loc>/);
    expect(xml).toContain("/materials");
    // Les cockpits authentifiés n'ont rien à faire dans un plan de site public.
    expect(xml).not.toContain("/water/cockpit");
    expect(xml).not.toContain("/water/decision");
    // L'ancienne URL redirige : la déclarer en plus enverrait indexer une URL
    // dont on affirme par ailleurs qu'elle n'est plus la bonne.
    expect(xml).not.toContain("/water-intelligence");
  });

  test("/materials répond toujours 200", async ({ page }) => {
    const response = await page.goto("/materials");
    expect(response?.status()).toBe(200);
  });
});
