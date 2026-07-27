/**
 * tests/water-v1-experience.test.tsx — les invariants de la refonte Water V1.
 *
 * Ces tests ne vérifient pas une mise en page : ils vérifient les règles que
 * la refonte s'est données et que rien d'autre ne tient.
 *
 * 1. Le document pilote a deux états, jamais un état dégradé unique.
 * 2. Les contenus éditoriaux ne portent AUCUN chiffre.
 * 3. Aucune dérivation n'est produite — `derived_use_allowed = false`.
 * 4. Le thème Water n'est couplé à aucun autre domaine.
 * 5. La couleur ne porte jamais un statut à elle seule.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BNPE_COVERAGE_WARNINGS,
  PILOT_FILE,
  PilotFileSchema,
  formatVolume,
  pilotCoverageWarnings,
  pilotIsPublished,
  pilotObservations,
  pilotScope,
} from "@/lib/water-intelligence/pilot-snapshot";
import {
  CLIMATE_EVENTS,
  EVIDENCE_LABELS,
  INNOVATION_FAMILIES,
  INTENSITY_LABELS,
  PULSE_FACETS,
  SECTORS,
  SECTOR_DIMENSIONS,
  FINANCIAL_BRIDGE,
} from "@/lib/water-intelligence/editorial-matrices";

const CARBON_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(CARBON_ROOT, "../..");

/* ==========================================================================
   1 — Le document pilote a DEUX états
   ========================================================================== */

describe("le document pilote distingue « non généré » de « publié »", () => {
  it("valide le fichier versionné contre l'un des deux contrats", () => {
    expect(() => PilotFileSchema.parse(PILOT_FILE)).not.toThrow();
  });

  it("le marqueur ne contient AUCUNE observation", () => {
    if (!pilotIsPublished(PILOT_FILE)) {
      expect(PILOT_FILE.contains_no_observation).toBe(true);
      expect(pilotObservations(PILOT_FILE)).toHaveLength(0);
    }
  });

  it("le périmètre signé est lisible dans les DEUX états", () => {
    /* Avant génération il vient du marqueur, après du bloc `pilot`. Dans les
       deux cas d'une source unique — jamais d'une constante recopiée dans le
       front, qui dériverait du registre à la première correction. */
    const scope = pilotScope(PILOT_FILE);
    expect(scope.geographyCode).toBe("34172");
    expect(scope.geographyType).toBe("code_commune_insee");
    expect(scope.periodStart).toBe("2020-01-01");
    expect(scope.periodEnd).toBe("2020-12-31");
    expect(scope.expectedObservationCount).toBe(3);
    expect(scope.reviewedBy).toBe("ludoviclabs-dotcom");
    expect(scope.reviewedOn).toBe("2026-07-28");
  });

  it("les avertissements de couverture existent AVANT toute publication", () => {
    /* Ce sont des faits sur la source BNPE, pas des propriétés du document.
       Les taire tant que rien n'est publié reviendrait à ne les afficher
       qu'une fois qu'il est trop tard pour qu'ils changent la lecture. */
    const warnings = pilotCoverageWarnings(PILOT_FILE);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
    expect(warnings.join(" ")).toContain("JAMAIS un prélèvement nul");
    if (!pilotIsPublished(PILOT_FILE)) {
      expect(warnings).toEqual(BNPE_COVERAGE_WARNINGS);
    }
  });

  it("les deux documents sont identiques octet pour octet", () => {
    const canonical = readFileSync(
      resolve(REPO_ROOT, "docs/carbonco/water-intelligence/contracts/PUBLIC_SNAPSHOT_BNPE_V1.json"),
    );
    const mirror = readFileSync(
      resolve(CARBON_ROOT, "lib/water-intelligence/public-snapshot-bnpe-v1.json"),
    );
    expect(mirror.equals(canonical)).toBe(true);
  });

  it("une valeur absente se rend « n.c. », jamais zéro", () => {
    expect(formatVolume(null)).toBe("n.c.");
    expect(formatVolume(0)).not.toBe("n.c.");
  });
});

/* ==========================================================================
   2 — Les contenus éditoriaux ne portent AUCUN chiffre
   ========================================================================== */

describe("les matrices éditoriales ne publient aucun chiffre", () => {
  const EDITORIAL_TEXT = [
    ...PULSE_FACETS.flatMap((f) => [f.body, f.published, f.question]),
    ...SECTORS.map((s) => s.note),
    ...INNOVATION_FAMILIES.flatMap((f) => [f.principle, f.tradeoff]),
    ...FINANCIAL_BRIDGE.flatMap((s) => [s.question, s.note]),
  ];

  it("n'énonce aucune quantité chiffrée", () => {
    /* Un nombre suivi d'une unité, d'un pourcentage ou d'un multiplicateur :
       c'est la forme sous laquelle une valeur d'illustration devient une
       référence citée. */
    const forbidden = /\b\d+([.,]\d+)?\s*(%|litres?|m³|m3|km|tonnes?|fois|×)/i;
    for (const text of EDITORIAL_TEXT) {
      expect(text, `chiffre publié : « ${text} »`).not.toMatch(forbidden);
    }
  });

  it("chaque facette, secteur et innovation déclare son niveau de preuve", () => {
    for (const facet of PULSE_FACETS) {
      expect(EVIDENCE_LABELS[facet.evidenceLevel]).toBeTruthy();
    }
    for (const sector of SECTORS) {
      expect(EVIDENCE_LABELS[sector.evidenceLevel]).toBeTruthy();
    }
    for (const family of INNOVATION_FAMILIES) {
      expect(EVIDENCE_LABELS[family.evidenceLevel]).toBeTruthy();
    }
  });

  it("aucune affirmation n'est présentée comme une valeur sourcée", () => {
    /* `sourced_figure` exigerait une source relevée et une date de revue.
       Une seule facette l'emploie : celle qui décrit la publication pilote,
       et elle renvoie aux trois observations réellement publiées. */
    const sourced = PULSE_FACETS.filter((f) => f.evidenceLevel === "sourced_figure");
    expect(sourced.map((f) => f.id)).toEqual(["prelevements"]);
    for (const sector of SECTORS) {
      expect(sector.evidenceLevel).not.toBe("sourced_figure");
    }
    for (const family of INNOVATION_FAMILIES) {
      expect(family.evidenceLevel).not.toBe("sourced_figure");
    }
  });

  it("chaque innovation porte sa CONTREPARTIE", () => {
    /* Une famille présentée par son seul gain hydrique est une promesse, pas
       une option. */
    for (const family of INNOVATION_FAMILIES) {
      expect(family.tradeoff.trim().length, family.id).toBeGreaterThan(40);
    }
  });

  it("la chronologie reste vide tant qu'aucun événement n'est instruit", () => {
    expect(CLIMATE_EVENTS).toHaveLength(0);
  });
});

/* ==========================================================================
   3 — Aucune dérivation : derived_use_allowed = false
   ========================================================================== */

describe("aucune dérivation n'est produite à partir des valeurs publiées", () => {
  const SOURCES = readdirSync(resolve(CARBON_ROOT, "components/water-intelligence"))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => ({
      name,
      code: readFileSync(resolve(CARBON_ROOT, "components/water-intelligence", name), "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, ""),
    }));

  it("aucun composant ne somme, ne moyenne ni ne trie les observations", () => {
    /* La couverture BNPE est partielle par construction : un total sur trois
       ouvrages présenterait une somme partielle comme le prélèvement de la
       commune. L'interdiction est donc structurelle, pas éditoriale. */
    for (const { name, code } of SOURCES) {
      expect(code, `${name} réduit des valeurs`).not.toMatch(/\.reduce\s*\(/);
      expect(code, `${name} trie des valeurs`).not.toMatch(/observations[\s\S]{0,40}\.sort\s*\(/);
    }
  });

  it("la seule agrégation tolérée est l'ÉCHELLE du graphique, et elle est nommée", () => {
    const pilot = SOURCES.find((s) => s.name === "WiPilotData.tsx")!;
    /* `Math.max` sert à dimensionner les barres. Ce n'est ni un maximum
       communal ni un total, et le composant le dit à côté du graphique. */
    expect(pilot.code).toContain("Math.max");
    expect(pilot.code).not.toContain("Math.min");
    const raw = readFileSync(
      resolve(CARBON_ROOT, "components/water-intelligence/WiPilotData.tsx"),
      "utf-8",
    );
    expect(raw).toContain("ni un maximum communal, ni un total");
  });
});

/* ==========================================================================
   4 — Le thème Water n'est couplé à aucun autre domaine
   ========================================================================== */

describe("le thème Water est indépendant de /materials", () => {
  const WATER_FILES = [
    "app/water/page.tsx",
    "app/water/water-intelligence.css",
    ...readdirSync(resolve(CARBON_ROOT, "components/water-intelligence"))
      .filter((n) => n.endsWith(".tsx"))
      .map((n) => `components/water-intelligence/${n}`),
  ];

  it("aucun fichier Water ne dépend d'un jeton ou d'un crochet `mx`", () => {
    /* `MxThemeProvider` pose `data-mx`, crochet auquel toute la feuille
       /materials est accrochée. En hériter ferait s'appliquer à Water des
       règles qu'aucune ligne de code Water n'exprime. */
    for (const file of WATER_FILES) {
      /* Commentaires retirés : ces fichiers documentent en prose POURQUOI ils
         n'empruntent pas les jetons `--mx-*`, et un grep naïf confondrait la
         documentation avec une dépendance. */
      const code = readFileSync(resolve(CARBON_ROOT, file), "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code, `${file} référence un jeton mx`).not.toMatch(/--mx-|data-mx|MxTheme/);
    }
  });

  it("le provider partagé est paramétré par son domaine", () => {
    const provider = readFileSync(
      resolve(CARBON_ROOT, "components/intelligence/IntelligenceThemeProvider.tsx"),
      "utf-8",
    );
    expect(provider).toContain("scope: string");
    expect(provider).toContain("`carbonco-${scope}-theme`");
    /* Aucun nom de domaine n'y est écrit en dur : le provider ne connaît ni
       Water ni Materials. */
    expect(provider.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain('"wi"');
  });
});

/* ==========================================================================
   5 — La couleur ne porte jamais un statut à elle seule
   ========================================================================== */

describe("aucun statut n'est porté par la seule couleur", () => {
  const CSS = readFileSync(resolve(CARBON_ROOT, "app/water/water-intelligence.css"), "utf-8");

  it("l'absence de donnée porte un MOTIF, pas seulement une teinte", () => {
    expect(CSS).toContain("repeating-linear-gradient");
    expect(CSS).toMatch(/\.wi-absent-fill/);
  });

  it("chaque intensité de matrice a un libellé texte", () => {
    for (const label of Object.values(INTENSITY_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(3);
    }
    /* Sept dimensions, dix secteurs : chaque case porte son libellé. */
    expect(SECTOR_DIMENSIONS).toHaveLength(7);
    expect(SECTORS).toHaveLength(10);
    for (const sector of SECTORS) {
      for (const dimension of SECTOR_DIMENSIONS) {
        expect(INTENSITY_LABELS[sector.dimensions[dimension.id]]).toBeTruthy();
      }
    }
  });

  it("chaque état de source a une icône ET un libellé", () => {
    const constellation = readFileSync(
      resolve(CARBON_ROOT, "components/water-intelligence/WiConstellation.tsx"),
      "utf-8",
    );
    for (const code of [
      "published_limited_scope",
      "deferred_over_budget",
      "subdaily_identity_collision",
      "manual_artifact_required",
      "blocked_registration_required",
      "source_verified_decoder_deferred",
    ]) {
      expect(constellation, `${code} sans libellé`).toContain(code);
    }
    // Une icône par état, jamais la couleur seule.
    expect(constellation).toMatch(/icon: "[^"]+"/);
  });

  it("le focus visible n'est jamais supprimé", () => {
    expect(CSS).toContain("focus-visible");
    expect(CSS).not.toMatch(/outline:\s*(none|0)\s*;/);
  });

  it("le mouvement réduit est respecté sans perte d'information", () => {
    expect(CSS).toContain("prefers-reduced-motion");
    const hero = readFileSync(
      resolve(CARBON_ROOT, "components/water-intelligence/WiHero.tsx"),
      "utf-8",
    );
    expect(hero).toContain("useReducedMotion");
    /* La cascade est une liste ORDONNÉE : l'ordre est porté par le balisage,
       pas par l'animation. */
    expect(hero).toContain("<ol className=\"wi-cascade-list\">");
  });
});
