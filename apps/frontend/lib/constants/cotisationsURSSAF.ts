/* ─────────────────────────────────────────────────────────────────────────────
   Cotisations URSSAF PL — barèmes 2026
   ────────────────────────────────────────────────────────────────────────── */

export const COTISATIONS_URSSAF = {
  maladiematernite: {
    description: "Maladie-Maternité progressive",
    tranches: [
      { seuilBas: 0, seuilHaut: 0.4, tauxBas: 0, tauxHaut: 0 },
      { seuilBas: 0.4, seuilHaut: 1.0, tauxBas: 0, tauxHaut: 0.04 },
      { seuilBas: 1.0, seuilHaut: 5.0, tauxBas: 0.04, tauxHaut: 0.065 },
      { seuilBas: 5.0, seuilHaut: Infinity, tauxBas: 0.065, tauxHaut: 0.065 },
    ],
  },

  allocationsFamiliales: {
    description: "Allocations familiales progressive",
    tranches: [
      { seuilBas: 0, seuilHaut: 1.1, tauxBas: 0, tauxHaut: 0 },
      { seuilBas: 1.1, seuilHaut: 1.4, tauxBas: 0, tauxHaut: 0.031 },
      { seuilBas: 1.4, seuilHaut: Infinity, tauxBas: 0.031, tauxHaut: 0.031 },
    ],
  },

  IJMaladie: {
    taux: 0.005,
    plafond: 5,
    description: "0,50 % sur 5 PASS",
  },

  CSG_CRDS: {
    total: 0.097,
    CSGDeductible: 0.068,
    CSGNonDeductible: 0.024,
    CRDS: 0.005,
    assiette: "BNC + cotisations obligatoires" as const,
  },

  CFP: {
    taux: 0.0025,
    montant2026: 116,
    description: "0,25 % PASS",
  },

  CURPS: {
    montant: 33,
    description: "Forfait annuel",
  },
} as const;
