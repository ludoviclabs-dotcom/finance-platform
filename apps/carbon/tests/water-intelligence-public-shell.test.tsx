/**
 * water-intelligence-public-shell.test.tsx — shell public Water Intelligence (P04).
 *
 * Vérifie les garanties structurelles de la route publique `/water-intelligence` :
 * elle existe, elle est rendue côté serveur, elle annonce explicitement son
 * statut de démonstration, elle ne présente aucun chiffre comme réel, elle
 * n'appelle aucune source externe, et elle n'altère pas le cockpit authentifié
 * `/water`.
 *
 * Rendu par `renderToStaticMarkup` (pas de @testing-library dans ce dépôt) :
 * la page est un Server Component synchrone, sans hook ni état.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { renderToStaticMarkup } from "react-dom/server";

import WaterIntelligencePage, { metadata } from "@/app/water-intelligence/page";

const CARBON_ROOT = resolve(__dirname, "..");
const PUBLIC_PAGE = resolve(CARBON_ROOT, "app/water-intelligence/page.tsx");
const COCKPIT_PAGE = resolve(CARBON_ROOT, "app/(app)/water/page.tsx");
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

describe("route publique /water-intelligence", () => {
  it("existe et rend un document non vide", () => {
    expect(markup.length).toBeGreaterThan(1000);
    expect(markup).toContain("Water Intelligence");
  });

  it("est hors du groupe authentifié (app)", () => {
    // Le chemin du fichier détermine l'URL : app/water-intelligence/ est
    // public, app/(app)/... est protégé par la garde du layout de groupe.
    expect(PUBLIC_PAGE).not.toContain(`${"("}app${")"}`);
  });

  it("expose une metadata complète et honnête", () => {
    expect(metadata.title).toBeTruthy();
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe("/water-intelligence");
    expect(metadata.openGraph).toBeTruthy();
    // La metadata ne doit rien promettre que la page ne livre pas.
    const meta = `${metadata.title} ${metadata.description}`.toLowerCase();
    expect(meta).toContain("construction");
  });
});

describe("statut de démonstration explicite", () => {
  it("annonce en toutes lettres qu'aucune donnée réelle n'est affichée", () => {
    expect(markup).toContain("Aucune donnée réelle");
    expect(markup).toContain("Démonstration");
    expect(markup).toContain("Module en construction");
  });

  it("marque la fixture par du TEXTE, pas seulement par une couleur", () => {
    // Chaque marqueur visuel est doublé d'un libellé lisible et vocalisable.
    expect(markup).toContain("Sources non branchées");
    expect(markup).toContain("Non branché");
    expect(markup).toContain("Donnée absente");
  });

  it("affiche l'étiquette fixture du manifest et son statut de donnée", () => {
    expect(markup).toContain("fixture");
  });
});

describe("aucune valeur fabriquée n'est visible (P04B)", () => {
  /*
   * P04B : la page n'affiche plus AUCUNE valeur issue de la fixture — ni la
   * mesure, ni la date de récupération, ni l'empreinte. Un chiffre inventé,
   * même sous un badge « Démonstration », est lu comme une mesure avant
   * d'être lu comme une démonstration.
   *
   * Ces attentes sont dérivées de la fixture elle-même, pas codées en dur :
   * si quelqu'un change la fixture ET la réaffiche, le test échoue quand même.
   */
  const fixture = JSON.parse(
    read(resolve(CARBON_ROOT, "lib/water-intelligence/fixture-manifest.json")),
  );

  /** Texte réellement visible : sans balises, donc sans styles ni attributs. */
  function visibleText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ");
  }

  const visible = visibleText(markup);

  it("n'affiche pas la valeur numérique de l'observation de fixture", () => {
    const fixtureValue = fixture.observations[0].value;
    expect(typeof fixtureValue).toBe("number");
    // Recherche en texte visible (pas dans les styles) et sur un mot entier.
    expect(visible).not.toMatch(new RegExp(`\\b${fixtureValue}\\b`));
  });

  it("n'affiche pas l'unité de fixture", () => {
    expect(visible).not.toContain(fixture.observations[0].unit);
  });

  it("n'affiche ni date de récupération ni empreinte fabriquées", () => {
    const source = fixture.sources[0];
    const [y, m, d] = source.retrieved_at.slice(0, 10).split("-");
    expect(visible).not.toContain(`${d}.${m}.${y}`);
    expect(visible).not.toContain(source.checksum_sha256.slice(0, 16));
  });

  it("rend un libellé honnête à la place de chaque valeur retirée", () => {
    expect(markup).toContain("n.c.");
    expect(markup).toContain("Aucune valeur n&#x27;est affichée");
    expect(markup).toContain("À venir avec la première release WRI Aqueduct");
    expect(markup).toContain("Aucune récupération réelle à ce jour");
  });

  it("conserve la structure de l'observation (champs, sans valeurs)", () => {
    // Les libellés de champ restent visibles : ils montrent ce que la
    // provenance contiendra, sans rien fabriquer.
    for (const label of ["Indicateur", "Valeur", "Unité", "Statut", "Méthode", "Territoire"]) {
      expect(markup).toContain(label);
    }
  });

  it("distingue donnée absente et zéro", () => {
    expect(markup).toContain("Donnée absente");
    // Aucun « 0 » ne doit servir de substitut à une donnée manquante : le
    // libellé d'absence est textuel, jamais numérique.
    expect(markup).not.toContain("Donnée absente</span>0");
  });

  it("ne revendique aucun score hydrique composite", () => {
    expect(markup).toContain("Aucun score unique opaque");
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

  it("lie explicitement vers le cockpit authentifié /water", () => {
    expect(markup).toContain('href="/water"');
    expect(markup).toContain("authentifié");
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
    read(resolve(WI_COMPONENTS_DIR, "WiSnapshotBanner.tsx")),
  ].map(stripCommentsAndStrings);

  it("n'effectue aucun fetch au rendu", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\baxios\b/);
      expect(source).not.toMatch(/XMLHttpRequest/);
    }
  });

  it("ne référence aucune URL externe dans le markup rendu", () => {
    // Seules des URL internes (/water, /materials, /, #ancre) sont permises.
    const externalHrefs = [...markup.matchAll(/href="(https?:)?\/\/[^"]*"/g)];
    expect(externalHrefs).toEqual([]);
    const externalSrcs = [...markup.matchAll(/src="(https?:)?\/\/[^"]*"/g)];
    expect(externalSrcs).toEqual([]);
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

describe("le cockpit authentifié /water reste intact", () => {
  it("conserve sa page dans le groupe (app)", () => {
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
