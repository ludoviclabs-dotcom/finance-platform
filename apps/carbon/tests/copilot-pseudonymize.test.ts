/**
 * T9.2 — le contexte envoyé au modèle par le copilote ne contient pas la
 * raison sociale du client (promesse de /trust/sub-processors).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  COMPANY_ALIAS,
  IDENTIFIER_PLACEHOLDER,
  collectIdentifyingValues,
  pseudonymizeContext,
  pseudonymizeMessages,
  pseudonymizeText,
} from "@/lib/ai/pseudonymize";

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

  it("la route copilote pseudonymise aussi le texte des messages", () => {
    const route = readFileSync(resolve(__dirname, "../app/api/copilot/route.ts"), "utf8");
    expect(route).toMatch(/convertToModelMessages\(pseudonymizeMessages\(messages, knownIdentifiers\)\)/);
  });
});

describe("pseudonymizeText / pseudonymizeMessages", () => {
  const context = { carbon: { company: "Acme Industrie SAS" }, vsme: { raisonSociale: "Acme", siren: "123456789" } };
  const known = collectIdentifyingValues(context);

  it("remplace les valeurs connues du contexte, la plus longue d'abord", () => {
    expect(pseudonymizeText("Le bilan d'ACME Industrie SAS et d'Acme", known)).toBe(
      `Le bilan d'${COMPANY_ALIAS} et d'${COMPANY_ALIAS}`,
    );
    expect(pseudonymizeText("notre numéro 123456789", known)).toBe(`notre numéro ${IDENTIFIER_PLACEHOLDER}`);
  });

  it("masque les identifiants reconnaissables sans toucher aux indicateurs", () => {
    expect(pseudonymizeText("SIREN : 552 100 554 et 12 500 tCO2e")).toBe(
      `SIREN : ${IDENTIFIER_PLACEHOLDER} et 12 500 tCO2e`,
    );
    expect(pseudonymizeText("SIRET 55210055400013")).toBe(`SIRET ${IDENTIFIER_PLACEHOLDER}`);
    expect(pseudonymizeText("TVA FR40303265045")).toBe(`TVA ${IDENTIFIER_PLACEHOLDER}`);
    expect(pseudonymizeText("Scope 1 : 123456789 kgCO2e")).toBe("Scope 1 : 123456789 kgCO2e");
  });

  it("ne réécrit que les parties texte des messages", () => {
    const messages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "Analyse Acme Industrie SAS" }, { type: "file", url: "x" }] },
    ];
    const out = pseudonymizeMessages(messages, known);
    expect(out[0].parts[0]).toEqual({ type: "text", text: `Analyse ${COMPANY_ALIAS}` });
    expect(out[0].parts[1]).toEqual({ type: "file", url: "x" });
    expect(messages[0].parts[0]).toEqual({ type: "text", text: "Analyse Acme Industrie SAS" });
  });
});
