/* ─────────────────────────────────────────────────────────────────────────────
   Caisses de retraite PL Santé — paramètres 2026
   ────────────────────────────────────────────────────────────────────────── */

export const CAISSES = {
  CNAVPL: {
    nom: "CNAVPL",
    description:
      "Caisse Nationale d'Assurance Vieillesse des Professions Libérales",
    tranche1: { taux: 0.101, plafond: 1, description: "10,10 % sur 1 PASS" },
    tranche2: {
      taux: 0.0187,
      plafond: 5,
      description: "1,87 % jusqu'à 5 PASS",
    },
    valeurServicePoint: 0.6599,
    ageLegal: 64,
    decoteParTrimestre: 0.0125,
  },

  CARMF: {
    nom: "CARMF",
    profession: "Médecins",
    complementaire: {
      description: "4 classes selon revenus",
      classes: [
        { classe: 1, cotisation: 5_765, seuilMax: 48_060 },
        { classe: 2, cotisation: 9_066, seuilMax: 96_120 },
        { classe: 3, cotisation: 14_630, seuilMax: 168_210 },
        { classe: 4, cotisation: 18_836, seuilMax: Infinity },
      ],
    },
    ASV: {
      partForfaitaire: 5_628,
      partMedecinS1: 1_876,
      partCPAM: 3_752,
      partProportionnelle: 0.038,
      assiette: "honoraires conventionnés" as const,
    },
    invaliditeDeces: {
      classeA: 638,
      classeB: 1_058,
      classeC: 1_478,
    },
  },

  CARPIMKO: {
    nom: "CARPIMKO",
    professions: [
      "Infirmiers",
      "Kinés",
      "Podologues",
      "Orthophonistes",
      "Orthoptistes",
    ],
    forfaitaire: 1_920,
    proportionnel: 0.03,
    assietteMin: 25_246,
    assietteMax: 193_913,
    ASV: { total: 618, partPraticien: 206, partCPAM: 412 },
    invaliditeDeces: 776,
    delaiCarenceIJ: 90,
  },

  CARCDSF: {
    nom: "CARCDSF",
    professions: ["Dentistes", "Sages-femmes"],
    proportionnel: 0.1065,
    plafond: 205_000,
    PCV: 384,
  },

  CAVP: {
    nom: "CAVP",
    profession: "Pharmaciens",
    regime: "capitalisation" as const,
    classes: {
      3: 3_538,
      4: 4_718,
      5: 5_897,
      6: 7_076,
      7: 8_256,
      8: 9_435,
      9: 10_614,
      10: 11_794,
      11: 12_973,
      12: 14_152,
      13: 16_356,
    },
  },
} as const;
