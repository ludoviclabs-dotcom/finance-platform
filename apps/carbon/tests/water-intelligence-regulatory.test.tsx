/**
 * tests/water-intelligence-regulatory.test.tsx — registre juridique P13
 * (Wave D, commit D1).
 *
 * Deux niveaux :
 *  1. le MIROIR (`lib/water-intelligence/regulatory-registry.ts`) est à l'octet
 *     près le document canonique émis par le backend ;
 *  2. la SURFACE (`components/water-intelligence/WiRegulatory.tsx`) rend ce
 *     registre honnêtement — aucune date écrite dans le JSX, aucune conclusion
 *     rendue tant qu'aucun texte n'est instruit.
 *
 * Pas de @testing-library : rendu serveur via `renderToStaticMarkup`, comme le
 * reste de la suite Water Intelligence.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WiRegulatoryRegistry } from "@/components/water-intelligence/WiRegulatory";
import {
  MISSING_FIELD_LABELS,
  OUTCOME_LABELS,
  REGULATORY_REGISTRY,
  WiRegulatoryRegistrySchema,
  groupedRules,
  registryIsUnverified,
} from "@/lib/water-intelligence/regulatory-registry";

const CARBON_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(CARBON_ROOT, "../..");
const CANONICAL = resolve(
  REPO_ROOT,
  "docs/carbonco/water-intelligence/contracts/REGULATORY_REGISTRY.json",
);
const MIRROR = resolve(CARBON_ROOT, "lib/water-intelligence/regulatory-registry.json");
const COMPONENT = resolve(CARBON_ROOT, "components/water-intelligence/WiRegulatory.tsx");

const markup = renderToStaticMarkup(<WiRegulatoryRegistry />);

/**
 * Texte visible : balises retirées ET entités HTML décodées.
 *
 * Le décodage est nécessaire : `renderToStaticMarkup` échappe les apostrophes
 * en `&#x27;`, si bien qu'une comparaison brute échouerait sur des titres
 * pourtant correctement rendus.
 */
const visible = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&");

/* ------------------------------------------------------------ Le miroir */

describe("miroir du registre juridique", () => {
  it("est identique, à l'octet près, au document canonique", () => {
    expect(readFileSync(MIRROR, "utf-8")).toBe(readFileSync(CANONICAL, "utf-8"));
  });

  it("respecte le schéma", () => {
    expect(() =>
      WiRegulatoryRegistrySchema.parse(JSON.parse(readFileSync(MIRROR, "utf-8"))),
    ).not.toThrow();
  });

  it("ne contient aucune donnée tenant", () => {
    const raw = readFileSync(MIRROR, "utf-8");
    for (const forbidden of ["company_id", "tenant_id", "site_id", "user_id"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("sépare le droit contraignant des référentiels volontaires", () => {
    const { binding, voluntary } = groupedRules();
    expect(binding.length).toBeGreaterThan(0);
    expect(voluntary.length).toBeGreaterThan(0);
    expect(voluntary.every((rule) => rule.instrument_kind === "voluntary_framework")).toBe(
      true,
    );
    expect(binding.every((rule) => rule.instrument_kind !== "voluntary_framework")).toBe(
      true,
    );
  });

  it("ne déclare aucune règle vérifiée aujourd'hui", () => {
    expect(REGULATORY_REGISTRY.verified_rule_count).toBe(0);
    expect(registryIsUnverified()).toBe(true);
    for (const rule of REGULATORY_REGISTRY.rules) {
      expect(rule.legal_status).toBe("unknown");
      expect(rule.public_legal_status).toBe("unknown");
      expect(rule.missing_fields).toContain("source");
      expect(rule.missing_fields).toContain("human_review");
    }
  });

  it("limite le vocabulaire des verdicts à quatre valeurs", () => {
    expect(Object.keys(OUTCOME_LABELS).sort()).toEqual([
      "conditional",
      "in_scope",
      "out_of_scope",
      "unknown",
    ]);
  });
});

/* ----------------------------------------------------------- La surface */

describe("surface P13", () => {
  it("annonce qu'aucun texte n'est instruit", () => {
    expect(visible).toContain("Aucun texte instruit");
    expect(visible).toContain("aucune conclusion rendue");
  });

  it("affiche la version du registre", () => {
    expect(markup).toContain(REGULATORY_REGISTRY.registry_version);
  });

  it("rend chaque règle du registre", () => {
    for (const rule of REGULATORY_REGISTRY.rules) {
      expect(markup).toContain(rule.rule_id);
      expect(visible).toContain(rule.title);
    }
  });

  it("nomme, pour chaque règle, les champs manquants", () => {
    expect(visible).toContain(MISSING_FIELD_LABELS.source);
    expect(visible).toContain(MISSING_FIELD_LABELS.human_review);
  });

  it("marque les référentiels volontaires comme non contraignants", () => {
    expect(visible).toContain("n’oblige personne");
    expect(visible).toContain("ne sont pas du droit");
  });

  it("ne rend aucun statut juridique affirmatif", () => {
    // Aucune règle n'étant instruite, aucune affirmation d'état du droit ne
    // doit apparaître — seul le vocabulaire du moteur est listé.
    expect(visible).not.toContain("En vigueur depuis");
    expect(visible).not.toContain("Obligatoire");
    expect(visible).not.toContain("Vous êtes soumis");
  });

  it("ne présente jamais le registre comme un conseil juridique", () => {
    expect(visible).toContain("jamais un conseil juridique");
  });
});

/* ------------------------------------------- Discipline du code source */

describe("discipline du composant P13", () => {
  const source = readFileSync(COMPONENT, "utf-8");

  it("n'écrit aucune date dans le JSX", () => {
    // La consigne du MACRO-PROMPT D est explicite : « registre versionné, pas
    // de dates dans JSX ». Une échéance figée dans un composant survit à la
    // mise à jour du texte.
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(withoutComments).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(withoutComments).not.toMatch(/\b(19|20)\d{2}\b/);
  });

  it("n'effectue aucun appel réseau", () => {
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(withoutComments).not.toContain("fetch(");
    expect(withoutComments).not.toContain("useEffect");
  });

  it("reste un Server Component", () => {
    expect(source).not.toContain('"use client"');
  });

  it("n'utilise ni token --mx-* ni couleur Tailwind brute", () => {
    expect(source).not.toMatch(/var\(\s*--mx-/);
    expect(source).not.toMatch(/\b(zinc|emerald|amber|rose|slate|sky)-\d{2,3}\b/);
  });
});
