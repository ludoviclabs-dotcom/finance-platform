/* ─────────────────────────────────────────────────────────────────────────────
   Moteur de calcul — Fiscalité IR + CEHR
   ────────────────────────────────────────────────────────────────────────── */

import { CONSTANTS } from "../constants/baremes2026";

/* ── types ───────────────────────────────────────────────────────────────── */

export interface ParamsFiscalite {
  bnc: number;
  cotisationsDeductibles: number;
  csgDeductible: number;
  revenuFoncier?: number;
  revenuConjoint?: number;
  autresRevenus?: number;
  versementsPER?: number;
  pensionsAlimentaires?: number;
  nbParts: number;
  situationFamiliale: "celibataire" | "marie" | "pacse" | "divorce" | "veuf";
}

export interface DetailTranche {
  min: number;
  max: number;
  taux: number;
  montant: number;
}

export interface ResultatFiscalite {
  revenuBrutGlobal: number;
  deductions: number;
  revenuNetImposable: number;
  quotientFamilial: number;
  irParPart: number;
  irBrut: number;
  decote: number;
  irNet: number;
  tmi: number;
  tauxMoyen: number;
  cehr: number;
  totalImpot: number;
  detailTranches: DetailTranche[];
}

/* ── calcul IR par tranche ───────────────────────────────────────────────── */

function calculIRParPart(qf: number): { montant: number; tranches: DetailTranche[] } {
  const tranches: DetailTranche[] = [];
  let total = 0;

  for (const { min, max, taux } of CONSTANTS.BAREME_IR) {
    if (qf <= min) {
      tranches.push({ min, max, taux, montant: 0 });
      continue;
    }
    const assiette = Math.min(qf, max === Infinity ? qf : max) - min;
    const montant = assiette * taux;
    total += montant;
    tranches.push({ min, max, taux, montant });
  }

  return { montant: total, tranches };
}

/* ── TMI ─────────────────────────────────────────────────────────────────── */

function determineTMI(qf: number): number {
  for (let i = CONSTANTS.BAREME_IR.length - 1; i >= 0; i--) {
    if (qf > CONSTANTS.BAREME_IR[i].min) return CONSTANTS.BAREME_IR[i].taux;
  }
  return 0;
}

/* ── CEHR (calcul marginal / différentiel) ───────────────────────────────── */

function calculCEHR(
  rfr: number,
  situation: ParamsFiscalite["situationFamiliale"],
): number {
  const estCouple = situation === "marie" || situation === "pacse";
  const bareme = estCouple ? CONSTANTS.CEHR.couple : CONSTANTS.CEHR.celibataire;
  let cehr = 0;
  for (const { min, max, taux } of bareme) {
    if (rfr <= min) continue;
    const assiette = Math.min(rfr, max === Infinity ? rfr : max) - min;
    cehr += assiette * taux;
  }
  return cehr;
}

/* ── moteur principal ────────────────────────────────────────────────────── */

export function calculIR(params: ParamsFiscalite): ResultatFiscalite {
  const {
    bnc,
    cotisationsDeductibles,
    csgDeductible,
    revenuFoncier = 0,
    revenuConjoint = 0,
    autresRevenus = 0,
    versementsPER = 0,
    pensionsAlimentaires = 0,
    nbParts,
    situationFamiliale,
  } = params;

  // Étape 1 — RBG
  const revenuBrutGlobal =
    bnc - cotisationsDeductibles - csgDeductible + revenuFoncier + revenuConjoint + autresRevenus;

  // Étape 2 — Déductions
  // Abattement 10 % conjoint salarié (plafonné 14 171 €)
  const abattementConjoint =
    revenuConjoint > 0 ? Math.min(revenuConjoint * 0.1, 14_171) : 0;
  const deductions = versementsPER + pensionsAlimentaires + abattementConjoint;

  // Étape 3 — RNI
  const revenuNetImposable = Math.max(0, revenuBrutGlobal - deductions);

  // Étape 4 — QF
  const quotientFamilial = nbParts > 0 ? revenuNetImposable / nbParts : revenuNetImposable;

  // Étape 5 — IR par part puis IR brut
  const { montant: irParPart, tranches: detailTranches } = calculIRParPart(quotientFamilial);

  // Plafonnement QF : IR sans QF vs IR avec QF
  const irSansQF = calculIRParPart(revenuNetImposable / (situationFamiliale === "marie" || situationFamiliale === "pacse" ? 2 : 1)).montant;
  const partsBase = situationFamiliale === "marie" || situationFamiliale === "pacse" ? 2 : 1;
  const demiPartsSupp = nbParts - partsBase;

  let irBrut = irParPart * nbParts;

  if (demiPartsSupp > 0) {
    const irAvecPartsBase = irSansQF * partsBase;
    const avantage = irAvecPartsBase - irBrut;
    const plafond = demiPartsSupp * 2 * CONSTANTS.QUOTIENT_FAMILIAL.plafondDemiPart;
    if (avantage > plafond) {
      irBrut = irAvecPartsBase - plafond;
    }
  }

  // Étape 6 — Décote
  let decote = 0;
  const estCouple = situationFamiliale === "marie" || situationFamiliale === "pacse";
  const seuilDecote = estCouple
    ? CONSTANTS.DECOTE.seuilCouple
    : CONSTANTS.DECOTE.seuilCelibataire;
  if (irBrut < seuilDecote) {
    decote = seuilDecote * CONSTANTS.DECOTE.coefficient - irBrut * 0.4525;
    decote = Math.max(0, Math.min(decote, irBrut));
  }

  // Étape 7 — IR net
  const irNet = Math.max(0, irBrut - decote);

  // Étape 8 — TMI & taux moyen
  const tmi = determineTMI(quotientFamilial);
  const tauxMoyen = revenuNetImposable > 0 ? irNet / revenuNetImposable : 0;

  // Étape 9 — CEHR (différentiel)
  const rfr = revenuNetImposable; // simplification
  const cehr = calculCEHR(rfr, situationFamiliale);

  const totalImpot = irNet + cehr;

  return {
    revenuBrutGlobal,
    deductions,
    revenuNetImposable,
    quotientFamilial,
    irParPart,
    irBrut,
    decote,
    irNet,
    tmi,
    tauxMoyen,
    cehr,
    totalImpot,
    detailTranches,
  };
}
