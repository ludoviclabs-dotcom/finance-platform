/**
 * water-intelligence-public-shell.test.tsx — shell public Water Intelligence (P04).
 *
 * Vérifie les garanties structurelles de la route publique `/water` : elle
 * existe, elle est rendue côté serveur, elle annonce explicitement son statut
 * de démonstration, elle ne présente aucun chiffre comme réel, elle n'appelle
 * aucune source externe, et elle n'altère pas le cockpit authentifié
 * `/water/cockpit`.
 *
 * La page répondait sur `/water-intelligence` avant la Phase A. Le
 * déplacement ne relâche aucune de ces garanties : ce sont les mêmes
 * assertions, sur la même page, à sa nouvelle URL.
 *
 * Rendu par `renderToStaticMarkup` (pas de @testing-library dans ce dépôt) :
 * la page est un Server Component synchrone, sans hook ni état.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { renderToStaticMarkup } from "react-dom/server";

import WaterIntelligencePage, { metadata } from "@/app/water/page";
import { PILOT_FILE } from "@/lib/water-intelligence/pilot-snapshot";

const CARBON_ROOT = resolve(__dirname, "..");
const PUBLIC_PAGE = resolve(CARBON_ROOT, "app/water/page.tsx");
const COCKPIT_PAGE = resolve(CARBON_ROOT, "app/water/(authenticated)/cockpit/page.tsx");
const WI_COMPONENTS_DIR = resolve(CARBON_ROOT, "components/water-intelligence");

const read = (path: string) => readFileSync(path, "utf-8");

/**
 * Retire commentaires et littéraux de chaîne avant les vérifications de code :
 * ces fichiers documentent délibérément en prose ce qu'ils NE font pas
 * (« aucun appel réseau »), et une recherche naïve confondrait la
 * documentation avec du code réel.
 */
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

const markup = renderToStaticMarkup(<WaterIntelligencePage />);
const pageSource = read(PUBLIC_PAGE);

describe("route publique /water", () => {
  it("existe et rend un document non vide", () => {
    expect(markup.length).toBeGreaterThan(1000);
    expect(markup).toContain("Water Intelligence");
  });

  it("est hors de tout groupe authentifié", () => {
    /*
      Le chemin du fichier détermine l'URL ET la garde. `app/water/page.tsx`
      est le VOISIN du groupe `app/water/(authenticated)`, pas son enfant : il
      ne traverse donc ni son layout ni sa garde. Un jour où quelqu'un
      déplacerait ce fichier d'un cran, dans le groupe, la page publique
      deviendrait silencieusement authentifiée — c'est ce que ce test refuse.
    */
    const path = PUBLIC_PAGE.replace(/\\/g, "/");
    expect(path).toContain("app/water/page.tsx");
    expect(path).not.toContain(`${"("}app${")"}`);
    expect(path).not.toContain(`${"("}authenticated${")"}`);
  });

  it("expose une metadata complète et honnête", () => {
    expect(metadata.title).toBeTruthy();
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe("/water");
    expect(metadata.openGraph).toBeTruthy();
    // La metadata ne doit rien promettre que la page ne livre pas.
    //
    // Elle annonçait « infrastructure opérationnelle » : exact tant que rien
    // n'était publié, et devenu insuffisant depuis qu'une publication pilote
    // est autorisée. Elle annonce désormais la PROPOSITION du module, et
    // nomme la limite du pilote dans la même phrase — un titre qui promet
    // « Water Intelligence » sans dire « périmètre limité » se lirait comme
    // une couverture générale.
    const meta = `${metadata.title} ${metadata.description}`.toLowerCase();
    expect(meta).not.toContain("construction");
    expect(meta).toContain("explicitement limité");
    expect(meta).toContain("pilote");
  });
});

/*
 * Wave E, commit E1 — les deux blocs qui vivaient ici (« statut de
 * démonstration explicite » et « aucune valeur fabriquée n'est visible ») ont
 * été REMPLACÉS, pas supprimés par confort.
 *
 * Ils assertaient que la page affiche le manifest de FIXTURE, son étiquette
 * `fixture`, la structure d'une observation et les libellés « n.c. » /
 * « Donnée absente ». C'était la bonne exigence tant que la page montrait une
 * fixture. Elle n'en montre plus aucune : la surface publique est désormais
 * dérivée du snapshot canonique et de l'état des sources, tous deux émis par
 * le backend.
 *
 * La couverture correspondante — et bien plus large — vit dans
 * `water-intelligence-truth.test.tsx`, qui vérifie les dix contrôles de
 * véracité de la Wave E. Ce qui suit ne garde ici que ce qui reste vrai et
 * n'a pas de meilleur foyer.
 */
describe("aucune valeur fabriquée n'atteint le lecteur", () => {
  it("ne rend aucun identifiant de fixture", () => {
    for (const marker of ["FIXTURE_SOURCE", "fixture-release-v1", "fixture.stress_index"]) {
      expect(markup).not.toContain(marker);
    }
  });

  it("ne revendique aucun score hydrique composite", () => {
    /* Le libellé « Aucun score unique opaque » vivait dans une carte de
       proposition supprimée par la refonte. L'énoncé est repris par Water
       Pulse, à l'endroit où les huit facettes sont introduites — c'est-à-dire
       là où la tentation d'agréger se présente. */
    const visible = markup
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;| /g, " ");
    expect(visible).toContain("ne produit aucun indice composite");
    expect(visible).toContain("contestable seule");
  });

  it("ne rend jamais une absence comme un zéro", () => {
    expect(markup).not.toContain("Donnée absente</span>0");
  });
});

describe("ancres et navigation", () => {
  const REQUIRED_ANCHORS = [
    "vue-ensemble",
    "risques",
    "carte",
    "sources",
    "secteurs",
    "reglementation",
    "synergies",
    "limites",
  ];

  it("rend les huit sections attendues avec leur ancre", () => {
    for (const anchor of REQUIRED_ANCHORS) {
      expect(markup).toContain(`id="${anchor}"`);
    }
  });

  it("rend un lien de navigation vers chaque ancre", () => {
    for (const anchor of REQUIRED_ANCHORS) {
      expect(markup).toContain(`href="#${anchor}"`);
    }
  });

  it("lie explicitement vers le cockpit authentifié /water/cockpit", () => {
    expect(markup).toContain('href="/water/cockpit"');
    expect(markup).toContain("authentifié");
  });

  it("ne se lie jamais à elle-même en croyant viser le cockpit", () => {
    /*
      `/water` est désormais CETTE page. Un lien nu vers `/water` présenté
      comme « le cockpit » renverrait le lecteur sur la vitrine qu'il est déjà
      en train de lire, sans erreur visible — exactement le genre de lien mort
      qu'un déplacement d'URL produit.
    */
    expect(markup).not.toMatch(/href="\/water"/);
  });
});

describe("accessibilité de base", () => {
  it("rend un seul <h1>", () => {
    const h1Count = (markup.match(/<h1[\s>]/g) ?? []).length;
    expect(h1Count).toBe(1);
  });

  it("rend une hiérarchie de titres sans saut (h1 puis h2 puis h3)", () => {
    const levels = [...markup.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      // Un niveau ne peut descendre que d'un cran à la fois.
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  it("rend les repères sémantiques principaux", () => {
    expect(markup).toContain("<main");
    expect(markup).toContain("<nav");
    expect(markup).toContain("<footer");
    expect(markup).toContain("<section");
  });

  it("nomme la navigation et les sections pour les lecteurs d'écran", () => {
    expect(markup).toContain('aria-label="Sections de la page"');
    expect(markup).toContain("aria-labelledby=");
  });

  it("fournit un lien d'évitement vers le contenu", () => {
    expect(markup).toContain('href="#contenu"');
    expect(markup).toContain('id="contenu"');
  });
});

describe("aucun appel réseau ni bailout CSR", () => {
  const sources = [
    pageSource,
    read(resolve(WI_COMPONENTS_DIR, "WiNav.tsx")),
    read(resolve(WI_COMPONENTS_DIR, "WiPrimitives.tsx")),
  ].map(stripCommentsAndStrings);

  it("n'effectue aucun fetch au rendu", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\baxios\b/);
      expect(source).not.toMatch(/XMLHttpRequest/);
    }
  });

  it("ne charge aucune ressource externe au rendu", () => {
    /* `src` est la seule des deux qui déclenche une requête du navigateur.
       Elle reste interdite sans exception : c'est elle qui ferait de `/water`
       une page appelant Hub'Eau chez le lecteur. */
    const externalSrcs = [...markup.matchAll(/src="(https?:)?\/\/[^"]*"/g)];
    expect(externalSrcs.map((m) => m[0])).toEqual([]);
    for (const tag of [/<script\b/, /<link\b[^>]*rel="(preconnect|dns-prefetch)"/]) {
      expect(markup).not.toMatch(tag);
    }
  });

  it("ne pointe vers l'extérieur que par les URL que le document PORTE", () => {
    /* Un `href` externe n'est pas un appel réseau — le navigateur ne va nulle
       part tant que personne ne clique. Il en faut d'ailleurs : la Phase F
       exige que l'URL officielle de la source soit affichée à côté de chaque
       valeur, c'est la voie de conformité à la condition de paternité de la
       Licence Ouverte 2.0.
     *
     * Le contrôle porte donc sur la PROVENANCE du lien, pas sur son existence :
     * chaque URL externe rendue doit se retrouver telle quelle dans le document
     * publié. Aucun domaine n'est autorisé en dur — tant que rien n'est publié,
     * l'ensemble permis est vide et le test redevient l'interdiction stricte
     * qu'il était. */
    const allowed = new Set<string>();
    const walk = (node: unknown): void => {
      if (typeof node === "string") {
        if (/^https?:\/\//.test(node)) allowed.add(node);
      } else if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node && typeof node === "object") {
        Object.values(node).forEach(walk);
      }
    };
    walk(PILOT_FILE);

    const externalHrefs = [...markup.matchAll(/href="((?:https?:)?\/\/[^"]*)"/g)].map(
      (m) => m[1],
    );
    const unexpected = externalHrefs.filter((href) => !allowed.has(href));
    expect(unexpected).toEqual([]);
  });

  it("reste un Server Component (aucun composant client dans l'arbre)", () => {
    for (const source of sources) {
      expect(source).not.toContain("use client");
      expect(source).not.toMatch(/\buseState\b/);
      expect(source).not.toMatch(/\buseEffect\b/);
      expect(source).not.toMatch(/\buseSearchParams\b/);
    }
  });
});

describe("la fixture locale ne diverge pas du manifest canonique", () => {
  /*
   * La page importe une COPIE du manifest canonique, parce que Turbopack
   * refuse de résoudre un module hors de la racine de l'application. Ce test
   * est la contrepartie de ce compromis : il lit le fichier canonique (celui
   * que valident aussi les contrats P02 côté Python) et vérifie que la copie
   * n'a pas dérivé. Sans lui, une divergence resterait invisible.
   */
  const CANONICAL = resolve(
    CARBON_ROOT,
    "../../docs/carbonco/water-intelligence/contracts/FIXTURE_MANIFEST.json",
  );
  const LOCAL_COPY = resolve(CARBON_ROOT, "lib/water-intelligence/fixture-manifest.json");

  it("reste identique au manifest canonique du dépôt", () => {
    const canonical = JSON.parse(read(CANONICAL));
    const local = JSON.parse(read(LOCAL_COPY));
    expect(local).toEqual(canonical);
  });

  it("est bien étiquetée comme fixture", () => {
    const local = JSON.parse(read(LOCAL_COPY));
    expect(local.fixture_label).toBe("fixture");
  });
});

describe("le cockpit authentifié /water/cockpit reste intact", () => {
  it("conserve sa page dans le groupe authentifié du domaine hydrique", () => {
    const cockpit = read(COCKPIT_PAGE);
    expect(cockpit.length).toBeGreaterThan(0);
    // Marqueurs historiques du cockpit — leur disparition signalerait un
    // remplacement accidentel par la surface publique.
    expect(cockpit).toContain("FeatureStatusBadge");
  });

  it("n'est jamais réimplémenté par la page publique", () => {
    const stripped = stripCommentsAndStrings(pageSource);
    expect(stripped).not.toContain("redirect");
    expect(stripped).not.toContain("rewrite");
  });
});
