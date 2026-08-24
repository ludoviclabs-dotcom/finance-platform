/**
 * tests/water-intelligence-basin-atlas.test.tsx — Basin Atlas (WI-V3-04).
 *
 * Le garde-fou central : **aucune couche bassin ne peut être présentée comme
 * vérifiée sans jointure validée**, et `basinJoin()` ne peut pas retourner
 * `validated: true` par inadvertance — il lui faut deux faits canoniques,
 * dont aucun n'est vrai aujourd'hui.
 *
 * Les autres vérifient que la carte n'implique jamais une couverture
 * nationale, que le tiroir est atteignable au clavier, et que le mouvement
 * reste borné.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { WiFranceMap } from "@/components/water-intelligence/WiFranceMap";
import {
  LAYER_KIND_LABELS,
  atlasLayers,
  basinJoin,
  defaultVisibleLayers,
} from "@/lib/water-intelligence/basin-atlas";
import { PILOT_FILE, pilotIsPublished } from "@/lib/water-intelligence/pilot-snapshot";

const CARBON_ROOT = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(CARBON_ROOT, path), "utf-8");
const CSS = read("app/water/water-intelligence.css");

const JOIN = basinJoin(PILOT_FILE);

const PROPS = {
  markerLonLat: [3.8772, 43.6119] as readonly [number, number],
  geographyCode: "34172",
  ouvrageCount: 3,
  periodLabel: "2020",
  reducedMotion: true,
  join: JOIN,
  sourceCode: "HUBEAU_BNPE_PRELEVEMENTS",
  reviewedOn: "2026-07-28",
} as const;

const markup = renderToStaticMarkup(<WiFranceMap {...PROPS} />);
const visible = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;| /g, " ")
  .replace(/\s+/g, " ");

/* ==========================================================================
   1 — La jointure bassin n'est pas validée, et c'est démontré
   ========================================================================== */

describe("jointure commune → bassin", () => {
  it("n'est PAS validée aujourd'hui", () => {
    expect(JOIN.validated).toBe(false);
    expect(JOIN.label).toBe("Jointure bassin non validée");
  });

  it("le dit à partir du document, pas d'une phrase écrite dans le JSX", () => {
    /* Deux faits canoniques, l'un et l'autre faux : zéro couche géographique
       publiée, et aucune observation rattachée à une échelle de bassin. */
    expect(JOIN.publishedLayerCount).toBe(0);
    expect(JOIN.hasBasinScopedObservation).toBe(false);
    expect(pilotIsPublished(PILOT_FILE)).toBe(true);
  });

  it("exige les DEUX faits pour se valider — une couche seule ne suffit pas", () => {
    /* Contrôle par construction : on fabrique un document qui publie des
       couches SANS observation de bassin. La jointure doit rester invalide —
       sinon publier n'importe quelle couche géographique vaudrait
       rattachement à un bassin. */
    const withLayers = {
      ...(PILOT_FILE as object),
      coverage: { ...(PILOT_FILE as { coverage: object }).coverage, layer_count: 4 },
    } as typeof PILOT_FILE;

    const join = basinJoin(withLayers);
    expect(join.publishedLayerCount).toBe(4);
    expect(join.hasBasinScopedObservation).toBe(false);
    expect(join.validated).toBe(false);
    expect(join.reason).toContain("échelle de bassin");
  });

  it("nomme une démarche humaine comme prochaine étape, pas un réglage", () => {
    expect(JOIN.nextStep).toMatch(/licence|décision|signer/i);
    expect(JOIN.nextStep).not.toMatch(/corrig|bug|réglage technique/i);
  });

  it("n'est jamais écrite en dur dans un composant", () => {
    const map = read("components/water-intelligence/WiFranceMap.tsx");
    const matrices = read("components/water-intelligence/WiMatrices.tsx");
    for (const source of [map, matrices]) {
      expect(source).not.toMatch(/validated:\s*true/);
    }
  });
});

/* ==========================================================================
   2 — Trois types de couches
   ========================================================================== */

describe("modèle de couches", () => {
  const layers = atlasLayers({
    geographyCode: "34172",
    periodLabel: "2020",
    ouvrageCount: 3,
    join: JOIN,
  });

  it("distingue publié, repérage et différé", () => {
    const kinds = new Set(layers.map((l) => l.kind));
    expect(kinds).toEqual(new Set(["published", "context", "deferred"]));
    for (const kind of ["published", "context", "deferred"] as const) {
      expect(LAYER_KIND_LABELS[kind].length).toBeGreaterThan(0);
    }
  });

  it("suit la hiérarchie ouvrage → commune → bassin", () => {
    const levels = layers.map((l) => l.level);
    expect(levels.indexOf("ouvrage")).toBeLessThan(levels.indexOf("commune"));
    expect(levels.indexOf("commune")).toBeLessThan(levels.indexOf("bassin"));
  });

  it("rend la couche bassin DIFFÉRÉE tant que la jointure n'est pas validée", () => {
    const basin = layers.find((l) => l.id === "bassin")!;
    expect(basin.kind).toBe("deferred");
    expect(basin.toggleable).toBe(false);
    expect(basin.defaultVisible).toBe(false);
    /* Le détail s'ouvre sur l'ÉTAT, puis son motif. */
    expect(basin.detail.startsWith(JOIN.label)).toBe(true);
    expect(basin.detail).toContain(JOIN.reason);
  });

  it("n'active JAMAIS une couche différée : un interrupteur qui n'allume rien ment", () => {
    for (const layer of layers.filter((l) => l.kind === "deferred")) {
      expect(layer.toggleable, `${layer.id} activable`).toBe(false);
      expect(defaultVisibleLayers(layers)).not.toContain(layer.id);
    }
  });

  it("ne rend activables que les couches de repérage", () => {
    for (const layer of layers.filter((l) => l.toggleable)) {
      expect(layer.kind).toBe("context");
    }
  });
});

/* ==========================================================================
   3 — La carte n'implique aucune couverture nationale
   ========================================================================== */

describe("ce que la carte refuse d'affirmer", () => {
  it("rend la légende des trois types, en permanence", () => {
    expect(markup).toContain('data-testid="wi-atlas-legend"');
    expect(markup).toContain('data-testid="wi-atlas-layer-bassin"');
    expect(visible).toContain("Jointure bassin non validée");
  });

  it("marque la couche bassin comme différée dans le balisage", () => {
    const start = markup.indexOf('data-testid="wi-atlas-layer-bassin"');
    const basin = markup.slice(start, markup.indexOf("</li>", start));
    expect(basin).toContain("Différé");
    expect(basin).toContain("wi-atlas-swatch-deferred");
    // Pas d'interrupteur : la couche différée ne rend aucun bouton.
    expect(basin).not.toContain("<button");
    expect(markup).not.toContain('data-testid="wi-atlas-toggle-bassin"');
  });

  it("ne teinte aucun polygone en fonction d'une valeur", () => {
    /* Aucune métrique par polygone n'existe : un choroplèthe en inventerait
       une. Les pays sont peints d'une teinte de fond unique. */
    const fills = [...markup.matchAll(/<path[^>]*fill="([^"]+)"/g)].map((m) => m[1]);
    const distinct = new Set(fills);
    for (const fill of distinct) {
      expect(
        /var\(--wi-map-land\)|url\(#wi-map-hatch\)|rgba\(45,212,191,\.05\)|none/.test(fill),
        `remplissage inattendu, possible choroplèthe : ${fill}`,
      ).toBe(true);
    }
  });

  it("n'emploie ni rampe de couleur ni interpolation", () => {
    const source = read("components/water-intelligence/WiFranceMap.tsx").toLowerCase();
    for (const term of ["interpolate", "scalesequential", "scalelinear", "heat", "cluster"]) {
      expect(source, `procédé interdit : ${term}`).not.toContain(term);
    }
  });

  it("ne dimensionne pas le marqueur selon une valeur", () => {
    /* Le rayon est une constante littérale : aucune valeur observée n'y
       entre, donc aucune sémantique de taille n'est suggérée. */
    const source = read("components/water-intelligence/WiFranceMap.tsx");
    const radii = [...source.matchAll(/\br=\{([^}]+)\}/g)].map((m) => m[1].trim());
    expect(radii.length).toBeGreaterThan(0);
    for (const radius of radii) {
      expect(Number.isFinite(Number(radius)), `rayon calculé : ${radius}`).toBe(true);
    }
  });

  it("n'ajoute aucune bibliothèque de tuiles", () => {
    /* Commentaires retirés : la docstring du composant explique précisément
       POURQUOI Mapbox, MapLibre et Leaflet sont écartés, et un grep naïf
       confondrait cette justification avec une dépendance. Même convention
       que les autres suites du module. */
    const source = read("components/water-intelligence/WiFranceMap.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .toLowerCase();
    for (const lib of ["mapbox", "maplibre", "leaflet", "tile"]) {
      expect(source, `bibliothèque de tuiles : ${lib}`).not.toContain(lib);
    }
  });

  it("n'effectue aucun appel réseau : la topologie est un import de module", () => {
    const source = read("components/water-intelligence/WiFranceMap.tsx");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).toContain('from "world-atlas/countries-110m.json"');
  });
});

/* ==========================================================================
   4 — Tiroir d'inspection, atteignable au clavier
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

describe("inspection du périmètre publié", () => {
  it("expose un déclencheur qui est un vrai bouton, nommé", () => {
    expect(markup).toContain('data-testid="wi-atlas-probe"');
    const probe = markup.slice(markup.indexOf('data-testid="wi-atlas-probe"') - 200);
    expect(probe).toContain("<button");
    expect(visible).toContain("Inspecter le périmètre publié");
  });

  it("ouvre un tiroir portant tous les champs exigés", async () => {
    const m = await mount(<WiFranceMap {...PROPS} />);
    const probe = m.container.querySelector<HTMLButtonElement>('[data-testid="wi-atlas-probe"]')!;
    await act(async () => {
      probe.click();
    });

    const drawer = m.container.querySelector<HTMLElement>('[data-testid="wi-atlas-drawer"]')!;
    expect(drawer).not.toBeNull();
    const text = drawer.textContent ?? "";
    for (const label of [
      "Territoire",
      "Code INSEE",
      "Période",
      "Observations disponibles",
      "Source",
      "Statut de publication",
      "Niveau de preuve",
      "Jointure bassin",
      "Pourquoi certaines couches sont absentes",
      "Prochaine étape",
    ]) {
      expect(text, `champ manquant : ${label}`).toContain(label);
    }
    expect(text).toContain("Jointure bassin non validée");
    expect(text).toContain(JOIN.nextStep);

    await act(async () => {
      m.root.unmount();
    });
  });

  it("est un dialogue nommé, et prend le focus", async () => {
    const m = await mount(<WiFranceMap {...PROPS} />);
    await act(async () => {
      m.container.querySelector<HTMLButtonElement>('[data-testid="wi-atlas-probe"]')!.click();
    });

    const dialog = m.container.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(m.container.querySelector(`#${CSS_escape(labelledBy!)}`)?.textContent).toContain("34172");
    expect(document.activeElement).toBe(dialog);

    await act(async () => {
      m.root.unmount();
    });
  });

  it("se ferme avec Échap et rend le focus au déclencheur", async () => {
    const m = await mount(<WiFranceMap {...PROPS} />);
    const probe = m.container.querySelector<HTMLButtonElement>('[data-testid="wi-atlas-probe"]')!;
    await act(async () => {
      probe.focus();
      probe.click();
    });
    expect(m.container.querySelector('[data-testid="wi-atlas-drawer"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(m.container.querySelector('[data-testid="wi-atlas-drawer"]')).toBeNull();
    expect(document.activeElement).toBe(probe);

    await act(async () => {
      m.root.unmount();
    });
  });

  it("se ferme aussi par son bouton Fermer", async () => {
    const m = await mount(<WiFranceMap {...PROPS} />);
    await act(async () => {
      m.container.querySelector<HTMLButtonElement>('[data-testid="wi-atlas-probe"]')!.click();
    });
    const close = [...m.container.querySelectorAll("button")].find(
      (b) => b.textContent === "Fermer",
    )!;
    await act(async () => {
      close.click();
    });
    expect(m.container.querySelector('[data-testid="wi-atlas-drawer"]')).toBeNull();

    await act(async () => {
      m.root.unmount();
    });
  });
});

/** `CSS.escape` n'existe pas dans toutes les versions de jsdom. */
function CSS_escape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

/* ==========================================================================
   5 — Bascule de couche
   ========================================================================== */

describe("bascule des couches de repérage", () => {
  it("éteint et rallume une couche de contexte", async () => {
    const m = await mount(<WiFranceMap {...PROPS} />);
    const toggle = m.container.querySelector<HTMLButtonElement>(
      '[data-testid="wi-atlas-toggle-monde"]',
    )!;
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      toggle.click();
    });
    expect(
      m.container
        .querySelector<HTMLButtonElement>('[data-testid="wi-atlas-toggle-monde"]')!
        .getAttribute("aria-pressed"),
    ).toBe("false");

    await act(async () => {
      m.container.querySelector<HTMLButtonElement>('[data-testid="wi-atlas-toggle-monde"]')!.click();
    });
    expect(
      m.container
        .querySelector<HTMLButtonElement>('[data-testid="wi-atlas-toggle-monde"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");

    await act(async () => {
      m.root.unmount();
    });
  });

  it("ne masque JAMAIS la couche publiée : elle est le sujet de la carte", () => {
    expect(markup).not.toContain('data-testid="wi-atlas-toggle-commune"');
    expect(markup).not.toContain('data-testid="wi-atlas-toggle-ouvrages"');
  });
});

/* ==========================================================================
   6 — Mouvement
   ========================================================================== */

describe("mouvement de l'atlas", () => {
  const section = CSS.slice(CSS.indexOf("Water Intelligence v3 — Basin Atlas"));

  it("n'entretient aucune animation perpétuelle", () => {
    expect(section).not.toContain("infinite");
  });

  it("trace le contour entre 350 et 550 ms", () => {
    const draw = CSS.match(/animation: wiMapDraw (\d+)ms/);
    expect(draw).not.toBeNull();
    const duration = Number(draw![1]);
    expect(duration).toBeGreaterThanOrEqual(350);
    expect(duration).toBeLessThanOrEqual(550);
  });

  it("fait apparaître le marqueur en fondu ET en montée d'échelle", () => {
    const keyframes = CSS.slice(CSS.indexOf("@keyframes wiMapMarkerIn"));
    expect(keyframes.slice(0, 220)).toContain("scale: 0.8");
    expect(keyframes.slice(0, 220)).toContain("opacity: 0");
  });

  it("a retiré le ping du marqueur, qui n'informait plus", () => {
    expect(CSS).not.toContain("wiMapPulse");
    expect(read("components/water-intelligence/WiFranceMap.tsx")).not.toContain("wi-map-pulse");
  });

  it("fait le fondu croisé des couches entre 150 et 220 ms", () => {
    const layer = section.slice(section.indexOf("[data-wi] .wi-layer {"));
    const match = layer.match(/transition: opacity (\d+)ms/);
    expect(match).not.toBeNull();
    const duration = Number(match![1]);
    expect(duration).toBeGreaterThanOrEqual(150);
    expect(duration).toBeLessThanOrEqual(220);
  });

  it("anime le tiroir entre 180 et 240 ms", () => {
    const match = section.match(/animation: wiDrawerIn (\d+)ms/);
    expect(match).not.toBeNull();
    const duration = Number(match![1]);
    expect(duration).toBeGreaterThanOrEqual(180);
    expect(duration).toBeLessThanOrEqual(240);
  });

  it("borne la rotation 3D dans le temps, au lieu de la laisser tourner", () => {
    const source = read("components/water-intelligence/WiBassin3D.tsx");
    expect(source).toContain("autoRotateTimer");
    expect(source).toMatch(/setTimeout\(stopAutoRotate,\s*\d+\)/);
    // …et le minuteur est nettoyé au démontage.
    expect(source).toContain("window.clearTimeout(autoRotateTimer)");
  });

  it("neutralise le glissement du tiroir sous mouvement réduit", () => {
    const blocks = section.split("@media (prefers-reduced-motion: reduce)").slice(1);
    expect(blocks.some((block) => block.includes("wi-drawer"))).toBe(true);
  });
});

/* ==========================================================================
   7 — La 3D reste une illustration
   ========================================================================== */

describe("coupe 3D — illustration, jamais reconstruction", () => {
  it("porte l'avertissement pédagogique, avant la scène", () => {
    const source = read("components/water-intelligence/WiBassin3D.tsx");
    expect(source).toContain("Coupe pédagogique — représentation");
    expect(source).toContain("non topographique");

    /* AVANT : l'avertissement précède le conteneur de la scène dans le
       balisage, donc dans l'ordre de lecture comme dans l'ordre du DOM. */
    const notice = source.indexOf('data-testid="wi-bassin-notice"');
    const canvas = source.indexOf('data-testid="wi-bassin-3d"');
    expect(notice).toBeGreaterThan(0);
    expect(notice).toBeLessThan(canvas);
  });

  it("ne charge three.js qu'à la demande", () => {
    const source = read("components/water-intelligence/WiBassin3D.tsx");
    expect(source).toContain('await import("three")');
    expect(source).not.toMatch(/^import .* from "three"/m);
  });
});

/* ==========================================================================
   8 — Mobile
   ========================================================================== */

describe("mobile", () => {
  it("le tiroir n'excède jamais la largeur de l'écran", () => {
    const drawer = CSS.slice(CSS.indexOf("[data-wi] .wi-drawer {"));
    expect(drawer.slice(0, 400)).toContain("min(26rem, 100%)");
  });

  it("la cible d'inspection atteint la taille tactile recommandée", () => {
    const probe = CSS.slice(CSS.indexOf("[data-wi] .wi-map-probe {"));
    // 2,75rem = 44 px, le minimum retenu par les recommandations tactiles.
    expect(probe.slice(0, 400)).toContain("width: 2.75rem");
    expect(probe.slice(0, 400)).toContain("height: 2.75rem");
  });
});
