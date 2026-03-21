/* ─────────────────────────────────────────────────────────────────────────────
   Moteur de calcul — Optimisation Rémunération / Dividendes SELARL
   ────────────────────────────────────────────────────────────────────────── */

import { CONSTANTS } from "../constants/baremes2026";
import { calculCotisationsURSSAF } from "./cotisations";
import { calculIR } from "./fiscalite";

export interface ParamsRemuneration {
  beneficeSELARL: number;
  capitalSocial: number;
  cca: number;
  nbParts: number;
  situationFamiliale: "celibataire" | "marie" | "pacse" | "divorce" | "veuf";
  pass?: number;
}

export interface ScenarioRemuneration {
  nom: string;
  ratio: number;
  remunerationBrute: number;
  cotisationsTNS: number;
  remunerationNette: number;
  resultatAvantIS: number;
  is: number;
  dividendesDistribuables: number;
  dividendesSousSeuil: number;
  dividendesAuDessusSeuil: number;
  pfuTotal: number;
  cotisationsSurDiv: number;
  irEstime: number;
  netDisponible: number;
  tauxGlobal: number;
  pointsRetraiteEstimes: number;
}

export interface ResultatRemuneration {
  seuil10Pourcent: number;
  scenarios: ScenarioRemuneration[];
}

function calculIS(resultat: number): number {
  if (resultat <= 0) return 0;
  const is = CONSTANTS.BAREME_IS;
  if (resultat <= is.seuilReduit) return resultat * is.tauxReduit;
  return is.seuilReduit * is.tauxReduit + (resultat - is.seuilReduit) * is.tauxNormal;
}

export function simulationRemuneration(params: ParamsRemuneration): ResultatRemuneration {
  const {
    beneficeSELARL,
    capitalSocial,
    cca,
    nbParts,
    situationFamiliale,
    pass = CONSTANTS.PASS_2026,
  } = params;

  // Seuil 10 % — Art. L131-6 CSS
  const seuil10Pourcent = (capitalSocial + cca) * 0.1;

  const ratios = [
    { nom: "100 % rémunération", ratio: 1.0 },
    { nom: "75 % rému / 25 % div", ratio: 0.75 },
    { nom: "50 % rému / 50 % div", ratio: 0.5 },
    { nom: "25 % rému / 75 % div", ratio: 0.25 },
    { nom: "Optimum fiscal", ratio: -1 }, // calculé dynamiquement
  ];

  // Trouver l'optimum par itération
  let meilleurNet = 0;
  let meilleurRatio = 0.5;
  for (let r = 0; r <= 100; r += 1) {
    const ratio = r / 100;
    const net = calculerScenario(ratio, beneficeSELARL, seuil10Pourcent, pass, nbParts, situationFamiliale).netDisponible;
    if (net > meilleurNet) {
      meilleurNet = net;
      meilleurRatio = ratio;
    }
  }
  ratios[4].ratio = meilleurRatio;

  const scenarios = ratios.map((r) => ({
    ...calculerScenario(r.ratio, beneficeSELARL, seuil10Pourcent, pass, nbParts, situationFamiliale),
    nom: r.nom === "Optimum fiscal" ? `Optimum (${Math.round(r.ratio * 100)} %)` : r.nom,
    ratio: r.ratio,
  }));

  return { seuil10Pourcent, scenarios };
}

function calculerScenario(
  ratio: number,
  benefice: number,
  seuil10: number,
  pass: number,
  nbParts: number,
  situation: ParamsRemuneration["situationFamiliale"],
): Omit<ScenarioRemuneration, "nom" | "ratio"> {
  const remunerationBrute = benefice * ratio;

  // Cotisations TNS sur rémunération
  const cotis = calculCotisationsURSSAF(remunerationBrute, pass);
  const cotisationsTNS = cotis.totalCotisations;
  const remunerationNette = remunerationBrute - cotisationsTNS;

  // Résultat SELARL après rémunération (la rému est une charge)
  const resultatAvantIS = Math.max(0, benefice - remunerationBrute - cotisationsTNS);
  const is = calculIS(resultatAvantIS);

  // Dividendes distribuables
  const dividendesDistribuables = resultatAvantIS - is;

  // Partie sous le seuil 10 % → PFU
  const dividendesSousSeuil = Math.min(dividendesDistribuables, seuil10);
  const dividendesAuDessusSeuil = Math.max(0, dividendesDistribuables - seuil10);

  // PFU sur partie sous seuil
  const pfuTotal = dividendesSousSeuil * CONSTANTS.PFU.total;

  // Cotisations TNS sur dividendes au-dessus du seuil
  const cotisDiv = dividendesAuDessusSeuil > 0
    ? calculCotisationsURSSAF(dividendesAuDessusSeuil, pass).totalCotisations
    : 0;

  // IR estimé (sur rémunération nette uniquement)
  const irResult = calculIR({
    bnc: remunerationBrute,
    cotisationsDeductibles: cotis.totalDeductible - cotis.csgDeductible,
    csgDeductible: cotis.csgDeductible,
    nbParts,
    situationFamiliale: situation,
  });

  const netDisponible =
    remunerationNette + dividendesSousSeuil - pfuTotal + dividendesAuDessusSeuil - cotisDiv - irResult.irNet;

  const tauxGlobal = benefice > 0 ? 1 - netDisponible / benefice : 0;

  // Points retraite (approximation)
  const pointsRetraiteEstimes = Math.round(
    (Math.min(remunerationBrute + dividendesAuDessusSeuil, pass) * 0.101) /
      (0.6599 * 1.5),
  );

  return {
    remunerationBrute,
    cotisationsTNS,
    remunerationNette,
    resultatAvantIS,
    is,
    dividendesDistribuables,
    dividendesSousSeuil,
    dividendesAuDessusSeuil,
    pfuTotal,
    cotisationsSurDiv: cotisDiv,
    irEstime: irResult.irNet,
    netDisponible,
    tauxGlobal,
    pointsRetraiteEstimes,
  };
}
