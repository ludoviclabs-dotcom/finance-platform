/**
 * Demo dataset — cohérence du jeu démo UNIQUE (T0.5 du PLAN_ACTION_CARBONCO).
 *
 * Vérifie les invariants du fichier de vérité (sommes), l'étiquetage « fictif »,
 * et l'absence de chiffres démo contradictoires / d'accents manquants sur les
 * surfaces de démonstration.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, join } from "path";

import demo from "../data/demo-dataset.json";
import { demoTotal, demoScopeAnswer } from "../lib/demo-data";

const ROOT = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("Demo dataset — invariants du jeu unique", () => {
  it("Σ scopes.tco2e = total_tco2e", () => {
    const sum = demo.scopes.reduce((a, s) => a + s.tco2e, 0);
    expect(sum).toBe(demo.total_tco2e);
  });

  it("Σ scopes.part_pct = 100", () => {
    const sum = demo.scopes.reduce((a, s) => a + s.part_pct, 0);
    expect(sum).toBe(100);
  });

  it("Σ postes.tco2e = total_tco2e", () => {
    const sum = demo.postes.reduce((a, p) => a + p.tco2e, 0);
    expect(sum).toBe(demo.total_tco2e);
  });

  it("Σ postes.part_pct = 100", () => {
    const sum = demo.postes.reduce((a, p) => a + p.part_pct, 0);
    expect(sum).toBe(100);
  });

  it("l'entreprise est explicitement fictive et étiquetée", () => {
    expect(demo.entreprise.fictif).toBe(true);
    expect(demo.entreprise.nom).toBe("Exemplia Industrie");
    expect(demo.etiquette.toLowerCase()).toContain("fictives");
  });

  it("le JSON ne contient ni « Acme » ni « Bilan Carbone »", () => {
    const raw = JSON.stringify(demo);
    expect(raw).not.toMatch(/Acme/);
    expect(raw).not.toMatch(/Bilan Carbone/);
  });

  it("le helper formate le total et construit une réponse copilote cohérente", () => {
    expect(demoTotal()).toBe("12 847");
    const answer = demoScopeAnswer();
    expect(answer).toContain("12 847");
    expect(answer).not.toContain("5 955");
  });
});

describe("Demo dataset — pas de chiffres démo contradictoires", () => {
  it("lib/data.ts est aligné (12 847, plus de 5 955)", () => {
    const src = read("lib/data.ts");
    expect(src).toContain("12 847");
    expect(src).not.toContain("5 955");
  });

  it("sector-mockups.tsx n'affiche plus 12 480", () => {
    const src = read("components/landing/sector-mockups.tsx");
    expect(src).not.toContain("12 480");
  });
});

describe("Demo dataset — typographie française (accents)", () => {
  // Tokens capitalisés / multi-mots qui ne doivent PAS apparaître sans accent
  // dans les libellés. Case-sensitive pour éviter les faux positifs sur les
  // identifiants en minuscules (ex. clé `numerique` du mockup).
  const FORBIDDEN = [
    "Energie",
    "Annee",
    "Repartition",
    "Reduction requise",
    "Methodologie certifiee",
    "Numerique",
    "Telecharger",
    "Priorite",
    "acces direct",
    "Pret a signer",
  ];
  const FILES = [
    "components/landing/mockup/premium-dashboard-mockup.tsx",
    "components/pages/landing-page.tsx",
  ];

  for (const file of FILES) {
    it(`${file} — libellés FR accentués`, () => {
      const src = read(file);
      const hits = FORBIDDEN.filter((t) => src.includes(t));
      expect(hits, `tokens sans accent: ${hits.join(", ")}`).toEqual([]);
    });
  }
});
