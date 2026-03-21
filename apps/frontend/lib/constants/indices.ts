/* ─────────────────────────────────────────────────────────────────────────────
   Indices économiques & scénarios de projection
   ────────────────────────────────────────────────────────────────────────── */

export const INDICES = {
  inflation2026: 0.009,

  rendements: {
    fondsEuros: 0.025,
    obligations: 0.03,
    actions: 0.07,
    SCPI: 0.045,
    immobilier: 0.02,
  },

  scenarios: {
    pessimiste: {
      croissanceRevenus: -0.005,
      inflation: 0.03,
      rendementFinancier: 0.015,
      rendementImmobilier: 0,
      revalorisationPensions: 0.01,
    },
    central: {
      croissanceRevenus: 0.02,
      inflation: 0.009,
      rendementFinancier: 0.035,
      rendementImmobilier: 0.02,
      revalorisationPensions: 0.015,
    },
    optimiste: {
      croissanceRevenus: 0.03,
      inflation: 0.009,
      rendementFinancier: 0.06,
      rendementImmobilier: 0.03,
      revalorisationPensions: 0.02,
    },
  },
} as const;
