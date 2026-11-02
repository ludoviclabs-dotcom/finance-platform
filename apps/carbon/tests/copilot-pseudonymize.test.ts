/**
 * T9.2 — le contexte envoyé au modèle par le copilote ne contient pas la
 * raison sociale du client (promesse de /trust/sub-processors).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { COMPANY_ALIAS, pseudonymizeContext } from "@/lib/ai/pseudonymize";

describe("pseudonymizeContext", () => {
  it("remplace les champs identifiants à toute profondeur et garde les indicateurs", () => {
    const input = {
      carbon: { company: "Acme Industrie SAS", scope1Tco2e: 1234.5, reportingYear: 2025 },
      vsme: { raisonSociale: "Acme Industrie SAS", effectifTotal: 820, SIREN: "123456789" },
      list: [{ legal_name: "Filiale Sud", value: 3 }],
    };
    const out = pseudonymizeContext(input);
    expect(out.carbon.company).toBe(COMPANY_ALIAS);
    expect(out.vsme.raisonSociale).toBe(COMPANY_ALIAS);
    expect(out.vsme.SIREN).toBe(COMPANY_ALIAS);
    expect(out.list[0].legal_name).toBe(COMPANY_ALIAS);
    expect(out.carbon.scope1Tco2e).toBe(1234.5);
    expect(out.vsme.effectifTotal).toBe(820);
    expect(JSON.stringify(out)).not.toContain("Acme");
    // L'entrée n'est pas mutée.
    expect(input.carbon.company).toBe("Acme Industrie SAS");
  });

  it("laisse les champs vides tels quels (pas d'alias inventé)", () => {
    expect(pseudonymizeContext({ company: null, raisonSociale: "" })).toEqual({ company: null, raisonSociale: "" });
  });

  it("la route copilote pseudonymise avant de construire le prompt système", () => {
    const route = readFileSync(resolve(__dirname, "../app/api/copilot/route.ts"), "utf8");
    expect(route).toMatch(/buildSystemPrompt\(\s*tools \? pseudonymizeContext\(tools\)/);
    expect(route).toMatch(/snapshots \? pseudonymizeContext\(snapshots\)/);
  });
});
