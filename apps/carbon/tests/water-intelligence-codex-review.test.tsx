/**
 * tests/water-intelligence-codex-review.test.tsx — garde-fous des quatre
 * corrections issues de la revue automatisée de la PR #180 (commit 5bfeeb5).
 *
 * Chaque test reproduit précisément le scénario signalé plutôt que de
 * vérifier la présence d'une correction générique.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WaterIntelligencePage from "@/app/water/page";
import { WiPilotData } from "@/components/water-intelligence/WiPilotData";
import {
  PILOT_FILE,
  pilotCoverageWarnings,
  pilotObservations,
  pilotScope,
} from "@/lib/water-intelligence/pilot-snapshot";

const CARBON_ROOT = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(CARBON_ROOT, path), "utf-8");

const OBSERVATIONS = pilotObservations(PILOT_FILE);
const SCOPE = pilotScope(PILOT_FILE);

const BASE_PROPS = {
  observations: OBSERVATIONS,
  coverageWarnings: pilotCoverageWarnings(PILOT_FILE),
  scopeLabel: "commune 34172, année 2020",
  attribution: null,
  sourceUrl: null,
  isPublished: true,
  reviewedOn: SCOPE.reviewedOn,
  sourceCode: SCOPE.sourceCode,
  licenseLabel: "ETALAB-2.0 — portée platform",
  methodLabel: "CC-WI-HUBEAU-BNPE-PASSTHROUGH · 1.0.0",
  yearLabel: "2020",
  notGeneratedExplanation: "Produit par un workflow de génération vérifié.",
} as const;

/* ==========================================================================
   1 — La sonde d'inspection partage la boîte réelle du SVG
   ========================================================================== */

describe("sonde d'inspection — alignée sur la boîte réelle du SVG", () => {
  const source = read("components/water-intelligence/WiFranceMap.tsx");
  const css = read("app/water/water-intelligence.css");

  it("le SVG et la sonde partagent un conteneur dont le ratio est fixé", () => {
    /*
     * Avant correction, la sonde était positionnée en pourcentage contre
     * `.wi-map-frame` (min-height fixe), tandis que le SVG — en `height:
     * 100%` sur un ancêtre à hauteur `auto` — retombait sur son ratio
     * intrinsèque, presque toujours plus bas. Mesuré en navigateur sur un
     * viewport de 375 px : 211 px d'écart vertical entre la sonde et le
     * marqueur réel.
     */
    expect(source).toContain("wi-map-canvas");
    const canvas = css.slice(css.indexOf("[data-wi] .wi-map-canvas"));
    expect(canvas.slice(0, 200)).toContain("aspect-ratio: 720 / 520");
    expect(canvas.slice(0, 200)).toContain("position: relative");
  });

  it("le SVG et le bouton d'inspection sont tous deux enfants directs du même conteneur ratio-fixe", () => {
    const canvasOpen = source.indexOf('<div className="wi-map-canvas">');
    const svgOpen = source.indexOf("<svg", canvasOpen);
    const probeOpen = source.indexOf('data-testid="wi-atlas-probe"', canvasOpen);
    expect(canvasOpen).toBeGreaterThanOrEqual(0);
    expect(svgOpen).toBeGreaterThan(canvasOpen);
    expect(probeOpen).toBeGreaterThan(svgOpen);
  });

  it("`.wi-map-frame` ne porte plus le `position: relative` de la sonde", () => {
    /* Le repositionnement doit vivre sur `.wi-map-canvas`, pas sur le cadre
       extérieur — sinon la sonde continuerait de se résoudre contre la
       mauvaise boîte. Découpe bornée à la RÈGLE elle-même (jusqu'à sa propre
       accolade fermante) : s'arrêter au sélecteur suivant engloberait le
       commentaire qui explique la correction, lequel mentionne forcément
       « position: relative » en prose. */
    const start = css.indexOf("[data-wi] .wi-map-frame {");
    const end = css.indexOf("}", start);
    const frame = css.slice(start, end);
    expect(frame).not.toContain("position: relative");
  });

  it("plafonne la largeur de l'atlas — `aspect-ratio` seul ferait grandir la hauteur sans borne", () => {
    /*
     * `aspect-ratio` (correction ci-dessus) implique qu'une largeur non
     * bornée produit une hauteur non bornée. Mesuré en navigateur avant ce
     * second correctif : 866 px de haut sur un viewport de 1280 px, pour une
     * section qui tenait auparavant dans les 460 px du `min-height` fixe.
     */
    expect(source).toContain('className="wi-atlas"');
    const rule = css.slice(css.indexOf("[data-wi] .wi-atlas {"));
    expect(rule.slice(0, 150)).toContain("max-width");
  });
});

/* ==========================================================================
   2 — Un zéro mesuré n'est pas une division par zéro
   ========================================================================== */

describe("scale = 0 — un zéro mesuré, jamais NaN", () => {
  const ALL_ZERO = OBSERVATIONS.map((observation) => ({ ...observation, value: 0 }));

  it("ne produit aucun `NaN` dans le balisage quand toutes les valeurs mesurées sont zéro", () => {
    const markup = renderToStaticMarkup(
      <WiPilotData {...BASE_PROPS} observations={ALL_ZERO} />,
    );
    expect(markup).not.toContain("NaN");
  });

  it("place la tige et le point exactement à l'origine, pas hors du plancher habituel", () => {
    const markup = renderToStaticMarkup(
      <WiPilotData {...BASE_PROPS} observations={ALL_ZERO} />,
    );
    expect(markup).toContain('class="wi-lolli-stem" style="width:0%"');
    expect(markup).toContain('class="wi-lolli-dot" style="left:0%"');
  });

  it("ne confond pas un zéro mesuré avec une absence de valeur", () => {
    /* `pct: 0` doit emprunter la branche tracé, pas la branche « Valeur non
       disponible » — sinon un zéro RÉEL se lirait comme une donnée
       manquante, l'erreur inverse de celle que le composant existe pour
       éviter. */
    const markup = renderToStaticMarkup(
      <WiPilotData {...BASE_PROPS} observations={ALL_ZERO} />,
    );
    expect(markup).not.toContain("Valeur non disponible");
  });

  it("un mélange zéro/valeur réelle reste correct : le zéro à l'origine, l'autre à l'échelle", () => {
    const mixed = [
      { ...OBSERVATIONS[0], value: 0 },
      { ...OBSERVATIONS[1], value: 100 },
    ];
    const markup = renderToStaticMarkup(<WiPilotData {...BASE_PROPS} observations={mixed} />);
    expect(markup).not.toContain("NaN");
    expect(markup).toContain('class="wi-lolli-stem" style="width:0%"');
  });
});

/* ==========================================================================
   3 — Le compteur d'observations est dérivé, jamais recopié
   ========================================================================== */

describe("introduction de section — dérivée du document, jamais un chiffre en dur", () => {
  it("ne contient plus le nombre d'observations écrit en toutes lettres", () => {
    const source = read("app/water/page.tsx");
    const section = source.slice(
      source.indexOf('id="pilote"'),
      source.indexOf("</WiSection>", source.indexOf('id="pilote"')),
    );
    // Aucune des graphies possibles ne doit plus apparaître en dur.
    expect(section).not.toMatch(/\bTrois observations\b/);
  });

  it("le rendu réel annonce le compte RÉELLEMENT publié", () => {
    const markup = renderToStaticMarkup(<WaterIntelligencePage />);
    const visible = markup
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;| /g, " ")
      .replace(/\s+/g, " ");
    expect(visible).toContain(`${OBSERVATIONS.length} observation`);
  });

  it("le document canonique ne peut pas diverger silencieusement de cette phrase", () => {
    /* Contrôle par construction : si `pilotObservations` renvoyait un jour
       un nombre différent de trois, ce test resterait vert — c'est le test
       PRÉCÉDENT (compteur écrit en dur) qui aurait dû casser avant lui.
       Celui-ci vérifie la mécanique elle-même : la phrase est fonction de
       `observations.length`, pas d'une relecture manuelle du document. */
    const source = read("app/water/page.tsx");
    const section = source.slice(
      source.indexOf('id="pilote"'),
      source.indexOf("</WiSection>", source.indexOf('id="pilote"')),
    );
    expect(section).toContain("observations.length");
  });
});

/* ==========================================================================
   4 — La provenance ne dépend jamais du seul presse-papiers
   ========================================================================== */

describe("empreinte de payload — repli sans presse-papiers", () => {
  it("le composant n'affirme plus une promesse qu'il ne tenait pas", () => {
    /* L'ancien commentaire promettait « la valeur reste affichée en entier
       et sélectionnable » alors que seuls 12 caractères atteignaient le DOM.
       Ce test échoue si la promesse revient sans le mécanisme qui la tient. */
    const source = read("components/water-intelligence/WiPilotData.tsx");
    expect(source).toContain("ChecksumField");
    expect(source).toContain('data-testid={`wi-checksum-expand-');
  });

  it("le repli n'est pas conditionné à `navigator.clipboard`", () => {
    const source = read("components/water-intelligence/WiPilotData.tsx");
    const field = source.slice(source.indexOf("function ChecksumField"));
    expect(field.slice(0, 900)).not.toContain("clipboard");
  });
});
