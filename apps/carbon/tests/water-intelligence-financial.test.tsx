/**
 * tests/water-intelligence-financial.test.tsx — contrat du moteur de scénarios
 * financiers hydriques (P15, Wave D, commit D3).
 *
 * L'enjeu tenu ici : la surface publique décrit la MÉCANIQUE du moteur et
 * n'affiche AUCUN montant. Un chiffre d'exemple, même étiqueté, se lirait comme
 * un ordre de grandeur validé — la même erreur que les valeurs de fixture
 * retirées en P04B.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WiFinancialEngineContract } from "@/components/water-intelligence/WiFinancialEngine";
import {
  FINANCIAL_ENGINE,
  WiFinancialEngineSchema,
} from "@/lib/water-intelligence/financial-engine";

const CARBON_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(CARBON_ROOT, "../..");
const CANONICAL = resolve(
  REPO_ROOT,
  "docs/carbonco/water-intelligence/contracts/FINANCIAL_ENGINE.json",
);
const MIRROR = resolve(CARBON_ROOT, "lib/water-intelligence/financial-engine.json");
const COMPONENT = resolve(
  CARBON_ROOT,
  "components/water-intelligence/WiFinancialEngine.tsx",
);

const markup = renderToStaticMarkup(<WiFinancialEngineContract />);
const visible = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&");

describe("miroir du contrat moteur", () => {
  it("est identique, à l'octet près, au document canonique", () => {
    expect(readFileSync(MIRROR, "utf-8")).toBe(readFileSync(CANONICAL, "utf-8"));
  });

  it("respecte le schéma", () => {
    expect(() =>
      WiFinancialEngineSchema.parse(JSON.parse(readFileSync(MIRROR, "utf-8"))),
    ).not.toThrow();
  });

  it("rend le taux d'actualisation obligatoire", () => {
    const rate = FINANCIAL_ENGINE.parameters.find((p) => p.name === "discount_rate");
    expect(rate).toBeDefined();
    expect(rate?.required).toBe(true);
  });

  it("laisse la probabilité facultative et humaine", () => {
    const probability = FINANCIAL_ENGINE.parameters.find((p) => p.name === "probability");
    expect(probability).toBeDefined();
    expect(probability?.required).toBe(false);
    expect(probability?.description).toContain("humain");
  });

  it("déclare une unité connue pour chaque paramètre", () => {
    for (const parameter of FINANCIAL_ENGINE.parameters) {
      expect(["day", "ratio", "currency", "currency/day"]).toContain(parameter.unit);
    }
  });

  it("suit quatre inducteurs de sensibilité", () => {
    expect(FINANCIAL_ENGINE.sensitivity_drivers).toEqual([
      "outage_days",
      "revenue_per_day",
      "margin_rate",
      "discount_rate",
    ]);
  });
});

describe("surface P15", () => {
  it("annonce qu'aucun montant n'est affiché", () => {
    expect(visible).toContain("Aucun montant sur cette page");
  });

  it("n'affiche aucun montant ni symbole monétaire", () => {
    expect(visible).not.toMatch(/[€$]/);
    expect(visible).not.toMatch(/\d[\d\s.,]*\s*(k€|M€|EUR|USD)/i);
  });

  it("rend chaque paramètre du contrat", () => {
    for (const parameter of FINANCIAL_ENGINE.parameters) {
      expect(markup).toContain(parameter.name);
    }
  });

  it("rend les signaux comptables comme des questions", () => {
    for (const signal of FINANCIAL_ENGINE.accounting_signals) {
      expect(visible).toContain(signal.reference);
    }
    expect(visible).toContain("jamais des conclusions");
  });

  it("rend les refus du moteur", () => {
    for (const refusal of FINANCIAL_ENGINE.refusals) {
      expect(visible).toContain(refusal);
    }
  });

  it("affirme la sensibilité plutôt que la certitude", () => {
    expect(visible).toContain("Sensibilité plutôt que certitude");
    expect(visible).toContain("varié séparément");
  });

  it("ne saute aucun niveau de titre", () => {
    expect(markup).toContain("<h3");
    expect(markup).toContain("<h4");
    expect(markup).not.toContain("<h6");
  });
});

describe("discipline du composant", () => {
  const source = readFileSync(COMPONENT, "utf-8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("n'écrit aucun montant en dur", () => {
    expect(code).not.toMatch(/[€$]/);
  });

  it("reste un Server Component sans appel réseau", () => {
    expect(source).not.toContain('"use client"');
    expect(code).not.toContain("fetch(");
    expect(code).not.toContain("useEffect");
  });

  it("n'utilise ni token --mx-* ni couleur Tailwind brute", () => {
    expect(source).not.toMatch(/var\(\s*--mx-/);
    expect(source).not.toMatch(/\b(zinc|emerald|amber|rose|slate|sky)-\d{2,3}\b/);
  });
});
