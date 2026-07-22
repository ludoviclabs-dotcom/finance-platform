/**
 * Découvrabilité du module Ressources (feat/resources-discoverability).
 *
 * Rendu serveur pur (`renderToStaticMarkup`) + fonctions pures, à l'identique du
 * reste de la suite Ressources (aucune dépendance de test ajoutée). Couvre :
 *   - l'entrée sidebar « Ressources stratégiques » (Pilotage, après Matérialité,
 *     badge BETA) et l'entrée « Démo Ressources » sans écraser Demo Studio ;
 *   - la logique d'état actif (exact + sous-route) ;
 *   - le bandeau de contexte démo et son lien vers le parcours guidé ;
 *   - les trois états vides distincts (réel / démo / filtres) ;
 *   - la carte d'accès du tableau de bord ;
 *   - garde-fous : aucun interne d'admin exposé dans les états vides.
 *
 * Les assertions évitent les apostrophes (React les échappe en `&#x27;` dans le
 * HTML rendu) — on teste des fragments sans apostrophe + les testId/href.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: unknown }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children as never}
    </a>
  ),
}));

import { NAV_GROUPS, isNavItemActive } from "@/lib/nav-config";
import { DemoSessionBanner } from "@/components/resources/demo-session-banner";
import {
  ResourceEmptyState,
  resourcesEmptyStateKind,
} from "@/components/resources/resource-empty-state";
import { ResourcesAccessCardView } from "@/components/dashboard/resources-access-card";

// ---------------------------------------------------------------------------
// Navigation — entrées sidebar
// ---------------------------------------------------------------------------

describe("NAV_GROUPS — entrée Ressources stratégiques (Pilotage)", () => {
  const pilotage = NAV_GROUPS.find((g) => g.group === "Pilotage");

  it("existe dans le groupe Pilotage, juste après Matérialité", () => {
    expect(pilotage).toBeTruthy();
    const ids = pilotage!.items.map((i) => i.id);
    expect(ids).toContain("resources");
    expect(ids.indexOf("resources")).toBe(ids.indexOf("materialite") + 1);
  });

  it("pointe /resources, libellé et badge BETA", () => {
    const entry = pilotage!.items.find((i) => i.id === "resources")!;
    expect(entry.href).toBe("/resources");
    expect(entry.label).toBe("Ressources stratégiques");
    expect(entry.badge?.text).toBe("BETA");
  });
});

describe("NAV_GROUPS — entrée Démo Ressources (Démonstration)", () => {
  const demo = NAV_GROUPS.find((g) => g.group === "Démonstration");

  it("conserve Demo Studio ET ajoute Démo Ressources", () => {
    expect(demo).toBeTruthy();
    const ids = demo!.items.map((i) => i.id);
    expect(ids).toContain("demo-studio"); // non remplacé
    expect(ids).toContain("demo-resources");
  });

  it("Démo Ressources pointe la séquence guidée, sans toucher /demo/asterion-motion", () => {
    const studio = demo!.items.find((i) => i.id === "demo-studio")!;
    const res = demo!.items.find((i) => i.id === "demo-resources")!;
    expect(studio.href).toBe("/demo/asterion-motion");
    expect(res.href).toBe("/demo/asterion-resources");
    expect(res.label).toBe("Démo Ressources");
  });
});

describe("isNavItemActive — exact + sous-routes", () => {
  it("actif sur le chemin exact", () => {
    expect(isNavItemActive("/resources", "/resources")).toBe(true);
  });
  it("actif sur une sous-route", () => {
    expect(isNavItemActive("/resources/exposures", "/resources")).toBe(true);
    expect(isNavItemActive("/resources/methodology", "/resources")).toBe(true);
  });
  it("inactif sur une autre route ou un faux préfixe", () => {
    expect(isNavItemActive("/materialite", "/resources")).toBe(false);
    expect(isNavItemActive("/resources-autre", "/resources")).toBe(false);
  });
  it("inactif si pathname absent", () => {
    expect(isNavItemActive(null, "/resources")).toBe(false);
    expect(isNavItemActive(undefined, "/resources")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bandeau de contexte démo
// ---------------------------------------------------------------------------

describe("DemoSessionBanner — contexte démo sur /resources", () => {
  const html = renderToStaticMarkup(<DemoSessionBanner />);

  it("annonce sans ambiguïté un environnement de démonstration synthétique", () => {
    expect(html).toContain('data-testid="resources-demo-banner"');
    expect(html).toContain("ENVIRONNEMENT DE DÉMONSTRATION");
    expect(html).toContain("Asterion Motion");
    expect(html).toContain("Données synthétiques");
    expect(html).toContain("aucun appel IA live");
  });

  it("propose de rejouer le parcours guidé", () => {
    expect(html).toContain('data-testid="resources-demo-tour-link"');
    expect(html).toContain('href="/demo/asterion-resources"');
    expect(html).toContain("Revoir le parcours guidé");
  });
});

// ---------------------------------------------------------------------------
// États vides — décideur pur
// ---------------------------------------------------------------------------

describe("resourcesEmptyStateKind — cas distincts", () => {
  it("grid quand au moins un résultat filtré", () => {
    expect(
      resourcesEmptyStateKind({ itemsLength: 5, filteredLength: 5, family: "all", query: "", isDemo: false }),
    ).toBe("grid");
  });

  it("empty-real : catalogue vide, aucun filtre, session réelle", () => {
    expect(
      resourcesEmptyStateKind({ itemsLength: 0, filteredLength: 0, family: "all", query: "", isDemo: false }),
    ).toBe("empty-real");
  });

  it("empty-demo : catalogue vide, aucun filtre, session démo", () => {
    expect(
      resourcesEmptyStateKind({ itemsLength: 0, filteredLength: 0, family: "all", query: "", isDemo: true }),
    ).toBe("empty-demo");
  });

  it("no-results : un filtre famille exclut tout (même en démo)", () => {
    expect(
      resourcesEmptyStateKind({ itemsLength: 0, filteredLength: 0, family: "industrial_gas", query: "", isDemo: true }),
    ).toBe("no-results");
  });

  it("no-results : une recherche exclut tout alors que le catalogue existe", () => {
    expect(
      resourcesEmptyStateKind({ itemsLength: 5, filteredLength: 0, family: "all", query: "zzz", isDemo: false }),
    ).toBe("no-results");
  });
});

describe("ResourceEmptyState — rendu générique", () => {
  it("rend un lien primaire et un lien fantôme", () => {
    const html = renderToStaticMarkup(
      <ResourceEmptyState
        testId="es-real"
        title="Aucune dépendance encore cartographiée"
        description="Importez une nomenclature."
        actions={[
          { label: "Importer des données", href: "/imports", variant: "primary", testId: "es-import" },
          { label: "Configurer les sources", href: "/resources/methodology", variant: "ghost", testId: "es-sources" },
        ]}
      />,
    );
    expect(html).toContain('data-testid="es-real"');
    expect(html).toContain('data-testid="es-import"');
    expect(html).toContain('href="/imports"');
    expect(html).toContain('href="/resources/methodology"');
    expect(html).toContain("Aucune dépendance encore cartographiée");
  });

  it("rend une action bouton (onClick) pour la réinitialisation des filtres", () => {
    const html = renderToStaticMarkup(
      <ResourceEmptyState
        testId="es-filters"
        title="Aucun résultat pour ces filtres"
        description="Réinitialisez pour revoir tout le catalogue."
        actions={[{ label: "Réinitialiser les filtres", onClick: () => {}, variant: "ghost", testId: "es-reset" }]}
      />,
    );
    expect(html).toMatch(/<button[^>]*data-testid="es-reset"/);
    expect(html).toContain("Réinitialiser les filtres");
    // jamais une navigation directe pour un reset local
    expect(html).not.toMatch(/<a[^>]*data-testid="es-reset"/);
  });

  it("n'expose JAMAIS d'interne d'administration", () => {
    const demo = renderToStaticMarkup(
      <ResourceEmptyState
        testId="es-demo"
        title="Le scénario Asterion doit être initialisé"
        description="Les données synthétiques doivent être chargées via le workflow protégé de démonstration."
        actions={[{ label: "Voir le parcours guidé", href: "/demo/asterion-resources", testId: "es-tour" }]}
      />,
    );
    for (const forbidden of ["DATABASE_ADMIN_URL", "Evidence Kernel", "demo_seed", "production-db"]) {
      expect(demo).not.toContain(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------
// Carte d'accès du tableau de bord
// ---------------------------------------------------------------------------

describe("ResourcesAccessCardView — raccourci cockpit", () => {
  it("affiche titre, description et CTA vers /resources", () => {
    const html = renderToStaticMarkup(<ResourcesAccessCardView status="loading" />);
    expect(html).toContain('data-testid="dashboard-resources-card"');
    expect(html).toContain("Ressources stratégiques");
    expect(html).toContain("Cartographiez les matières");
    expect(html).toContain('data-testid="dashboard-resources-cta"');
    expect(html).toContain('href="/resources"');
    expect(html).toContain("Ouvrir le cockpit");
  });

  it("affiche les chiffres quand des données existent", () => {
    const html = renderToStaticMarkup(
      <ResourcesAccessCardView
        status="ready"
        stats={{ resourceCount: 5, alertCount: 2, avgConfidence: 61.4 }}
      />,
    );
    expect(html).toContain('data-testid="dashboard-resources-stats"');
    expect(html).toContain('data-testid="dashboard-resources-count"');
    expect(html).toContain("5");
    expect(html).toContain('data-testid="dashboard-resources-alerts"');
    expect(html).toContain("61 %"); // moyenne arrondie, honnête
  });

  it("masque la confiance quand aucune n'est calculable", () => {
    const html = renderToStaticMarkup(
      <ResourcesAccessCardView
        status="ready"
        stats={{ resourceCount: 3, alertCount: 0, avgConfidence: null }}
      />,
    );
    expect(html).toContain('data-testid="dashboard-resources-count"');
    expect(html).not.toContain('data-testid="dashboard-resources-confidence"');
  });

  it("catalogue vide ou indisponible : carte + CTA seuls, sans chiffres", () => {
    const empty = renderToStaticMarkup(
      <ResourcesAccessCardView status="ready" stats={{ resourceCount: 0, alertCount: 0, avgConfidence: null }} />,
    );
    const unavailable = renderToStaticMarkup(<ResourcesAccessCardView status="unavailable" />);
    for (const html of [empty, unavailable]) {
      expect(html).not.toContain('data-testid="dashboard-resources-stats"');
      expect(html).toContain('data-testid="dashboard-resources-cta"');
    }
  });
});
