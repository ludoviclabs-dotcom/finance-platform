/**
 * water-intelligence-map.test.ts — carte multi-échelle (Wave C, C4).
 *
 * Teste l'état de l'explorateur, qui est PUR et entièrement dérivable de
 * l'URL : filtres, URL partageable, sélection, hiérarchie des filtres, échelles
 * atteignables, et le refus des valeurs inconnues. Aucun DOM requis.
 *
 * Le rendu D3 lui-même est couvert par sa propre discipline (pas d'appel
 * externe, pas d'animation perpétuelle), vérifiée par analyse de source.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAP_STATE,
  DEFAULT_SCOPE,
  EMPTY_VOCABULARY,
  MAP_SCOPES,
  applyDimensionChange,
  applyScopeChange,
  applySelection,
  parseMapState,
  reachableScopes,
  serialiseMapState,
  type WiMapVocabulary,
} from "@/lib/water-intelligence/map-state";

const CANVAS = readFileSync(
  join(process.cwd(), "components", "water-intelligence", "WiMapCanvas.tsx"),
  "utf8",
);

const VOCABULARY: WiMapVocabulary = {
  dimensions: ["eea_wei_plus.subunit", "hubeau.hydrometrie.debit"],
  periods: [
    ["2023-01-01", "2023-03-31"],
    ["2023-07-01", "2023-09-30"],
  ],
  scenarios: ["bau"],
  codes: ["FR", "ES"],
};

describe("parseMapState — valeurs publiées uniquement", () => {
  it("retombe sur le défaut quand l'URL est vide", () => {
    const { state, ignored } = parseMapState(new URLSearchParams(), VOCABULARY);

    expect(state).toEqual(DEFAULT_MAP_STATE);
    expect(ignored).toEqual([]);
  });

  it("reconstruit un état complet", () => {
    const params = new URLSearchParams({
      scope: "europe",
      dim: "eea_wei_plus.subunit",
      code: "FR",
      period_start: "2023-07-01",
      period_end: "2023-09-30",
      scenario: "bau",
      view: "table",
    });

    const { state, ignored } = parseMapState(params, VOCABULARY);

    expect(state.scope).toBe("europe");
    expect(state.dim).toBe("eea_wei_plus.subunit");
    expect(state.code).toBe("FR");
    expect(state.period_start).toBe("2023-07-01");
    expect(state.view).toBe("table");
    expect(ignored).toEqual([]);
  });

  it("ignore une dimension retirée du manifest et le signale", () => {
    const params = new URLSearchParams({ dim: "dimension.disparue" });

    const { state, ignored } = parseMapState(params, VOCABULARY);

    expect(state.dim).toBeNull();
    expect(ignored).toContain("dim");
  });

  it("ignore une échelle inconnue plutôt que d'afficher un écran vide", () => {
    const { state, ignored } = parseMapState(new URLSearchParams({ scope: "mars" }), VOCABULARY);

    expect(state.scope).toBe(DEFAULT_SCOPE);
    expect(ignored).toContain("scope");
  });

  it("ignore une période qui n'existe pas telle quelle", () => {
    const params = new URLSearchParams({
      period_start: "2023-01-01",
      period_end: "2023-12-31",
    });

    const { state, ignored } = parseMapState(params, VOCABULARY);

    expect(state.period_start).toBeNull();
    expect(ignored).toContain("period");
  });

  it("n'accepte aucune valeur quand rien n'est publié", () => {
    const params = new URLSearchParams({ dim: "x", code: "FR", scenario: "bau" });

    const { state, ignored } = parseMapState(params, EMPTY_VOCABULARY);

    expect(state.dim).toBeNull();
    expect(state.code).toBeNull();
    expect(state.scenario).toBeNull();
    expect(ignored).toEqual(expect.arrayContaining(["dim", "code", "scenario"]));
  });

  it("accepte aussi un objet simple de paramètres", () => {
    const { state } = parseMapState({ scope: "france" }, VOCABULARY);

    expect(state.scope).toBe("france");
  });
});

describe("serialiseMapState — URL partageable", () => {
  it("omet les valeurs par défaut", () => {
    expect(serialiseMapState(DEFAULT_MAP_STATE)).toBe("");
  });

  it("fait un aller-retour exact", () => {
    const state = {
      scope: "europe" as const,
      dim: "eea_wei_plus.subunit",
      code: "FR",
      period_start: "2023-07-01",
      period_end: "2023-09-30",
      scenario: "bau",
      view: "table" as const,
    };

    const round = parseMapState(new URLSearchParams(serialiseMapState(state)), VOCABULARY);

    expect(round.state).toEqual(state);
    expect(round.ignored).toEqual([]);
  });

  it("n'écrit aucun paramètre vide", () => {
    const query = serialiseMapState({ ...DEFAULT_MAP_STATE, scope: "france" });

    expect(query).toBe("scope=france");
    expect(query).not.toContain("=&");
  });
});

describe("hiérarchie des filtres", () => {
  const filled = {
    scope: "europe" as const,
    dim: "eea_wei_plus.subunit",
    code: "FR",
    period_start: "2023-07-01",
    period_end: "2023-09-30",
    scenario: "bau",
    view: "map" as const,
  };

  it("changer d'échelle réinitialise tous les niveaux inférieurs", () => {
    const next = applyScopeChange(filled, "france");

    expect(next.scope).toBe("france");
    expect(next.dim).toBeNull();
    expect(next.period_start).toBeNull();
    expect(next.scenario).toBeNull();
    expect(next.code).toBeNull();
  });

  it("changer de dimension réinitialise période et scénario, pas l'échelle", () => {
    const next = applyDimensionChange(filled, "hubeau.hydrometrie.debit");

    expect(next.scope).toBe("europe");
    expect(next.dim).toBe("hubeau.hydrometrie.debit");
    expect(next.period_start).toBeNull();
    expect(next.scenario).toBeNull();
  });
});

describe("sélection", () => {
  it("sélectionne une entité", () => {
    expect(applySelection(DEFAULT_MAP_STATE, "FR").code).toBe("FR");
  });

  it("re-sélectionner la même entité la désélectionne", () => {
    const selected = applySelection(DEFAULT_MAP_STATE, "FR");

    expect(applySelection(selected, "FR").code).toBeNull();
  });
});

describe("échelles atteignables", () => {
  it("propose toujours le monde", () => {
    expect(reachableScopes([])).toEqual(["world"]);
  });

  it("ne propose une échelle que si une couche y est publiée", () => {
    expect(reachableScopes(["france"])).toEqual(["world", "france"]);
    expect(reachableScopes(["europe", "france"])).toEqual(MAP_SCOPES);
  });
});

describe("discipline du rendu cartographique", () => {
  it("n'appelle aucun service externe", () => {
    expect(CANVAS).not.toContain("fetch(");
    expect(CANVAS).not.toMatch(/https?:\/\//);
  });

  it("n'ajoute ni Mapbox ni fond de tuiles", () => {
    expect(CANVAS.toLowerCase()).not.toContain("mapbox");
    expect(CANVAS.toLowerCase()).not.toContain("tile");
    expect(CANVAS.toLowerCase()).not.toContain("googlemaps");
  });

  it("n'utilise que les dépendances déjà installées", () => {
    for (const dependency of ["d3-geo", "d3-selection", "topojson-client", "world-atlas"]) {
      expect(CANVAS).toContain(dependency);
    }
  });

  it("joint par code, jamais par libellé", () => {
    expect(CANVAS).toContain("featureCode");
    expect(CANVAS).toContain("aucune jointure par libellé");
  });

  it("exclut les absences du domaine de la rampe", () => {
    expect(CANVAS).toContain("value !== null");
  });

  it("neutralise la transition sous reduced motion", () => {
    expect(CANVAS).toContain("reducedMotion");
    expect(CANVAS).toMatch(/reducedMotion \? "none"/);
  });

  it("n'introduit aucune animation perpétuelle", () => {
    expect(CANVAS).not.toContain("ping-ring");
    expect(CANVAS).not.toContain("infinite");
    expect(CANVAS).not.toContain("setInterval");
  });

  it("renvoie explicitement vers le tableau équivalent", () => {
    expect(CANVAS).toContain("tableau équivalent");
  });
});
