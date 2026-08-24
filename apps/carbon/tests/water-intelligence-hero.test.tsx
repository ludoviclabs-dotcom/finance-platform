/**
 * tests/water-intelligence-hero.test.tsx — le hero comme centre de commande
 * evidence-first (WI-V3-02).
 *
 * Ces tests ne vérifient pas une mise en page : ils vérifient les règles que
 * le hero s'est données, et que rien d'autre ne tient.
 *
 * 1. Le positionnement est celui qui a été arbitré, mot pour mot.
 * 2. Les quatre Evidence Counters affichent des valeurs REÇUES, et aucune
 *    forme qui supposerait un dénominateur (anneau, jauge, pourcentage,
 *    barre de complétion).
 * 3. Le bloc Snapshot dit l'état réel, et ne fabrique jamais de date.
 * 4. L'Evidence Chain lit l'état de ses maillons sur `PULSE_FACETS` — elle ne
 *    le réécrit pas — et n'encode aucune quantité dans son tracé.
 * 5. Le mouvement reste borné : rien de perpétuel, rien qui cache un contenu.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WiHero } from "@/components/water-intelligence/WiHero";
import { PULSE_FACETS } from "@/lib/water-intelligence/editorial-matrices";

const CARBON_ROOT = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(CARBON_ROOT, path), "utf-8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const HERO_SOURCE = read("components/water-intelligence/WiHero.tsx");
const CSS = read("app/water/water-intelligence.css");

/** Périmètre du pilote réel — repris tel quel, jamais inventé pour le test. */
const PROPS = {
  observationCount: 3,
  isPublished: true,
  snapshotDate: "2026-07-28",
  scopeLabel: "commune 34172, année 2020",
  territoryCode: "34172",
  periodLabel: "2020",
  reviewedOn: "2026-07-28",
  sourceCode: "HUBEAU_BNPE_PRELEVEMENTS",
  sourceCount: 7,
  publishableCount: 1,
} as const;

const markup = renderToStaticMarkup(<WiHero {...PROPS} />);
const visible = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;| /g, " ")
  .replace(/\s+/g, " ");

/**
 * Découpe la région d'un `data-testid` jusqu'à un marqueur de fin.
 *
 * Le marqueur de fin est une chaîne quelconque du balisage (testid OU classe) :
 * les Evidence Counters sont suivis, dans la même colonne, de la ligne de
 * provenance et des appels à l'action — s'arrêter au testid du bloc SUIVANT
 * les avalerait et fausserait tout décompte de liens.
 */
function region(testId: string, until: string | null): string {
  const start = markup.indexOf(`data-testid="${testId}"`);
  expect(start, `region introuvable : ${testId}`).toBeGreaterThanOrEqual(0);
  if (until === null) return markup.slice(start);
  const end = markup.indexOf(until, start + 1);
  expect(end, `marqueur de fin introuvable : ${until}`).toBeGreaterThan(start);
  return markup.slice(start, end);
}

/* ==========================================================================
   1 — Positionnement
   ========================================================================== */

describe("hero — identité et positionnement", () => {
  it("conserve le titre du module", () => {
    expect(markup).toContain("<h1");
    expect(visible).toContain("Water Intelligence");
  });

  it("rend exactement UN titre de premier niveau", () => {
    expect((markup.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("énonce le positionnement arbitré, mot pour mot", () => {
    expect(visible).toContain(
      "Dépendance à l'eau, exposition territoriale et résilience — des observations aux décisions, avec leur niveau de preuve.",
    );
  });

  it("ne promet rien que la page ne livre", () => {
    for (const phrase of [
      "temps réel",
      "surveillance active",
      "couverture mondiale",
      "leader",
      "révolutionn",
    ]) {
      expect(visible.toLowerCase(), `formulation marketing : ${phrase}`).not.toContain(phrase);
    }
  });

  it("conserve les deux pastilles de portée que l'E2E public vérifie", () => {
    expect(markup).toContain('data-testid="wi-hero-badge-pilot"');
    expect(markup).toContain('data-testid="wi-hero-badge-scope"');
    expect(visible).toContain("34172");
    expect(visible).toContain("2020");
  });
});

/* ==========================================================================
   2 — Evidence Counters
   ========================================================================== */

describe("hero — Evidence Counters", () => {
  const counters = region("wi-hero-counters", "wi-hero-provenance");

  it("porte les quatre compteurs demandés, avec leur libellé", () => {
    for (const label of [
      "Observations publiées",
      "Sources instrumentées",
      "Sources autorisées",
      "Périmètre couvert",
    ]) {
      expect(counters, `compteur manquant : ${label}`).toContain(label);
    }
  });

  it("affiche les valeurs REÇUES, jamais des constantes", () => {
    expect(counters).toContain(">3<");
    expect(counters).toContain(">7<");
    expect(counters).toContain(">1<");
    expect(counters).toContain(">34172<");
  });

  it("suit le document quand il change : d'autres props, d'autres chiffres", () => {
    /* Un compteur écrit en dur resterait à « 3 » après un retour arrière du
       document publié. Celui-ci suit ses props. */
    const other = renderToStaticMarkup(
      <WiHero {...PROPS} observationCount={0} publishableCount={0} isPublished={false} snapshotDate={null} />,
    );
    const otherCounters = other.slice(
      other.indexOf('data-testid="wi-hero-counters"'),
      other.indexOf("wi-hero-provenance"),
    );
    expect(otherCounters).toContain(">0<");
    expect(otherCounters).not.toContain(">3<");
  });

  it("le compteur d'observations reste un nombre NU — contrat de l'E2E public", () => {
    /* `toHaveText(/^[0-9]+$/)` côté Playwright : l'élément porteur du testid
       ne doit contenir QUE les chiffres, sans unité ni symbole collés. */
    expect(markup).toMatch(/data-testid="wi-hero-observations">\d+</);
  });

  it("ne dessine AUCUNE forme qui supposerait un dénominateur", () => {
    /* Anneau de progression, jauge, barre de complétion, pourcentage : les
       quatre supposent un « sur combien » que ce module n'a pas. */
    expect(counters).not.toContain("<circle");
    expect(counters).not.toContain("<progress");
    expect(counters).not.toContain('role="progressbar"');
    expect(counters).not.toContain("%");
    expect(counters).not.toMatch(/aria-valuenow|aria-valuemax/);
  });

  it("aucune classe de jauge n'existe dans la feuille de style du hero", () => {
    for (const forbidden of ["wi-counter-ring", "wi-counter-gauge", "wi-counter-progress"]) {
      expect(CSS).not.toContain(forbidden);
    }
  });

  it("rend le périmètre comme une RÉFÉRENCE, pas comme une quantité", () => {
    /* « 34172 » dans la même graisse display que « 3 » se lirait comme
       trente-quatre mille. Le monospace dit que c'est un identifiant. */
    expect(counters).toContain("wi-counter-value-ref");
    expect(counters).toContain("Commune INSEE");
  });

  it("rend la provenance de chaque compteur, et une métadonnée toujours visible", () => {
    expect((counters.match(/wi-counter-tip/g) ?? []).length).toBe(4);
    expect((counters.match(/wi-counter-meta/g) ?? []).length).toBe(4);
  });

  it("mène à l'Evidence Registry plutôt que nulle part", () => {
    const hrefs = [...counters.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(4);
    for (const href of hrefs) {
      expect(href).toBe("#preuves");
    }
  });

  it("la provenance n'est JAMAIS la seule voie vers l'information", () => {
    /* La bulle est un supplément : elle apparaît au survol et au focus, et la
       valeur comme sa métadonnée restent peintes en permanence. */
    expect(CSS).toContain("[data-wi] .wi-counter:hover .wi-counter-tip");
    expect(CSS).toContain("[data-wi] .wi-counter:focus-visible .wi-counter-tip");
  });
});

/* ==========================================================================
   3 — Snapshot pilote
   ========================================================================== */

describe("hero — Snapshot pilote", () => {
  it("rend le bloc, son titre et son état de publication", () => {
    expect(markup).toContain('data-testid="wi-snapshot-status"');
    expect(visible).toContain("Snapshot pilote");
    expect(markup).toContain("wi-pubstate-published");
  });

  it("porte territoire, période, snapshot, revue et source principale", () => {
    expect(visible).toContain("Territoire");
    expect(visible).toContain("Période");
    expect(visible).toContain("Revu le");
    expect(visible).toContain("Source principale");
    expect(visible).toContain("HUBEAU_BNPE_PRELEVEMENTS");
    expect(visible).toContain("2026-07-28");
  });

  it("énonce la phrase de cadrage exigée", () => {
    expect(visible).toContain("Données publiées sous périmètre signé.");
  });

  it("offre un chemin vers la provenance", () => {
    expect(markup).toContain('href="#preuves"');
    expect(visible).toContain("Provenance vérifiable");
  });

  it("ne fabrique aucune date quand le document n'est pas généré", () => {
    const notGenerated = renderToStaticMarkup(
      <WiHero {...PROPS} isPublished={false} snapshotDate={null} observationCount={0} />,
    );
    expect(notGenerated).toContain('data-testid="wi-hero-snapshot-date">non généré<');
    /* La date de REVUE reste affichée — c'est un fait de la décision signée,
       pas une propriété du document ; seule la date d'assemblage disparaît. */
    expect(notGenerated).not.toMatch(/wi-hero-snapshot-date">2026/);
  });

  it("son titre est un `h2` : le hero ne creuse pas de saut de niveau", () => {
    /* `h1` puis `h2` : un `h3` ici sauterait un cran dans le plan du
       document, ce que le garde-fou de `water-intelligence-public-shell`
       refuse au niveau de la page entière. */
    expect(markup).toMatch(/<h2[^>]*id="wi-snapshot-title"/);
  });
});

/* ==========================================================================
   4 — Evidence Chain
   ========================================================================== */

describe("hero — Evidence Chain", () => {
  const chain = region("wi-evidence-chain", null);

  it("rend les sept maillons de la chaîne, dans l'ordre", () => {
    const labels = [
      "Climat",
      "Bassin et ressource",
      "Prélèvements",
      "Activités dépendantes",
      "Risques opérationnels",
      "Finance & ESG",
      "Adaptation",
    ];
    let cursor = -1;
    for (const label of labels) {
      const at = visible.indexOf(label, cursor + 1);
      expect(at, `maillon absent ou hors ordre : ${label}`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("reste une liste ORDONNÉE — l'ordre est porté par le balisage", () => {
    expect(chain).toContain("<ol");
    /* `<li[ >]` et non `<li` : les pictogrammes Lucide contiennent des
       `<line>`, qu'une recherche naïve compterait comme des éléments de
       liste. */
    expect((chain.match(/<li[\s>]/g) ?? []).length).toBe(7);
  });

  it("chaque maillon mène à la section qui le traite", () => {
    const hrefs = [...chain.matchAll(/href="(#[a-z-]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([
      "#evenements",
      "#carte",
      "#pilote",
      "#secteurs",
      "#risques",
      "#finance",
      "#innovations",
    ]);
  });

  it("porte un pictogramme par maillon", () => {
    expect((chain.match(/<svg/g) ?? []).length).toBe(7);
    expect((chain.match(/wi-chain-icon/g) ?? []).length).toBe(7);
  });

  it("LIT l'état de publication sur les facettes, il ne le réécrit pas", () => {
    /* Si `editorial-matrices.ts` fait passer une facette à « publié », la
       chaîne suit sans qu'aucune ligne de `WiHero.tsx` ne bouge. Ce test
       échouerait si quelqu'un recopiait les états en dur. */
    const prelevements = PULSE_FACETS.find((f) => f.id === "prelevements");
    expect(prelevements?.publicationState).toBe("published");
    expect(chain).toContain('data-state="published"');

    const publishedDots = (chain.match(/data-state="published"/g) ?? []).length;
    expect(publishedDots).toBe(1);
    expect(stripComments(HERO_SOURCE)).toContain("PULSE_FACETS.find");
  });

  it("double chaque pastille d'un texte réel — jamais la couleur seule", () => {
    expect((chain.match(/wi-chain-dot/g) ?? []).length).toBe(7);
    expect((chain.match(/wi-visually-hidden/g) ?? []).length).toBe(7);
    for (const label of ["Publié", "Qualitatif", "Différé"]) {
      expect(chain).toContain(label);
    }
  });

  it("n'est PAS un Sankey : aucune épaisseur ne code une quantité", () => {
    /* Le connecteur a une largeur constante d'un pixel, écrite une fois dans
       la feuille de style. Une largeur variable prétendrait mesurer un flux
       entre deux maillons — rien n'est quantifié entre eux. */
    const connector = CSS.slice(CSS.indexOf("[data-wi] .wi-chain-node:not(:last-child)::after"));
    expect(connector).toContain("width: 1px;");

    /* Les pictogrammes portent bien un `stroke-width`, mais le MÊME pour
       tous : c'est une constante de dessin, pas une variable qui coderait
       une intensité. Ce test échouerait si un maillon recevait un trait plus
       épais qu'un autre. */
    const strokes = new Set(
      [...chain.matchAll(/stroke-width="([^"]+)"/g)].map((m) => m[1]),
    );
    expect(strokes.size).toBe(1);

    /* Et aucune largeur inline calculée : le seul `style` des maillons porte
       l'index d'échelonnement de l'animation, jamais une dimension. */
    expect(chain).not.toMatch(/style="[^"]*width:/);
    const inlineStyles = [...chain.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    for (const style of inlineStyles) {
      expect(style).toMatch(/^--wi-i:\d+$/);
    }
  });
});

/* ==========================================================================
   5 — Mouvement
   ========================================================================== */

describe("hero — mouvement borné", () => {
  it("n'entretient aucune animation perpétuelle", () => {
    /* Même invariant que l'E2E public, tenu ici à la source : aucune règle du
       hero ne déclare `infinite`. */
    const v3 = CSS.slice(CSS.indexOf("Water Intelligence v3 — hero"));
    expect(v3).not.toContain("infinite");
  });

  it("respecte les durées arbitrées : entrée ~320 ms, survol ~140 ms", () => {
    expect(CSS).toContain("animation: wiRise 320ms");
    expect(CSS).toContain("transition: background-color 140ms ease");
  });

  it("échelonne les compteurs sans dépasser la fenêtre demandée", () => {
    expect(CSS).toContain("calc(var(--wi-i, 0) * 55ms)");
  });

  it("révèle le tracé de la chaîne UNE SEULE FOIS", () => {
    expect(CSS).toContain("animation: wiChainDraw 560ms");
    const draw = CSS.slice(CSS.indexOf("[data-wi] .wi-chain-draw"));
    expect(draw).not.toContain("infinite");
  });

  it("part de l'état FINAL : sans JavaScript, le hero reste lisible", () => {
    /* Les animations sont en CSS et leur état de base est l'état final.
       `framer-motion` écrirait `opacity: 0` dans le HTML rendu, et le
       contenu n'en sortirait qu'à l'exécution du script. */
    const code = stripComments(HERO_SOURCE);
    expect(code).not.toContain("motion.");
    expect(code).not.toMatch(/initial=\{/);
    expect(markup).not.toMatch(/style="[^"]*opacity:\s*0/);
  });

  it("annule les délais sous mouvement réduit, plutôt que de retarder l'affichage", () => {
    const reduced = CSS.slice(CSS.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("animation-delay: 0ms !important");
  });

  it("continue de consulter la préférence de mouvement côté client", () => {
    expect(HERO_SOURCE).toContain("useReducedMotion");
  });
});

/* ==========================================================================
   6 — Provenance des valeurs
   ========================================================================== */

describe("hero — d'où viennent ses valeurs", () => {
  it("ne lit aucun document hydrique par lui-même : les chiffres arrivent en props", () => {
    /* Le hero importe `editorial-matrices` (libellés et facettes, du texte
       éditorial versionné) mais JAMAIS `pilot-snapshot` ni
       `canonical-snapshot` : sinon il pourrait diverger silencieusement des
       valeurs que `page.tsx` calcule déjà. Un seul point de lecture. */
    const code = stripComments(HERO_SOURCE);
    expect(code).not.toMatch(/from ["']@\/lib\/water-intelligence\/pilot-snapshot/);
    expect(code).not.toMatch(/from ["']@\/lib\/water-intelligence\/canonical-snapshot/);
  });

  it("page.tsx ne lui passe que des expressions, jamais un littéral chiffré", () => {
    const source = stripComments(read("app/water/page.tsx"));
    const start = source.indexOf("<WiHero");
    const call = source.slice(start, source.indexOf("/>", start) + 2);
    expect(call.length).toBeGreaterThan(0);
    // `nom={expression}` partout — jamais `nom="texte"`.
    expect(call).not.toMatch(/=\s*"/);
    for (const prop of [
      "observationCount",
      "isPublished",
      "snapshotDate",
      "scopeLabel",
      "territoryCode",
      "periodLabel",
      "reviewedOn",
      "sourceCode",
      "sourceCount",
      "publishableCount",
    ]) {
      expect(call, `prop non transmise : ${prop}`).toContain(`${prop}={`);
    }
  });

  it("n'expose aucune donnée d'entreprise", () => {
    for (const field of ["company_id", "tenant_id", "site_id", "user_id"]) {
      expect(markup).not.toContain(field);
    }
  });
});
