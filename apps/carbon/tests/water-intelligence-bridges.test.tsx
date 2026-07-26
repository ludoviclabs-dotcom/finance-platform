/**
 * tests/water-intelligence-bridges.test.tsx — ponts CarbonCo sur la surface
 * publique (P14, Wave D, commit D2).
 *
 * L'enjeu tenu ici : la page publique ne doit émettre AUCUN lien porteur d'un
 * identifiant d'entreprise, de site ou d'utilisateur. Le registre backend le
 * refuse à la construction ; ce test vérifie que la surface hérite bien de ce
 * refus au lieu de réintroduire des liens écrits à la main.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WiModuleBridges } from "@/components/water-intelligence/WiBridges";
import {
  MODULE_BRIDGES,
  WiModuleBridgeDocumentSchema,
} from "@/lib/water-intelligence/module-bridges";

const CARBON_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(CARBON_ROOT, "../..");
const CANONICAL = resolve(
  REPO_ROOT,
  "docs/carbonco/water-intelligence/contracts/MODULE_BRIDGES.json",
);
const MIRROR = resolve(CARBON_ROOT, "lib/water-intelligence/module-bridges.json");
const COMPONENT = resolve(CARBON_ROOT, "components/water-intelligence/WiBridges.tsx");

const markup = renderToStaticMarkup(<WiModuleBridges />);

/** Balisage avec entités décodées — `renderToStaticMarkup` échappe les
 *  apostrophes en `&#x27;`, ce qui ferait échouer une comparaison brute. */
const decoded = markup
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&");

describe("miroir des ponts", () => {
  it("est identique, à l'octet près, au document canonique", () => {
    expect(readFileSync(MIRROR, "utf-8")).toBe(readFileSync(CANONICAL, "utf-8"));
  });

  it("respecte le schéma", () => {
    expect(() =>
      WiModuleBridgeDocumentSchema.parse(JSON.parse(readFileSync(MIRROR, "utf-8"))),
    ).not.toThrow();
  });

  it("ne contient aucun champ tenant", () => {
    const raw = readFileSync(MIRROR, "utf-8");
    for (const forbidden of ["company_id", "tenant_id", "site_id", "user_id"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("déclare tous les modules attendus par le MACRO-PROMPT D", () => {
    const targets = MODULE_BRIDGES.bridges.map((bridge) => bridge.target_path);
    for (const expected of [
      "/water/cockpit",
      "/sites-geo",
      "/resources/exposures",
      "/materials",
      "/iro",
      "/materialite",
      "/scopes",
      "/fournisseurs/scope3",
      "/actions",
    ]) {
      expect(targets).toContain(expected);
    }
  });
});

describe("liens rendus", () => {
  it("ne rend que des chemins nus", () => {
    const hrefs = [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs.length).toBe(MODULE_BRIDGES.bridges.length);
    for (const href of hrefs) {
      expect(href.startsWith("/")).toBe(true);
      expect(href).not.toContain("?");
      expect(href).not.toContain("#");
    }
  });

  it("n'émet aucun identifiant tenant dans le balisage", () => {
    for (const forbidden of ["company_id", "tenant_id", "site_id", "user_id"]) {
      expect(markup).not.toContain(forbidden);
    }
  });

  it("distingue les cibles authentifiées de la surface publique", () => {
    expect(markup).toContain("Accès authentifié");
    expect(markup).toContain("Surface publique");
  });

  it("nomme le signal hydrique de chaque pont", () => {
    for (const bridge of MODULE_BRIDGES.bridges) {
      expect(decoded).toContain(bridge.water_signal);
    }
  });

  it("ne saute aucun niveau de titre (enfant direct du h2 de section)", () => {
    expect(markup).toContain("<h3");
    expect(markup).not.toContain("<h4");
  });
});

describe("discipline du composant", () => {
  const source = readFileSync(COMPONENT, "utf-8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("n'écrit aucune cible en dur", () => {
    // Toute cible vient du registre : un chemin littéral dans le JSX pourrait
    // un jour recevoir un paramètre et faire fuiter du tenant.
    expect(code).not.toMatch(/href="\/[a-z]/);
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
