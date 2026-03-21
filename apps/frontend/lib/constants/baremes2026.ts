/* ─────────────────────────────────────────────────────────────────────────────
   Barèmes & constantes officiels 2026 (revenus 2025)
   ────────────────────────────────────────────────────────────────────────── */

export const CONSTANTS = {
  // ── PASS historique ──────────────────────────────────────────────────────
  PASS: { 2023: 43_992, 2024: 46_368, 2025: 47_100, 2026: 48_060 },
  PASS_2026: 48_060,
  PMSS_2026: 4_005,
  SMIC_HORAIRE_2026: 11.88,
  SMIC_MENSUEL_2026: 1_801.84,

  // ── Barème IR 2026 (sur revenus 2025) — 5 tranches ─────────────────────
  BAREME_IR: [
    { min: 0, max: 11_520, taux: 0 },
    { min: 11_520, max: 29_373, taux: 0.11 },
    { min: 29_373, max: 83_988, taux: 0.30 },
    { min: 83_988, max: 180_648, taux: 0.41 },
    { min: 180_648, max: Infinity, taux: 0.45 },
  ],

  // ── Barème IS ──────────────────────────────────────────────────────────
  BAREME_IS: { tauxReduit: 0.15, seuilReduit: 42_500, tauxNormal: 0.25 },

  // ── CSG / CRDS ─────────────────────────────────────────────────────────
  CSG: {
    total: 0.092,
    deductible: 0.068,
    nonDeductible: 0.024,
    CRDS: 0.005,
    totalAvecCRDS: 0.097,
  },

  // ── PFU (Flat Tax) ─────────────────────────────────────────────────────
  PFU: { total: 0.30, IR: 0.128, PS: 0.172 },

  // ── CEHR ───────────────────────────────────────────────────────────────
  CEHR: {
    celibataire: [
      { min: 0, max: 250_000, taux: 0 },
      { min: 250_000, max: 500_000, taux: 0.03 },
      { min: 500_000, max: Infinity, taux: 0.04 },
    ],
    couple: [
      { min: 0, max: 500_000, taux: 0 },
      { min: 500_000, max: 1_000_000, taux: 0.03 },
      { min: 1_000_000, max: Infinity, taux: 0.04 },
    ],
  },

  // ── Barème IFI (6 tranches) ────────────────────────────────────────────
  BAREME_IFI: [
    { min: 0, max: 800_000, taux: 0 },
    { min: 800_000, max: 1_300_000, taux: 0.005 },
    { min: 1_300_000, max: 2_570_000, taux: 0.007 },
    { min: 2_570_000, max: 5_000_000, taux: 0.01 },
    { min: 5_000_000, max: 10_000_000, taux: 0.0125 },
    { min: 10_000_000, max: Infinity, taux: 0.015 },
  ],
  IFI_SEUIL_IMPOSITION: 1_300_000,
  IFI_ABATTEMENT_RP: 0.30,

  // ── Droits donation / succession ligne directe ─────────────────────────
  BAREME_DROITS_DONATION: [
    { min: 0, max: 8_072, taux: 0.05 },
    { min: 8_072, max: 12_109, taux: 0.10 },
    { min: 12_109, max: 15_932, taux: 0.15 },
    { min: 15_932, max: 552_324, taux: 0.20 },
    { min: 552_324, max: 902_838, taux: 0.30 },
    { min: 902_838, max: 1_805_677, taux: 0.40 },
    { min: 1_805_677, max: Infinity, taux: 0.45 },
  ],

  // ── Abattements donation ───────────────────────────────────────────────
  ABATTEMENTS_DONATION: {
    parentEnfant: 100_000,
    epoux: 80_724,
    petitEnfant: 31_865,
    arrieresPetitsEnfants: 5_310,
    freresSoeurs: 15_932,
    neveux: 7_967,
    renouvellement: 15,
  },

  // ── Démembrement Art. 669 CGI ──────────────────────────────────────────
  DEMEMBREMENT_669: [
    { ageMin: 0, ageMax: 20, usufruit: 0.90, nuePropriete: 0.10 },
    { ageMin: 21, ageMax: 30, usufruit: 0.80, nuePropriete: 0.20 },
    { ageMin: 31, ageMax: 40, usufruit: 0.70, nuePropriete: 0.30 },
    { ageMin: 41, ageMax: 50, usufruit: 0.60, nuePropriete: 0.40 },
    { ageMin: 51, ageMax: 60, usufruit: 0.50, nuePropriete: 0.50 },
    { ageMin: 61, ageMax: 70, usufruit: 0.40, nuePropriete: 0.60 },
    { ageMin: 71, ageMax: 80, usufruit: 0.30, nuePropriete: 0.70 },
    { ageMin: 81, ageMax: 90, usufruit: 0.20, nuePropriete: 0.80 },
    { ageMin: 91, ageMax: Infinity, usufruit: 0.10, nuePropriete: 0.90 },
  ],

  // ── Quotient familial ──────────────────────────────────────────────────
  QUOTIENT_FAMILIAL: { plafondDemiPart: 1_791, plafondParentIsole: 4_149 },

  // ── Décote IR ──────────────────────────────────────────────────────────
  DECOTE: { seuilCelibataire: 1_965, seuilCouple: 3_248, coefficient: 0.4525 },

  // ── Prélèvements sociaux revenus patrimoine ────────────────────────────
  PS_PATRIMOINE: {
    CSG: 0.092,
    CRDS: 0.005,
    solidarite: 0.075,
    total: 0.172,
    CSGDeductible: 0.068,
  },

  // ── Réforme retraite 2023 ──────────────────────────────────────────────
  REFORME_RETRAITE: { ageLegal: 64, decoteParTrimestre: 0.0125 },
} as const;
