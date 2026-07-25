/**
 * tests/water-decision-client.test.ts — clients des surfaces décisionnelles
 * (Wave E-Interface, commit F1).
 *
 * `global.fetch` est déjà un `vi.fn()` posé par `tests/setup.ts` : aucun appel
 * réseau réel n'est possible ici.
 *
 * | Exigence | describe |
 * |---|---|
 * | schéma valide / invalide | « validation des réponses » |
 * | 304 | « lecture conditionnelle » |
 * | auth requise | « erreurs typées » |
 * | absence | « absence et état vide » |
 * | erreur | « erreurs typées » |
 * | aucun champ tenant accepté | « aucun tenant dans le contrat » |
 * | aucune URL externe | « aucune URL externe » |
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DecisionAuthError,
  DecisionContractError,
  DecisionSchemaNotReadyError,
  WiFinancialScenarioRequestSchema,
  evaluateFinancialScenario,
  fetchDecisionSynthesis,
  fetchPublicRegulatoryRegistry,
  fetchPublicSnapshot,
} from "@/lib/api/water-decision";
import { CANONICAL_EMPTY_SNAPSHOT } from "@/lib/water-intelligence/canonical-snapshot";
import { REGULATORY_REGISTRY } from "@/lib/water-intelligence/regulatory-registry";

const MODULE = resolve(__dirname, "..", "lib/api/water-decision.ts");

const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    headers: new Headers(init.headers ?? {}),
    json: async () => body,
    clone() {
      return this;
    },
  } as unknown as Response;
}

const SNAPSHOT_ENVELOPE = {
  schema_version: "1.0.0",
  is_empty: true,
  snapshot: CANONICAL_EMPTY_SNAPSHOT,
};

const SYNTHESIS = {
  company_id: 42,
  is_empty: false,
  facets: [
    {
      facet: "risk",
      label: "Risque hydrique",
      is_empty: false,
      vocabularies: ["water_stress_category_v1"],
      has_mixed_vocabularies: false,
      entries: [
        {
          facet: "risk",
          source_module: "/water",
          label: "Site 1",
          vocabulary: "water_stress_category_v1",
          value: "high",
          evidence_ref: "site_water_screening:1",
          absence_reason: null,
        },
      ],
    },
  ],
};

function quantity(value: string | null) {
  return { value, provenance: "assumption" as const, basis: "hypothèse de test" };
}

const SCENARIO = {
  scenario_code: "T",
  label: "Scénario de test",
  base_year: 2026,
  horizon_year: 2030,
  outage_days: quantity("10"),
  affected_capacity_share: quantity("0.5"),
  revenue_per_day: quantity("1000"),
  margin_rate: quantity("0.3"),
  additional_opex_per_day: quantity("200"),
  adaptation_capex: quantity("5000"),
  discount_rate: quantity("0.05"),
  sensitivity_variation_pct: "20",
  signals: [],
};

beforeEach(() => {
  mockFetch.mockReset();
});

/* --------------------------------------------------- Validation de réponse */

describe("validation des réponses", () => {
  it("accepte une charge conforme", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(SNAPSHOT_ENVELOPE));
    const result = await fetchPublicSnapshot();
    expect(result.kind).toBe("fresh");
  });

  it("lève sur une charge hors contrat plutôt que de dégrader", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ schema_version: 1, is_empty: "oui" }));
    await expect(fetchPublicSnapshot()).rejects.toBeInstanceOf(DecisionContractError);
  });

  it("valide le registre juridique public", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(REGULATORY_REGISTRY));
    const registry = await fetchPublicRegulatoryRegistry();
    expect(registry.verified_rule_count).toBe(0);
    expect(registry.rules.length).toBe(9);
  });

  it("lève si le registre est hors contrat", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ registry_version: "x" }));
    await expect(fetchPublicRegulatoryRegistry()).rejects.toBeInstanceOf(DecisionContractError);
  });

  it("valide la synthèse authentifiée", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(SYNTHESIS));
    const synthesis = await fetchDecisionSynthesis();
    expect(synthesis.company_id).toBe(42);
    expect(synthesis.facets[0].facet).toBe("risk");
  });

  it("refuse une facette de vocabulaire inconnu", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ...SYNTHESIS, facets: [{ ...SYNTHESIS.facets[0], facet: "esg_global" }] }),
    );
    await expect(fetchDecisionSynthesis()).rejects.toBeInstanceOf(DecisionContractError);
  });
});

/* ------------------------------------------------- Lecture conditionnelle */

describe("lecture conditionnelle", () => {
  it("n'envoie pas If-None-Match sans ETag connu", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(SNAPSHOT_ENVELOPE));
    await fetchPublicSnapshot();
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["If-None-Match"]).toBeUndefined();
  });

  it("envoie If-None-Match quand un ETag est connu", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(SNAPSHOT_ENVELOPE));
    await fetchPublicSnapshot({ knownEtag: 'W/"wi-abc"' });
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["If-None-Match"]).toBe('W/"wi-abc"');
  });

  it("rend « not-modified » sur 304, jamais une absence", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(null, { status: 304, headers: { etag: 'W/"wi-abc"' } }),
    );
    const result = await fetchPublicSnapshot({ knownEtag: 'W/"wi-abc"' });
    expect(result.kind).toBe("not-modified");
    // 304 signifie « inchangé », pas « absent » : aucun envelope n'est rendu,
    // et l'appelant conserve la charge qu'il détenait.
    expect("envelope" in result).toBe(false);
  });

  it("remonte l'ETag d'une réponse fraîche", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(SNAPSHOT_ENVELOPE, { headers: { etag: 'W/"wi-xyz"' } }),
    );
    const result = await fetchPublicSnapshot();
    expect(result.etag).toBe('W/"wi-xyz"');
  });
});

/* -------------------------------------------------------- Erreurs typées */

describe("erreurs typées", () => {
  it("traduit 401 en erreur d'authentification", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ detail: "Token manquant" }, { status: 401 }));
    await expect(fetchDecisionSynthesis()).rejects.toBeInstanceOf(DecisionAuthError);
  });

  it("traduit 403 en erreur d'authentification", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ detail: "refusé" }, { status: 403 }));
    await expect(fetchDecisionSynthesis()).rejects.toBeInstanceOf(DecisionAuthError);
  });

  it("traduit 503 schema_not_ready en erreur dédiée", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ detail: "schema_not_ready" }, { status: 503 }),
    );
    await expect(fetchDecisionSynthesis()).rejects.toBeInstanceOf(DecisionSchemaNotReadyError);
  });

  it("ne confond pas un 503 générique avec un schéma non prêt", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ detail: "Base indisponible" }, { status: 503 }));
    await expect(fetchDecisionSynthesis()).rejects.not.toBeInstanceOf(
      DecisionSchemaNotReadyError,
    );
  });

  it("remonte le détail serveur d'une erreur métier", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ detail: "ordre temporel impossible" }, { status: 422 }),
    );
    await expect(evaluateFinancialScenario(SCENARIO)).rejects.toThrow("ordre temporel");
  });
});

/* ------------------------------------------------ Absence et état vide */

describe("absence et état vide", () => {
  it("un snapshot vide reste un succès, pas une erreur", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(SNAPSHOT_ENVELOPE));
    const result = await fetchPublicSnapshot();
    expect(result.kind === "fresh" && result.envelope.is_empty).toBe(true);
  });

  it("un résultat financier absent porte son motif", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scenario_code: "T",
        label: "T",
        horizon_year: 2030,
        is_absent: true,
        absence_reason: "missing_input: revenue_per_day",
        components: {},
        present_value: null,
        probability_weighted: null,
        sensitivities: [],
        signals: [],
      }),
    );
    const result = await evaluateFinancialScenario(SCENARIO);
    expect(result.is_absent).toBe(true);
    expect(result.present_value).toBeNull();
    expect(result.absence_reason).toContain("revenue_per_day");
  });
});

/* ------------------------------------------ Aucun tenant dans le contrat */

describe("aucun tenant dans le contrat", () => {
  it("la requête financière n'accepte aucun champ tenant", () => {
    for (const field of ["company_id", "tenant_id", "site_id", "user_id"]) {
      expect(WiFinancialScenarioRequestSchema.shape).not.toHaveProperty(field);
    }
  });

  it("la synthèse ne prend aucun paramètre d'appel", () => {
    // `fetchDecisionSynthesis(signal?)` — un seul paramètre, et c'est un
    // AbortSignal. Le périmètre vient du jeton, jamais de l'appelant.
    expect(fetchDecisionSynthesis.length).toBeLessThanOrEqual(1);
  });

  it("aucune URL construite ne porte d'identifiant tenant", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(SYNTHESIS));
    await fetchDecisionSynthesis();
    const url = String(mockFetch.mock.calls[0][0]);
    for (const field of ["company_id", "tenant_id", "site_id", "user_id"]) {
      expect(url).not.toContain(field);
    }
  });

  it("le module ne déclare aucun défaut financier", () => {
    const source = readFileSync(MODULE, "utf-8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    // Aucun `.default(...)` sur une grandeur : un défaut serait une hypothèse
    // invisible posée au nom de l'utilisateur.
    expect(code).not.toMatch(/discount_rate[^;]*\.default\(/);
    expect(code).not.toMatch(/probability[^;]*\.default\(/);
    expect(code).not.toMatch(/margin_rate[^;]*\.default\(/);
    expect(code).not.toMatch(/revenue_per_day[^;]*\.default\(/);
  });
});

/* ---------------------------------------------------- Aucune URL externe */

describe("aucune URL externe", () => {
  it("toutes les requêtes visent l'API du produit", async () => {
    mockFetch.mockResolvedValue(jsonResponse(SNAPSHOT_ENVELOPE));
    await fetchPublicSnapshot();
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain("/water-intelligence/public-snapshot");
  });

  it("le module ne contient aucun domaine en dur", () => {
    const source = readFileSync(MODULE, "utf-8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/https?:\/\/(?!\/)/);
  });

  it("le module n'écrit rien : aucune méthode d'écriture hors POST d'évaluation", () => {
    const source = readFileSync(MODULE, "utf-8");
    expect(source).not.toContain('method: "PUT"');
    expect(source).not.toContain('method: "DELETE"');
    expect(source).not.toContain('method: "PATCH"');
  });
});
