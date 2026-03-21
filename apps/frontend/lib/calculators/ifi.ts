/* ─────────────────────────────────────────────────────────────────────────────
   Moteur de calcul — IFI (Impôt sur la Fortune Immobilière)
   ────────────────────────────────────────────────────────────────────────── */

import { CONSTANTS } from "../constants/baremes2026";

export interface ParamsIFI {
  rpValeur: number;
  locatifValeur: number;
  sciValeur: number;
  scpiValeur: number;
  opciValeur: number;
  crdEmprunts: number;
  taxeFonciereDue: number;
  travauxFactures: number;
  donsIFI: number;
  revenus: number;
  irNet: number;
  psTotal: number;
}

export interface DetailTrancheIFI {
  min: number;
  max: number;
  taux: number;
  montant: number;
}

export interface ResultatIFI {
  actifBrut: number;
  rpApresAbattement: number;
  passifDeductible: number;
  patrimoineNetTaxable: number;
  soumisIFI: boolean;
  ifiAvantReduction: number;
  reductionDons: number;
  plafonnement: number;
  ifiNet: number;
  detailTranches: DetailTrancheIFI[];
}

export function calculIFI(params: ParamsIFI): ResultatIFI {
  const {
    rpValeur,
    locatifValeur,
    sciValeur,
    scpiValeur,
    opciValeur,
    crdEmprunts,
    taxeFonciereDue,
    travauxFactures,
    donsIFI,
    revenus,
    irNet,
    psTotal,
  } = params;

  // Abattement 30 % sur RP
  const rpApresAbattement = rpValeur * (1 - CONSTANTS.IFI_ABATTEMENT_RP);

  // Actif brut
  const actifBrut = rpApresAbattement + locatifValeur + sciValeur + scpiValeur + opciValeur;

  // Passif déductible
  const passifDeductible = crdEmprunts + taxeFonciereDue + travauxFactures;

  // Patrimoine net taxable
  const patrimoineNetTaxable = Math.max(0, actifBrut - passifDeductible);

  // Soumis ?
  const soumisIFI = patrimoineNetTaxable >= CONSTANTS.IFI_SEUIL_IMPOSITION;

  // Calcul par tranches
  const detailTranches: DetailTrancheIFI[] = [];
  let ifiAvantReduction = 0;

  if (soumisIFI) {
    for (const { min, max, taux } of CONSTANTS.BAREME_IFI) {
      if (patrimoineNetTaxable <= min) {
        detailTranches.push({ min, max, taux, montant: 0 });
        continue;
      }
      const assiette =
        Math.min(patrimoineNetTaxable, max === Infinity ? patrimoineNetTaxable : max) - min;
      const montant = assiette * taux;
      ifiAvantReduction += montant;
      detailTranches.push({ min, max, taux, montant });
    }
  }

  // Réduction dons : 75 % plafonné à 50 000 €
  const reductionDons = Math.min(donsIFI * 0.75, 50_000);
  let ifiApresReduction = Math.max(0, ifiAvantReduction - reductionDons);

  // Plafonnement : IR + IFI + PS ≤ 75 % des revenus
  let plafonnement = 0;
  if (revenus > 0) {
    const totalImposition = irNet + ifiApresReduction + psTotal;
    const plafond75 = revenus * 0.75;
    if (totalImposition > plafond75) {
      plafonnement = totalImposition - plafond75;
      ifiApresReduction = Math.max(0, ifiApresReduction - plafonnement);
    }
  }

  return {
    actifBrut,
    rpApresAbattement,
    passifDeductible,
    patrimoineNetTaxable,
    soumisIFI,
    ifiAvantReduction,
    reductionDons,
    plafonnement,
    ifiNet: ifiApresReduction,
    detailTranches,
  };
}
