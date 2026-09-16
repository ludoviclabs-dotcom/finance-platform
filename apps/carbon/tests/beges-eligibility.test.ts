/**
 * Contrat GET /beges/status → `eligibility` : statut, libellé, périodicité,
 * base légale et notes, avec rétrocompatibilité des anciens statuts.
 */

import { describe, expect, it } from "vitest";

import { normalizeBegesEligibility } from "@/lib/beges-eligibility";

describe("normalizeBegesEligibility", () => {
  it("contrat courant : champs repris tels quels", () => {
    expect(
      normalizeBegesEligibility({
        status: "obligatoire",
        label: "Libellé API",
        periodicity_years: 4,
        legal_basis: "Base légale API",
        notes: ["Note 1", "  ", "Note 2"],
      }),
    ).toEqual({
      status: "obligatoire",
      label: "Libellé API",
      periodicityYears: 4,
      legalBasis: "Base légale API",
      notes: ["Note 1", "Note 2"],
    });
  });

  it("statut historique « volontaire » → sous_seuil", () => {
    const out = normalizeBegesEligibility({
      status: "volontaire",
      label: "Démarche volontaire (sous les seuils réglementaires)",
    });
    expect(out.status).toBe("sous_seuil");
    expect(out.periodicityYears).toBeNull();
    expect(out.legalBasis).toBeNull();
    expect(out.notes).toEqual([]);
  });

  it("statut historique « obligatoire_om » → obligatoire_outre_mer", () => {
    expect(normalizeBegesEligibility({ status: "obligatoire_om", label: "x" }).status).toBe(
      "obligatoire_outre_mer",
    );
  });

  it("indetermine : jamais présenté comme une démarche volontaire", () => {
    const out = normalizeBegesEligibility({
      status: "indetermine",
      label: "Démarche volontaire (sous les seuils réglementaires)",
    });
    expect(out.status).toBe("indetermine");
    expect(out.label).not.toMatch(/volontaire/i);
    expect(out.label).toMatch(/indéterminée/i);
  });

  it("indetermine avec un libellé API neutre : libellé conservé", () => {
    const out = normalizeBegesEligibility({ status: "indetermine", label: "Effectif inconnu" });
    expect(out.label).toBe("Effectif inconnu");
  });

  it("statut inconnu ou absent → indetermine (aucune conclusion)", () => {
    expect(normalizeBegesEligibility({ status: "exempte", label: "Démarche volontaire" })).toMatchObject({
      status: "indetermine",
    });
    expect(normalizeBegesEligibility(undefined).status).toBe("indetermine");
    expect(normalizeBegesEligibility(null).label).toMatch(/indéterminée/i);
  });

  it("libellé absent : libellé de repli selon le statut", () => {
    expect(normalizeBegesEligibility({ status: "sous_seuil" }).label).toBeTruthy();
    expect(normalizeBegesEligibility({ status: "obligatoire", label: "" }).label).toBeTruthy();
  });

  it("périodicité invalide ignorée", () => {
    expect(normalizeBegesEligibility({ status: "obligatoire", periodicity_years: 0 }).periodicityYears).toBeNull();
    expect(
      normalizeBegesEligibility({ status: "obligatoire", periodicity_years: "4" }).periodicityYears,
    ).toBeNull();
  });
});
