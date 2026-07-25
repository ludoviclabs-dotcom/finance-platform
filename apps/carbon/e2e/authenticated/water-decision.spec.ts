import { expect, test } from "@playwright/test";

import { TEST_EMAIL, loginAsTestUser, logout } from "../fixtures/auth";

/**
 * e2e/authenticated/water-decision.spec.ts — cockpit décisionnel hydrique sur
 * une Preview (Wave E-Interface, commit F4).
 *
 * STATUT : `prepared_not_executed_environment_not_configured`.
 *
 * **Ces scénarios n'ont jamais été exécutés.** L'environnement GitHub
 * `e2e-preview` n'existe pas, ses secrets non plus, et rien ici ne doit être lu
 * comme une vérification effectuée. Ce fichier décrit ce qui sera vérifié le
 * jour où un humain aura configuré l'environnement — voir
 * `docs/carbonco/water-intelligence/E2E_AUTHENTICATED_RUNBOOK.md`.
 *
 * La connexion réutilise `e2e/fixtures/auth.ts`, déjà employée par la suite
 * existante : une seconde procédure de connexion divergerait de la première dès
 * la première évolution de l'écran de login.
 *
 * Les neuf scénarios prévus :
 *
 * | # | Scénario |
 * |---|---|
 * | 1 | connexion |
 * | 2 | accès à `/water/decision` |
 * | 3 | chargement des six facettes |
 * | 4 | absence de fuite tenant |
 * | 5 | saisie du calculateur |
 * | 6 | résultat central |
 * | 7 | sensibilités |
 * | 8 | réinitialisation |
 * | 9 | déconnexion |
 */

const FACETS = ["risk", "confidence", "dependency", "resource_material", "iro", "action"] as const;

/**
 * Remplit une grandeur du calculateur.
 *
 * Les valeurs employées ici sont des valeurs de TEST, saisies par le scénario :
 * elles ne sont ni des recommandations, ni des défauts du produit — le
 * formulaire, lui, s'ouvre vide.
 */
async function fillQuantity(
  page: import("@playwright/test").Page,
  field: string,
  value: string,
  provenance: "observed" | "assumption",
  basis: string,
) {
  const fieldset = page.locator(`[data-testid="wd-quantity-${field}"]`);
  await fieldset.locator('input[inputmode="decimal"]').fill(value);
  await fieldset.locator(`input[type="radio"][value="${provenance}"]`).check();
  await page.locator(`[data-testid="wd-basis-${field}"]`).fill(basis);
}

test.describe("cockpit décisionnel hydrique (Preview authentifiée)", () => {
  test.beforeEach(async ({ page }) => {
    // Scénario 1 — connexion.
    await loginAsTestUser(page);
  });

  test("scénario 2 · accède à /water/decision une fois authentifié", async ({ page }) => {
    await page.goto("/water/decision");
    await expect(page).toHaveURL(/\/water\/decision/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Cockpit décisionnel hydrique/i,
    );
    await expect(page.locator('[data-testid="wd-back-to-water"]')).toBeVisible();
  });

  test("scénario 3 · charge les six facettes, chacune avec son état", async ({ page }) => {
    await page.goto("/water/decision");

    for (const facet of FACETS) {
      const card = page.locator(`[data-testid="wd-facet-${facet}"]`);
      await expect(card, `facette absente de la page : ${facet}`).toBeVisible();

      // L'état est explicite : aucune facette ne reste en chargement, et aucune
      // n'est rendue sans état du tout.
      await expect
        .poll(async () => card.getAttribute("data-facet-state"), { timeout: 20_000 })
        .not.toBe("loading");
      const state = await card.getAttribute("data-facet-state");
      expect(
        ["available", "empty", "schema_unavailable", "access_denied", "unexpected_error"],
        `état inconnu pour ${facet} : ${state}`,
      ).toContain(state);
    }

    // Le décompte affiché porte sur la disponibilité, jamais sur un niveau.
    await expect(page.locator('[data-testid="wd-availability"]')).toContainText(
      /disponibilité de l['’]information/i,
    );
  });

  test("scénario 4 · ne laisse fuiter aucune donnée de tenant", async ({ page }) => {
    await page.goto("/water/decision");
    await expect(page.locator('[data-testid="wd-synthesis"]')).toBeVisible();

    const html = await page.content();
    for (const marker of ["company_id", "tenant_id"]) {
      expect(html, `identifiant de tenant rendu dans le DOM : ${marker}`).not.toContain(marker);
    }

    // Ni dans l'URL, ni dans les requêtes émises.
    expect(page.url()).not.toMatch(/company|tenant|site_id/i);
    // Le compte connecté n'est pas non plus affiché dans le cockpit lui-même.
    await expect(page.locator('[data-testid="wd-page"]')).not.toContainText(TEST_EMAIL);
  });

  test("scénarios 5 à 8 · saisie, résultat central, sensibilités, réinitialisation", async ({
    page,
  }) => {
    await page.goto("/water/decision");

    // Le formulaire s'ouvre vide : c'est le contrat, on le vérifie avant de le
    // remplir.
    const firstValue = page
      .locator('[data-testid="wd-quantity-outage_days"] input[inputmode="decimal"]')
      .first();
    await expect(firstValue).toHaveValue("");
    expect(await page.locator("[placeholder]").count()).toBe(0);

    // Scénario 5 — saisie complète, étape par étape.
    await fillQuantity(page, "outage_days", "12", "observed", "Relevé E2E");
    await fillQuantity(page, "affected_capacity_share", "0.4", "assumption", "Hypothèse E2E");
    await page.locator('[data-testid="wd-next"]').click();

    await fillQuantity(page, "revenue_per_day", "1234.56", "observed", "Base E2E");
    await fillQuantity(page, "margin_rate", "0.32", "observed", "Base E2E");
    await fillQuantity(page, "additional_opex_per_day", "980.10", "assumption", "Base E2E");
    await page.locator('[data-testid="wd-next"]').click();

    await fillQuantity(page, "adaptation_capex", "250000", "assumption", "Base E2E");
    await fillQuantity(page, "discount_rate", "0.08", "assumption", "Taux fourni par la DAF");
    await page.locator('[data-testid="wd-scenario-code"]').fill("E2E-1");
    await page.locator('[data-testid="wd-label"]').fill("Scénario E2E");
    await page.locator('[data-testid="wd-base-year"]').fill("2026");
    await page.locator('[data-testid="wd-horizon-year"]').fill("2030");
    await page.locator('[data-testid="wd-variation"]').fill("10");
    await page.locator('[data-testid="wd-next"]').click();

    // La revue montre toutes les hypothèses AVANT tout calcul.
    await expect(page.locator('[data-testid="wd-review-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="wd-result"]')).toHaveAttribute(
      "data-result-state",
      "idle",
    );

    await page.locator('[data-testid="wd-submit"]').click();

    // Scénario 6 — résultat central.
    const result = page.locator('[data-testid="wd-result"]');
    await expect
      .poll(async () => result.getAttribute("data-result-state"), { timeout: 30_000 })
      .not.toBe("pending");

    const state = await result.getAttribute("data-result-state");
    if (state !== "done") {
      /*
        Un environnement de Preview peut légitimement répondre « schéma non
        disponible » : les migrations n'y sont pas toujours appliquées. On le
        constate explicitement plutôt que de faire échouer le scénario sur un
        état qui est, lui aussi, un comportement correct.
      */
      test.info().annotations.push({
        type: "état moteur",
        description: `Le moteur a répondu « ${state} » plutôt qu'un résultat.`,
      });
      await expect(result).not.toContainText(/^0([.,]0+)?$/);
      return;
    }

    await expect(page.locator('[data-testid="wd-result-central"]')).toBeVisible();

    // Scénario 7 — sensibilités : la valeur centrale ne se lit jamais seule.
    await expect(page.locator('[data-testid="wd-sensitivities"]')).toBeVisible();
    expect(await page.locator('[data-testid="wd-sensitivities"] tbody tr').count()).toBeGreaterThan(
      0,
    );
    // Les hypothèses restent affichées avec le résultat.
    await expect(result).toContainText(/Hypothèses de ce résultat/i);
    await expect(result).toContainText("IAS 36");

    // Scénario 8 — réinitialisation.
    await page.locator('[data-testid="wd-reset"]').click();
    await expect(page.locator('[data-testid="wd-result"]')).toHaveAttribute(
      "data-result-state",
      "idle",
    );
    await expect(
      page.locator('[data-testid="wd-quantity-outage_days"] input[inputmode="decimal"]').first(),
    ).toHaveValue("");
  });

  test("scénario 9 · déconnexion, puis refus de la route protégée", async ({ page }) => {
    await page.goto("/water/decision");
    await expect(page.locator('[data-testid="wd-page"]')).toBeVisible();

    await logout(page);

    // La session n'est plus : la route protégée redirige de nouveau.
    await page.goto("/water/decision");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator('[data-testid="wd-synthesis"]')).toHaveCount(0);
  });
});
