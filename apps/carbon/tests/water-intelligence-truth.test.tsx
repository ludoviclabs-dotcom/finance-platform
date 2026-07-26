/**
 * tests/water-intelligence-truth.test.tsx — la page publique dit-elle la vérité
 * sur l'état du produit ? (P16, Wave E, commit E1).
 *
 * Ces tests ne vérifient pas une mise en forme : ils vérifient qu'aucune
 * affirmation périmée ni aucun artefact de développement n'atteint un lecteur
 * réel. Un texte faux sur une page publique est un défaut au même titre qu'un
 * calcul faux.
 *
 * Les dix contrôles exigés par la Wave E :
 *
 *  1. aucun identifiant de fixture dans le HTML public ;
 *  2. aucun texte « connecteur non créé / non branché » ;
 *  3. aucune étape P05-P13 déjà livrée présentée comme future ;
 *  4. WRI apparaît comme publication bloquée ;
 *  5. Copernicus apparaît comme décodage reporté ;
 *  6. EEA et Hub'Eau apparaissent comme décisions non rendues ;
 *  7. zéro observation publique ;
 *  8. aucune donnée tenant ;
 *  9. aucune fausse date ni empreinte ;
 * 10. metadata et footer cohérents avec l'état réel.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WaterIntelligencePage, { metadata } from "@/app/water/page";
import {
  CANONICAL_EMPTY_SNAPSHOT,
  SOURCE_STATUS,
  nothingIsPublishable,
} from "@/lib/water-intelligence/canonical-snapshot";

const CARBON_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(CARBON_ROOT, "../..");
const PAGE_SOURCE = readFileSync(
  resolve(CARBON_ROOT, "app/water/page.tsx"),
  "utf-8",
);

const markup = renderToStaticMarkup(<WaterIntelligencePage />);
const visible = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&");

/** Code de la page, commentaires et chaînes de docstring retirés : ces fichiers
 *  documentent en prose ce qu'ils NE font pas, et un grep naïf confondrait la
 *  documentation avec le code. */
const PAGE_CODE = PAGE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/* --------------------------------------------- 1. Aucune fixture publique */

describe("1 — aucun identifiant de fixture n'atteint le lecteur", () => {
  const FIXTURE_MARKERS = [
    "FIXTURE_SOURCE",
    "fixture-release-v1",
    "fixture.stress_index",
    "FIXTURE-METHOD",
    "fixture_label",
  ];

  it("ne rend aucun identifiant de fixture", () => {
    for (const marker of FIXTURE_MARKERS) {
      expect(markup).not.toContain(marker);
    }
  });

  it("n'importe plus le manifest de fixture", () => {
    expect(PAGE_CODE).not.toContain("FIXTURE_MANIFEST");
    expect(PAGE_CODE).not.toContain("fixture-manifest");
  });

  it("ne rend plus le mot « Démonstration » comme état de la page", () => {
    expect(visible).not.toContain("Démonstration");
    expect(visible).not.toContain("manifest de démonstration");
  });

  it("conserve néanmoins la fixture pour les contrats et les tests", () => {
    // La fixture n'est pas supprimée du dépôt : elle reste la référence de
    // parité entre les contrats Python et TypeScript.
    const canonical = resolve(
      REPO_ROOT,
      "docs/carbonco/water-intelligence/contracts/FIXTURE_MANIFEST.json",
    );
    expect(() => readFileSync(canonical, "utf-8")).not.toThrow();
  });
});

/* ------------------------------ 2/3. Aucune affirmation périmée */

describe("2 — aucun texte « connecteur non branché »", () => {
  it("n'affirme plus qu'aucun connecteur n'existe", () => {
    for (const claim of [
      "Aucun connecteur",
      "aucun connecteur",
      "non branché",
      "non branchés",
      "Sources non branchées",
    ]) {
      expect(visible).not.toContain(claim);
    }
  });

  it("ne se décrit plus comme un squelette ni un module en construction", () => {
    expect(visible).not.toContain("squelette");
    expect(visible).not.toContain("Module en construction");
    expect(visible).not.toContain("module en construction");
  });

  it("n'affirme plus qu'aucune licence n'est vérifiée", () => {
    expect(visible).not.toContain("aucune licence n'y est vérifiée");
    expect(visible).not.toContain("aucune licence n’est vérifiée");
  });
});

describe("3 — aucune étape déjà livrée présentée comme future", () => {
  it("ne présente plus P05 à P13 comme des prochaines étapes", () => {
    // Les codes de prompt n'ont plus leur place sur une surface publique une
    // fois les étapes livrées : ils décrivaient un plan, pas un produit.
    expect(visible).not.toMatch(/\bP0[5-9]\b/);
    expect(visible).not.toMatch(/\bP1[0-3]\b/);
  });

  it("décrit les prochaines étapes comme des décisions humaines", () => {
    expect(visible).toContain("décisions et des démarches humaines");
  });
});

/* --------------------------- 4/5/6. État réel de chaque source */

describe("4/5/6 — chaque source affiche son état réel", () => {
  it("WRI apparaît comme publication bloquée", () => {
    const wri = SOURCE_STATUS.sources.find((s) => s.source_code === "WRI_AQUEDUCT");
    expect(wri?.state).toBe("publication_blocked");
    expect(markup).toContain("WRI_AQUEDUCT");
    expect(visible).toContain("Publication bloquée");
  });

  it("Copernicus apparaît comme décodage reporté", () => {
    const edo = SOURCE_STATUS.sources.find((s) => s.source_code === "COPERNICUS_EDO");
    expect(edo?.state).toBe("decoder_deferred");
    expect(markup).toContain("COPERNICUS_EDO");
    expect(visible).toContain("Décodage reporté");
  });

  it("EEA et les quatre sources Hub'Eau attendent une décision humaine", () => {
    const pending = SOURCE_STATUS.sources.filter((s) => s.state === "decision_pending");
    expect(pending.map((s) => s.source_code).sort()).toEqual([
      "EEA_WEI_PLUS",
      "HUBEAU_ADES",
      "HUBEAU_BNPE_PRELEVEMENTS",
      "HUBEAU_HYDROMETRIE",
      "HUBEAU_QUALITE_SURFACE",
    ]);
    expect(visible).toContain("Décision humaine non rendue");
  });

  it("distingue licence vérifiée et publication autorisée", () => {
    expect(SOURCE_STATUS.license_verified_count).toBe(7);
    expect(SOURCE_STATUS.publishable_count).toBe(0);
    expect(visible).toContain("licence permissive autorise un usage");
  });

  it("affiche la granularité de la licence Hub'Eau (plateforme, pas jeu)", () => {
    const hubeau = SOURCE_STATUS.sources.find(
      (s) => s.source_code === "HUBEAU_HYDROMETRIE",
    );
    expect(hubeau?.license_scope).toBe("platform");
    expect(visible).toContain("vérifiée au niveau de la plateforme");
  });
});

/* ------------------------------------------- 7/8/9. Contenu retenu */

describe("7 — zéro observation publique", () => {
  it("le snapshot canonique est vide et le déclare", () => {
    expect(CANONICAL_EMPTY_SNAPSHOT.is_empty).toBe(true);
    expect(CANONICAL_EMPTY_SNAPSHOT.manifest).toBeNull();
    expect(CANONICAL_EMPTY_SNAPSHOT.coverage.observation_count).toBe(0);
    expect(CANONICAL_EMPTY_SNAPSHOT.coverage.layer_count).toBe(0);
    expect(nothingIsPublishable()).toBe(true);
  });

  it("porte les sept exclusions réelles avec leur motif", () => {
    expect(CANONICAL_EMPTY_SNAPSHOT.exclusions.length).toBe(7);
    for (const exclusion of CANONICAL_EMPTY_SNAPSHOT.exclusions) {
      expect(exclusion.detail.length).toBeGreaterThan(0);
    }
  });

  it("ne monte aucune carte faute de couche autorisée", () => {
    expect(markup).not.toContain("<svg");
    expect(visible).toContain("Carte prête — aucune couche autorisée à la publication");
  });
});

describe("8 — aucune donnée tenant", () => {
  it("n'émet aucun champ tenant", () => {
    for (const field of ["company_id", "tenant_id", "site_id", "organisation_id", "user_id"]) {
      expect(markup).not.toContain(field);
    }
  });

  it("ne déclenche aucun appel réseau au rendu", () => {
    expect(PAGE_CODE).not.toContain("fetch(");
    expect(PAGE_CODE).not.toMatch(/https?:\/\/(?!\/)/);
  });
});

describe("9 — aucune fausse date ni empreinte", () => {
  it("n'affiche aucune date d'assemblage inventée", () => {
    expect(CANONICAL_EMPTY_SNAPSHOT.generated_at).toBe("");
    expect(visible).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("n'affiche aucune empreinte fabriquée", () => {
    expect(visible).not.toMatch(/[0-9a-f]{16,}/);
  });

  it("ne réintroduit aucune valeur fabriquée", () => {
    expect(visible).not.toMatch(/\b42\b/);
  });
});

/* ------------------------------------------ 10. Metadata et footer */

describe("10 — metadata et footer cohérents avec l'état réel", () => {
  it("la metadata ne parle plus d'un module en construction", () => {
    const serialised = JSON.stringify(metadata);
    expect(serialised).not.toContain("en construction");
    expect(serialised).toContain("Infrastructure opérationnelle");
  });

  it("le footer décrit un module opérationnel en mode contrôlé", () => {
    expect(visible).toContain("Module opérationnel en mode contrôlé");
    expect(visible).toContain("décisions de publication ne sont pas signées");
  });

  it("le hero annonce l'infrastructure et la retenue des données", () => {
    expect(visible).toContain("Infrastructure opérationnelle");
    expect(visible).toContain("Données publiques en attente de validation");
    expect(visible).toContain("décision humaine de publication n'a pas été signée");
  });

  it("renvoie toujours vers le cockpit authentifié", () => {
    expect(markup).toContain('href="/water/cockpit"');
  });
});

/* --------------------------------------- Parité des documents émis */

describe("parité des documents canoniques", () => {
  const pairs = [
    ["docs/carbonco/water-intelligence/contracts/PUBLIC_SNAPSHOT_EMPTY.json",
     "lib/water-intelligence/public-snapshot-empty.json"],
    ["docs/carbonco/water-intelligence/contracts/SOURCE_STATUS.json",
     "lib/water-intelligence/source-status.json"],
  ] as const;

  it("les miroirs sont identiques à l'octet près", () => {
    for (const [canonical, mirror] of pairs) {
      expect(readFileSync(resolve(CARBON_ROOT, mirror), "utf-8")).toBe(
        readFileSync(resolve(REPO_ROOT, canonical), "utf-8"),
      );
    }
  });

  it("aucun document publié ne contient de champ tenant", () => {
    for (const [, mirror] of pairs) {
      const raw = readFileSync(resolve(CARBON_ROOT, mirror), "utf-8");
      for (const field of ["company_id", "tenant_id", "site_id", "user_id"]) {
        expect(raw).not.toContain(field);
      }
    }
  });
});
