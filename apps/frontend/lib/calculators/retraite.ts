/* ─────────────────────────────────────────────────────────────────────────────
   Moteur de calcul — Projection Retraite CNAVPL + CER
   ────────────────────────────────────────────────────────────────────────── */

import { CONSTANTS } from "../constants/baremes2026";
import { CAISSES } from "../constants/caisses";

/* ── types ───────────────────────────────────────────────────────────────── */

export interface ParamsRetraite {
  bnc: number;
  age: number;
  ageDepart: number;
  croissanceBNC: number;
  inflation: number;
  trimestresAcquis: number;
  pointsAcquis: number;
  valeurServicePoint?: number;
  objectifMensuel: number;
  pass?: number;
}

export interface LigneProjection {
  annee: number;
  age: number;
  bnc: number;
  cotisationsCNAVPL: number;
  pointsAnnee: number;
  pointsCumules: number;
  trimestresAnnee: number;
  trimestresCumules: number;
}

export interface ResultatRetraite {
  tableProjection: LigneProjection[];
  pensionAnnuelle: number;
  pensionMensuelle: number;
  tauxRemplacement: number;
  gapVsObjectif: number;
  trimestresManquants: number;
  decote: number;
}

/* ── moteur ──────────────────────────────────────────────────────────────── */

export function projectionRetraite(params: ParamsRetraite): ResultatRetraite {
  const {
    bnc,
    age,
    ageDepart,
    croissanceBNC,
    trimestresAcquis,
    pointsAcquis,
    objectifMensuel,
    pass = CONSTANTS.PASS_2026,
  } = params;

  const vsp = params.valeurServicePoint ?? CAISSES.CNAVPL.valeurServicePoint;
  const trimestresRequis = 172; // taux plein né après 1973

  const table: LigneProjection[] = [];
  let bncCourant = bnc;
  let pointsCumules = pointsAcquis;
  let trimestresCumules = trimestresAcquis;

  const nbAnnees = ageDepart - age;

  for (let i = 0; i < nbAnnees; i++) {
    const annee = 2026 + i;
    const ageCourant = age + i;

    // Cotisations CNAVPL
    const t1 = Math.min(bncCourant, pass) * CAISSES.CNAVPL.tranche1.taux;
    const t2 = Math.min(bncCourant, 5 * pass) * CAISSES.CNAVPL.tranche2.taux;
    const cotisations = t1 + t2;

    // Points acquis (approximation : cotisation / valeur d'achat)
    const valeurAchat = vsp * 1.5; // ratio classique achat/service
    const points = cotisations / valeurAchat;

    // Trimestres (4 max par an si BNC >= 600 SMIC horaire)
    const seuilTrimestre = CONSTANTS.SMIC_HORAIRE_2026 * 150;
    const trimestres = Math.min(4, Math.floor(bncCourant / seuilTrimestre));

    pointsCumules += points;
    trimestresCumules += trimestres;

    table.push({
      annee,
      age: ageCourant,
      bnc: bncCourant,
      cotisationsCNAVPL: cotisations,
      pointsAnnee: points,
      pointsCumules,
      trimestresAnnee: trimestres,
      trimestresCumules,
    });

    bncCourant *= 1 + croissanceBNC;
  }

  // Pension
  const trimestresManquants = Math.max(0, trimestresRequis - trimestresCumules);
  const decote = trimestresManquants * CONSTANTS.REFORME_RETRAITE.decoteParTrimestre;
  const coeffDecote = Math.max(0, 1 - decote);

  const pensionAnnuelle = pointsCumules * vsp * coeffDecote;
  const pensionMensuelle = pensionAnnuelle / 12;

  const dernierBNC = table.length > 0 ? table[table.length - 1].bnc : bnc;
  const tauxRemplacement = dernierBNC > 0 ? pensionAnnuelle / dernierBNC : 0;
  const gapVsObjectif = objectifMensuel - pensionMensuelle;

  return {
    tableProjection: table,
    pensionAnnuelle,
    pensionMensuelle,
    tauxRemplacement,
    gapVsObjectif,
    trimestresManquants,
    decote,
  };
}

/* ── CER (Cumul Emploi-Retraite) ─────────────────────────────────────────── */

export interface ParamsCER {
  pensionInitiale: number;
  revenusCER: number;
  dureeCER: number;
  pass?: number;
}

export interface ResultatCER {
  conditionsRemplies: boolean;
  cotisationsCERTotal: number;
  pointsSupplementaires: number;
  secondePension: number;
  plafondSecondePension: number;
  revenuPendantCER: number;
  revenuApresCER: number;
}

export function simulationCER(params: ParamsCER): ResultatCER {
  const { pensionInitiale, revenusCER, dureeCER, pass = CONSTANTS.PASS_2026 } = params;

  // Plafond seconde pension : 5 % PASS/an
  const plafondAnnuel = pass * 0.05;
  const plafondSecondePension = plafondAnnuel;

  // Cotisations pendant CER
  const cotisAnnuelles =
    Math.min(revenusCER, pass) * CAISSES.CNAVPL.tranche1.taux +
    Math.min(revenusCER, 5 * pass) * CAISSES.CNAVPL.tranche2.taux;
  const cotisationsCERTotal = cotisAnnuelles * dureeCER;

  // Points supplémentaires
  const vsp = CAISSES.CNAVPL.valeurServicePoint;
  const valeurAchat = vsp * 1.5;
  const pointsSupplementaires = cotisationsCERTotal / valeurAchat;

  // Seconde pension (plafonnée)
  const secondePensionBrute = pointsSupplementaires * vsp;
  const secondePension = Math.min(secondePensionBrute, plafondSecondePension);

  return {
    conditionsRemplies: true,
    cotisationsCERTotal,
    pointsSupplementaires,
    secondePension,
    plafondSecondePension,
    revenuPendantCER: pensionInitiale + revenusCER - cotisAnnuelles,
    revenuApresCER: pensionInitiale + secondePension,
  };
}
