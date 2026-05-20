/**
 * Tests de la couche d'unification proof-status (refonte V2, PR 5).
 *
 * Vérifie la dérivation `displayStatus` pour les agents emblématiques et
 * garantit que `getUnifiedStatus()` ne lève pas sur les agents connus.
 */

import { describe, expect, it } from "vitest";

import { AGENT_ENTRIES } from "@/lib/public-catalog";
import { MATRIX } from "@/lib/data/agents-registry";
import {
  getProofBadgeShort,
  getProofCta,
  getProofDescription,
  getProofLabel,
  getProofScore,
  getProofScoreLabel,
  getUnifiedStatus,
  isClientReady,
  isExportAuditEligible,
  type UnifiedStatusKind,
} from "@/lib/proof-status";

describe("getUnifiedStatus — composition des 3 sources", () => {
  it("compose registry + catalog + proof pour reg-bank-comms (cas multidimensionnel typique)", () => {
    const status = getUnifiedStatus("reg-bank-comms");
    // Cellule Banque × Communication : excelSource null → registry planned.
    expect(status.registryStatus).toBe("planned");
    // Catalogue public : démo live publique avec scénarios figés.
    expect(status.catalogStatus).toBe("live");
    // Proof : export Markdown signé SHA-256 → score 3.
    expect(status.proofScore).toBe(3);
    // Display dérivé : on choisit le palier de preuve réel, pas le statut technique.
    expect(status.displayStatus).toBe("export_audit");
    expect(status.isExportAuditEligible).toBe(true);
    expect(status.isClientReady).toBe(false);
  });

  it("retourne client_ready uniquement pour les agents avec score 4", () => {
    // Aucun agent n'est marqué client-ready par défaut (cf. proof-catalog.test.ts).
    for (const entry of AGENT_ENTRIES) {
      if (entry.kind !== "agent") continue;
      const status = getUnifiedStatus(entry.slug);
      if (status.isClientReady) {
        expect(status.proofScore).toBe(4);
      }
    }
  });

  it("retourne 'unknown' sans planter pour un slug fantôme", () => {
    const status = getUnifiedStatus("agent-qui-nexiste-pas");
    expect(status.registryStatus).toBe("unknown");
    expect(status.catalogStatus).toBe("unknown");
    expect(status.proofScore).toBeNull();
    expect(status.displayStatus).toBe("unknown");
    expect(status.isClientReady).toBe(false);
    expect(status.isExportAuditEligible).toBe(false);
  });

  it("retourne 100% de displayStatus valides pour les agents du registry", () => {
    const validStatuses: UnifiedStatusKind[] = [
      "client_ready",
      "export_audit",
      "public_demo",
      "runtime_parsed",
      "excel_created",
      "planned",
      "unknown",
    ];
    const invalid: string[] = [];
    for (const cell of MATRIX) {
      for (const agent of cell.agents) {
        const status = getUnifiedStatus(agent.id);
        if (!validStatuses.includes(status.displayStatus)) {
          invalid.push(`${agent.id}: displayStatus invalide (${status.displayStatus})`);
        }
      }
    }
    expect(invalid, invalid.join("\n")).toEqual([]);
  });

  it("retourne 100% de displayStatus valides pour les agents AGENT_ENTRIES", () => {
    const validStatuses: UnifiedStatusKind[] = [
      "client_ready",
      "export_audit",
      "public_demo",
      "runtime_parsed",
      "excel_created",
      "planned",
      "unknown",
    ];
    const invalid: string[] = [];
    for (const entry of AGENT_ENTRIES) {
      if (entry.kind !== "agent") continue;
      const status = getUnifiedStatus(entry.slug);
      if (!validStatuses.includes(status.displayStatus)) {
        invalid.push(`${entry.slug}: displayStatus invalide (${status.displayStatus})`);
      }
      // Le score doit être défini pour tout agent public — sinon proof-catalog
      // a oublié un agent.
      if (status.proofScore === null) {
        invalid.push(`${entry.slug}: pas de proofScore (manquant dans proof-catalog)`);
      }
    }
    expect(invalid, invalid.join("\n")).toEqual([]);
  });
});

describe("Helpers de présentation", () => {
  it("getProofBadgeShort retourne un libellé court pour chaque statut", () => {
    const statuses: UnifiedStatusKind[] = [
      "client_ready",
      "export_audit",
      "public_demo",
      "runtime_parsed",
      "excel_created",
      "planned",
      "unknown",
    ];
    for (const status of statuses) {
      const label = getProofBadgeShort(status);
      expect(label, `${status} → libellé vide`).toBeTruthy();
      // Libellés courts < 15 caractères (sauf le cas "Prêt client" qui est intentionnel).
      expect(label.length).toBeLessThanOrEqual(15);
    }
  });

  it("getProofLabel retourne un libellé long non vide pour chaque statut", () => {
    const statuses: UnifiedStatusKind[] = [
      "client_ready",
      "export_audit",
      "public_demo",
      "runtime_parsed",
      "excel_created",
      "planned",
      "unknown",
    ];
    for (const status of statuses) {
      expect(getProofLabel(status), `${status} → label vide`).toBeTruthy();
    }
  });

  it("getProofDescription renvoie une phrase explicative pour chaque palier", () => {
    const statuses: UnifiedStatusKind[] = [
      "client_ready",
      "export_audit",
      "public_demo",
      "runtime_parsed",
      "excel_created",
      "planned",
      "unknown",
    ];
    for (const status of statuses) {
      const description = getProofDescription(status);
      expect(description.length, `${status} → description trop courte`).toBeGreaterThan(20);
    }
  });

  it("getProofCta retourne un label et un tone valide", () => {
    const statuses: UnifiedStatusKind[] = [
      "client_ready",
      "export_audit",
      "public_demo",
      "runtime_parsed",
      "excel_created",
      "planned",
      "unknown",
    ];
    const validTones = ["primary", "secondary", "ghost"];
    for (const status of statuses) {
      const cta = getProofCta(status);
      expect(cta.label, `${status} → CTA label vide`).toBeTruthy();
      expect(validTones).toContain(cta.tone);
    }
  });

  it("getProofScoreLabel couvre les 5 paliers 0-4", () => {
    expect(getProofScoreLabel(0)).toBeTruthy();
    expect(getProofScoreLabel(1)).toBeTruthy();
    expect(getProofScoreLabel(2)).toBeTruthy();
    expect(getProofScoreLabel(3)).toBeTruthy();
    expect(getProofScoreLabel(4)).toBeTruthy();
  });
});

describe("Helpers de prédicat", () => {
  it("isClientReady ↔ proofScore === 4 (pas d'agent client-ready par défaut)", () => {
    for (const entry of AGENT_ENTRIES) {
      if (entry.kind !== "agent") continue;
      const score = getProofScore(entry.slug);
      const ready = isClientReady(entry.slug);
      expect(ready).toBe(score === 4);
    }
  });

  it("isExportAuditEligible ↔ proofScore >= 3", () => {
    for (const entry of AGENT_ENTRIES) {
      if (entry.kind !== "agent") continue;
      const score = getProofScore(entry.slug);
      const eligible = isExportAuditEligible(entry.slug);
      expect(eligible).toBe(score !== null && score >= 3);
    }
  });
});
