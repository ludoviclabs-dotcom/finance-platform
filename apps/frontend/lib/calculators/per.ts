/* ─────────────────────────────────────────────────────────────────────────────
   Moteur de calcul — Simulation PER (Plan Épargne Retraite)
   ────────────────────────────────────────────────────────────────────────── */

import { CONSTANTS } from "../constants/baremes2026";

export interface ParamsPER {
  bnc: number;
  pass?: number;
  tmi: number;
  tmiRetraite: number;
  versementAnnuel: number;
  encoursActuel: number;
  duree: number;
  rendementCentral: number;
  rendementPessimiste: number;
  rendementOptimiste: number;
  reliquatsN1?: number;
  reliquatsN2?: number;
  reliquatsN3?: number;
  ratioVersementsPV?: number;
  dureeFractionnement?: number;
  ageRetraite?: number;
}

export interface ResultatPER {
  plafondAnnuel: number;
  plafondDisponible: number;
  projectionCapital: {
    pessimiste: number;
    central: number;
    optimiste: number;
  };
  economieFiscale: number;
  coutNetVersement: number;
  sortieOneShot: {
    irSurVersements: number;
    pfuSurPV: number;
    totalImpot: number;
    capitalNet: number;
    tmiEffective: number;
  };
  sortieFractionnee: {
    irAnnuelParTranche: number;
    tmiMaintenue: number;
    totalImpot: number;
    capitalNet: number;
    economieVsOneShot: number;
    economieEnPourcent: number;
  };
  renteViagere: {
    coefficient: number;
    renteBrute: number;
    renteNette: number;
    pointMortAnnees: number;
  };
}

function projeterCapital(
  encours: number,
  versementAnnuel: number,
  duree: number,
  rendement: number,
): number {
  let capital = encours;
  for (let i = 0; i < duree; i++) {
    capital = (capital + versementAnnuel) * (1 + rendement);
  }
  return capital;
}

export function simulationPER(params: ParamsPER): ResultatPER {
  const {
    bnc,
    tmi,
    tmiRetraite,
    versementAnnuel,
    encoursActuel,
    duree,
    rendementCentral,
    rendementPessimiste,
    rendementOptimiste,
    reliquatsN1 = 0,
    reliquatsN2 = 0,
    reliquatsN3 = 0,
    ratioVersementsPV = 0.6,
    dureeFractionnement = 5,
    ageRetraite = 64,
    pass = CONSTANTS.PASS_2026,
  } = params;

  // Plafond Art. 154 bis TNS :
  // 10 % du bénéfice dans la limite de 8 PASS + 15 % du bénéfice entre 1 et 8 PASS
  const plafond10 = Math.min(bnc, 8 * pass) * 0.1;
  const plafond15 = Math.max(0, Math.min(bnc, 8 * pass) - pass) * 0.15;
  const plafondAnnuel = plafond10 + plafond15;
  const plafondDisponible = plafondAnnuel + reliquatsN1 + reliquatsN2 + reliquatsN3;

  // Projection capital
  const projectionCapital = {
    pessimiste: projeterCapital(encoursActuel, versementAnnuel, duree, rendementPessimiste),
    central: projeterCapital(encoursActuel, versementAnnuel, duree, rendementCentral),
    optimiste: projeterCapital(encoursActuel, versementAnnuel, duree, rendementOptimiste),
  };

  // Économie fiscale annuelle
  const versementEffectif = Math.min(versementAnnuel, plafondDisponible);
  const economieFiscale = versementEffectif * tmi;
  const coutNetVersement = versementEffectif - economieFiscale;

  // Capital central pour calculs de sortie
  const capitalCentral = projectionCapital.central;
  const partVersements = capitalCentral * ratioVersementsPV;
  const partPV = capitalCentral - partVersements;

  // Sortie one-shot
  const irSurVersements = partVersements * tmiRetraite;
  const pfuSurPV = partPV * CONSTANTS.PFU.total;
  const totalImpotOneShot = irSurVersements + pfuSurPV;
  const capitalNetOneShot = capitalCentral - totalImpotOneShot;

  // Sortie fractionnée
  const trancheAnnuelle = partVersements / dureeFractionnement;
  const irAnnuelParTranche = trancheAnnuelle * tmiRetraite;
  const totalImpotFrac = irAnnuelParTranche * dureeFractionnement + pfuSurPV;
  const capitalNetFrac = capitalCentral - totalImpotFrac;
  const economieVsOneShot = capitalNetFrac - capitalNetOneShot;

  // Rente viagère (coefficients approximatifs)
  const coefficientRente = ageRetraite <= 60 ? 0.032 : ageRetraite <= 65 ? 0.038 : 0.044;
  const renteBrute = capitalCentral * coefficientRente;
  const renteNette = renteBrute * (1 - CONSTANTS.CSG.totalAvecCRDS);
  const pointMortAnnees = capitalCentral / renteBrute;

  return {
    plafondAnnuel,
    plafondDisponible,
    projectionCapital,
    economieFiscale,
    coutNetVersement,
    sortieOneShot: {
      irSurVersements,
      pfuSurPV,
      totalImpot: totalImpotOneShot,
      capitalNet: capitalNetOneShot,
      tmiEffective: tmiRetraite,
    },
    sortieFractionnee: {
      irAnnuelParTranche,
      tmiMaintenue: tmiRetraite,
      totalImpot: totalImpotFrac,
      capitalNet: capitalNetFrac,
      economieVsOneShot,
      economieEnPourcent:
        totalImpotOneShot > 0
          ? ((totalImpotOneShot - totalImpotFrac) / totalImpotOneShot) * 100
          : 0,
    },
    renteViagere: {
      coefficient: coefficientRente,
      renteBrute,
      renteNette,
      pointMortAnnees,
    },
  };
}
