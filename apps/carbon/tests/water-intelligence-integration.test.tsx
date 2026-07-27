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

import WaterIntelligencePage from "@/app/water/page";

const markup = renderToStaticMarkup(<WaterIntelligencePage />);
const visible = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;| /g, " ");

const PAGE_SOURCE = readFileSync(
  join(process.cwd(), "app", "water", "page.tsx"),
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
    /* Le libellé a changé avec Territory Readiness : « Aucune couche publiée »
       décrivait un état de carte, « Couches géographiques différées » décrit
       une décision. L'invariant testé est le même — l'absence est nommée. */
    expect(visible).toContain("Couches géographiques différées");
  });

  it("ne rend aucune carte", () => {
    expect(markup).not.toContain("<svg");
  });

  it("explique pourquoi la carte n'est pas affichée", () => {
    expect(visible).toContain("couverture nulle");
  });

  it("rend l'état de la donnée sans produire de score", () => {
    /* Water Pulse remplace l'ancien bandeau « État de la donnée ». Il porte
       huit facettes tenues séparées, et dit lui-même qu'il n'agrège rien. */
    expect(visible).toContain("Water Pulse");
    expect(visible).toContain("ne produit aucun indice composite");
  });

  it("annonce que le gate exige une décision humaine", () => {
    expect(visible).toContain("décision humaine");
  });
});

describe("contenus éditoriaux", () => {
  it("rend un état vide honnête pour les événements", () => {
    /* La chronologie est vide, et l'explique plutôt que d'afficher un grand
       bloc hachuré : elle ÉNONCE les cinq éléments qu'un événement devra
       porter — une information réelle, et un critère vérifiable. */
    expect(visible).toContain("Aucun événement instruit");
    expect(visible).toContain("Ce qu'un événement devra porter pour apparaître ici");
    expect(visible).toContain("une date de revue humaine");
  });

  it("rend les innovations avec leurs contreparties, jamais leur seule promesse", () => {
    /* Les innovations, elles, ne sont PAS vides : neuf familles qualitatives,
       chacune portant son arbitrage. Aucune n'affiche de volume économisé. */
    expect(visible).toContain("Innovations et adaptation");
    expect(visible).toContain(
      "Chacune porte sa contrepartie au même niveau que son bénéfice",
    );
    expect(visible).not.toMatch(/\d+\s*(litres|m³|%)\s*(économisés|d'économie)/i);
  });

  it("n'invente aucune date dans les sections éditoriales vides", () => {
    const editorialBlock = markup.slice(
      markup.indexOf('id="evenements"'),
      markup.indexOf('id="reglementation"'),
    );

    expect(editorialBlock).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("Wave D — les deux previews sont remplacées", () => {
  /*
   * Commits D1 et D3 : les aperçus « Cockpit de conformité » et « Passerelle
   * financière » ont été REMPLACÉS par le registre juridique réel et le contrat
   * réel du moteur financier, conformément à la consigne « remplacer, pas
   * compléter ». Les assertions qui vérifiaient leur présence ont donc été
   * retirées en connaissance de cause et remplacées par celles du contenu réel.
   */
  it("rend le registre juridique réel en section Réglementation", () => {
    expect(visible).toContain("Registre juridique");
    expect(visible).toContain("Aucun texte instruit");
    expect(visible).toContain("Droit contraignant");
    expect(visible).toContain("Référentiels volontaires");
  });

  it("rend le contrat réel du moteur financier en section Synergies", () => {
    expect(visible).toContain("Passerelle financière");
    expect(visible).toContain("Aucun montant sur cette page");
    expect(visible).toContain("Sensibilité plutôt que certitude");
  });

  it("ne présente plus aucun de ces deux blocs comme un aperçu", () => {
    expect(visible).not.toContain("Cockpit de conformité");
    expect(visible).not.toContain("Aperçu — livré par");
  });

  it("rend les ponts vers les modules CarbonCo", () => {
    expect(visible).toContain("Cockpit Eau");
    expect(visible).toContain("chemins nus");
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
    expect(markup).toContain('href="/water/cockpit"');
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
