import { describe, expect, it } from "vitest";

import {
  ASTERION_AI_TRACE,
  ASTERION_BADGES,
  ASTERION_EXCLUDED_EVIDENCE,
  ASTERION_METRICS,
  ASTERION_REVIEW,
} from "@/lib/demo/asterion-motion-data";
import { ASTERION_TOUR, DIRECTOR_TOTAL_MS } from "@/lib/demo/asterion-motion-tour";

describe("Asterion demo — invariants de données (fictif, déterministe)", () => {
  it("porte les 3 badges de démonstration fictive", () => {
    expect(ASTERION_BADGES).toContain("IA SIMULÉE");
    expect(ASTERION_BADGES).toContain("ZÉRO APPEL EXTERNE");
    expect(ASTERION_BADGES).toContain("DÉMONSTRATION FICTIVE");
  });

  it("expose les métriques canoniques du scénario", () => {
    expect(ASTERION_METRICS.scope3.value).toBe(3480);
    expect(ASTERION_METRICS.magnetsShare.value).toBeCloseTo(61.8, 1);
    expect(ASTERION_METRICS.scope2Lb.value).toBe(1860);
    expect(ASTERION_METRICS.scope2Mb.value).toBe(1090);
    expect(ASTERION_METRICS.coverage.value).toBe(54);
    expect(ASTERION_METRICS.dependency.value).toBe(92);
    expect(ASTERION_METRICS.dependency.status).toBe("estimated"); // estimé ≠ vérifié
  });

  it("le parcours a 10 étapes dont l'étape IA, et un mode réalisateur ~2 min", () => {
    expect(ASTERION_TOUR).toHaveLength(10);
    expect(ASTERION_TOUR.filter((s) => s.isAiStep)).toHaveLength(1);
    // Chaque étape a un lien d'exploration.
    for (const s of ASTERION_TOUR) expect(s.exploreHref).toMatch(/^\//);
    // ~2 minutes (110–140 s).
    expect(DIRECTOR_TOTAL_MS).toBeGreaterThanOrEqual(110_000);
    expect(DIRECTOR_TOTAL_MS).toBeLessThanOrEqual(140_000);
  });

  it("la revue IA canonique produit EXACTEMENT les 4 statuts déterministes", () => {
    const statuses = ASTERION_REVIEW.claims.map((c) => c.support_status);
    expect(statuses).toContain("supported");
    expect(statuses).toContain("partially_supported");
    expect(statuses).toContain("contradicted");
    expect(statuses).toContain("unsupported");
  });

  it("le claim contredit cite une preuve résolue + flag contradiction ; le non-étayé n'a aucune citation", () => {
    const contradicted = ASTERION_REVIEW.claims.find((c) => c.support_status === "contradicted");
    expect(contradicted?.structured_payload?.contradiction).toBe(true);
    expect(contradicted?.citations.length).toBe(1);

    const unsupported = ASTERION_REVIEW.claims.find((c) => c.support_status === "unsupported");
    expect(unsupported?.citations.length).toBe(0);
  });

  it("la revue est gratuite et sans appel réseau (mode demo)", () => {
    expect(ASTERION_REVIEW.run.provider).toBe("demo");
    expect(ASTERION_REVIEW.run.cost_estimate).toBe(0);
  });

  it("la trace fonctionnelle a 6 étapes et exclut 2 preuves (licence/sensibilité)", () => {
    expect(ASTERION_AI_TRACE).toHaveLength(6);
    expect(ASTERION_EXCLUDED_EVIDENCE).toHaveLength(2);
    const reasons = ASTERION_EXCLUDED_EVIDENCE.map((e) => e.reason);
    expect(reasons).toContain("sensibilité");
    expect(reasons).toContain("licence");
  });
});
