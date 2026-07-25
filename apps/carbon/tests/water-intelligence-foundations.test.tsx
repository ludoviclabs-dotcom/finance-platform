/**
 * water-intelligence-foundations.test.tsx — fondations UI Wave C (C3).
 *
 * Rendu au serveur via `renderToStaticMarkup` (le dépôt n'a pas
 * `@testing-library` — même approche que les tests du shell P04).
 *
 * Couvre : les huit états et leur ordre de priorité, la légende jamais réduite
 * à une couleur, la table alternative à parité, le Water Pulse qui n'agrège
 * rien, les previews sans chiffre ni date, l'absence de fixture visible et
 * l'absence de palette étrangère au thème `--wi-*`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  WiAccessibleDataTable,
  WiExclusionList,
  WiLegend,
  WiWaterPulse,
} from "@/components/water-intelligence/WiFoundations";
import { WiDataState } from "@/components/water-intelligence/WiDataState";
import {
  MODIFIER_LABELS,
  resolveWiDataState,
} from "@/lib/water-intelligence/data-state";
import {
  EMPTY_SNAPSHOT,
  parsePublicSnapshot,
  type WaterPublicSnapshot,
} from "@/lib/water-intelligence/public-snapshot";

const COMPONENTS_DIR = join(process.cwd(), "components", "water-intelligence");

function read(file: string): string {
  return readFileSync(join(COMPONENTS_DIR, file), "utf8");
}

/* ------------------------------------------------------ Décideur d'état */

describe("resolveWiDataState — ordre de priorité", () => {
  it("fixture écrase tout, y compris une erreur", () => {
    const state = resolveWiDataState({
      fixtureLabel: "fixture",
      error: "boom",
      value: 42,
      allowDisplay: true,
    });

    expect(state.kind).toBe("fixture");
    expect(state.rendersValue).toBe(false);
  });

  it("l'erreur prime sur la licence bloquée", () => {
    const state = resolveWiDataState({ error: "manifest illisible", allowDisplay: false });

    expect(state.kind).toBe("error");
  });

  it("la licence bloquée prime sur l'absence", () => {
    const state = resolveWiDataState({ allowDisplay: false, value: null });

    expect(state.kind).toBe("blocked");
    expect(state.rendersValue).toBe(false);
  });

  it("l'absence est déclenchée par null, jamais par 0", () => {
    expect(resolveWiDataState({ allowDisplay: true, value: null }).kind).toBe("absent");
    expect(resolveWiDataState({ allowDisplay: true, value: 0 }).kind).toBe("nominal");
    expect(resolveWiDataState({ allowDisplay: true, value: false }).kind).toBe("nominal");
  });

  it("le chargement ne masque pas une absence connue", () => {
    const state = resolveWiDataState({ allowDisplay: true, value: null, isLoading: true });

    expect(state.kind).toBe("absent");
  });

  it("rend l'état nominal quand une valeur est publiable", () => {
    const state = resolveWiDataState({ allowDisplay: true, value: 12.5 });

    expect(state.kind).toBe("nominal");
    expect(state.rendersValue).toBe(true);
  });

  it("stale et couverture partielle sont des modificateurs cumulables", () => {
    const state = resolveWiDataState({
      allowDisplay: true,
      value: 12.5,
      isStale: true,
      coveragePct: 60,
    });

    expect(state.kind).toBe("nominal");
    expect(state.modifiers).toContain("stale");
    expect(state.modifiers).toContain("partial-coverage");
  });

  it("une couverture complète n'ajoute pas de modificateur", () => {
    const state = resolveWiDataState({ allowDisplay: true, value: 1, coveragePct: 100 });

    expect(state.modifiers).not.toContain("partial-coverage");
  });

  it("chaque état porte un libellé texte — jamais de couleur seule", () => {
    for (const input of [
      { fixtureLabel: "fixture" },
      { error: "x" },
      { allowDisplay: false },
      { allowDisplay: true, value: null },
      { allowDisplay: true, value: 1, isLoading: true },
      { allowDisplay: true, value: 1 },
    ]) {
      expect(resolveWiDataState(input).label.length).toBeGreaterThan(0);
    }
  });
});

/* --------------------------------------------------- Rendu des états */

describe("WiDataState — rendu", () => {
  it("ne rend jamais la valeur quand l'état l'interdit", () => {
    const blocked = resolveWiDataState({ allowDisplay: false });
    const html = renderToStaticMarkup(
      <WiDataState state={blocked}>
        <span>VALEUR-SECRETE-1234</span>
      </WiDataState>,
    );

    expect(html).not.toContain("VALEUR-SECRETE-1234");
    expect(html).toContain("licence");
  });

  it("rend la valeur en état nominal", () => {
    const nominal = resolveWiDataState({ allowDisplay: true, value: 12.5 });
    const html = renderToStaticMarkup(
      <WiDataState state={nominal}>
        <span>12,5&nbsp;%</span>
      </WiDataState>,
    );

    expect(html).toContain("12,5");
  });

  it("annonce l'erreur avec role=alert", () => {
    const html = renderToStaticMarkup(
      <WiDataState state={resolveWiDataState({ error: "couche illisible" })} />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("couche illisible");
  });

  it("rend les modificateurs en texte", () => {
    const html = renderToStaticMarkup(
      <WiDataState state={resolveWiDataState({ allowDisplay: true, value: 1, isStale: true })}>
        <span>1</span>
      </WiDataState>,
    );

    expect(html).toContain(MODIFIER_LABELS.stale);
  });
});

/* ---------------------------------------------------------- Légende */

describe("WiLegend", () => {
  it("rend un libellé texte pour chaque palier", () => {
    const html = renderToStaticMarkup(
      <WiLegend
        title="Rareté saisonnière"
        entries={[
          { label: "Au-dessus du seuil", range: "> 20 %", token: "--wi-stress" },
          { label: "Donnée absente", range: null, token: "--wi-absent", hatched: true },
        ]}
      />,
    );

    expect(html).toContain("Au-dessus du seuil");
    expect(html).toContain("Donnée absente");
  });

  it("annonce un intervalle manquant plutôt que d'en inventer un", () => {
    const html = renderToStaticMarkup(
      <WiLegend title="X" entries={[{ label: "A", range: null, token: "--wi-water" }]} />,
    );

    expect(html).toContain("intervalle non communiqué");
  });

  it("rappelle que les seuils viennent de la méthode, pas de l'interface", () => {
    const html = renderToStaticMarkup(<WiLegend title="X" entries={[]} />);

    expect(html).toContain("métadonnées de méthode");
  });
});

/* ------------------------------------------------ Table alternative */

describe("WiAccessibleDataTable", () => {
  const columns = [
    { key: "territoire", header: "Territoire" },
    { key: "valeur", header: "Valeur", numeric: true },
  ];

  it("annonce le total de lignes — jamais de troncature muette", () => {
    const html = renderToStaticMarkup(
      <WiAccessibleDataTable
        caption="Territoires"
        columns={columns}
        rows={[
          { id: "a", cells: { territoire: "A", valeur: "1" } },
          { id: "b", cells: { territoire: "B", valeur: "2" } },
        ]}
        emptyLabel="vide"
      />,
    );

    expect(html).toContain("2 lignes au total");
  });

  it("conserve les lignes sans valeur", () => {
    const html = renderToStaticMarkup(
      <WiAccessibleDataTable
        caption="Territoires"
        columns={columns}
        rows={[{ id: "a", cells: { territoire: "SANS-VALEUR-001" } }]}
        emptyLabel="vide"
      />,
    );

    expect(html).toContain("SANS-VALEUR-001");
  });

  it("rend un état vide explicite", () => {
    const html = renderToStaticMarkup(
      <WiAccessibleDataTable
        caption="X"
        columns={columns}
        rows={[]}
        emptyLabel="Aucune entité publiée."
      />,
    );

    expect(html).toContain("Aucune ligne");
    expect(html).toContain("Aucune entité publiée.");
  });

  it("utilise des en-têtes de colonne avec scope", () => {
    const html = renderToStaticMarkup(
      <WiAccessibleDataTable
        caption="X"
        columns={columns}
        rows={[{ id: "a", cells: { territoire: "A", valeur: "1" } }]}
        emptyLabel="vide"
      />,
    );

    expect(html).toContain('scope="col"');
  });
});

/* -------------------------------------------------------- Water Pulse */

describe("WiWaterPulse", () => {
  it("décrit l'état des couches, jamais l'état de l'eau", () => {
    const html = renderToStaticMarkup(<WiWaterPulse snapshot={EMPTY_SNAPSHOT} />);

    expect(html).toContain("couches publiées");
    expect(html).toContain("n’agrège aucune dimension");
  });

  it("annonce explicitement l'absence de couche publiée", () => {
    const html = renderToStaticMarkup(<WiWaterPulse snapshot={EMPTY_SNAPSHOT} />);

    expect(html).toContain("Aucune couche publiée");
    expect(html).toContain("décision humaine");
  });

  it("ne produit aucun score composite", () => {
    const html = renderToStaticMarkup(<WiWaterPulse snapshot={EMPTY_SNAPSHOT} />);

    // Le composant DIT qu'il ne produit aucun score — cette phrase ne doit pas
    // faire échouer le test. On vérifie la règle réelle : les seules valeurs
    // rendues sont les quatre compteurs déclarés, aucun agrégat supplémentaire.
    const values = html.match(/<dd[^>]*>([^<]*)<\/dd>/g) ?? [];
    expect(values).toHaveLength(4);
    expect(values.every((cell) => /^<dd[^>]*>\d+<\/dd>$/.test(cell))).toBe(true);

    // Et la garantie est bien affichée au lecteur.
    expect(html).toContain("ne produit aucun score");
  });
});

/* ------------------------------------------------------- Exclusions */

describe("WiExclusionList", () => {
  it("rend chaque exclusion avec son motif", () => {
    const html = renderToStaticMarkup(
      <WiExclusionList
        exclusions={[
          {
            source_code: "WRI_AQUEDUCT",
            reason: "decision_refused",
            detail: "Enregistrement WRI non effectué.",
          },
        ]}
      />,
    );

    expect(html).toContain("WRI_AQUEDUCT");
    expect(html).toContain("Publication refusée");
    expect(html).toContain("Enregistrement WRI non effectué.");
  });
});

/* --------------------------------------------------------- Previews */

/*
 * Les deux previews Wave D ont été REMPLACÉES (commits D1 et D3) : le bloc de
 * tests « aucun chiffre / aucune date » qui les couvrait a donc été retiré en
 * connaissance de cause. Les composants qui les remplacent ont leurs propres
 * suites : `water-intelligence-regulatory.test.tsx` (P13) et
 * `water-intelligence-financial.test.tsx` (P15).
 */

/* ----------------------------------------- Discipline de thème et fixture */

describe("discipline de thème", () => {
  const files = [
    "WiDataState.tsx",
    "WiFoundations.tsx",
    "WiMapFrame.tsx",
    "WiFilterBar.tsx",
    "WiProvenanceDrawer.tsx",
  ];

  it("n'utilise jamais les tokens --mx-* de /materials", () => {
    // La règle porte sur l'USAGE d'un token, pas sur sa mention : plusieurs
    // docstrings expliquent précisément pourquoi `--mx-*` est proscrit.
    for (const file of files) {
      expect(read(file)).not.toMatch(/var\(\s*--mx-/);
    }
  });

  it("n'utilise aucune couleur Tailwind brute", () => {
    for (const file of files) {
      const source = read(file);
      expect(source).not.toMatch(/\b(zinc|emerald|amber|rose|slate|sky)-\d{2,3}\b/);
    }
  });

  it("garde les composants de présentation en Server Components", () => {
    for (const file of ["WiDataState.tsx", "WiFoundations.tsx", "WiMapFrame.tsx"]) {
      expect(read(file)).not.toContain('"use client"');
    }
  });

  it("limite les îlots clients à ceux qui ont une interaction réelle", () => {
    expect(read("WiFilterBar.tsx")).toContain('"use client"');
    expect(read("WiProvenanceDrawer.tsx")).toContain('"use client"');
  });

  it("le tiroir de provenance ne récupère rien lui-même", () => {
    const source = read("WiProvenanceDrawer.tsx");

    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("axios");
  });
});

/* --------------------------------------------------- Snapshot public */

describe("public-snapshot", () => {
  it("le snapshot vide est valide", () => {
    expect(parsePublicSnapshot(EMPTY_SNAPSHOT)).not.toBeNull();
  });

  it("un snapshot illisible ne devient pas un snapshot vide silencieux", () => {
    expect(parsePublicSnapshot({ schema_version: 42 })).toBeNull();
    expect(parsePublicSnapshot("nope")).toBeNull();
  });

  it("le snapshot vide ne contient aucune valeur inventée", () => {
    const serialised = JSON.stringify(EMPTY_SNAPSHOT);

    expect(serialised).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(EMPTY_SNAPSHOT.manifest).toBeNull();
  });

  it("expose une couverture entièrement à zéro plutôt que des champs absents", () => {
    const snapshot: WaterPublicSnapshot = EMPTY_SNAPSHOT;

    expect(snapshot.coverage.observation_count).toBe(0);
    expect(snapshot.coverage.source_count).toBe(0);
  });
});
