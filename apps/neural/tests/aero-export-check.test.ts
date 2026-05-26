/**
 * Tests Aéro / Marketing — API /api/demo/aero-export-check
 *
 * Contrat :
 *  - L'API est déterministe (aucun LLM, aucun fetch externe).
 *  - Les scénarios disponibles correspondent exactement aux JSON committés
 *    dans content/aero-marketing/master.json (sheet MASTER_SCENARIOS).
 *  - Un POST avec scenario_id inconnu retourne 400.
 *  - Un POST sans scenario_id retourne 400.
 *  - Un GET retourne la liste des scénarios disponibles.
 *  - Chaque scénario produit un verdict OK / WARN / KO et des règles + sources
 *    non vides (les agents JSON contiennent au moins 3 règles et 3 sources).
 */

import { describe, it, expect } from "vitest";

import { GET, POST } from "@/app/api/demo/aero-export-check/route";
import master from "@/content/aero-marketing/master.json";

type Scenario = { scenario_id: string; agent_slug: string; verdict: string };
const SCENARIOS = master.data.MASTER_SCENARIOS as unknown as Scenario[];

function jsonPost(body: unknown) {
  return new Request("http://localhost/api/demo/aero-export-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Aéro / Marketing — API aero-export-check", () => {
  it("GET retourne la liste des scénarios figés", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { scenarios: Scenario[] };
    expect(Array.isArray(payload.scenarios)).toBe(true);
    expect(payload.scenarios.length).toBe(SCENARIOS.length);
    expect(payload.scenarios.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(payload.scenarios.map((s) => s.scenario_id));
    for (const s of SCENARIOS) expect(ids.has(s.scenario_id)).toBe(true);
  });

  it("POST sans body JSON retourne 400", async () => {
    const req = new Request("http://localhost/api/demo/aero-export-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    // @ts-expect-error Request -> NextRequest compatible runtime
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST sans scenario_id retourne 400", async () => {
    // @ts-expect-error Request -> NextRequest compatible runtime
    const res = await POST(jsonPost({}));
    expect(res.status).toBe(400);
  });

  it("POST avec scenario_id inconnu retourne 400", async () => {
    // @ts-expect-error Request -> NextRequest compatible runtime
    const res = await POST(jsonPost({ scenario_id: "SCN-DOES-NOT-EXIST" }));
    expect(res.status).toBe(400);
  });

  for (const scenario of SCENARIOS) {
    it(`POST ${scenario.scenario_id} → verdict ${scenario.verdict} déterministe`, async () => {
      // @ts-expect-error Request -> NextRequest compatible runtime
      const res = await POST(jsonPost({ scenario_id: scenario.scenario_id }));
      expect(res.status).toBe(200);

      const payload = (await res.json()) as {
        result: {
          scenario: { id: string; verdict: string; metrics: Array<{ label: string }> };
          agent: { name: string; primaryRule: string } | null;
          rulesTriggered: Array<{ ruleId: string; niveau: string }>;
          sourcesCited: Array<{ sourceId: string }>;
        };
        meta: { mode: string };
      };

      expect(payload.result.scenario.id).toBe(scenario.scenario_id);
      expect(["OK", "WARN", "KO"]).toContain(payload.result.scenario.verdict);
      expect(payload.result.scenario.verdict).toBe(scenario.verdict);
      expect(payload.result.agent?.name).toBeTruthy();
      expect(payload.result.rulesTriggered.length).toBeGreaterThan(0);
      expect(payload.result.sourcesCited.length).toBeGreaterThan(0);
      expect(payload.result.scenario.metrics.length).toBeGreaterThan(0);
      expect(payload.meta.mode).toBe("deterministic-scenario-id");
    });
  }

  it("réponse identique pour deux appels successifs (déterminisme)", async () => {
    const first = SCENARIOS[0];
    // @ts-expect-error Request -> NextRequest compatible runtime
    const res1 = await POST(jsonPost({ scenario_id: first.scenario_id }));
    // @ts-expect-error Request -> NextRequest compatible runtime
    const res2 = await POST(jsonPost({ scenario_id: first.scenario_id }));
    const p1 = (await res1.json()) as { result: unknown };
    const p2 = (await res2.json()) as { result: unknown };
    expect(JSON.stringify(p1.result)).toBe(JSON.stringify(p2.result));
  });
});
