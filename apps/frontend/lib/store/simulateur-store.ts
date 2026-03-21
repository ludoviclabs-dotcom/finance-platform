"use client";
/* ─────────────────────────────────────────────────────────────────────────────
   Store Zustand — Simulateur Patrimoine PL Santé
   ────────────────────────────────────────────────────────────────────────── */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CONSTANTS } from "../constants/baremes2026";
import {
  calculCotisationsURSSAF,
  calculIR,
  calculIFI,
  projectionRetraite,
  calculGapPrevoyance,
  simulationPER,
  simulationRemuneration,
  projectionPatrimoniale,
} from "../calculators";

import type { ResultatCotisations } from "../calculators/cotisations";
import type { ResultatFiscalite } from "../calculators/fiscalite";
import type { ResultatIFI } from "../calculators/ifi";
import type { ResultatRetraite } from "../calculators/retraite";
import type { ResultatPrevoyance } from "../calculators/prevoyance";
import type { ResultatPER } from "../calculators/per";
import type { ResultatRemuneration } from "../calculators/remuneration";
import type { ResultatProjection } from "../calculators/projection";

/* ── Client data ─────────────────────────────────────────────────────────── */

export interface ClientIdentite {
  civilite: "M" | "Mme";
  nom: string;
  prenom: string;
  dateNaissance: string;
  age: number;
  situationFamiliale: "celibataire" | "marie" | "pacse" | "divorce" | "veuf";
  nbEnfants: number;
  nbParts: number;
  conjointNom: string;
  conjointAge: number;
  conjointProfession: string;
  conjointRevenu: number;
  regimeMatrimonial: "communaute_legale" | "separation" | "participation" | "communaute_universelle" | "";
}

export interface ClientActivite {
  profession: string;
  conventionnement: "S1" | "S2" | "NC";
  dateDebutExercice: string;
  formeJuridique: "EI_BNC" | "EI_IS" | "SELARL" | "SELAS" | "MICRO";
  regimeFiscal: "BNC" | "IS" | "MICRO";
  caisse: string;
  bncN2: number;
  bncN1: number;
  bncN: number;
  capitalSocial: number;
  cca: number;
  pourcentageDetention: number;
  remuneration: number;
  dividendesN1: number;
}

export interface ClientPatrimoine {
  rpValeur: number;
  locatifValeur: number;
  sciValeur: number;
  scpiValeur: number;
  opciValeur: number;
  livretA: number;
  ldds: number;
  av1: number;
  av2: number;
  per: number;
  pea: number;
  cto: number;
  crypto: number;
  emprunt1CRD: number;
  emprunt1Mensualite: number;
  emprunt2CRD: number;
  emprunt2Mensualite: number;
  totalActifs: number;
  totalPassifs: number;
  patrimoineNet: number;
}

export interface ClientContrats {
  prevoyanceIJJour: number;
  prevoyanceFranchise: number;
  prevoyanceCapitalDeces: number;
  prevoyanceCotisation: number;
  complementaireSante: number;
  retraiteSupplementaireEncours: number;
  retraiteSupplementaireVersement: number;
}

export interface ClientObjectifs {
  ageDepartRetraite: number;
  revenuCibleMensuel: number;
  pourcentageMaintienRevenu: number;
  chargesFixes: number;
  franchiseSouhaitee: number;
  capitalDecesSouhaite: number;
  profilRisque: "conservateur" | "equilibre" | "dynamique";
  capaciteEpargneMensuelle: number;
}

export interface ClientData {
  identite: ClientIdentite;
  activite: ClientActivite;
  patrimoine: ClientPatrimoine;
  contrats: ClientContrats;
  objectifs: ClientObjectifs;
}

/* ── Résultats ───────────────────────────────────────────────────────────── */

export interface Resultats {
  cotisations: ResultatCotisations | null;
  fiscalite: ResultatFiscalite | null;
  ifi: ResultatIFI | null;
  retraite: ResultatRetraite | null;
  prevoyance: ResultatPrevoyance | null;
  per: ResultatPER | null;
  remuneration: ResultatRemuneration | null;
  projection: ResultatProjection | null;
}

/* ── Store ────────────────────────────────────────────────────────────────── */

interface SimulateurStore {
  client: ClientData;
  resultats: Resultats;
  calculsDone: boolean;
  currentStep: number;

  updateIdentite: (data: Partial<ClientIdentite>) => void;
  updateActivite: (data: Partial<ClientActivite>) => void;
  updatePatrimoine: (data: Partial<ClientPatrimoine>) => void;
  updateContrats: (data: Partial<ClientContrats>) => void;
  updateObjectifs: (data: Partial<ClientObjectifs>) => void;
  setStep: (step: number) => void;
  runAllCalculations: () => void;
  resetAll: () => void;
}

const defaultClient: ClientData = {
  identite: {
    civilite: "M",
    nom: "",
    prenom: "",
    dateNaissance: "",
    age: 45,
    situationFamiliale: "marie",
    nbEnfants: 2,
    nbParts: 3,
    conjointNom: "",
    conjointAge: 43,
    conjointProfession: "",
    conjointRevenu: 0,
    regimeMatrimonial: "communaute_legale",
  },
  activite: {
    profession: "Médecin",
    conventionnement: "S1",
    dateDebutExercice: "2010-01-01",
    formeJuridique: "EI_BNC",
    regimeFiscal: "BNC",
    caisse: "CARMF",
    bncN2: 120_000,
    bncN1: 130_000,
    bncN: 140_000,
    capitalSocial: 0,
    cca: 0,
    pourcentageDetention: 100,
    remuneration: 0,
    dividendesN1: 0,
  },
  patrimoine: {
    rpValeur: 500_000,
    locatifValeur: 0,
    sciValeur: 0,
    scpiValeur: 0,
    opciValeur: 0,
    livretA: 22_950,
    ldds: 12_000,
    av1: 50_000,
    av2: 0,
    per: 15_000,
    pea: 30_000,
    cto: 0,
    crypto: 0,
    emprunt1CRD: 180_000,
    emprunt1Mensualite: 1_200,
    emprunt2CRD: 0,
    emprunt2Mensualite: 0,
    totalActifs: 629_950,
    totalPassifs: 180_000,
    patrimoineNet: 449_950,
  },
  contrats: {
    prevoyanceIJJour: 80,
    prevoyanceFranchise: 30,
    prevoyanceCapitalDeces: 200_000,
    prevoyanceCotisation: 250,
    complementaireSante: 180,
    retraiteSupplementaireEncours: 15_000,
    retraiteSupplementaireVersement: 5_000,
  },
  objectifs: {
    ageDepartRetraite: 65,
    revenuCibleMensuel: 5_000,
    pourcentageMaintienRevenu: 80,
    chargesFixes: 2_000,
    franchiseSouhaitee: 15,
    capitalDecesSouhaite: 500_000,
    profilRisque: "equilibre",
    capaciteEpargneMensuelle: 1_500,
  },
};

const defaultResultats: Resultats = {
  cotisations: null,
  fiscalite: null,
  ifi: null,
  retraite: null,
  prevoyance: null,
  per: null,
  remuneration: null,
  projection: null,
};

export const useSimulateurStore = create<SimulateurStore>()(
  persist(
    (set, get) => ({
      client: defaultClient,
      resultats: defaultResultats,
      calculsDone: false,
      currentStep: 0,

      updateIdentite: (data) =>
        set((s) => ({ client: { ...s.client, identite: { ...s.client.identite, ...data } } })),

      updateActivite: (data) =>
        set((s) => ({ client: { ...s.client, activite: { ...s.client.activite, ...data } } })),

      updatePatrimoine: (data) =>
        set((s) => ({ client: { ...s.client, patrimoine: { ...s.client.patrimoine, ...data } } })),

      updateContrats: (data) =>
        set((s) => ({ client: { ...s.client, contrats: { ...s.client.contrats, ...data } } })),

      updateObjectifs: (data) =>
        set((s) => ({ client: { ...s.client, objectifs: { ...s.client.objectifs, ...data } } })),

      setStep: (step) => set({ currentStep: step }),

      runAllCalculations: () => {
        const { client } = get();
        const bnc = client.activite.bncN;
        const pass = CONSTANTS.PASS_2026;

        // 1. Cotisations
        const cotisations = calculCotisationsURSSAF(bnc, pass);

        // 2. Fiscalité IR
        const fiscalite = calculIR({
          bnc,
          cotisationsDeductibles: cotisations.totalDeductible - cotisations.csgDeductible,
          csgDeductible: cotisations.csgDeductible,
          revenuFoncier: 0,
          revenuConjoint: client.identite.conjointRevenu,
          versementsPER: client.contrats.retraiteSupplementaireVersement,
          nbParts: client.identite.nbParts,
          situationFamiliale: client.identite.situationFamiliale,
        });

        // 3. IFI
        const ifi = calculIFI({
          rpValeur: client.patrimoine.rpValeur,
          locatifValeur: client.patrimoine.locatifValeur,
          sciValeur: client.patrimoine.sciValeur,
          scpiValeur: client.patrimoine.scpiValeur,
          opciValeur: client.patrimoine.opciValeur,
          crdEmprunts: client.patrimoine.emprunt1CRD + client.patrimoine.emprunt2CRD,
          taxeFonciereDue: 0,
          travauxFactures: 0,
          donsIFI: 0,
          revenus: bnc,
          irNet: fiscalite.irNet,
          psTotal: 0,
        });

        // 4. Retraite
        const retraite = projectionRetraite({
          bnc,
          age: client.identite.age,
          ageDepart: client.objectifs.ageDepartRetraite,
          croissanceBNC: 0.02,
          inflation: 0.009,
          trimestresAcquis: Math.max(0, (client.identite.age - 25) * 4),
          pointsAcquis: Math.max(0, (client.identite.age - 25) * 30),
          objectifMensuel: client.objectifs.revenuCibleMensuel,
        });

        // 5. Prévoyance
        const prevoyance = calculGapPrevoyance({
          revenuNetMensuel: cotisations.bncNetMensuel,
          pourcentageMaintien: client.objectifs.pourcentageMaintienRevenu,
          chargesFixes: client.objectifs.chargesFixes,
          franchiseSouhaitee: client.objectifs.franchiseSouhaitee,
          ijCaisseObligatoire: 55,
          franchiseCaisse: 90,
          ijContratPrive: client.contrats.prevoyanceIJJour,
          franchisePrive: client.contrats.prevoyanceFranchise,
          capitalCaisseObligatoire: 50_000,
          capitalContratPrive: client.contrats.prevoyanceCapitalDeces,
          epargneConjoint: 0,
          trainDeVieFamille: client.objectifs.chargesFixes,
          anneesACouvrirDeces: 15,
          fraisEtudes: 30_000,
          fraisObseques: 5_000,
          crdNonCouverts: 0,
        });

        // 6. PER
        const per = simulationPER({
          bnc,
          tmi: fiscalite.tmi,
          tmiRetraite: 0.30,
          versementAnnuel: client.contrats.retraiteSupplementaireVersement,
          encoursActuel: client.contrats.retraiteSupplementaireEncours,
          duree: client.objectifs.ageDepartRetraite - client.identite.age,
          rendementCentral: 0.035,
          rendementPessimiste: 0.015,
          rendementOptimiste: 0.06,
          ageRetraite: client.objectifs.ageDepartRetraite,
        });

        // 7. Rémunération (si SELARL)
        let remuneration: ResultatRemuneration | null = null;
        if (client.activite.formeJuridique === "SELARL" || client.activite.formeJuridique === "SELAS") {
          remuneration = simulationRemuneration({
            beneficeSELARL: bnc,
            capitalSocial: client.activite.capitalSocial,
            cca: client.activite.cca,
            nbParts: client.identite.nbParts,
            situationFamiliale: client.identite.situationFamiliale,
          });
        }

        // 8. Projection 30 ans
        const projection = projectionPatrimoniale({
          patrimoineNetActuel: client.patrimoine.patrimoineNet,
          bnc,
          age: client.identite.age,
          ageRetraite: client.objectifs.ageDepartRetraite,
          depensesMensuelles: client.objectifs.chargesFixes,
          epargneNetteMensuelle: client.objectifs.capaciteEpargneMensuelle,
          pensionEstimee: retraite.pensionAnnuelle,
          nbParts: client.identite.nbParts,
          situationFamiliale: client.identite.situationFamiliale,
        });

        set({
          resultats: { cotisations, fiscalite, ifi, retraite, prevoyance, per, remuneration, projection },
          calculsDone: true,
        });
      },

      resetAll: () => set({ client: defaultClient, resultats: defaultResultats, calculsDone: false, currentStep: 0 }),
    }),
    { name: "simulateur-patrimoine-pl" },
  ),
);
