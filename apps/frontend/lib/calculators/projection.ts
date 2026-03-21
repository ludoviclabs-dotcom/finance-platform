/* ─────────────────────────────────────────────────────────────────────────────
   Moteur de calcul — Projection patrimoniale 30 ans (3 scénarios)
   ────────────────────────────────────────────────────────────────────────── */

import { INDICES } from "../constants/indices";
import { calculCotisationsURSSAF } from "./cotisations";
import { calculIR } from "./fiscalite";

/* ── types ───────────────────────────────────────────────────────────────── */

export interface ParamsProjection {
  patrimoineNetActuel: number;
  bnc: number;
  age: number;
  ageRetraite: number;
  depensesMensuelles: number;
  epargneNetteMensuelle: number;
  pensionEstimee: number;
  nbParts: number;
  situationFamiliale: "celibataire" | "marie" | "pacse" | "divorce" | "veuf";
}

export interface LigneProjectionAnnuelle {
  annee: number;
  age: number;
  revenusPro: number;
  cotisations: number;
  irEstime: number;
  revenuNetDispo: number;
  epargneCumulee: number;
  rendementPatrimoine: number;
  patrimoineNet: number;
  pension: number | null;
  phase: "activite" | "retraite";
}

export interface Synthese5ans {
  annee: number;
  age: number;
  pessimiste: number;
  central: number;
  optimiste: number;
}

export interface ResultatProjection {
  tableAnnuelle: LigneProjectionAnnuelle[];
  synthese5ans: Synthese5ans[];
}

/* ── moteur ──────────────────────────────────────────────────────────────── */

function projeterScenario(
  params: ParamsProjection,
  scenario: keyof typeof INDICES.scenarios,
): LigneProjectionAnnuelle[] {
  const {
    patrimoineNetActuel, bnc, age, ageRetraite,
    depensesMensuelles, epargneNetteMensuelle, pensionEstimee,
    nbParts, situationFamiliale,
  } = params;

  const sc = INDICES.scenarios[scenario];
  const table: LigneProjectionAnnuelle[] = [];
  let bncCourant = bnc;
  let patrimoine = patrimoineNetActuel;
  let pensionCourante = pensionEstimee;

  for (let i = 0; i < 30; i++) {
    const annee = 2026 + i;
    const ageCourant = age + i;
    const enRetraite = ageCourant >= ageRetraite;
    const phase = enRetraite ? "retraite" as const : "activite" as const;

    let revenusPro: number;
    let cotisations: number;
    let irEstime: number;

    if (!enRetraite) {
      revenusPro = bncCourant;
      const cotisResult = calculCotisationsURSSAF(bncCourant);
      cotisations = cotisResult.totalCotisations;
      const irResult = calculIR({
        bnc: bncCourant,
        cotisationsDeductibles: cotisResult.totalDeductible - cotisResult.csgDeductible,
        csgDeductible: cotisResult.csgDeductible,
        nbParts,
        situationFamiliale,
      });
      irEstime = irResult.irNet;
    } else {
      revenusPro = 0;
      cotisations = 0;
      irEstime = pensionCourante * 0.1; // estimation simplifiée
      pensionCourante *= 1 + sc.revalorisationPensions;
    }

    const revenuNetDispo = enRetraite
      ? pensionCourante - irEstime
      : bncCourant - cotisations - irEstime;

    const depensesAnnuelles = depensesMensuelles * 12 * Math.pow(1 + sc.inflation, i);
    const epargneAnnee = enRetraite
      ? Math.max(0, revenuNetDispo - depensesAnnuelles)
      : epargneNetteMensuelle * 12;

    const rendementPatrimoine = patrimoine * sc.rendementFinancier;
    patrimoine = patrimoine + rendementPatrimoine + epargneAnnee;

    table.push({
      annee,
      age: ageCourant,
      revenusPro,
      cotisations,
      irEstime,
      revenuNetDispo,
      epargneCumulee: epargneAnnee,
      rendementPatrimoine,
      patrimoineNet: patrimoine,
      pension: enRetraite ? pensionCourante : null,
      phase,
    });

    if (!enRetraite) bncCourant *= 1 + sc.croissanceRevenus;
  }

  return table;
}

export function projectionPatrimoniale(params: ParamsProjection): ResultatProjection {
  const central = projeterScenario(params, "central");
  const pessimiste = projeterScenario(params, "pessimiste");
  const optimiste = projeterScenario(params, "optimiste");

  // Synthèse tous les 5 ans
  const synthese5ans: Synthese5ans[] = [];
  for (let i = 4; i < 30; i += 5) {
    synthese5ans.push({
      annee: central[i].annee,
      age: central[i].age,
      pessimiste: pessimiste[i].patrimoineNet,
      central: central[i].patrimoineNet,
      optimiste: optimiste[i].patrimoineNet,
    });
  }

  return { tableAnnuelle: central, synthese5ans };
}
