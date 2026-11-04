/**
 * context-candidates.test.ts — les repères de contexte restent des CANDIDATS.
 */

import { describe, expect, it } from "vitest";

import {
  CONTEXT_CANDIDATES,
  WiContextCandidatesSchema,
  WiContextFactSchema,
  isHumanReviewed,
  pfasAnalysesAboveLimit,
  publishableContextFacts,
} from "./context-candidates";
import { PILOT_FILE, pilotIsPublished } from "./pilot-snapshot";

describe("document de repères de contexte", () => {
  it("respecte son contrat", () => {
    expect(() => WiContextCandidatesSchema.parse(CONTEXT_CANDIDATES)).not.toThrow();
  });

  it("n'est pas revu : aucun repère n'est publiable", () => {
    expect(CONTEXT_CANDIDATES.review.status).toBe("pending_human_review");
    expect(CONTEXT_CANDIDATES.review.reviewed_by).toBeNull();
    expect(isHumanReviewed(CONTEXT_CANDIDATES)).toBe(false);
    expect(publishableContextFacts()).toEqual([]);
  });

  it("ne publie jamais une valeur non vérifiée, même après revue", () => {
    const reviewed = {
      ...CONTEXT_CANDIDATES,
      review: { status: "reviewed" as const, reviewed_by: "relecteur", reviewed_on: "2026-11-05" },
    };
    const published = publishableContextFacts(reviewed);
    expect(published.length).toBeGreaterThan(0);
    expect(published.every((f) => f.verification !== "relayed_unverified")).toBe(true);
  });

  it("une revue sans réviseur nommé ne compte pas", () => {
    const unsigned = {
      ...CONTEXT_CANDIDATES,
      review: { status: "reviewed" as const, reviewed_by: "  ", reviewed_on: "2026-11-05" },
    };
    expect(publishableContextFacts(unsigned)).toEqual([]);
  });

  it("garde les identifiants de repères uniques", () => {
    const ids = CONTEXT_CANDIDATES.facts.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ne mêle aucun repère au pilote BNPE publié", () => {
    const pilotSource = pilotIsPublished(PILOT_FILE) ? PILOT_FILE.pilot.source_code : null;
    for (const fact of CONTEXT_CANDIDATES.facts) {
      expect(JSON.stringify(fact)).not.toContain("HUBEAU_BNPE_PRELEVEMENTS");
      if (pilotSource) expect(JSON.stringify(fact)).not.toContain(pilotSource);
    }
  });

  it("signale la réserve sur l'échantillon PFAS de 30 communes", () => {
    const fact = CONTEXT_CANDIDATES.facts.find((f) => f.id === "pfas-robinet");
    expect(fact?.caveat).toMatch(/30 communes/);
  });

  it("garde le chiffre de captages introuvable comme non vérifié", () => {
    const fact = CONTEXT_CANDIDATES.facts.find((f) => f.id === "captages-abandonnes");
    expect(fact?.verification).toBe("relayed_unverified");
  });
});

describe("garde-fous du contrat de repère", () => {
  const base = {
    id: "x",
    theme: "couts",
    label: "Prix",
    value: 1,
    unit: "€/m³",
    period: "2024",
    geography: { scope: "france", code: "FR", label: "France" },
    primary_source: { name: "OFB", url: null },
    relay: null,
    verification: "primary_verified",
    caveat: null,
  };

  it("refuse une valeur dite vérifiée sans lien vers la source", () => {
    expect(WiContextFactSchema.safeParse(base).success).toBe(false);
  });

  it("refuse une valeur relayée sans relais nommé", () => {
    expect(
      WiContextFactSchema.safeParse({ ...base, verification: "relayed_primary_named" }).success,
    ).toBe(false);
  });
});

describe("cas locaux — commune 34172", () => {
  it("restrictions : une année par ligne, dans l'ordre, sans trou", () => {
    const years = CONTEXT_CANDIDATES.local_cases.restrictions_34172.years.map((y) => y.year);
    for (let i = 1; i < years.length; i += 1) expect(years[i]).toBe(years[i - 1] + 1);
  });

  it("restrictions : 2023 compte des jours de crise", () => {
    const y2023 = CONTEXT_CANDIDATES.local_cases.restrictions_34172.years.find((y) => y.year === 2023);
    expect(y2023?.days_crise).toBeGreaterThan(0);
  });

  it("PFAS : aucune analyse relevée au-delà de la limite de qualité", () => {
    expect(pfasAnalysesAboveLimit()).toEqual([]);
  });
});
