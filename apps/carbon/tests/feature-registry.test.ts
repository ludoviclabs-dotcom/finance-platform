/**
 * Feature Registry — test d'intégrité (T0.2 du PLAN_ACTION_CARBONCO).
 *
 * Garantit que data/feature-status.json reste la source de vérité UNIQUE et
 * cohérente des statuts produit, et que les deux pages canoniques de statut
 * (/etat-du-produit, /couverture) la consomment au lieu de coder les statuts
 * en dur.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, join } from "path";

import registry from "../data/feature-status.json";
import {
  allFeatures,
  esrsRows,
  allIntegrations,
  featuresByStatus,
  esrsCounts,
  integrationsBySection,
  lastUpdate,
} from "../lib/feature-registry";

const ROOT = resolve(__dirname, "..");
const FEATURE_STATUSES = ["live", "beta", "planifie"];
const INTEGRATION_STATUSES = ["live", "beta", "planifie", "roadmap"];
const INTEGRATION_SECTIONS = ["disponible", "imports-fichiers", "roadmap"];

describe("Feature registry — intégrité du JSON", () => {
  it("derniere_maj est une date ISO valide (YYYY-MM-DD)", () => {
    expect(registry.derniere_maj).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(registry.derniere_maj))).toBe(false);
    expect(lastUpdate()).toBe(registry.derniere_maj);
  });

  it("les ids de features sont uniques", () => {
    const ids = allFeatures().map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque feature a un statut valide", () => {
    for (const f of allFeatures()) {
      expect(FEATURE_STATUSES, `feature ${f.id}`).toContain(f.statut);
    }
  });

  it("toute feature 'live' cite une preuve (chemin repo)", () => {
    for (const f of featuresByStatus("live")) {
      expect(f.preuve, `feature live ${f.id} sans preuve`).toBeTruthy();
    }
  });

  it("les ids ESRS sont uniques et ont un statut valide", () => {
    const ids = esrsRows().map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of esrsRows()) {
      expect(FEATURE_STATUSES, `esrs ${r.id}`).toContain(r.statut);
    }
  });

  it("les ids d'intégrations sont uniques, avec statut + section valides", () => {
    const ids = allIntegrations().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of allIntegrations()) {
      expect(INTEGRATION_STATUSES, `integ ${i.id} statut`).toContain(i.statut);
      expect(INTEGRATION_SECTIONS, `integ ${i.id} section`).toContain(i.section);
    }
  });

  it("toute intégration 'live' cite une preuve", () => {
    for (const i of allIntegrations().filter((x) => x.statut === "live")) {
      expect(i.preuve, `integ live ${i.id} sans preuve`).toBeTruthy();
    }
  });

  it("aucune intégration ERP/Énergie/Compta OAuth n'est affichée 'live'", () => {
    // Garde-fou T0.4 : seul l'import Excel (et l'API REST en beta) peut être
    // disponible. Tout connecteur OAuth tiers livré serait un claim faux.
    const liveConnectors = allIntegrations().filter(
      (i) => i.statut === "live" && ["ERP", "Énergie"].includes(i.category),
    );
    expect(liveConnectors).toEqual([]);
  });

  it("les helpers de comptage sont cohérents avec le JSON", () => {
    const counts = esrsCounts();
    expect(counts.live + counts.beta + counts.planifie).toBe(esrsRows().length);
    const sections = integrationsBySection();
    const total =
      sections.disponible.length +
      sections["imports-fichiers"].length +
      sections.roadmap.length;
    expect(total).toBe(allIntegrations().length);
  });
});

describe("Feature registry — les pages de statut consomment le registre", () => {
  const cases: { path: string; mustImport: string; mustNotContain: RegExp }[] = [
    {
      path: "app/etat-du-produit/page.tsx",
      mustImport: "feature-registry",
      // Plus de tableau de features codé en dur : on ne doit plus voir un objet
      // feature inline (clé `tag:` ou liste `features: [`).
      mustNotContain: /features:\s*\[/,
    },
    {
      path: "app/couverture/page.tsx",
      mustImport: "feature-registry",
      // L'ancien tableau ESRS_COVERAGE ne doit plus exister.
      mustNotContain: /ESRS_COVERAGE/,
    },
  ];

  for (const { path: relPath, mustImport, mustNotContain } of cases) {
    it(`${relPath} importe le registre et ne code aucun statut en dur`, () => {
      const content = readFileSync(join(ROOT, relPath), "utf8");
      expect(content).toContain(mustImport);
      expect(mustNotContain.test(content)).toBe(false);
    });
  }
});
