/**
 * tests/water-intelligence-discoverability.test.tsx — découvrabilité du module
 * Water Intelligence (feat/water-intelligence-discoverability).
 *
 * Le module existait en production — trois routes hydriques répondaient — sans
 * figurer nulle part dans la navigation : on ne pouvait y arriver qu'en
 * connaissant l'URL. Ces tests vérifient les points d'entrée ajoutés, et
 * surtout ce que la page d'accueil A LE DROIT de promettre.
 *
 * Les cibles ont changé en Phase A — `/water` est la vitrine publique,
 * `/water/cockpit` et `/water/decision` les deux surfaces authentifiées — mais
 * les affirmations, elles, sont inchangées : ce sont les mêmes garanties de
 * découvrabilité, aux nouvelles URL.
 *
 * Le menu est réellement MONTÉ (React 19 `act` + `createRoot`) : « ouvre au
 * clavier », « ferme avec Échap » et « rend le focus au déclencheur » sont des
 * affirmations sur le comportement, qu'un rendu statique ne vérifierait pas.
 *
 * Aucune dépendance de test ajoutée — même contrainte que
 * `resources-discoverability.test.tsx`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: unknown }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children as never}
    </a>
  ),
}));

import { EnvironmentalIntelligence } from "@/components/landing/environmental-intelligence";
import {
  NavResourcesMenu,
  NavResourcesMobileGroup,
  RESOURCE_MENU_ENTRIES,
  RESOURCE_MENU_LABEL,
} from "@/components/landing/nav-resources-menu";
import { NAV_GROUPS, isNavItemActive } from "@/lib/nav-config";

const CARBON_ROOT = resolve(__dirname, "..");
const LANDING = resolve(CARBON_ROOT, "components/pages/landing-page.tsx");
const SITEMAP = resolve(CARBON_ROOT, "app/sitemap.ts");
const MENU = resolve(CARBON_ROOT, "components/landing/nav-resources-menu.tsx");
const SECTION = resolve(CARBON_ROOT, "components/landing/environmental-intelligence.tsx");

const read = (path: string) => readFileSync(path, "utf-8");

/* ------------------------------------------------------------- Outillage */

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

async function unmount(m: { container: HTMLElement; root: Root }) {
  await act(async () => {
    m.root.unmount();
  });
  m.container.remove();
}

function pick<T extends Element>(scope: ParentNode, selector: string): T {
  const found = scope.querySelector<T>(selector);
  if (!found) throw new Error(`Élément introuvable : ${selector}`);
  return found;
}

async function press(target: Element, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

/* ================================================= 1 · 2 — Liens présents */

describe("menu Ressources — cibles", () => {
  it("porte les deux modules, /materials conservé et /water ajouté", () => {
    const hrefs = RESOURCE_MENU_ENTRIES.map((e) => e.href);
    expect(hrefs).toEqual(["/materials", "/water"]);
    expect(RESOURCE_MENU_LABEL).toBe("Ressources");
  });

  it("décrit chaque entrée en texte, jamais par la seule couleur", () => {
    for (const entry of RESOURCE_MENU_ENTRIES) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
    expect(RESOURCE_MENU_ENTRIES[0].description).toBe(
      "Dépendances, criticité et chaînes d’approvisionnement",
    );
    expect(RESOURCE_MENU_ENTRIES[1].description).toBe(
      "Stress, prélèvements, qualité, réglementation et résilience",
    );
  });

  it("remplace l’entrée de premier niveau « Métaux critiques » dans la barre", () => {
    const landing = read(LANDING);
    // L'ancien lien top-level a disparu…
    expect(landing).not.toContain('{ href: "/materials", label: "Métaux critiques" }');
    // …et le menu occupe sa place dans l'ordre déclaré.
    expect(landing).toContain("RESOURCES_MENU_SLOT");
    expect(landing).toContain("<NavResourcesMenu");
    expect(landing).toContain("<NavResourcesMobileGroup");
  });
});

/* ================================================ 3 · 5 — Clavier et Échap */

describe("menu Ressources — comportement", () => {
  it("est fermé au départ et l’annonce par aria-expanded", async () => {
    const m = await mount(<NavResourcesMenu />);
    const trigger = pick<HTMLButtonElement>(m.container, '[data-testid="nav-resources-trigger"]');
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(m.container.querySelector('[data-testid="nav-resources-panel"]')).toBeNull();
    await unmount(m);
  });

  it("s’ouvre par le bouton — pas seulement au survol", async () => {
    const m = await mount(<NavResourcesMenu />);
    const trigger = pick<HTMLButtonElement>(m.container, '[data-testid="nav-resources-trigger"]');
    await act(async () => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const panel = pick<HTMLElement>(m.container, '[data-testid="nav-resources-panel"]');
    expect(panel.querySelectorAll("a").length).toBe(2);
    expect(panel.querySelector('a[href="/water"]')).toBeTruthy();
    expect(panel.querySelector('a[href="/materials"]')).toBeTruthy();
    await unmount(m);
  });

  it("ferme avec Échap et rend le focus au déclencheur", async () => {
    const m = await mount(<NavResourcesMenu />);
    const trigger = pick<HTMLButtonElement>(m.container, '[data-testid="nav-resources-trigger"]');
    await act(async () => {
      trigger.click();
    });
    expect(m.container.querySelector('[data-testid="nav-resources-panel"]')).toBeTruthy();

    await press(pick(m.container, '[data-testid="nav-resources-panel"]'), "Escape");
    expect(m.container.querySelector('[data-testid="nav-resources-panel"]')).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    await unmount(m);
  });

  it("parcourt les entrées aux flèches", async () => {
    const m = await mount(<NavResourcesMenu />);
    await act(async () => {
      pick<HTMLButtonElement>(m.container, '[data-testid="nav-resources-trigger"]').click();
    });
    const panel = pick<HTMLElement>(m.container, '[data-testid="nav-resources-panel"]');
    const items = Array.from(panel.querySelectorAll("a"));

    await act(async () => {
      items[0].focus();
    });
    await press(panel, "ArrowDown");
    expect(document.activeElement).toBe(items[1]);
    await press(panel, "ArrowUp");
    expect(document.activeElement).toBe(items[0]);
    await unmount(m);
  });

  it("ferme au clic extérieur", async () => {
    const m = await mount(<NavResourcesMenu />);
    await act(async () => {
      pick<HTMLButtonElement>(m.container, '[data-testid="nav-resources-trigger"]').click();
    });
    expect(m.container.querySelector('[data-testid="nav-resources-panel"]')).toBeTruthy();

    await act(async () => {
      // jsdom n'implémente pas `PointerEvent` ; le type de l'événement suffit,
      // c'est lui que le composant écoute.
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(m.container.querySelector('[data-testid="nav-resources-panel"]')).toBeNull();
    await unmount(m);
  });

  it("ne laisse aucun lien tabulable tant qu’il est fermé", async () => {
    const m = await mount(<NavResourcesMenu />);
    expect(m.container.querySelectorAll("a").length).toBe(0);
    await unmount(m);
  });
});

/* ==================================================== 4 — Version mobile */

describe("menu Ressources — mobile", () => {
  const html = renderToStaticMarkup(<NavResourcesMobileGroup onNavigate={() => {}} />);

  it("expose les deux mêmes cibles, à plat", () => {
    expect(html).toContain('data-testid="nav-resources-mobile"');
    expect(html).toContain('href="/materials"');
    expect(html).toContain('href="/water"');
    expect(html).toContain("Eau &amp; risques hydriques");
  });

  it("ne dépend d’aucun état replié pour être atteignable", () => {
    expect(html).not.toContain("aria-expanded");
  });
});

/* ======================================= 7 · 8 · 9 · 10 — Section homepage */

describe("section Intelligence environnementale", () => {
  const html = renderToStaticMarkup(<EnvironmentalIntelligence />);

  it("est rendue et titrée", () => {
    expect(html).toContain('data-testid="environmental-intelligence"');
    expect(html).toContain('id="intelligence-environnementale"');
    expect(html).toContain("environnementale");
  });

  it("porte les deux cartes et leurs CTA", () => {
    expect(html).toContain('data-testid="env-card-materials"');
    expect(html).toContain('data-testid="env-card-water"');
    expect(html).toContain('href="/materials"');
    expect(html).toContain('href="/water"');
    expect(html).toContain("Explorer Water Intelligence");
  });

  it("emploie les libellés de statut exacts, mot pour mot", () => {
    expect(html).toContain("Infrastructure opérationnelle");
    expect(html).toContain("7 sources officielles instrumentées");
    expect(html).toContain("Licences vérifiées");
    expect(html).toContain("Données publiques en attente de validation humaine");
    expect(html).toContain(
      "Stress, sécheresse, nappes, prélèvements, qualité et réglementation",
    );
  });

  it("ne promet AUCUNE donnée vivante", () => {
    const forbidden = [
      "temps réel",
      "temps-réel",
      "actuellement alimentée",
      "surveillance active",
      "conformité automatique",
      "couverture mondiale complète",
      "live",
    ];
    for (const phrase of forbidden) {
      expect(html.toLowerCase(), `formulation interdite : ${phrase}`).not.toContain(
        phrase.toLowerCase(),
      );
    }
  });

  it("n’affiche aucun chiffre hydrique — il n’y en a aucun à montrer", () => {
    // Le seul nombre autorisé sur la carte Eau est le décompte de SOURCES.
    const waterCard = html.slice(html.indexOf('data-testid="env-card-water"'));
    const numbers = waterCard.match(/\b\d+(?:[.,]\d+)?\s*(?:m³|m3|%|mm|L\/s|hm³)\b/g) ?? [];
    expect(numbers).toEqual([]);
  });

  it("distingue la surface publique des deux cockpits authentifiés", () => {
    expect(html).toContain('data-testid="env-water-private"');
    expect(html).toContain('href="/water/cockpit"');
    expect(html).toContain('href="/water/decision"');
    expect(html).toContain("Accéder au cockpit entreprise");
    expect(html).toContain("Connexion requise");
  });

  it("n’expose aucun identifiant de tenant dans ses liens", () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, `identifiant dans une URL publique : ${href}`).not.toMatch(
        /company_id|tenant_id|site_id|\?/,
      );
    }
  });

  it("rappelle que rien n’est publié sans décision humaine", () => {
    expect(html).toContain("décision humaine de publication");
  });
});

/* ====================================== 11 — Navigation authentifiée */

describe("navigation authentifiée", () => {
  const pilotage = NAV_GROUPS.find((g) => g.group === "Pilotage");

  it("expose /water/cockpit et /water/decision avec les libellés attendus", () => {
    expect(pilotage).toBeTruthy();
    const water = pilotage!.items.find((i) => i.id === "water");
    const decision = pilotage!.items.find((i) => i.id === "water-decision");

    expect(water?.href).toBe("/water/cockpit");
    expect(water?.label).toBe("Eau & stress hydrique");
    expect(decision?.href).toBe("/water/decision");
    expect(decision?.label).toBe("Décision hydrique");
  });

  it("ne duplique aucune entrée existante", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("n’allume qu’une seule entrée sur chaque cockpit hydrique", () => {
    const water = pilotage!.items.find((i) => i.id === "water")!;
    const decision = pilotage!.items.find((i) => i.id === "water-decision")!;

    expect(isNavItemActive("/water/decision", water.href, water.exact)).toBe(false);
    expect(isNavItemActive("/water/decision", decision.href, decision.exact)).toBe(true);
    expect(isNavItemActive("/water/cockpit", water.href, water.exact)).toBe(true);
    expect(isNavItemActive("/water/cockpit", decision.href, decision.exact)).toBe(false);
  });

  it("n’allume aucune entrée sur la vitrine publique /water", () => {
    /*
      `/water` est une page PUBLIQUE : elle n'est pas rendue sous la barre
      latérale et ne doit correspondre à aucune de ses entrées. Avant la
      Phase A, `/water` ÉTAIT l'entrée cockpit ; sans ce test, une entrée
      laissée sur l'ancien chemin s'allumerait encore, ou pire, ramènerait un
      utilisateur authentifié vers une page sans ses données.
    */
    for (const item of pilotage!.items) {
      expect(
        isNavItemActive("/water", item.href, item.exact),
        `entrée allumée sur la vitrine publique : ${item.href}`,
      ).toBe(false);
    }
  });

  it("conserve le comportement de préfixe des autres entrées", () => {
    expect(isNavItemActive("/resources/exposures", "/resources")).toBe(true);
    expect(isNavItemActive("/resources-autre", "/resources")).toBe(false);
  });
});

/* ================================================ 12 · 13 — Sitemap et non-régression */

describe("sitemap et non-régression", () => {
  it("déclare les deux surfaces publiques thématiques", () => {
    const sitemap = read(SITEMAP);
    expect(sitemap).toContain("/water");
    expect(sitemap).toContain("/materials");
  });

  it("n’expose JAMAIS les cockpits authentifiés au sitemap", () => {
    /*
      On cherche des ENTRÉES, pas des occurrences de texte : le fichier explique
      en commentaire pourquoi les cockpits en sont absents, et une recherche
      naïve trouverait cette explication.
    */
    const entries = [...read(SITEMAP).matchAll(/url:\s*`\$\{baseUrl\}([^`]*)`/g)].map(
      (m) => m[1],
    );
    expect(entries).toContain("/water");
    expect(entries).toContain("/materials");
    expect(entries).not.toContain("/water/cockpit");
    expect(entries).not.toContain("/water/decision");
    /*
      L'ancienne URL publique n'est pas déclarée EN PLUS de la nouvelle : elle
      redirige en 308 vers `/water`, et lister les deux demanderait aux moteurs
      d'indexer une URL dont on affirme par ailleurs qu'elle n'est plus la
      bonne.
    */
    expect(entries).not.toContain("/water-intelligence");
  });

  it("conserve les liens de navigation existants", () => {
    const landing = read(LANDING);
    for (const href of ["/produit", "/proof", "/demo", "#features", "#pricing", "#how"]) {
      expect(landing, `lien de navigation perdu : ${href}`).toContain(`"${href}"`);
    }
  });

  it("garde /materials atteignable depuis l’accueil, menu et pied de page", () => {
    const landing = read(LANDING);
    expect(landing).toContain('href="/materials"'); // pied de page
    expect(read(MENU)).toContain('href: "/materials"'); // menu
  });

  it("ajoute Water Intelligence au pied de page", () => {
    expect(read(LANDING)).toContain('href="/water"');
  });
});

/* ================================================ Garde-fous transverses */

describe("garde-fous", () => {
  it("n’ajoute aucune dépendance : le menu n’importe que React et next/link", () => {
    const menu = read(MENU);
    const imports = [...menu.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    for (const source of imports) {
      expect(
        source === "react" || source === "next/link" || source.startsWith("@/"),
        `import externe inattendu : ${source}`,
      ).toBe(true);
    }
  });

  it("neutralise ses transitions sous mouvement réduit", () => {
    for (const file of [MENU, SECTION]) {
      const source = read(file);
      const transitions = (source.match(/transition-colors/g) ?? []).length;
      const guarded = (source.match(/motion-reduce:transition-none/g) ?? []).length;
      expect(transitions).toBeGreaterThan(0);
      expect(guarded).toBe(transitions);
    }
  });

  it("ne touche à aucune règle métier du module", () => {
    const section = read(SECTION);
    // Aucune décision de publication, aucune source signée, aucun connecteur.
    expect(section).not.toMatch(/decision_approved|publication_allowed|connector|WRI_AQUEDUCT/);
  });
});
