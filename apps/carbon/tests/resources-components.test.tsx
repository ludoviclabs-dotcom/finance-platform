/**
 * Ressources (Module 2, PR-M2C) — composants présentationnels.
 *
 * Rendu serveur pur (`renderToStaticMarkup`) + assertions sur le HTML, à
 * l'identique du test DataStatusBadge existant (aucune dépendance de test
 * ajoutée). Prouve les garanties visuelles exigées par le brief :
 *   - jamais une jauge opaque : risque ET confiance décomposés, séparés ;
 *   - donnée manquante ≠ risque nul ;
 *   - provenance affichée ; disclaimer non officiel présent ;
 *   - motion gardée par `motion-safe:` (désactivée sous reduced-motion) ;
 *   - accessibilité (rôles, aria, scope, caption).
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// next/link nécessite le runtime Next ; on le réduit à une ancre pour le rendu pur.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: unknown }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children as never}
    </a>
  ),
}));

import { AssessmentDimensionsPanel } from "@/components/resources/assessment-dimensions-panel";
import { ResourceIndexCard } from "@/components/resources/resource-index-card";
import { StageConcentrationPanel } from "@/components/resources/stage-concentration-panel";
import { RegulatoryStatusPanel } from "@/components/resources/regulatory-status-panel";
import { ModuleLinks } from "@/components/resources/module-links";
import { MethodologyDisclaimer } from "@/components/resources/methodology-disclaimer";
import { DimensionBar } from "@/components/resources/dimension-bar";
import { ResourceDataStatus } from "@/components/resources/resource-data-status";
import { AssessmentSummaryTable } from "@/components/resources/assessment-summary-table";
import { ExposureLinksTable } from "@/components/resources/exposure-links-table";
import { ResourceNav } from "@/components/resources/resource-nav";
import type {
  ResourceAssessmentSummary,
  ResourceDimension,
  ResourceExposureLink,
  ResourceRegulatoryStatus,
  ResourceStageConcentration,
} from "@/lib/api/resources";

function dim(partial: Partial<ResourceDimension>): ResourceDimension {
  return {
    kind: "risk",
    dimension_code: "stage_concentration",
    available: true,
    risk_value: 64,
    weight: 0.5,
    contribution: 32,
    raw_value: 6400,
    raw_unit: "HHI (0-10000)",
    stage_code: "mining",
    rationale: "Étape la plus concentrée.",
    detail: {},
    source_release_ids: [12],
    ...partial,
  };
}

describe("AssessmentDimensionsPanel — décomposition risque ≠ confiance", () => {
  const dims: ResourceDimension[] = [
    dim({ dimension_code: "stage_concentration", available: true, risk_value: 64, source_release_ids: [12] }),
    dim({ dimension_code: "supplier_dependency", available: false, risk_value: null, contribution: null, weight: null, source_release_ids: [] }),
    dim({ kind: "confidence", dimension_code: "market_coverage", available: true, risk_value: null, raw_value: 0.8, weight: 0.3, rationale: "Marché documenté à 80 %.", source_release_ids: [] }),
  ];
  const html = renderToStaticMarkup(
    <AssessmentDimensionsPanel dimensions={dims} riskScore={42} confidence={70} />,
  );

  it("rend le risque et la confiance dans deux colonnes séparées", () => {
    expect(html).toContain('data-testid="assessment-risk-dimensions"');
    expect(html).toContain('data-testid="assessment-confidence-dimensions"');
  });

  it("affiche une composante disponible avec sa valeur, jamais une jauge unique", () => {
    expect(html).toContain('data-testid="risk-dim-stage_concentration"');
    expect(html).toContain('data-available="true"');
    expect(html).toContain("64 / 100");
  });

  it("marque une composante manquante « Donnée manquante » — jamais un risque nul", () => {
    expect(html).toContain('data-testid="risk-dim-supplier_dependency"');
    expect(html).toContain('data-available="false"');
    expect(html).toContain("Donnée manquante");
    // pas de barre chiffrée pour la composante absente
    expect(html).not.toContain('data-testid="risk-bar-supplier_dependency"');
    expect(html).toContain('data-testid="assessment-missing-note"');
  });

  it("trace la provenance (source_release_id) et avoue l'absence de source", () => {
    expect(html).toContain('data-testid="risk-prov-stage_concentration"');
    expect(html).toContain("#12"); // release #12
    expect(html).toContain('data-testid="confidence-prov-market_coverage-none"');
  });
});

describe("ResourceIndexCard — indice secondaire & décomposable", () => {
  it("affiche risque ET confiance côte à côte, plus le disclaimer non officiel", () => {
    const html = renderToStaticMarkup(
      <ResourceIndexCard
        riskScore={42}
        confidence={70}
        observedHhi={6400}
        coveragePct={80}
        missingSharePct={20}
        methodologyCode="CC-RESOURCE-EXPOSURE"
        methodologyVersion="0.1.0"
        assessmentYear={2024}
      />,
    );
    expect(html).toContain('data-testid="index-risk"');
    expect(html).toContain('data-testid="index-confidence"');
    expect(html).toContain("Indice secondaire");
    expect(html).toContain('data-testid="resource-methodology-disclaimer"');
    expect(html).toContain("Année 2024");
  });

  it("rend « Non calculé » pour un risque absent, sans jamais afficher 0", () => {
    const html = renderToStaticMarkup(
      <ResourceIndexCard
        riskScore={null}
        confidence={55}
        methodologyCode="CC-RESOURCE-EXPOSURE"
        methodologyVersion="0.1.0"
      />,
    );
    expect(html).toContain('data-testid="index-risk-uncomputed"');
    expect(html).toContain("non calculé");
    // la confiance reste affichée
    expect(html).toContain("55");
  });
});

describe("StageConcentrationPanel — concentration par étape", () => {
  const stage: ResourceStageConcentration = {
    stage_code: "mining",
    reference_year: 2024,
    metric_code: "production",
    country_shares: [
      { country_code: "CN", share_pct: 60, data_status: "estimated" },
      { country_code: "FR", share_pct: 20, data_status: "verified" },
    ],
    hhi: 6400,
    observed_total_pct: 80,
    coverage_pct: 80,
    missing_share_pct: 20,
    top_country_code: "CN",
    top_country_share_pct: 60,
    non_eu_pct: 75,
    country_count: 2,
    is_share_based: true,
    source_release_ids: [12],
  };

  it("affiche HHI, premier pays et géographie par étape", () => {
    const html = renderToStaticMarkup(<StageConcentrationPanel stages={[stage]} />);
    expect(html).toContain('data-testid="stage-mining"');
    expect(html).toContain("6400");
    expect(html).toContain("CN");
    expect(html).toContain("année 2024");
  });

  it("distingue absence de donnée de absence de risque (état vide)", () => {
    const html = renderToStaticMarkup(<StageConcentrationPanel stages={[]} />);
    expect(html).toContain('data-testid="stage-concentration-empty"');
    expect(html).toContain("pas absence de risque");
  });
});

describe("RegulatoryStatusPanel — statut versionné & sourcé-ou-avoué", () => {
  function reg(partial: Partial<ResourceRegulatoryStatus>): ResourceRegulatoryStatus {
    return {
      id: 1,
      company_id: null,
      resource_id: 1,
      regime: "crma",
      regulation_ref: "Reg (UE) 2024/1252",
      list_or_annex: "Annexe II — Critique",
      listing_status: "listed",
      validity_note: null,
      certainty: "confirmed",
      source_release_id: 7,
      verified_on: "2024-05-01",
      created_at: "2024-05-01T00:00:00Z",
      ...partial,
    };
  }

  it("affiche le régime, la version et l'année, avec l'indication sourcé", () => {
    const html = renderToStaticMarkup(<RegulatoryStatusPanel statuses={[reg({})]} />);
    expect(html).toContain('data-testid="regulation-crma"');
    expect(html).toContain("Reg (UE) 2024/1252");
    expect(html).toContain('data-testid="regulation-sourced-crma"');
  });

  it("avoue un statut non sourcé au lieu de le présenter comme confirmé", () => {
    const html = renderToStaticMarkup(
      <RegulatoryStatusPanel statuses={[reg({ regime: "eudr", source_release_id: null, certainty: "probable" })]} />,
    );
    expect(html).toContain('data-testid="regulation-unsourced-eudr"');
  });
});

describe("ModuleLinks — ponts vers CRMA / Eau / Énergie / Achats (D-4)", () => {
  const html = renderToStaticMarkup(<ModuleLinks />);
  it("lie les quatre modules qui portent l'empreinte réelle", () => {
    expect(html).toContain('href="/crma"');
    expect(html).toContain('href="/water"');
    expect(html).toContain('href="/scopes"');
    expect(html).toContain('href="/fournisseurs/scope3"');
  });
  it("expose une navigation nommée (accessibilité)", () => {
    expect(html).toContain('aria-label="Modules liés à l&#x27;exposition environnementale"');
  });
});

describe("MethodologyDisclaimer — accessibilité & message non officiel", () => {
  it("porte un rôle note et le message non officiel", () => {
    const html = renderToStaticMarkup(<MethodologyDisclaimer />);
    expect(html).toContain('role="note"');
    expect(html).toContain("non officielle");
    expect(html).toContain("PAS un score");
  });
});

describe("DimensionBar — motion gardée par reduced-motion", () => {
  const html = renderToStaticMarkup(
    <DimensionBar label="Concentration" valuePct={60} valueLabel="60 / 100" tone="high" />,
  );
  it("gate toute transition derrière motion-safe (désactivée sous prefers-reduced-motion)", () => {
    expect(html).toContain("motion-safe:transition-[width]");
    // aucune animation par keyframes non gardée
    expect(html).not.toContain("animate-");
  });
  it("rend la valeur en toutes lettres — le contenu ne dépend pas du mouvement", () => {
    expect(html).toContain("60 / 100");
    expect(html).toContain("width:60%");
  });
});

describe("ResourceDataStatus — réutilise DataStatusBadge", () => {
  it("nomme « Inféré » et expose l'aria-label du badge", () => {
    const html = renderToStaticMarkup(<ResourceDataStatus status="inferred" />);
    expect(html).toContain("Inféré");
    expect(html).toContain("aria-label=");
    expect(html).toContain("data-status-badge-estimated");
  });
});

describe("AssessmentSummaryTable — risque et confiance en colonnes distinctes", () => {
  function run(partial: Partial<ResourceAssessmentSummary>): ResourceAssessmentSummary {
    return {
      run_id: 1,
      resource_slug: "helium",
      resource_id: 1,
      assessment_year: 2024,
      status: "computed",
      risk_score: 42,
      confidence: 70,
      coverage_pct: 80,
      observed_hhi: 6400,
      missing_share_pct: 20,
      methodology_code: "CC-RESOURCE-EXPOSURE",
      methodology_version: "0.1.0",
      calculated_at: "2024-05-01T00:00:00Z",
      ...partial,
    };
  }

  it("sépare les colonnes risque et confiance et rend « Non calculé » pour un risque nul", () => {
    const html = renderToStaticMarkup(
      <AssessmentSummaryTable
        runs={[run({ run_id: 1 }), run({ run_id: 2, risk_score: null, status: "superseded" })]}
        linkToResource={false}
      />,
    );
    expect(html).toContain('data-testid="assessment-risk-1"');
    expect(html).toContain('data-testid="assessment-confidence-1"');
    expect(html).toContain("Non calculé");
    expect(html).toContain("Remplacé");
    expect(html).toContain("<caption");
  });

  it("rend l'état vide", () => {
    const html = renderToStaticMarkup(<AssessmentSummaryTable runs={[]} />);
    expect(html).toContain('data-testid="assessments-empty"');
  });
});

describe("ExposureLinksTable — pointeur lisible, jamais recopie", () => {
  function link(partial: Partial<ResourceExposureLink>): ResourceExposureLink {
    return {
      id: 1,
      company_id: 1,
      resource_id: 1,
      resource_slug: "cuivre",
      role: "material",
      link_kind: "purchase_line",
      linked_ref: "purchase_line:842",
      annual_mass_kg: 1000,
      annual_spend_eur: 50000,
      share_of_supply_pct: 30,
      stock_coverage_days: 45,
      data_status: "manual",
      created_at: "2024-01-01T00:00:00Z",
      ...partial,
    };
  }
  it("affiche le linked_ref et un en-tête accessible", () => {
    const html = renderToStaticMarkup(<ExposureLinksTable links={[link({})]} />);
    expect(html).toContain("purchase_line:842");
    expect(html).toContain('scope="col"');
    expect(html).toContain('data-testid="exposure-row-1"');
  });
  it("rend l'état vide sans prétendre à une absence de risque", () => {
    const html = renderToStaticMarkup(<ExposureLinksTable links={[]} />);
    expect(html).toContain('data-testid="exposures-empty"');
  });
});

describe("ResourceNav — onglet actif accessible", () => {
  it("marque l'onglet courant avec aria-current", () => {
    const html = renderToStaticMarkup(<ResourceNav active="methodology" />);
    expect(html).toContain('data-testid="resource-tab-methodology"');
    expect(html).toContain('aria-current="page"');
  });
});
