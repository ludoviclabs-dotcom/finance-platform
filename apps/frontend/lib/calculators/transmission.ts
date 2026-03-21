/* ─────────────────────────────────────────────────────────────────────────────
   Moteur de calcul — Transmission & Cession
   ────────────────────────────────────────────────────────────────────────── */

import { CONSTANTS } from "../constants/baremes2026";

/* ── A. Cession patientèle BNC ───────────────────────────────────────────── */

export interface ParamsCessionPatientele {
  prixCession: number;
  valeurInscription: number;
  dureeDetention: number;
  recettesMoyennes: number;
  anciennete: number;
  departRetraite: boolean;
  valeurFonds: number;
}

export interface ResultatCessionPatientele {
  pvBrute: number;
  typePV: "CT" | "LT";
  exonerations: {
    art151Septies: { eligible: boolean; motif: string; montant: number };
    art238Quindecies: { eligible: boolean; motif: string; montant: number };
    art151SeptiesA: { eligible: boolean; motif: string; montant: number };
  };
  pvImposable: number;
  impot: number;
  netCession: number;
}

export function cessionPatientele(params: ParamsCessionPatientele): ResultatCessionPatientele {
  const {
    prixCession, valeurInscription, dureeDetention,
    recettesMoyennes, departRetraite, valeurFonds,
  } = params;

  const pvBrute = prixCession - valeurInscription;
  const typePV = dureeDetention >= 2 ? "LT" : "CT";

  // Art. 151 septies — exonération sur recettes
  let art151Septies = { eligible: false, motif: "", montant: 0 };
  if (dureeDetention >= 5) {
    if (recettesMoyennes <= 90_000) {
      art151Septies = { eligible: true, motif: "Recettes < 90 000 € — exonération totale", montant: pvBrute };
    } else if (recettesMoyennes <= 126_000) {
      const ratio = (126_000 - recettesMoyennes) / 36_000;
      art151Septies = { eligible: true, motif: `Exonération partielle (${Math.round(ratio * 100)} %)`, montant: pvBrute * ratio };
    } else {
      art151Septies = { eligible: false, motif: "Recettes > 126 000 €", montant: 0 };
    }
  } else {
    art151Septies = { eligible: false, motif: "Détention < 5 ans", montant: 0 };
  }

  // Art. 238 quindecies — exonération sur valeur fonds
  let art238Quindecies = { eligible: false, motif: "", montant: 0 };
  if (valeurFonds <= 500_000) {
    if (valeurFonds <= 300_000) {
      art238Quindecies = { eligible: true, motif: "Valeur fonds ≤ 300 000 € — exonération totale", montant: pvBrute };
    } else {
      const ratio = (500_000 - valeurFonds) / 200_000;
      art238Quindecies = { eligible: true, motif: `Exonération partielle (${Math.round(ratio * 100)} %)`, montant: pvBrute * ratio };
    }
  } else {
    art238Quindecies = { eligible: false, motif: "Valeur fonds > 500 000 €", montant: 0 };
  }

  // Art. 151 septies A — départ retraite
  const art151SeptiesA = departRetraite && dureeDetention >= 5
    ? { eligible: true, motif: "Départ retraite + 5 ans détention", montant: pvBrute }
    : { eligible: false, motif: departRetraite ? "Détention < 5 ans" : "Pas de départ retraite", montant: 0 };

  // Meilleure exonération
  const exoMax = Math.max(art151Septies.montant, art238Quindecies.montant, art151SeptiesA.montant);
  const pvImposable = Math.max(0, pvBrute - exoMax);

  // Imposition PV
  const impot = typePV === "LT"
    ? pvImposable * (0.128 + CONSTANTS.PS_PATRIMOINE.total) // PFU + PS
    : pvImposable * 0.45; // TMI max pour estimation

  return {
    pvBrute, typePV,
    exonerations: { art151Septies, art238Quindecies, art151SeptiesA },
    pvImposable, impot,
    netCession: prixCession - impot,
  };
}

/* ── B. Donation ─────────────────────────────────────────────────────────── */

export interface ParamsDonation {
  valeur: number;
  lienParente: "parentEnfant" | "epoux" | "petitEnfant" | "freresSoeurs" | "neveux";
  ageDonateur: number;
  demembrement: boolean;
  donationsAnterieures: number;
}

export interface ResultatDonation {
  abattement: number;
  baseTaxable: number;
  droitsBruts: number;
  tauxEffectif: number;
  optionDemembrement?: {
    usufruit: number;
    nuePropriete: number;
    baseTaxableNP: number;
    droitsNP: number;
    economie: number;
  };
}

function calculDroitsDonation(baseTaxable: number): number {
  let droits = 0;
  for (const { min, max, taux } of CONSTANTS.BAREME_DROITS_DONATION) {
    if (baseTaxable <= min) continue;
    const assiette = Math.min(baseTaxable, max === Infinity ? baseTaxable : max) - min;
    droits += assiette * taux;
  }
  return droits;
}

export function simulationDonation(params: ParamsDonation): ResultatDonation {
  const { valeur, lienParente, ageDonateur, demembrement, donationsAnterieures } = params;

  const abattement = Math.max(0, CONSTANTS.ABATTEMENTS_DONATION[lienParente] - donationsAnterieures);
  const baseTaxable = Math.max(0, valeur - abattement);
  const droitsBruts = calculDroitsDonation(baseTaxable);
  const tauxEffectif = valeur > 0 ? droitsBruts / valeur : 0;

  let optionDemembrement: ResultatDonation["optionDemembrement"];
  if (demembrement) {
    const tranche = CONSTANTS.DEMEMBREMENT_669.find(
      (t) => ageDonateur >= t.ageMin && ageDonateur <= t.ageMax,
    );
    if (tranche) {
      const nuePropriete = valeur * tranche.nuePropriete;
      const baseTaxableNP = Math.max(0, nuePropriete - abattement);
      const droitsNP = calculDroitsDonation(baseTaxableNP);
      optionDemembrement = {
        usufruit: tranche.usufruit,
        nuePropriete: tranche.nuePropriete,
        baseTaxableNP,
        droitsNP,
        economie: droitsBruts - droitsNP,
      };
    }
  }

  return { abattement, baseTaxable, droitsBruts, tauxEffectif, optionDemembrement };
}

/* ── C. Pacte Dutreil ────────────────────────────────────────────────────── */

export interface ParamsDutreil {
  valeurParts: number;
  lienParente: "parentEnfant" | "epoux" | "petitEnfant" | "freresSoeurs" | "neveux";
  nbBeneficiaires: number;
  conditionsRemplies: {
    engagementCollectif2ans: boolean;
    engagementIndividuel4ans: boolean;
    directionPost3ans: boolean;
    activiteOperationnelle: boolean;
  };
}

export interface ResultatDutreil {
  abattementDutreil: number;
  baseApresDutreil: number;
  abattementParente: number;
  droitsAvecDutreil: number;
  droitsSansDutreil: number;
  economieDutreil: number;
}

export function simulationDutreil(params: ParamsDutreil): ResultatDutreil {
  const { valeurParts, lienParente, nbBeneficiaires, conditionsRemplies } = params;

  const toutesConditions = Object.values(conditionsRemplies).every(Boolean);

  // Abattement Dutreil 75 %
  const abattementDutreil = toutesConditions ? valeurParts * 0.75 : 0;
  const baseApresDutreil = valeurParts - abattementDutreil;

  // Abattement parenté par bénéficiaire
  const abattementParente = CONSTANTS.ABATTEMENTS_DONATION[lienParente] * nbBeneficiaires;
  const baseTaxableAvecDutreil = Math.max(0, baseApresDutreil - abattementParente);
  const baseTaxableSansDutreil = Math.max(0, valeurParts - abattementParente);

  const droitsAvecDutreil = calculDroitsDonation(baseTaxableAvecDutreil / Math.max(1, nbBeneficiaires)) * nbBeneficiaires;
  const droitsSansDutreil = calculDroitsDonation(baseTaxableSansDutreil / Math.max(1, nbBeneficiaires)) * nbBeneficiaires;

  return {
    abattementDutreil,
    baseApresDutreil,
    abattementParente,
    droitsAvecDutreil,
    droitsSansDutreil,
    economieDutreil: droitsSansDutreil - droitsAvecDutreil,
  };
}
