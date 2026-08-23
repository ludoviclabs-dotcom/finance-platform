/**
 * tests/water-intelligence-v3-foundation.test.tsx — fondation visuelle Water
 * Intelligence V3 (WI-V3-01).
 *
 * Quatre garanties, indépendantes de toute maquette :
 *
 * 1. Le thème est sombre PAR DÉFAUT, structurellement — plus aucune dépendance
 *    à `prefers-color-scheme` dans la feuille de style, et le mécanisme reste
 *    générique côté React (aucun nom de domaine en dur).
 * 2. Un choix explicite se persiste — « clair » comme « sombre » — et se
 *    retrouve identique après un remontage (l'équivalent d'un retour sur la
 *    page).
 * 3. La Provenance Rail affiche exactement ce qu'on lui donne, jamais une
 *    valeur qu'elle aurait recalculée ou importée elle-même.
 * 4. Rien de nouveau ajouté par ce chantier n'introduit une constante
 *    quantitative — les primitives de statut restent des lecteurs, jamais des
 *    sources.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IntelligenceThemeProvider,
  IntelligenceThemeToggle,
} from "@/components/intelligence/IntelligenceThemeProvider";
import { WiScopeRail } from "@/components/water-intelligence/WiScopeRail";
import {
  WiEvidenceChip,
  WiStatusChip,
  SOURCE_STATE_TONE,
} from "@/components/water-intelligence/WiPrimitives";

const CARBON_ROOT = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(CARBON_ROOT, path), "utf-8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/* ==========================================================================
   1 — Sombre par défaut, structurellement
   ========================================================================== */

describe("thème Water — sombre par défaut, sans dépendre du système", () => {
  /* Commentaires retirés avant chaque assertion : ce fichier CSS documente en
     prose, dans ses propres commentaires, les sélecteurs qu'il n'emploie plus
     — un grep naïf sur le texte brut confondrait cette documentation avec du
     CSS fonctionnel (même règle que les tests `.tsx` du dépôt). */
  const css = stripComments(read("app/water/water-intelligence.css"));

  it("la feuille de style ne référence plus prefers-color-scheme en dehors de sa documentation", () => {
    expect(css).not.toContain("prefers-color-scheme");
  });

  it("le clair n'existe que sous l'attribut explicite data-wi-theme=\"clair\"", () => {
    expect(css).toContain('[data-wi][data-wi-theme="clair"]');
    // Aucun sélecteur fonctionnel ne conditionne plus une règle à L'ABSENCE d'attribut.
    expect(css).not.toContain(":not([data-wi-theme])");
  });

  it("le bloc [data-wi] de base pose des valeurs sombres inconditionnelles", () => {
    const start = css.indexOf("[data-wi] {");
    const end = css.indexOf('[data-wi][data-wi-theme="clair"]');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const baseBlock = css.slice(start, end);
    expect(baseBlock).toContain("--wi-bg: #07111f;");
    expect(baseBlock).not.toContain("@media");
  });

  it("le provider partagé reste agnostique du domaine (aucun « wi » en dur)", () => {
    /* Même garde-fou que water-v1-experience.test.tsx, reformulé pour ce
       chantier : le mécanisme de bascule ne doit connaître ni Water ni
       Materials — c'est la feuille de style de CHAQUE domaine qui décide de
       son comportement par défaut. */
    const provider = stripComments(
      read("components/intelligence/IntelligenceThemeProvider.tsx"),
    );
    expect(provider).not.toContain('"wi"');
    expect(provider).toContain("scope: string");
  });
});

/* ==========================================================================
   2 — Persistance d'un choix explicite
   ========================================================================== */

async function mount(node: React.ReactElement): Promise<{ container: HTMLElement; root: Root }> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

async function unmount(m: { container: HTMLElement; root: Root }) {
  await act(async () => {
    m.root.unmount();
  });
  m.container.remove();
}

const STORAGE_KEY = "carbonco-wi-theme";

function themeAttr(container: HTMLElement): string | null {
  return container.querySelector("[data-wi]")!.getAttribute("data-wi-theme");
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("persistance du thème Water", () => {
  it("première visite : aucun attribut posé — le sombre vient de la feuille de style", async () => {
    const m = await mount(
      <IntelligenceThemeProvider scope="wi">
        <IntelligenceThemeToggle />
      </IntelligenceThemeProvider>,
    );
    expect(themeAttr(m.container)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    await unmount(m);
  });

  it("un choix explicite « clair » est mémorisé et posé sur le conteneur", async () => {
    const m = await mount(
      <IntelligenceThemeProvider scope="wi">
        <IntelligenceThemeToggle />
      </IntelligenceThemeProvider>,
    );
    const toggle = m.container.querySelector<HTMLButtonElement>('[data-testid="wi-theme-toggle"]')!;
    await act(async () => {
      toggle.click();
    });
    expect(themeAttr(m.container)).toBe("clair");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("clair");
    await unmount(m);
  });

  it("un second bascule choisit explicitement « sombre », et le persiste aussi", async () => {
    const m = await mount(
      <IntelligenceThemeProvider scope="wi">
        <IntelligenceThemeToggle />
      </IntelligenceThemeProvider>,
    );
    const toggle = m.container.querySelector<HTMLButtonElement>('[data-testid="wi-theme-toggle"]')!;
    await act(async () => {
      toggle.click(); // -> clair
    });
    await act(async () => {
      toggle.click(); // -> sombre, explicite cette fois
    });
    expect(themeAttr(m.container)).toBe("sombre");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("sombre");
    await unmount(m);
  });

  it("retour sur la page : le choix mémorisé « clair » est repris sans nouvelle action", async () => {
    window.localStorage.setItem(STORAGE_KEY, "clair");
    const m = await mount(
      <IntelligenceThemeProvider scope="wi">
        <IntelligenceThemeToggle />
      </IntelligenceThemeProvider>,
    );
    expect(themeAttr(m.container)).toBe("clair");
    await unmount(m);
  });

  it("retour sur la page : le choix mémorisé « sombre » est repris à l'identique", async () => {
    window.localStorage.setItem(STORAGE_KEY, "sombre");
    const m = await mount(
      <IntelligenceThemeProvider scope="wi">
        <IntelligenceThemeToggle />
      </IntelligenceThemeProvider>,
    );
    expect(themeAttr(m.container)).toBe("sombre");
    await unmount(m);
  });
});

/* ==========================================================================
   3 — Provenance Rail : un lecteur, jamais une source
   ========================================================================== */

describe("WiScopeRail — Provenance / Scope Rail", () => {
  const PROPS = {
    territoryCode: "34172",
    periodLabel: "2020",
    snapshotDate: "2026-07-28",
    observationCount: 3,
    sourceCount: 7,
    publishableCount: 1,
    published: true,
  } as const;

  it("rend exactement les valeurs reçues, jamais recalculées", () => {
    const markup = renderToStaticMarkup(<WiScopeRail {...PROPS} />);
    expect(markup).toContain('data-testid="wi-scope-rail"');
    expect(markup).toContain("34172");
    expect(markup).toContain("2020");
    expect(markup).toContain("2026-07-28");
    expect(markup).toContain(">3<");
    expect(markup).toContain(">7<");
    expect(markup).toContain(">1<");
  });

  it("rend le statut « non généré » sans fabriquer de date", () => {
    const markup = renderToStaticMarkup(
      <WiScopeRail {...PROPS} snapshotDate={null} published={false} />,
    );
    expect(markup).toContain("non généré");
    expect(markup).not.toContain("2026-07-28");
  });

  it("chaque item mène à l'Evidence Registry (#preuves)", () => {
    const markup = renderToStaticMarkup(<WiScopeRail {...PROPS} />);
    const hrefs = [...markup.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toBe("#preuves");
    }
  });

  it("n'affiche pas de jointure de bassin — aucun état canonique ne l'expose", () => {
    /* Le blueprint prévoyait ce champ SOUS CONDITION qu'un état canonique
       existe. Il n'existe pas (voir la docstring de WiScopeRail.tsx) : ce
       test tient la clause conditionnelle, pas seulement l'implémentation
       actuelle. */
    const markup = renderToStaticMarkup(<WiScopeRail {...PROPS} />);
    expect(markup.toLowerCase()).not.toContain("bassin");
  });

  it("est un repère nommé pour un lecteur d'écran", () => {
    const markup = renderToStaticMarkup(<WiScopeRail {...PROPS} />);
    expect(markup).toContain('aria-label="Portée et provenance publiées"');
  });

  it("ne lit aucune donnée hydrique par elle-même — tout arrive en props", () => {
    /* Si ce composant importait `canonical-snapshot`/`pilot-snapshot`, il
       pourrait diverger silencieusement des valeurs que `page.tsx` calcule
       déjà pour le hero. Un seul point de calcul, un composant qui ne fait
       que réafficher. */
    const source = read("components/water-intelligence/WiScopeRail.tsx");
    expect(source).not.toMatch(/from ["']@\/lib\/water-intelligence/);
  });

  it("page.tsx ne passe aucun littéral en dur à WiScopeRail — uniquement des expressions", () => {
    const source = stripComments(read("app/water/page.tsx"));
    const call = source.slice(source.indexOf("<WiScopeRail"), source.indexOf("/>", source.indexOf("<WiScopeRail")) + 2);
    expect(call.length).toBeGreaterThan(0);
    // Chaque prop est de la forme `nom={expression}` — jamais `nom="texte"`.
    const props = [...call.matchAll(/(\w+)=/g)].map((m) => m[1]);
    expect(props).toEqual([
      "territoryCode",
      "periodLabel",
      "snapshotDate",
      "observationCount",
      "sourceCount",
      "publishableCount",
      "published",
    ]);
    expect(call).not.toMatch(/=\s*"/);
  });
});

/* ==========================================================================
   4 — Grammaire de statut centralisée : aucune constante quantitative
   ========================================================================== */

describe("grammaire de statut — WiStatusChip / WiEvidenceChip / SOURCE_STATE_TONE", () => {
  it("WiStatusChip rend les quatre états de publication avec icône et libellé", () => {
    for (const state of ["published", "qualitative", "deferred", "not_instrumented"] as const) {
      const markup = renderToStaticMarkup(<WiStatusChip state={state} />);
      expect(markup).toContain(`wi-pubstate-${state}`);
      expect(markup).toContain('aria-hidden="true"');
    }
  });

  it("WiEvidenceChip donne quatre rendus DISTINCTS — plus un badge unique partagé", () => {
    const levels = [
      "institutional_context",
      "qualitative_consensus",
      "requires_measurement",
      "sourced_figure",
    ] as const;
    const renders = levels.map((level) => renderToStaticMarkup(<WiEvidenceChip level={level} />));
    expect(new Set(renders).size).toBe(4);
    // Aucun des quatre n'est plus systématiquement le badge "pending" hérité.
    const allPending = renders.every((r) => r.includes("wi-badge-pending"));
    expect(allPending).toBe(false);
  });

  it("SOURCE_STATE_TONE couvre les cinq états sans valeur numérique", () => {
    const values = Object.values(SOURCE_STATE_TONE);
    expect(values).toHaveLength(5);
    for (const tone of values) {
      expect(typeof tone).toBe("string");
    }
  });

  it("les primitives de statut n'importent aucune valeur hydrique — seulement des libellés", () => {
    /* `EVIDENCE_LABELS`/`PUBLICATION_STATE_LABELS` sont du texte éditorial ;
       aucune primitive de ce fichier n'importe `pilot-snapshot` ni
       `canonical-snapshot` au-delà du TYPE `WiSourceStatus["state"]`, déjà
       vérifié en axe 3 — ce test interdit un futur import de valeur. */
    const source = stripComments(read("components/water-intelligence/WiPrimitives.tsx"));
    expect(source).not.toMatch(/from ["']@\/lib\/water-intelligence\/pilot-snapshot/);
  });
});
