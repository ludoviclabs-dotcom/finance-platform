/**
 * M-04 / m-18 — /dashboard ne revendique plus rien qu'il ne sait pas.
 *
 * Démonstration (snapshot vide) : aucune « Chaîne d'intégrité vérifiée »,
 * score ESRS « — » (plus de 62 codé en dur), veille réglementaire sourcée,
 * aucun persona fictif ni compte à rebours CSRD inventé.
 * Données réelles : badge d'intégrité issu de l'API, score ESRS dérivé de la
 * matrice de matérialité, aucune tendance / position SBTi de maquette.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard",
}));

import { DashboardPage } from "@/components/pages/dashboard-page";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const EMPTY_CARBON = {
  scope1Tco2e: null,
  scope2LbTco2e: null,
  scope3Tco2e: null,
  totalS123Tco2e: null,
  intensityRevenueTco2ePerMEur: null,
  intensityFteTco2ePerFte: null,
  turnoverAlignedPct: null,
  capexAlignedPct: null,
  renewableSharePct: null,
  targetReductionS12Pct: null,
  estimatedCbamCostEur: null,
};

function consolidatedBody(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-09-16T06:00:00Z",
    company: { name: null, reportingYear: null, sectorActivity: null, fte: null, revenueNetEur: null },
    carbon: EMPTY_CARBON,
    vsme: {},
    esg: { scoreGlobal: null },
    finance: {},
    deltas: { totalS123Tco2e: null, totalS123Tco2ePct: null, scoreGlobal: null, scorePct: null, greenCapexPct: null },
    health: {},
    alerts: { totalActive: 0, firedSinceLastCheck: 0, domains: [] },
    rawCarbon: null,
    rawVsme: null,
    rawEsg: null,
    rawFinance: null,
    ...overrides,
  };
}

function installApi(consolidated: unknown) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/dashboard/consolidated")) return json(consolidated);
    if (url.includes("/chain/status")) {
      return json({ scheduled: true, ok: true, broken_at: null, checked: 25, verified_at: null });
    }
    if (url.includes("/audit/events")) {
      return json({
        total: 1,
        events: [
          { id: "ev-1", timestamp: new Date().toISOString(), type: "ingest", title: "Import du classeur carbone", status: "ok" },
        ],
      });
    }
    if (url.includes("/beges/filings")) {
      return json({
        status: "aucun_bilan",
        label: "Aucun bilan déclaré",
        next_due_at: null,
        days_until_due: null,
        last_exercise_year: null,
        last_filed_at: null,
        filings: [],
      });
    }
    return json({ detail: "Not Found" }, 404);
  });
}

async function mount(node: React.ReactElement): Promise<{ container: HTMLElement; root: Root }> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  // Laisse se résoudre les chargements successifs (snapshot puis panneaux).
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  return { container, root };
}

let mounted: { container: HTMLElement; root: Root } | null = null;

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(async () => {
  if (mounted) {
    const current = mounted;
    await act(async () => current.root.unmount());
    current.container.remove();
    mounted = null;
  }
});

function calledUrls(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

describe("DashboardPage — mode démonstration (snapshot vide)", () => {
  it("aucune revendication d'intégrité, score ESRS « — », veille sourcée", async () => {
    installApi(consolidatedBody());
    mounted = await mount(<DashboardPage />);
    const text = mounted.container.textContent ?? "";

    expect(text).toContain("Données de démonstration");
    expect(mounted.container.querySelector('[data-testid="demo-state-badge"]')).not.toBeNull();
    expect(text).not.toContain("Chaîne d'intégrité vérifiée");
    expect(calledUrls().some((u) => u.includes("/chain/status"))).toBe(false);

    // Score ESRS : plus de 62 codé en dur.
    expect(mounted.container.querySelector('[data-testid="esrs-score-empty"]')).not.toBeNull();
    expect(text).toContain("Score non calculé");

    // Veille réglementaire réelle et sourcée, plus de brève inventée.
    expect(text).not.toContain("15/03/26");
    expect(text).toContain("Commission européenne · 03/07/2026");
    expect(text).toContain("2026/470");
    const source = mounted.container.querySelector('a[href^="https://www.efrag.org/"]');
    expect(source?.getAttribute("rel")).toContain("noopener");

    // Ni persona fictif, ni échéances inventées, ni validation d'auditeur.
    expect(text).not.toContain("Marie");
    expect(text).not.toContain("Dépôt CSRD");
    expect(text).not.toContain("Rapport ESRS E1");
    expect(text).not.toContain("validé par l'auditeur");
    expect(mounted.container.querySelector('[data-testid="deadlines-empty"]')).not.toBeNull();
    // Aucun connecteur présenté comme connecté.
    expect(mounted.container.querySelector(".cc-conn.connected")).toBeNull();
    expect(text).toContain("Exemplia Industrie (entreprise fictive)");
  });
});

describe("DashboardPage — données réelles", () => {
  const live = consolidatedBody({
    company: { name: "Acme SAS", reportingYear: 2025, sectorActivity: null, fte: 120, revenueNetEur: null },
    carbon: { ...EMPTY_CARBON, scope1Tco2e: 100, scope2LbTco2e: 100, scope3Tco2e: 800, totalS123Tco2e: 1000 },
    rawEsg: {
      materialite: {
        issues: [
          { code: "E1-01", label: "Climat", categorie: "E", normeEsrs: "ESRS E1", scoreImpact: null, scoreProbabilite: null, scoreImpactTotal: 5, materiel: true },
        ],
      },
    },
  });

  it("badge d'intégrité de l'API, score dérivé, aucune valeur de maquette", async () => {
    installApi(live);
    mounted = await mount(<DashboardPage />);
    const text = mounted.container.textContent ?? "";

    expect(text).not.toContain("Données de démonstration");
    expect(mounted.container.querySelector('[data-testid="demo-state-badge"]')).toBeNull();
    expect(text).toContain("Chaîne d'intégrité vérifiée");
    expect(text).toContain("25 events");

    // ESRS dérivé de la matrice (E1 à 100 %, 1 norme conforme sur 12).
    expect(mounted.container.querySelector('[data-testid="esrs-score-empty"]')).toBeNull();
    expect(text).toContain("1 conformes");
    expect(text).not.toContain("8 conformes");

    // Parts calculées sur les totaux réels (10 / 10 / 80), pas 13 / 9 / 78.
    expect(text).toContain("Le Scope 3 pèse 80 % de vos émissions");
    expect(text).not.toContain("78 %");

    // Pas de tendance, de position SBTi ni de variation inventées.
    expect(text).not.toContain("SBTi ✓");
    expect(text).not.toContain("5.8 %");
    expect(text).not.toContain("Top 25 %");
    expect(text).not.toContain("−114 tCO₂e/an");

    // Activité = journal d'audit réel.
    expect(text).toContain("Import du classeur carbone");
    expect(text).toContain("Acme SAS · données issues de vos imports");
    expect(text).not.toContain("Exemplia");
  });
});
