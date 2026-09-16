/**
 * M-04 / M-05 — règles pures du cockpit : données réelles vs démonstration,
 * score ESRS partagé avec /esrs, échéance BEGES, activité du journal d'audit.
 */

import { describe, expect, it } from "vitest";

import type { AuditEvent, ConsolidatedSnapshot, MaterialiteIssue } from "@/lib/api";
import {
  REGULATORY_NOTES,
  auditEventsToActivity,
  buildEsrsCockpitState,
  hasLiveCarbon,
  scopeShares,
} from "@/components/cockpit/dashboard-model";
import {
  deriveEsrsStandards,
  extractMaterialiteIssues,
  hasEsrsData,
  normalizeNorme,
  summarizeEsrs,
} from "@/components/cockpit/esrs-derivation";
import { describeBegesDeadline } from "@/lib/beges-deadline";
import { formatRelativeTimeFr } from "@/lib/relative-time";

function issue(overrides: Partial<MaterialiteIssue>): MaterialiteIssue {
  return {
    code: "E1-01",
    label: "Émissions",
    categorie: "E",
    normeEsrs: "ESRS E1",
    scoreImpact: null,
    scoreProbabilite: null,
    scoreImpactTotal: null,
    materiel: null,
    ...overrides,
  };
}

function consolidated(total: number | null): ConsolidatedSnapshot {
  return { carbon: { totalS123Tco2e: total } } as unknown as ConsolidatedSnapshot;
}

describe("hasLiveCarbon — vide ≠ réel", () => {
  it("total > 0 : données réelles", () => {
    expect(hasLiveCarbon(consolidated(9550))).toBe(true);
  });

  it("total nul, absent ou invalide : pas de données réelles", () => {
    expect(hasLiveCarbon(consolidated(0))).toBe(false);
    expect(hasLiveCarbon(consolidated(null))).toBe(false);
    expect(hasLiveCarbon(consolidated(Number.NaN))).toBe(false);
    expect(hasLiveCarbon(null)).toBe(false);
  });
});

describe("scopeShares", () => {
  it("parts calculées sur les totaux (jeu de la maquette : 13 / 9 / 78)", () => {
    expect(scopeShares([1240, 890, 7420])).toEqual([13, 9, 78]);
  });

  it("totaux nuls ou invalides : 0 %", () => {
    expect(scopeShares([0, 0, 0])).toEqual([0, 0, 0]);
    expect(scopeShares([Number.NaN, -5, 10])).toEqual([0, 0, 100]);
  });
});

describe("dérivation ESRS (source unique /esrs + tableau de bord)", () => {
  const issues = [
    issue({ code: "E1-01", normeEsrs: "ESRS E1", scoreImpactTotal: 5, materiel: true }),
    issue({ code: "E1-02", normeEsrs: "E1 — Climat", scoreImpactTotal: 3, materiel: true }),
    issue({ code: "S1-01", normeEsrs: "ESRS S1", materiel: true }),
    issue({ code: "S1-02", normeEsrs: "ESRS S1", materiel: false }),
    issue({ code: "XX", normeEsrs: "Hors référentiel" }),
  ];

  it("normalise les libellés de norme", () => {
    expect(normalizeNorme("esrs e1")).toBe("ESRS E1");
    expect(normalizeNorme("ESRS S1")).toBe("ESRS S1");
    expect(normalizeNorme("ESRS E1-6")).toBe("ESRS E1");
    expect(normalizeNorme("E5 — Économie circulaire")).toBe("ESRS E5");
    expect(normalizeNorme("ESRS 2")).toBe("ESRS 2");
    expect(normalizeNorme("Transverse (ESRS 1)")).toBe("ESRS 1");
    // Sans espace : ce sont les normes générales, pas S1 / S2.
    expect(normalizeNorme("ESRS2")).toBe("ESRS 2");
    expect(normalizeNorme("ESRS1")).toBe("ESRS 1");
    expect(normalizeNorme("Hors référentiel")).toBeNull();
    expect(normalizeNorme("ESRS 12")).toBeNull();
    expect(normalizeNorme(42)).toBeNull();
  });

  it("avancement par norme : moyenne des scores, sinon part matérielle", () => {
    const standards = deriveEsrsStandards(issues);
    expect(standards).toHaveLength(12);
    const e1 = standards.find((s) => s.id === "ESRS E1")!;
    expect(e1.progress).toBe(80); // (5 + 3) / 2 / 5
    expect(e1.status).toBe("compliant");
    const s1 = standards.find((s) => s.id === "ESRS S1")!;
    expect(s1.progress).toBe(50); // 1 matériel sur 2
    expect(s1.status).toBe("in_progress");
    expect(standards.find((s) => s.id === "ESRS G1")!.progress).toBe(0);
    expect(hasEsrsData(standards)).toBe(true);
  });

  it("résumé : moyenne sur les 12 normes", () => {
    const summary = summarizeEsrs(deriveEsrsStandards(issues));
    expect(summary).toEqual({ avg: 11, compliant: 1, inProgress: 1, notStarted: 10 });
  });

  it("matrice vide ou non rattachée : aucune donnée", () => {
    expect(hasEsrsData(deriveEsrsStandards([]))).toBe(false);
    expect(hasEsrsData(deriveEsrsStandards([issue({ normeEsrs: "?" })]))).toBe(false);
  });

  it("extractMaterialiteIssues est défensif", () => {
    expect(extractMaterialiteIssues(null)).toEqual([]);
    expect(extractMaterialiteIssues({ materialite: { issues: "x" } })).toEqual([]);
    expect(extractMaterialiteIssues({ materialite: { issues: [null, { code: 1 }, issues[0]] } })).toEqual([
      issues[0],
    ]);
  });

  it("score du cockpit = « — » (null) sans matrice, jamais 62", () => {
    const state = buildEsrsCockpitState(null);
    expect(state.score).toBeNull();
    expect(state.radial).toEqual([]);
    expect(buildEsrsCockpitState({ materialite: { issues: [] } }).score).toBeNull();
  });

  it("score du cockpit = moyenne affichée par /esrs, heatmap des 10 normes thématiques", () => {
    const state = buildEsrsCockpitState({ materialite: { issues } });
    expect(state.score).toBe(summarizeEsrs(deriveEsrsStandards(issues)).avg);
    expect(state.radial).toHaveLength(10);
    expect(state.radial[0]).toEqual({ k: "E1", label: "Climat", v: 80 });
    expect(state.compliant).toBe(1);
  });
});

describe("veille réglementaire", () => {
  it("plus de brève EFRAG inventée ; faits datés, le premier est sourcé", () => {
    const serialized = JSON.stringify(REGULATORY_NOTES);
    expect(serialized).not.toContain("15/03/26");
    expect(REGULATORY_NOTES[0]).toMatchObject({
      src: "Commission européenne",
      date: "03/07/2026",
      href: expect.stringMatching(/^https:\/\/www\.efrag\.org\//),
    });
    expect(serialized).toContain("2026/470");
    expect(serialized).toContain("19/03/2027");
  });
});

describe("auditEventsToActivity", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  const events: AuditEvent[] = [
    { id: "1", timestamp: "2026-09-16T11:50:00Z", type: "login", title: "Connexion", status: "ok" },
    { id: "2", timestamp: "2026-09-16T10:00:00Z", type: "ingest", title: "Import carbone", status: "ok", detail: "v3" },
    { id: "3", timestamp: "2026-09-15T08:00:00Z", type: "export", title: "Export", status: "ok" },
    { id: "4", timestamp: "2026-09-10T08:00:00Z", type: "validation", title: "Contrôle", status: "error" },
  ];

  it("reprend le journal réel, sans les connexions", () => {
    expect(auditEventsToActivity(events, now)).toEqual([
      { id: "2", type: "upload", title: "Import carbone", desc: "v3", time: "il y a 2 h" },
      { id: "3", type: "report", title: "Export", desc: "", time: "hier" },
      { id: "4", type: "alert", title: "Contrôle", desc: "", time: "il y a 6 j" },
    ]);
  });

  it("journal vide : aucune activité inventée", () => {
    expect(auditEventsToActivity([], now)).toEqual([]);
  });
});

describe("describeBegesDeadline (M-05)", () => {
  const now = new Date("2026-09-16T00:00:00Z");

  it("échéance inconnue : aucun indicateur", () => {
    expect(describeBegesDeadline(null, now)).toBeNull();
    expect(
      describeBegesDeadline({ status: "aucun_bilan", next_due_at: null, days_until_due: null }, now),
    ).toBeNull();
    expect(
      describeBegesDeadline({ status: "a_jour", next_due_at: "pas une date", days_until_due: 3 }, now),
    ).toBeNull();
  });

  it("utilise le décompte de l'API et son statut", () => {
    expect(
      describeBegesDeadline(
        { status: "echeance_proche", next_due_at: "2026-10-16", days_until_due: 30 },
        now,
      ),
    ).toMatchObject({ days: 30, level: "warn", chipText: "BEGES · 30 j" });
  });

  it("calcule le décompte si l'API ne le fournit pas", () => {
    expect(
      describeBegesDeadline({ status: "a_jour", next_due_at: "2027-09-16T00:00:00Z", days_until_due: null }, now),
    ).toMatchObject({ days: 365, level: "info" });
  });

  it("échéance dépassée : alerte explicite", () => {
    expect(
      describeBegesDeadline({ status: "en_retard", next_due_at: "2026-09-01", days_until_due: -15 }, now),
    ).toMatchObject({ level: "alert", chipText: "BEGES · échéance dépassée" });
  });
});

describe("formatRelativeTimeFr", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  it("formats lisibles, jamais « Invalid Date »", () => {
    expect(formatRelativeTimeFr("2026-09-16T11:59:30Z", now)).toBe("à l'instant");
    expect(formatRelativeTimeFr("2026-09-16T11:55:00Z", now)).toBe("il y a 5 min");
    expect(formatRelativeTimeFr("bad", now)).toBeNull();
    expect(formatRelativeTimeFr(null, now)).toBeNull();
    expect(formatRelativeTimeFr("2026-08-01T00:00:00Z", now)).not.toContain("Invalid");
  });
});
