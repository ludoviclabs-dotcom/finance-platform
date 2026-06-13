/**
 * Demo state — 30 datapoints ESRS Set 2 réalistes pour onboarding prospect.
 *
 * Permet à un visiteur curieux de découvrir l'app sans avoir à uploader
 * ses propres documents. Couvre E1 (climat), E2 (pollution), E3 (eau),
 * E5 (économie circulaire), S1 (effectifs), S2 (chaîne valeur), G1 (gouvernance).
 *
 * Particularités :
 *   - Confidence variable (0.62 - 0.96) pour montrer la barre colorée vert/orange/rouge
 *   - Mix statuts : ~24 "extracted" (à valider) + 6 "validated" (déjà acceptés)
 *   - Sources fake mais formellement valides (filename + page + snippet)
 *   - Cohérence numérique : ΣScopes = total, déchets diverted+directed = total
 *
 * Utilisé par : /api/datapoints/load-demo (POST)
 */

import type { ExtractedDatapoint } from "@/lib/esrs/schema";

const NOW = new Date().toISOString();

const RAPPORT_ANNUEL = "Rapport-annuel-2024-Acme-Corp.pdf";
const BILAN_CARBONE = "Bilan-GES-2024-Acme-Corp.xlsx";
const BDES = "BDES-2024-Acme-Corp.xlsx";
const DEONTOLOGIE = "Code-deontologie-Acme-2024.pdf";

function dp(
  datapointId: string,
  value: ExtractedDatapoint["value"],
  unit: string | undefined,
  confidence: number,
  source: { filename: string; page?: number; sheet?: string; snippet: string },
  status: "extracted" | "validated" = "extracted",
  reasoning?: string,
): ExtractedDatapoint {
  return {
    datapointId,
    value,
    unit,
    confidence,
    reasoning: reasoning ?? `Valeur extraite depuis ${source.filename}${source.page ? `, page ${source.page}` : ""}.`,
    sources: [
      {
        blobUrl: `/demo/${source.filename}`,
        filename: source.filename,
        ...(source.page !== undefined && { page: source.page }),
        ...(source.sheet !== undefined && { sheet: source.sheet }),
        snippet: source.snippet,
      },
    ],
    status,
    extractedAt: NOW,
    ...(status === "validated" && { validatedBy: "demo-validator" }),
  };
}

export const DEMO_DATAPOINTS: Record<string, ExtractedDatapoint> = {
  // ---------------------------------------------------------------------------
  // E1 — Climat (8 datapoints)
  // ---------------------------------------------------------------------------
  "E1-6_scope1_gross": dp(
    "E1-6_scope1_gross",
    5840,
    "tCO2e",
    0.94,
    {
      filename: BILAN_CARBONE,
      sheet: "Scope1_Detail",
      snippet:
        "Émissions Scope 1 directes 2024 : 5 840 tCO2e (combustion stationnaire 3 120 + véhicules 1 720 + fuites fluides 1 000).",
    },
    "validated",
    "Validé manuellement après vérification croisée bilan énergie.",
  ),
  "E1-6_scope2_lb": dp("E1-6_scope2_lb", 12300, "tCO2e", 0.88, {
    filename: BILAN_CARBONE,
    sheet: "Scope2_LB",
    snippet:
      "Scope 2 location-based 2024 : 12 300 tCO2e (consommation électricité 28 500 MWh × facteur réseau France 432 gCO2e/kWh).",
  }),
  "E1-6_scope2_mb": dp(
    "E1-6_scope2_mb",
    11800,
    "tCO2e",
    0.86,
    {
      filename: BILAN_CARBONE,
      sheet: "Scope2_MB",
      snippet:
        "Scope 2 market-based 2024 : 11 800 tCO2e (factures fournisseurs avec garanties d'origine sur 18 % du périmètre).",
    },
    "validated",
  ),
  "E1-6_scope3_total": dp("E1-6_scope3_total", 145000, "tCO2e", 0.71, {
    filename: BILAN_CARBONE,
    sheet: "Scope3_15cat",
    snippet:
      "Scope 3 amont+aval : 145 000 tCO2e — Achats biens & services 78k, Capital Goods 22k, Transport 18k, Use of Sold Products 27k.",
  }),
  "E1-6_total_ghg_gross": dp("E1-6_total_ghg_gross", 163140, "tCO2e", 0.85, {
    filename: BILAN_CARBONE,
    sheet: "Synthese",
    snippet:
      "Total GES brut Scope 1+2 LB+3 = 5 840 + 12 300 + 145 000 = 163 140 tCO2e.",
  }),
  "E1-5_energy_consumption_total": dp("E1-5_energy_consumption_total", 28500, "MWh", 0.92, {
    filename: BILAN_CARBONE,
    sheet: "Energie",
    snippet: "Consommation énergétique totale : 28 500 MWh (électricité 22 100 + gaz 4 800 + carburants 1 600).",
  }),
  "E1-5_renewable_share": dp("E1-5_renewable_share", 42, "%", 0.81, {
    filename: BILAN_CARBONE,
    sheet: "Energie",
    snippet:
      "Part énergie renouvelable : 42 % (PPA solaire 2 200 MWh + autoproduction toiture 580 MWh + GO réseau 9 200 MWh / total 28 500).",
  }),
  "E1-6_intensity_revenue": dp("E1-6_intensity_revenue", 8.4, "tCO2e/M€", 0.79, {
    filename: RAPPORT_ANNUEL,
    page: 47,
    snippet:
      "Intensité GES par revenu net : 8,4 tCO2e par million d'euros (163 140 tCO2e / 19,42 M€ chiffre d'affaires net).",
  }),

  // ---------------------------------------------------------------------------
  // E2 — Pollution (3 datapoints)
  // ---------------------------------------------------------------------------
  "E2-4_air_nox": dp("E2-4_air_nox", 12, "tonne", 0.83, {
    filename: RAPPORT_ANNUEL,
    page: 62,
    snippet:
      "Émissions NOx atmosphériques mesurées sur les 3 sites industriels : 12 tonnes en 2024 (vs 14 t en 2023, -14 %).",
  }),
  "E2-4_air_sox": dp("E2-4_air_sox", 4, "tonne", 0.77, {
    filename: RAPPORT_ANNUEL,
    page: 62,
    snippet: "Émissions SOx 2024 : 4 tonnes (combustion gaz industriels), conforme arrêté ICPE.",
  }),
  "E2-6_microplastics": dp("E2-6_microplastics", 0.8, "tonne", 0.65, {
    filename: RAPPORT_ANNUEL,
    page: 64,
    snippet:
      "Microplastiques générés par usure pneumatiques flotte interne : 0,8 tonne (estimation méthode TRWP-2024).",
  }),

  // ---------------------------------------------------------------------------
  // E3 — Eau (2 datapoints)
  // ---------------------------------------------------------------------------
  "E3-4_water_withdrawal": dp("E3-4_water_withdrawal", 125000, "m3", 0.89, {
    filename: BDES,
    sheet: "Eau",
    snippet: "Prélèvement d'eau total 2024 : 125 000 m³ (90 % réseau, 10 % forage industriel autorisé).",
  }),
  "E3-4_water_intensity": dp("E3-4_water_intensity", 42.5, "m3/M€", 0.78, {
    filename: BDES,
    sheet: "Eau",
    snippet: "Intensité hydrique : 42,5 m³ par million d'euros de chiffre d'affaires net.",
  }),

  // ---------------------------------------------------------------------------
  // E5 — Économie circulaire (4 datapoints)
  // ---------------------------------------------------------------------------
  "E5-5_waste_total": dp(
    "E5-5_waste_total",
    1240,
    "tonne",
    0.91,
    {
      filename: RAPPORT_ANNUEL,
      page: 71,
      snippet:
        "Déchets totaux générés 2024 : 1 240 tonnes (industriels banals 980 + dangereux 87 + DEEE 173).",
    },
    "validated",
  ),
  "E5-5_waste_hazardous": dp("E5-5_waste_hazardous", 87, "tonne", 0.93, {
    filename: RAPPORT_ANNUEL,
    page: 71,
    snippet: "Déchets dangereux 2024 : 87 tonnes (huiles usées 42, solvants 28, batteries 17).",
  }),
  "E5-5_waste_diverted_from_disposal": dp("E5-5_waste_diverted_from_disposal", 920, "tonne", 0.85, {
    filename: RAPPORT_ANNUEL,
    page: 72,
    snippet: "Déchets détournés de l'élimination (recyclage + valorisation matière) : 920 tonnes (74 %).",
  }),
  "E5-5_waste_directed_to_disposal": dp("E5-5_waste_directed_to_disposal", 320, "tonne", 0.84, {
    filename: RAPPORT_ANNUEL,
    page: 72,
    snippet:
      "Déchets dirigés vers élimination (incinération sans récupération + enfouissement) : 320 tonnes.",
  }),

  // ---------------------------------------------------------------------------
  // S1 — Effectifs propres (8 datapoints)
  // ---------------------------------------------------------------------------
  "S1-6_total_employees": dp(
    "S1-6_total_employees",
    247,
    "personnes",
    0.96,
    {
      filename: BDES,
      sheet: "Effectifs",
      snippet: "Effectif total au 31/12/2024 : 247 ETP (hommes 142, femmes 102, autres 3).",
    },
    "validated",
  ),
  "S1-6_male_employees": dp("S1-6_male_employees", 142, "personnes", 0.95, {
    filename: BDES,
    sheet: "Effectifs",
    snippet: "Effectif masculin 31/12/2024 : 142 ETP.",
  }),
  "S1-6_female_employees": dp("S1-6_female_employees", 102, "personnes", 0.95, {
    filename: BDES,
    sheet: "Effectifs",
    snippet: "Effectif féminin 31/12/2024 : 102 ETP.",
  }),
  "S1-6_other_gender": dp("S1-6_other_gender", 3, "personnes", 0.72, {
    filename: BDES,
    sheet: "Effectifs",
    snippet: "Effectifs autres genres / non binaires 31/12/2024 : 3.",
  }),
  "S1-6_permanent_employees": dp("S1-6_permanent_employees", 215, "personnes", 0.93, {
    filename: BDES,
    sheet: "Contrats",
    snippet: "CDI au 31/12/2024 : 215 ETP (87 % de l'effectif total).",
  }),
  "S1-6_employee_turnover": dp("S1-6_employee_turnover", 12, "%", 0.74, {
    filename: BDES,
    sheet: "Mouvements",
    snippet: "Taux de turnover 2024 : 12 % (29 départs sur effectif moyen 247).",
  }),
  "S1-14_recordable_work_accidents": dp("S1-14_recordable_work_accidents", 4, "accidents", 0.88, {
    filename: RAPPORT_ANNUEL,
    page: 89,
    snippet: "Accidents de travail enregistrés 2024 : 4 (avec arrêt > 1 jour, taux fréquence 7,8).",
  }),
  "S1-14_work_related_fatalities": dp(
    "S1-14_work_related_fatalities",
    0,
    "personnes",
    0.99,
    {
      filename: RAPPORT_ANNUEL,
      page: 89,
      snippet: "Décès liés au travail 2024 : 0 (objectif Vision Zero atteint pour la 5ème année consécutive).",
    },
    "validated",
  ),

  // ---------------------------------------------------------------------------
  // S2 — Chaîne de valeur (1 datapoint)
  // ---------------------------------------------------------------------------
  "S2-5_human_rights_incidents": dp("S2-5_human_rights_incidents", 2, "incidents", 0.62, {
    filename: RAPPORT_ANNUEL,
    page: 102,
    snippet:
      "Incidents droits humains identifiés en chaîne de valeur : 2 cas (audits fournisseurs Tier-2 Asie, plans correctifs en cours).",
  }),

  // ---------------------------------------------------------------------------
  // G1 — Gouvernance (4 datapoints)
  // ---------------------------------------------------------------------------
  "G1-4_corruption_incidents": dp(
    "G1-4_corruption_incidents",
    0,
    "incidents",
    0.97,
    {
      filename: DEONTOLOGIE,
      page: 8,
      snippet:
        "Incidents de corruption ou de subordination confirmés sur l'exercice 2024 : 0. Dispositif Sapin II opérationnel.",
    },
    "validated",
  ),
  "G1-4_corruption_convictions": dp("G1-4_corruption_convictions", 0, "incidents", 0.95, {
    filename: DEONTOLOGIE,
    page: 8,
    snippet: "Condamnations pour faits de corruption : 0 sur les 5 derniers exercices (2020-2024).",
  }),
  "G1-3_anticorruption_training_coverage": dp(
    "G1-3_anticorruption_training_coverage",
    89,
    "%",
    0.86,
    {
      filename: BDES,
      sheet: "Formation",
      snippet:
        "Couverture formation anti-corruption : 89 % des collaborateurs ayant complété le module e-learning Sapin II.",
    },
  ),
  "G1-6_supplier_payment_days": dp(
    "G1-6_supplier_payment_days",
    47,
    "jours",
    0.81,
    {
      filename: RAPPORT_ANNUEL,
      page: 118,
      snippet:
        "Délai moyen de paiement fournisseurs 2024 : 47 jours (LME : 60 jours max — conformité 100 %).",
    },
    "validated",
  ),
};

/** Nombre total de datapoints dans le set démo. */
export const DEMO_DATAPOINT_COUNT = Object.keys(DEMO_DATAPOINTS).length;
