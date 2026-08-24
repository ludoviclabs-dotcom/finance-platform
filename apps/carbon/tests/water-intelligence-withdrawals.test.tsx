/**
 * tests/water-intelligence-withdrawals.test.tsx — Observed Withdrawals
 * (WI-V3-03).
 *
 * Ces tests ne vérifient pas une mise en page : ils vérifient qu'aucune
 * donnée dérivée interdite n'entre dans la section, aujourd'hui ni plus tard.
 *
 * Le garde-fou central est le dernier : **tout nombre affiché doit exister
 * dans le document canonique**. Un total, une moyenne, une part du total ou
 * un ratio produiraient un nombre qui ne s'y trouve pas — et échoueraient
 * ici, quel que soit le libellé sous lequel ils seraient présentés.
 *
 * Le garde-fou lexical le complète pour les dérivations qui, par accident
 * arithmétique, retomberaient sur une valeur existante : une médiane de trois
 * valeurs EST l'une des trois, et aucun contrôle numérique ne peut la voir.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { WiPilotData } from "@/components/water-intelligence/WiPilotData";
import {
  PILOT_FILE,
  pilotCoverageWarnings,
  pilotObservations,
  pilotScope,
  type PilotObservationRow,
} from "@/lib/water-intelligence/pilot-snapshot";

const CARBON_ROOT = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(CARBON_ROOT, path), "utf-8");

/** Le document canonique, brut : la référence de tout nombre affichable. */
const CANONICAL_RAW = read("lib/water-intelligence/public-snapshot-bnpe-v1.json");

const OBSERVATIONS = pilotObservations(PILOT_FILE);
const SCOPE = pilotScope(PILOT_FILE);

const PROPS = {
  observations: OBSERVATIONS,
  coverageWarnings: pilotCoverageWarnings(PILOT_FILE),
  scopeLabel: "commune 34172, année 2020",
  attribution: "Source : Hub'Eau — API Prélèvements en eau.",
  sourceUrl: "https://hubeau.eaufrance.fr/page/api-prelevements-eau",
  isPublished: true,
  reviewedOn: SCOPE.reviewedOn,
  sourceCode: SCOPE.sourceCode,
  licenseLabel: "ETALAB-2.0 — portée platform",
  methodLabel: "CC-WI-HUBEAU-BNPE-PASSTHROUGH · 1.0.0",
  yearLabel: "2020",
  notGeneratedExplanation: "Produit par un workflow de génération vérifié.",
} as const;

const markup = renderToStaticMarkup(<WiPilotData {...PROPS} />);

/**
 * Texte visible, séparateurs de milliers RECOLLÉS.
 *
 * `Intl.NumberFormat("fr-FR")` insère une espace fine insécable (U+202F) dans
 * « 217 865 ». Sans ce recollage, une extraction naïve verrait « 217 » et
 * « 865 » — deux nombres courts et anodins là où il y en a un seul, et le
 * contrôle de provenance ne vérifierait plus rien.
 */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/(\d)[  \s](?=\d)/g, "$1")
    .replace(/\s+/g, " ");
}

const visible = visibleText(markup);

/* ==========================================================================
   1 — Aucun nombre qui ne vienne du document
   ========================================================================== */

describe("aucune valeur affichée n'est dérivée", () => {
  it("chaque nombre d'au moins quatre chiffres existe dans le document canonique", () => {
    /* Quatre chiffres : en deçà, on attrape des numéros de version et des
       fragments d'empreinte, dont la présence fortuite ne prouve rien. Toute
       dérivation interdite sur ces volumes (somme, moyenne, part, ratio)
       produit un nombre bien plus long que quatre chiffres. */
    const rendered = visible.match(/\d{4,}/g) ?? [];
    expect(rendered.length).toBeGreaterThan(0);

    const canonicalDigits = CANONICAL_RAW.replace(/[^0-9]/g, "|");
    for (const value of rendered) {
      expect(
        canonicalDigits.includes(value),
        `nombre affiché absent du document canonique : ${value}`,
      ).toBe(true);
    }
  });

  it("n'affiche ni la somme, ni la moyenne des observations", () => {
    /* Contrôle négatif explicite : on CALCULE ici ce que la section n'a pas
       le droit de calculer, et on vérifie qu'il n'apparaît nulle part. */
    const values = OBSERVATIONS.map((o) => o.value).filter(
      (v): v is number => typeof v === "number",
    );
    expect(values.length).toBeGreaterThan(1);

    let sum = 0;
    for (const value of values) sum += value;
    const mean = Math.round(sum / values.length);

    const digitsOnly = visible.replace(/[^0-9]/g, "|");
    expect(digitsOnly.includes(String(sum)), `somme publiée : ${sum}`).toBe(false);
    expect(digitsOnly.includes(String(mean)), `moyenne publiée : ${mean}`).toBe(false);
  });

  it("n'affiche aucun pourcentage : une part du total supposerait un total", () => {
    expect(visible).not.toMatch(/\d\s*%/);
  });
});

/* ==========================================================================
   2 — Garde-fou lexical
   ========================================================================== */

describe("aucun libellé d'agrégat n'introduit un résultat", () => {
  /*
   * La section PARLE de totaux et de moyennes — pour dire qu'elle n'en produit
   * pas. Un grep sur le mot seul échouerait donc sur sa propre dénégation.
   * Le contrôle porte sur la FORME d'un résultat : un mot d'agrégat suivi,
   * à courte distance, d'un nombre.
   */
  const FORBIDDEN = [
    "total",
    "moyenne",
    "médiane",
    "mediane",
    "average",
    "ranking",
    "classement",
    "score",
    "part du total",
    "variation",
  ];

  it.each(FORBIDDEN)("ne présente jamais « %s » comme un résultat chiffré", (word) => {
    const asResult = new RegExp(
      `${word}[^.!?]{0,24}?[:=]\\s*[-+]?\\d`,
      "i",
    );
    expect(visible, `« ${word} » présenté comme un résultat`).not.toMatch(asResult);
  });

  it("n'emploie ces mots que sous forme de négation explicite", () => {
    /* « Aucun total », « aucune moyenne », « aucun classement » : chaque
       occurrence doit être niée. Si quelqu'un ajoute un jour « Total : » à
       cette section, ce test tombe en même temps que le précédent. */
    for (const word of ["total", "moyenne", "classement"]) {
      const occurrences = [...visible.matchAll(new RegExp(`\\S*\\s*\\S*\\s*${word}`, "gi"))];
      for (const [context] of occurrences) {
        expect(
          /aucun|aucune|ni |sans |interdit/i.test(context),
          `« ${word} » employé hors dénégation : « ${context} »`,
        ).toBe(true);
      }
    }
  });
});

/* ==========================================================================
   3 — Ordre déterministe, jamais un tri
   ========================================================================== */

describe("l'ordre d'affichage est celui du document", () => {
  it("rend les ouvrages dans l'ordre du document", () => {
    const rendered = [...markup.matchAll(/data-testid="wi-observation-([^"]+)"/g)].map((m) => m[1]);
    expect(rendered).toEqual(OBSERVATIONS.map((o) => o.ouvrageCode));
  });

  it("n'est PAS l'ordre décroissant des valeurs", () => {
    /* Preuve que rien n'est trié : la plus grande valeur ne tombe pas en
       tête. Si un jour le document lui-même arrivait trié, ce test devrait
       être relu — mais il échouerait bruyamment plutôt que de laisser un
       classement passer pour un ordre naturel. */
    const rendered = [...markup.matchAll(/data-testid="wi-observation-([^"]+)"/g)].map((m) => m[1]);
    const byDescendingValue = [...OBSERVATIONS]
      .filter((o) => typeof o.value === "number")
      .sort((a, b) => (b.value as number) - (a.value as number))
      .map((o) => o.ouvrageCode);
    expect(rendered).not.toEqual(byDescendingValue);
  });

  it("le composant ne trie ni ne réduit les observations", () => {
    const code = read("components/water-intelligence/WiPilotData.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.sort\s*\(/);
    expect(code).not.toMatch(/\.reduce\s*\(/);
  });
});

/* ==========================================================================
   4 — Une absence n'est jamais un zéro
   ========================================================================== */

describe("Data Availability State", () => {
  const absent: PilotObservationRow = {
    ...OBSERVATIONS[0],
    ouvrageCode: "OPR_SANS_VALEUR",
    value: null,
  };

  const withAbsent = renderToStaticMarkup(
    <WiPilotData {...PROPS} observations={[...OBSERVATIONS, absent]} />,
  );

  it("rend un état d'indisponibilité explicite plutôt qu'une valeur", () => {
    expect(withAbsent).toContain("Valeur non disponible");
  });

  it("ne dessine AUCUNE tige pour une valeur absente", () => {
    /* Une tige de longueur nulle se lirait « mesuré, et c'était zéro ». Il y
       a trois valeurs numériques et quatre observations : donc trois tiges. */
    const stems = (withAbsent.match(/wi-lolli-stem/g) ?? []).length;
    expect(stems).toBe(OBSERVATIONS.length);
  });

  it("rend « n.c. » et jamais 0 comme valeur", () => {
    const row = withAbsent.slice(withAbsent.indexOf("OPR_SANS_VALEUR"));
    const cell = row.slice(0, row.indexOf("</button>"));
    expect(cell).toContain("n.c.");
    expect(cell).not.toMatch(/wi-num">0</);
  });
});

/* ==========================================================================
   5 — L'axe commun est conditionnel
   ========================================================================== */

describe("baseline zéro commune, sous condition de commensurabilité", () => {
  it("dessine un axe commun quand unité, période et méthode coïncident", () => {
    expect(markup).toContain('data-testid="wi-pilot-axis"');
    expect(visible).toContain("Axe commun, origine zéro");
    expect(visible).toContain("ni un maximum communal, ni un total");
  });

  it("borne l'axe sur une valeur RÉELLE du document, pas sur un arrondi", () => {
    const values = OBSERVATIONS.map((o) => o.value).filter(
      (v): v is number => typeof v === "number",
    );
    const bound = Math.max(...values);
    expect(visible.replace(/[^0-9]/g, "|")).toContain(String(bound));
  });

  it("retire toute longueur si les unités diffèrent", () => {
    const mixed = renderToStaticMarkup(
      <WiPilotData
        {...PROPS}
        observations={[OBSERVATIONS[0], { ...OBSERVATIONS[1], unit: "l/s" }]}
      />,
    );
    expect(mixed).toContain('data-testid="wi-pilot-axis-absent"');
    expect(mixed).not.toContain("wi-lolli-stem");
    expect(visibleText(mixed)).toContain("les unités diffèrent");
  });

  it("retire toute longueur si les périodes diffèrent", () => {
    const mixed = renderToStaticMarkup(
      <WiPilotData
        {...PROPS}
        observations={[OBSERVATIONS[0], { ...OBSERVATIONS[1], periodStart: "2019-01-01" }]}
      />,
    );
    expect(mixed).toContain('data-testid="wi-pilot-axis-absent"');
    expect(mixed).not.toContain("wi-lolli-stem");
  });

  it("conserve les valeurs exactes même sans tracé", () => {
    const mixed = renderToStaticMarkup(
      <WiPilotData
        {...PROPS}
        observations={[OBSERVATIONS[0], { ...OBSERVATIONS[1], unit: "l/s" }]}
      />,
    );
    const text = visibleText(mixed).replace(/[^0-9]/g, "|");
    expect(text).toContain(String(OBSERVATIONS[0].value));
    expect(text).toContain(String(OBSERVATIONS[1].value));
  });
});

/* ==========================================================================
   6 — Chaque observation porte son identité complète
   ========================================================================== */

describe("chaque observation s'affiche explicitement", () => {
  it("porte ouvrage, valeur, unité, période et statut", () => {
    for (const observation of OBSERVATIONS) {
      expect(visible, `ouvrage manquant : ${observation.ouvrageCode}`).toContain(
        observation.ouvrageCode,
      );
      expect(visible.replace(/[^0-9]/g, "|")).toContain(String(observation.value));
    }
    expect(visible).toContain("m3");
    expect(visible).toContain("Déclaré");
    expect(visible).toContain("2020");
  });

  it("le nombre est rendu en texte, jamais porté par la seule longueur", () => {
    /* Retirer tout le tracé ne retirerait aucune information : les valeurs
       sont dans le texte. */
    const withoutPlot = markup.replace(/<span class="wi-lolli-track"[\s\S]*?<\/span><\/span>/g, "");
    const text = visibleText(withoutPlot).replace(/[^0-9]/g, "|");
    for (const observation of OBSERVATIONS) {
      expect(text).toContain(String(observation.value));
    }
  });

  it("n'expose jamais 64 caractères d'empreinte en continu", () => {
    for (const observation of OBSERVATIONS) {
      expect(markup, "empreinte complète rendue").not.toContain(observation.checksum);
    }
  });
});

/* ==========================================================================
   7 — Panneau d'inspection
   ========================================================================== */

async function mount(node: React.ReactElement): Promise<{ container: HTMLElement; root: Root }> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("inspection d'une observation", () => {
  it("est fermée au départ, et l'annonce", async () => {
    const m = await mount(<WiPilotData {...PROPS} />);
    const trigger = m.container.querySelector<HTMLButtonElement>(
      `[data-testid="wi-observation-${OBSERVATIONS[0].ouvrageCode}"]`,
    )!;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(m.container.querySelector('[data-testid="wi-observation-detail"]')).toBeNull();
    await act(async () => {
      m.root.unmount();
    });
  });

  it("ouvre un panneau portant toute la provenance de CETTE observation", async () => {
    const m = await mount(<WiPilotData {...PROPS} />);
    const observation = OBSERVATIONS[0];
    const trigger = m.container.querySelector<HTMLButtonElement>(
      `[data-testid="wi-observation-${observation.ouvrageCode}"]`,
    )!;
    await act(async () => {
      trigger.click();
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const panel = m.container.querySelector<HTMLElement>('[data-testid="wi-observation-detail"]')!;
    expect(panel).not.toBeNull();
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);

    const text = panel.textContent ?? "";
    for (const label of [
      "Observation",
      "Source",
      "Géographie",
      "Période observée",
      "Date de consultation",
      "Méthode",
      "Statut de qualité",
      "Clé de release",
      "Empreinte du payload",
      "Décision de publication",
    ]) {
      expect(text, `champ d'inspection manquant : ${label}`).toContain(label);
    }

    expect(text).toContain(observation.releaseKey);
    expect(text).toContain(observation.methodCode);
    expect(text).toContain(observation.retrievedAt);
    expect(text).toContain(SCOPE.sourceCode);

    // Empreinte abrégée à l'écran, jamais les 64 caractères.
    expect(text).toContain(observation.checksum.slice(0, 12));
    expect(text).not.toContain(observation.checksum);

    // …mais copiable en entier.
    expect(panel.querySelector("button")?.getAttribute("aria-label")).toContain("Copier");

    await act(async () => {
      m.root.unmount();
    });
  });

  it("n'ouvre qu'une observation à la fois", async () => {
    const m = await mount(<WiPilotData {...PROPS} />);
    const [first, second] = OBSERVATIONS;
    const triggerOf = (code: string) =>
      m.container.querySelector<HTMLButtonElement>(`[data-testid="wi-observation-${code}"]`)!;

    await act(async () => {
      triggerOf(first.ouvrageCode).click();
    });
    await act(async () => {
      triggerOf(second.ouvrageCode).click();
    });

    expect(triggerOf(first.ouvrageCode).getAttribute("aria-expanded")).toBe("false");
    expect(triggerOf(second.ouvrageCode).getAttribute("aria-expanded")).toBe("true");
    expect(m.container.querySelectorAll('[data-testid="wi-observation-detail"]')).toHaveLength(1);

    await act(async () => {
      m.root.unmount();
    });
  });
});

/* ==========================================================================
   8 — Mouvement
   ========================================================================== */

describe("mouvement borné", () => {
  const css = read("app/water/water-intelligence.css");
  const section = css.slice(css.indexOf("Water Intelligence v3 — Observed Withdrawals"));

  it("n'entretient aucune animation perpétuelle", () => {
    expect(section).not.toContain("infinite");
  });

  it("respecte la fenêtre de 300 à 500 ms", () => {
    const durations = [...section.matchAll(/animation:\s*\w+\s+(\d+)ms/g)].map((m) => Number(m[1]));
    expect(durations.length).toBeGreaterThan(0);
    for (const duration of durations) {
      expect(duration, `durée hors fenêtre : ${duration}ms`).toBeGreaterThanOrEqual(300);
      expect(duration, `durée hors fenêtre : ${duration}ms`).toBeLessThanOrEqual(500);
    }
  });

  it("anime la tige en scaleX, le point en opacité et translation, la valeur en fondu", () => {
    expect(section).toContain("transform: scaleX(0)");
    expect(section).toContain("wiLolliDotIn");
    expect(section).toContain("wiLolliFade");
  });

  it("part de l'état FINAL : sans JavaScript, les tiges sont dessinées", () => {
    /* La classe d'animation n'est posée qu'au franchissement du viewport.
       Le rendu serveur ne la porte donc pas, et l'état de base est final. */
    expect(markup).toContain("wi-lolli");
    expect(markup).not.toContain("wi-lolli-animate");
  });

  it("ne s'anime qu'à l'entrée dans le viewport, et se déconnecte aussitôt", async () => {
    /*
     * Le déclencheur est vérifié ICI plutôt que dans un navigateur : le
     * panneau de prévisualisation de cet environnement ne composite pas de
     * frames, donc ni le défilement programmatique ni `IntersectionObserver`
     * n'y produisent d'effet observable. Un observateur simulé rend la
     * vérification déterministe, et teste exactement ce qui compte : la
     * classe n'est posée qu'au franchissement, et l'observation cesse.
     */
    const callbacks: IntersectionObserverCallback[] = [];
    let disconnects = 0;
    let observed = 0;

    class FakeObserver {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe() {
        observed += 1;
      }
      disconnect() {
        disconnects += 1;
      }
      unobserve() {}
      takeRecords() {
        return [];
      }
    }

    const globals = globalThis as { IntersectionObserver?: unknown };
    const original = globals.IntersectionObserver;
    globals.IntersectionObserver = FakeObserver;

    try {
      const m = await mount(<WiPilotData {...PROPS} />);
      const list = m.container.querySelector<HTMLElement>('[data-testid="wi-pilot-tracks"]')!;

      // Avant tout franchissement : aucune animation.
      expect(list.className).toBe("wi-lolli");
      expect(observed).toBe(1);
      expect(disconnects).toBe(0);

      // Élément hors champ : toujours rien.
      await act(async () => {
        callbacks[0]([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
      expect(list.className).toBe("wi-lolli");

      // Franchissement : la classe est posée, et l'observation cesse.
      await act(async () => {
        callbacks[0]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
      expect(m.container.querySelector('[data-testid="wi-pilot-tracks"]')!.className).toBe(
        "wi-lolli wi-lolli-animate",
      );
      expect(disconnects).toBe(1);

      await act(async () => {
        m.root.unmount();
      });
    } finally {
      globals.IntersectionObserver = original;
    }
  });

  it("annule les délais sous mouvement réduit", () => {
    expect(section).toContain("animation-delay: 0ms !important");
  });
});
