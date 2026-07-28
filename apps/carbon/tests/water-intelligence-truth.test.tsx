/**
 * tests/water-intelligence-truth.test.tsx — la page publique dit-elle la vérité
 * sur l'état du produit ?
 *
 * Ces tests ne vérifient pas une mise en forme : ils vérifient qu'aucune
 * affirmation périmée ni aucun artefact de développement n'atteint un lecteur
 * réel. Un texte faux sur une page publique est un défaut au même titre
 * qu'un calcul faux.
 *
 * ## Ce qui a changé le 2026-07-28, et ce qui n'a pas changé
 *
 * Ce fichier vérifiait « zéro observation publique » et « aucune source
 * autorisée ». C'était exact jusqu'à la première décision humaine de
 * publication ; ça a cessé de l'être. Les contrôles portent désormais sur la
 * nouvelle vérité — **une** source autorisée, sur **un** périmètre — et sur ce
 * qui reste vrai quoi qu'il arrive :
 *
 * - aucun identifiant de fixture n'atteint le lecteur ;
 * - aucune donnée tenant ;
 * - aucune date, empreinte ou valeur fabriquée ;
 * - aucun score composite, aucun total, aucune moyenne ;
 * - chaque source affiche son état RÉEL et son motif propre ;
 * - le périmètre signé est affiché à côté de la mention « publié ».
 *
 * Le dernier point est le plus important de cette refonte : « publié » sans
 * son périmètre se lirait comme « toute la source est publiée ».
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WaterIntelligencePage, { metadata } from "@/app/water/page";
import { SOURCE_STATUS } from "@/lib/water-intelligence/canonical-snapshot";
import {
  PILOT_FILE,
  pilotIsPublished,
  pilotObservations,
} from "@/lib/water-intelligence/pilot-snapshot";

const CARBON_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(CARBON_ROOT, "../..");
const PAGE_SOURCE = readFileSync(resolve(CARBON_ROOT, "app/water/page.tsx"), "utf-8");

const markup = renderToStaticMarkup(<WaterIntelligencePage />);
const visible = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;| /g, " ");

/** Code de la page, commentaires retirés : ce fichier documente en prose ce
 *  qu'il NE fait pas, et un grep naïf confondrait la documentation avec le
 *  code. */
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

  it("n'importe pas le manifest de fixture", () => {
    expect(PAGE_CODE).not.toContain("FIXTURE_MANIFEST");
    expect(PAGE_CODE).not.toContain("fixture-manifest");
  });

  it("conserve néanmoins la fixture pour les contrats et les tests", () => {
    /* La fixture n'est pas supprimée du dépôt : elle reste la référence de
       parité entre les contrats Python et TypeScript. Elle n'atteint
       simplement plus le rendu public. */
    const canonical = resolve(
      REPO_ROOT,
      "docs/carbonco/water-intelligence/contracts/FIXTURE_MANIFEST.json",
    );
    expect(() => readFileSync(canonical, "utf-8")).not.toThrow();
  });
});

/* ------------------------------------------ 2. Aucun état périmé annoncé */

describe("2 — aucune affirmation périmée sur l'avancement", () => {
  const STALE = [
    "connecteur non créé",
    "non branché",
    "squelette",
    "en construction",
    "prochainement",
    "bientôt disponible",
  ];

  it.each(STALE)("ne contient pas « %s »", (phrase) => {
    expect(visible.toLowerCase()).not.toContain(phrase);
  });

  it("ne présente plus la publication comme entièrement en attente", () => {
    /* L'ancienne page annonçait « Données publiques en attente de validation
       humaine ». La validation a eu lieu — pour une source, sur un périmètre. */
    expect(visible).not.toContain("Données publiques en attente de validation");
  });
});

/* ------------------------------- 3. Les prochaines étapes sont humaines */

describe("3 — les prochaines étapes sont des décisions, pas des correctifs", () => {
  it("décrit ce qui reste dû comme des démarches humaines", () => {
    expect(visible).toContain("Ce qui reste dû");
    expect(visible).toContain("Deux démarches humaines, pas des réglages");
  });

  it("nomme le réviseur juridique manquant", () => {
    expect(visible).toContain("réviseur juridique");
  });
});

/* --------------------------- 4/5/6. Chaque source affiche son état réel */

describe("4/5/6 — chaque source affiche son état réel et son motif propre", () => {
  it("rend les sept sources", () => {
    for (const source of SOURCE_STATUS.sources) {
      expect(markup).toContain(source.source_code);
    }
    expect(SOURCE_STATUS.source_count).toBe(7);
  });

  it("affiche un libellé d'état DISTINCT par famille de blocage", () => {
    /* Sept sources qui afficheraient toutes « non branché » seraient exactes
       et inutiles : aucune n'échoue pour la même raison, et l'une publie. */
    for (const label of [
      "Publié — pilote limité",
      "Validé — reporté pour budget",
      "Collision d'identité sous-journalière",
      "Artefact manuel requis",
      "Enregistrement requis",
      "Décodage différé",
    ]) {
      expect(visible).toContain(label);
    }
  });

  it("distingue licence vérifiée et publication autorisée", () => {
    expect(SOURCE_STATUS.license_verified_count).toBe(7);
    expect(SOURCE_STATUS.publishable_count).toBe(1);
    /* Début de phrase : la comparaison est insensible à la casse plutôt que
       de dépendre d'un choix de rédaction. */
    expect(visible.toLowerCase()).toContain(
      "licences vérifiées, une publication autorisée",
    );
  });

  it("affiche la granularité de licence Hub'Eau (plateforme, pas jeu)", () => {
    const hubeau = SOURCE_STATUS.sources.filter((s) =>
      s.source_code.startsWith("HUBEAU_"),
    );
    expect(hubeau).toHaveLength(4);
    for (const source of hubeau) {
      expect(source.license_scope).toBe("platform");
    }
  });
});

/* ----------------------------- 7. Le périmètre voyage avec la publication */

describe("7 — « publié » n'est jamais affiché sans son périmètre", () => {
  it("nomme la commune et l'année à côté de la mention de publication", () => {
    expect(visible).toContain("34172");
    expect(visible).toContain("2020");
    expect(visible).toContain("Périmètre limité");
  });

  it("dit explicitement que tout autre périmètre exige une nouvelle décision", () => {
    expect(visible).toContain("exigeraient une nouvelle décision");
  });

  it("n'annonce que le nombre d'observations RÉELLEMENT publiées", () => {
    /* Le compteur est LU au document. Tant que le workflow de génération n'a
       pas tourné, il vaut zéro — et surtout pas trois. */
    const count = pilotObservations(PILOT_FILE).length;
    expect(count).toBe(pilotIsPublished(PILOT_FILE) ? 3 : 0);
    expect(markup).toContain(`data-testid="wi-hero-observations">${count}<`);
  });
});

/* ------------------------------------------------- 8. Aucune donnée tenant */

describe("8 — aucune donnée tenant n'atteint la surface publique", () => {
  const TENANT_FIELDS = [
    "company_id",
    "tenant_id",
    "site_id",
    "organisation_id",
    "user_id",
  ];

  it.each(TENANT_FIELDS)("ne rend aucun champ %s", (field) => {
    expect(markup).not.toContain(field);
  });

  it("ne porte aucun paramètre de requête dans ses liens", () => {
    /* Un lien écrit à la main peut recevoir un identifiant : `/water?site=…`
       le ferait transiter par l'historique et les journaux d'accès. */
    expect(markup).not.toMatch(/href="\/[a-z/-]*\?[a-z_]+=/i);
  });
});

/* ------------------------------------ 9. Aucune date ni empreinte fabriquée */

describe("9 — aucune valeur fabriquée", () => {
  it("n'affiche aucune date d'assemblage tant que le document n'est pas généré", () => {
    if (!pilotIsPublished(PILOT_FILE)) {
      expect(markup).toContain('data-testid="wi-hero-snapshot-date">non généré<');
    }
  });

  it("rend l'absence de cadence de rafraîchissement comme une absence", () => {
    /* La cadence BNPE n'a pas été relevée. Aucune n'est affichée, et le motif
       accompagne l'absence plutôt que de la laisser muette. */
    expect(visible).toContain("Non vérifiée. Aucune cadence n'est affichée");
  });

  it("rend l'absence de date de mise à jour de la source, avec sa raison", () => {
    expect(visible).toContain("Non relevée");
    expect(visible).toContain("voie de l'URL officielle");
  });

  it("ne produit aucun score composite", () => {
    for (const forbidden of ["score hydrique", "indice global", "note globale"]) {
      expect(visible.toLowerCase()).not.toContain(forbidden);
    }
    expect(visible).toContain("ne produit aucun indice composite");
  });

  it("ne produit ni total, ni moyenne, ni classement à partir des valeurs", () => {
    /* `derived_use_allowed = false` au registre des décisions : la page le
       tient, et le dit. */
    expect(visible).toContain("ni total, ni moyenne, ni classement, ni score");
  });
});

/* ------------------------------- 10. Metadata et footer cohérents au réel */

describe("10 — metadata et footer cohérents avec l'état réel", () => {
  it("la metadata annonce la proposition, pas un état de chantier", () => {
    const description = String(metadata.description);
    expect(description).toContain("Comprendre où l'entreprise dépend de l'eau");
    expect(description.toLowerCase()).not.toContain("en construction");
    expect(metadata.alternates?.canonical).toBe("/water");
  });

  it("la metadata nomme le caractère limité du pilote", () => {
    expect(String(metadata.description)).toContain("explicitement limité");
  });

  it("le footer dit que six sources restent non publiées", () => {
    expect(visible).toContain("Les six autres sources restent non publiées");
    expect(visible).toContain("aucune n'attend un correctif technique");
  });
});
