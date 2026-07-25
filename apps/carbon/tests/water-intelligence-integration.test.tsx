/**
 * water-intelligence-integration.test.tsx — intégration de la page publique
 * (Wave C, C6).
 *
 * Vérifie que la page rend correctement l'état RÉEL du produit : aucune source
 * autorisée, donc aucune couche, aucune carte, aucun contenu éditorial — et
 * que cet état est rendu honnêtement plutôt que masqué.
 *
 * Complète (sans remplacer) `water-intelligence-public-shell.test.tsx`, qui
 * reste le garde-fou P04B sur les valeurs de fixture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WaterIntelligencePage from "@/app/water-intelligence/page";

const markup = renderToStaticMarkup(<WaterIntelligencePage />);
const visible = markup.replace(/<[^>]+>/g, " ");

const PAGE_SOURCE = readFileSync(
  join(process.cwd(), "app", "water-intelligence", "page.tsx"),
  "utf8",
);

describe("ancres", () => {
  it("conserve les huit ancres historiques", () => {
    for (const anchor of [
      "vue-ensemble",
      "risques",
      "carte",
      "sources",
      "secteurs",
      "reglementation",
      "synergies",
      "limites",
    ]) {
      expect(markup).toContain(`id="${anchor}"`);
    }
  });

  it("ajoute les deux ancres de la Wave C", () => {
    expect(markup).toContain('id="evenements"');
    expect(markup).toContain('id="innovations"');
  });

  it("expose un lien de navigation vers chaque ancre nouvelle", () => {
    expect(markup).toContain('href="#evenements"');
    expect(markup).toContain('href="#innovations"');
  });
});

describe("état réel du produit — aucune couche publiée", () => {
  it("annonce l'absence de couche publiée", () => {
    expect(visible).toContain("Aucune couche publiée");
  });

  it("ne rend aucune carte", () => {
    expect(markup).not.toContain("<svg");
  });

  it("explique pourquoi la carte n'est pas affichée", () => {
    expect(visible).toContain("couverture nulle");
  });

  it("rend l'état de la donnée sans produire de score", () => {
    expect(visible).toContain("État de la donnée");
    expect(visible).toContain("ne produit aucun score");
  });

  it("annonce que le gate exige une décision humaine", () => {
    expect(visible).toContain("décision humaine");
  });
});

describe("contenus éditoriaux", () => {
  it("rend un état vide honnête pour les événements et les innovations", () => {
    expect(visible).toContain("Aucun contenu publié");
    expect(visible).toContain("réviseur identifié");
  });

  it("n'invente aucune date dans les sections éditoriales vides", () => {
    const editorialBlock = markup.slice(
      markup.indexOf('id="evenements"'),
      markup.indexOf('id="reglementation"'),
    );

    expect(editorialBlock).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("previews Wave D", () => {
  it("rend les deux aperçus", () => {
    expect(visible).toContain("Cockpit de conformité");
    expect(visible).toContain("Passerelle financière");
  });

  it("les étiquette comme aperçus non fonctionnels", () => {
    expect(visible).toContain("Aperçu");
    expect(visible).toContain("P13");
    expect(visible).toContain("P15");
  });
});

describe("garde-fous de la surface publique", () => {
  it("ne réintroduit aucune valeur fabriquée", () => {
    expect(visible).not.toMatch(/\b42\b/);
    expect(visible).not.toMatch(/[0-9a-f]{16,}/);
  });

  it("ne rend aucune donnée tenant", () => {
    for (const field of ["company_id", "tenant_id", "site_id", "user_id"]) {
      expect(markup).not.toContain(field);
    }
  });

  it("reste distincte du cockpit et y renvoie explicitement", () => {
    expect(markup).toContain('href="/water"');
    expect(visible).toContain("authentifié");
  });

  it("n'introduit aucun composant client dans la page elle-même", () => {
    // La DIRECTIVE, pas la mention : la docstring de la page explique
    // précisément qu'elle n'en contient aucune.
    expect(PAGE_SOURCE).not.toMatch(/^\s*["']use client["']\s*;?\s*$/m);
  });

  it("ne déclenche aucun appel réseau au rendu", () => {
    expect(PAGE_SOURCE).not.toContain("fetch(");
    expect(PAGE_SOURCE).not.toMatch(/https?:\/\/(?!\/)/);
  });
});
