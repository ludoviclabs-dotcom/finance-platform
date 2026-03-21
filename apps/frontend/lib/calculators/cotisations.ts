/* ─────────────────────────────────────────────────────────────────────────────
   Moteur de calcul — Cotisations sociales PL
   ────────────────────────────────────────────────────────────────────────── */

import { CONSTANTS } from "../constants/baremes2026";
import { COTISATIONS_URSSAF } from "../constants/cotisationsURSSAF";
import { CAISSES } from "../constants/caisses";

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Interpolation linéaire du taux entre deux bornes PASS */
function tauxProgressif(
  bnc: number,
  pass: number,
  tranche: { seuilBas: number; seuilHaut: number; tauxBas: number; tauxHaut: number },
): number {
  const bas = tranche.seuilBas * pass;
  const haut = tranche.seuilHaut === Infinity ? Infinity : tranche.seuilHaut * pass;
  if (bnc <= bas) return 0;
  if (haut === Infinity) return tranche.tauxHaut;
  const ratio = Math.min((bnc - bas) / (haut - bas), 1);
  return tranche.tauxBas + ratio * (tranche.tauxHaut - tranche.tauxBas);
}

/* ── types résultat ──────────────────────────────────────────────────────── */

export interface DetailCotisation {
  label: string;
  assiette: number;
  taux: number;
  montant: number;
}

export interface ResultatCotisations {
  lignes: DetailCotisation[];
  totalCotisations: number;
  totalDeductible: number;
  csgDeductible: number;
  csgNonDeductible: number;
  crds: number;
  tauxEffectif: number;
  bncNetAnnuel: number;
  bncNetMensuel: number;
}

/* ── moteur principal ────────────────────────────────────────────────────── */

export function calculCotisationsURSSAF(
  bnc: number,
  pass: number = CONSTANTS.PASS_2026,
): ResultatCotisations {
  const lignes: DetailCotisation[] = [];

  // 1. Maladie-Maternité (progressive)
  let tauxMM = 0;
  for (const tr of COTISATIONS_URSSAF.maladiematernite.tranches) {
    if (bnc <= tr.seuilBas * pass) continue;
    tauxMM = tauxProgressif(bnc, pass, tr);
  }
  const maladie = bnc * tauxMM;
  lignes.push({ label: "Maladie-Maternité", assiette: bnc, taux: tauxMM, montant: maladie });

  // 2. Allocations familiales (progressive)
  let tauxAF = 0;
  for (const tr of COTISATIONS_URSSAF.allocationsFamiliales.tranches) {
    if (bnc <= tr.seuilBas * pass) continue;
    tauxAF = tauxProgressif(bnc, pass, tr);
  }
  const af = bnc * tauxAF;
  lignes.push({ label: "Allocations familiales", assiette: bnc, taux: tauxAF, montant: af });

  // 3. IJ Maladie
  const assietteIJ = Math.min(bnc, COTISATIONS_URSSAF.IJMaladie.plafond * pass);
  const ij = assietteIJ * COTISATIONS_URSSAF.IJMaladie.taux;
  lignes.push({ label: "IJ Maladie", assiette: assietteIJ, taux: COTISATIONS_URSSAF.IJMaladie.taux, montant: ij });

  // 4. CNAVPL Tranche 1
  const assietteCNAVPL_T1 = Math.min(bnc, CAISSES.CNAVPL.tranche1.plafond * pass);
  const cnavplT1 = assietteCNAVPL_T1 * CAISSES.CNAVPL.tranche1.taux;
  lignes.push({ label: "CNAVPL T1", assiette: assietteCNAVPL_T1, taux: CAISSES.CNAVPL.tranche1.taux, montant: cnavplT1 });

  // 5. CNAVPL Tranche 2
  const assietteCNAVPL_T2 = Math.min(bnc, CAISSES.CNAVPL.tranche2.plafond * pass);
  const cnavplT2 = assietteCNAVPL_T2 * CAISSES.CNAVPL.tranche2.taux;
  lignes.push({ label: "CNAVPL T2", assiette: assietteCNAVPL_T2, taux: CAISSES.CNAVPL.tranche2.taux, montant: cnavplT2 });

  // 6. CFP
  const cfp = COTISATIONS_URSSAF.CFP.montant2026;
  lignes.push({ label: "CFP", assiette: pass, taux: COTISATIONS_URSSAF.CFP.taux, montant: cfp });

  // 7. CURPS
  const curps = COTISATIONS_URSSAF.CURPS.montant;
  lignes.push({ label: "CURPS", assiette: 0, taux: 0, montant: curps });

  // Total cotisations hors CSG/CRDS
  const totalHorsCSG = lignes.reduce((s, l) => s + l.montant, 0);

  // 8. CSG/CRDS — assiette = BNC + cotisations obligatoires (hors CSG/CRDS)
  const assietteCSG = bnc + totalHorsCSG;
  const csgDed = assietteCSG * COTISATIONS_URSSAF.CSG_CRDS.CSGDeductible;
  const csgNonDed = assietteCSG * COTISATIONS_URSSAF.CSG_CRDS.CSGNonDeductible;
  const crds = assietteCSG * COTISATIONS_URSSAF.CSG_CRDS.CRDS;

  lignes.push({ label: "CSG déductible", assiette: assietteCSG, taux: COTISATIONS_URSSAF.CSG_CRDS.CSGDeductible, montant: csgDed });
  lignes.push({ label: "CSG non déductible", assiette: assietteCSG, taux: COTISATIONS_URSSAF.CSG_CRDS.CSGNonDeductible, montant: csgNonDed });
  lignes.push({ label: "CRDS", assiette: assietteCSG, taux: COTISATIONS_URSSAF.CSG_CRDS.CRDS, montant: crds });

  const totalCotisations = totalHorsCSG + csgDed + csgNonDed + crds;
  const totalDeductible = totalHorsCSG + csgDed;
  const bncNetAnnuel = bnc - totalCotisations;

  return {
    lignes,
    totalCotisations,
    totalDeductible,
    csgDeductible: csgDed,
    csgNonDeductible: csgNonDed,
    crds,
    tauxEffectif: bnc > 0 ? totalCotisations / bnc : 0,
    bncNetAnnuel,
    bncNetMensuel: bncNetAnnuel / 12,
  };
}
