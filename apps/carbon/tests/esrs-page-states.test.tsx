/**
 * M-05 — /esrs : chaque chiffre vient de l'API ; le badge « live » n'apparaît
 * que pour une matrice réelle et non vide ; plus de datapoints 257/378 ni
 * d'échéances « E1 · 15j / CSRD · 45j » ; `no_snapshot` = état vide.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ESRSPage } from "@/components/pages/esrs-page";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function esgSnapshot(issues: unknown[]) {
  return {
    snapshotVersion: "1",
    generatedAt: "2026-09-16T06:00:00Z",
    scores: { scoreGlobal: null, scoreE: null, scoreS: null, scoreG: null, enjeuxMateriels: null, statut: null },
    materialite: {
      enjeuxEvalues: issues.length,
      enjeuxMateriels: 0,
      enjeuxNonMateriels: 0,
      enjeuxMaterielsE: 0,
      enjeuxMaterielsS: 0,
      enjeuxMaterielsG: 0,
      issues,
    },
    qcControls: [],
    warnings: [],
  };
}

let mounted: { container: HTMLElement; root: Root } | null = null;

async function mount(): Promise<HTMLElement> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ESRSPage />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  mounted = { container, root };
  return container;
}

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

function expectNoInventedFigures(text: string) {
  expect(text).not.toContain("257/378");
  expect(text).not.toContain("15j");
  expect(text).not.toContain("45j");
  expect(text).not.toContain("Données de démonstration");
}

describe("ESRSPage — états", () => {
  it("404 no_snapshot : état vide, aucune donnée de démonstration", async () => {
    fetchMock.mockResolvedValue(
      json({ detail: { error: "no_snapshot", message: "Aucun snapshot ESG." } }, 404),
    );
    const container = await mount();
    const text = container.textContent ?? "";

    expect(container.querySelector('[data-testid="esrs-empty"]')).not.toBeNull();
    expect(text).toContain("Aucune donnée importée");
    expect(text).not.toContain("API 404");
    expect(text).not.toContain("Données réelles");
    expect(container.querySelector('a[href="/upload"]')).not.toBeNull();
    expectNoInventedFigures(text);
  });

  it("API injoignable : message présentable, aucune conformité affichée", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const container = await mount();
    const text = container.textContent ?? "";

    expect(container.querySelector('[data-testid="esrs-error"]')).not.toBeNull();
    expect(text).toContain("Service momentanément indisponible");
    expect(text).not.toContain("Failed to fetch");
    expect(text).not.toContain("conformité");
    expectNoInventedFigures(text);
  });

  it("snapshot sans enjeu rattaché : pas de badge live ni de 0 % présenté comme conformité", async () => {
    fetchMock.mockResolvedValue(json(esgSnapshot([])));
    const container = await mount();
    const text = container.textContent ?? "";

    expect(text).toContain("Matrice de matérialité non renseignée");
    expect(text).not.toContain("Données réelles");
    expect(text).not.toContain("% global");
    expectNoInventedFigures(text);
  });

  it("matrice réelle : badge live, conformité dérivée, datapoints « — »", async () => {
    fetchMock.mockResolvedValue(
      json(
        esgSnapshot([
          { code: "E1-01", label: "Climat", categorie: "E", normeEsrs: "ESRS E1", scoreImpact: null, scoreProbabilite: null, scoreImpactTotal: 4, materiel: true },
        ]),
      ),
    );
    const container = await mount();
    const text = container.textContent ?? "";

    expect(text).toContain("Données réelles — dérivées de votre matrice de matérialité ESG");
    // E1 = 80 %, 11 autres normes à 0 → moyenne 7 %.
    expect(text).toContain("7% global");
    expect(text).toContain("Datapoints renseignés");
    expect(text).toContain("Suivi des datapoints non disponible");
    expectNoInventedFigures(text);
  });
});
