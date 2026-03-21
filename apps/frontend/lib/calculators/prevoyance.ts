/* ─────────────────────────────────────────────────────────────────────────────
   Moteur de calcul — Analyse Gaps Prévoyance
   ────────────────────────────────────────────────────────────────────────── */

export interface ParamsPrevoyance {
  revenuNetMensuel: number;
  pourcentageMaintien: number;
  chargesFixes: number;
  franchiseSouhaitee: number;
  ijCaisseObligatoire: number;
  franchiseCaisse: number;
  ijContratPrive: number;
  franchisePrive: number;
  capitalCaisseObligatoire: number;
  capitalContratPrive: number;
  epargneConjoint: number;
  trainDeVieFamille: number;
  anneesACouvrirDeces: number;
  fraisEtudes: number;
  fraisObseques: number;
  crdNonCouverts: number;
}

export interface GapPeriode {
  debut: number;
  fin: number;
  besoin: number;
  couverture: number;
  gap: number;
  description: string;
}

export interface ResultatPrevoyance {
  besoinJournalier: number;
  gapIJ: {
    periode1: GapPeriode;
    periode2: GapPeriode;
    periode3: GapPeriode;
  };
  ijComplementaireRecommandee: number;
  besoinCapitalDeces: number;
  couvertureExistanteDeces: number;
  gapCapitalDeces: number;
}

export function calculGapPrevoyance(params: ParamsPrevoyance): ResultatPrevoyance {
  const {
    revenuNetMensuel,
    pourcentageMaintien,
    chargesFixes,
    ijCaisseObligatoire,
    franchiseCaisse,
    ijContratPrive,
    franchisePrive,
    capitalCaisseObligatoire,
    capitalContratPrive,
    epargneConjoint,
    trainDeVieFamille,
    anneesACouvrirDeces,
    fraisEtudes,
    fraisObseques,
    crdNonCouverts,
  } = params;

  const besoinJournalier = ((revenuNetMensuel * pourcentageMaintien) / 100 + chargesFixes) / 30;

  // Période 1 : 0 → franchise privé (aucune couverture privée, caisse selon franchise)
  const finP1 = Math.min(franchisePrive, franchiseCaisse);
  const couvertureP1 = 0;
  const gapP1 = besoinJournalier - couvertureP1;

  // Période 2 : franchise privé → 90j (franchise CARPIMKO classique)
  const debutP2 = finP1;
  const finP2 = franchiseCaisse;
  const couvertureP2 = debutP2 < franchisePrive ? 0 : ijContratPrive;
  const gapP2 = Math.max(0, besoinJournalier - couvertureP2);

  // Période 3 : > 90j (caisse + privé)
  const debutP3 = franchiseCaisse;
  const couvertureP3 = ijCaisseObligatoire + ijContratPrive;
  const gapP3 = Math.max(0, besoinJournalier - couvertureP3);

  const ijComplementaireRecommandee = Math.max(gapP1, gapP2, gapP3);

  // Capital décès
  const besoinCapitalDeces =
    trainDeVieFamille * 12 * anneesACouvrirDeces +
    fraisEtudes +
    fraisObseques +
    crdNonCouverts;

  const couvertureExistanteDeces =
    capitalCaisseObligatoire + capitalContratPrive + epargneConjoint;

  const gapCapitalDeces = Math.max(0, besoinCapitalDeces - couvertureExistanteDeces);

  return {
    besoinJournalier,
    gapIJ: {
      periode1: {
        debut: 0,
        fin: finP1,
        besoin: besoinJournalier,
        couverture: couvertureP1,
        gap: gapP1,
        description: `J0 → J${finP1} : aucune couverture`,
      },
      periode2: {
        debut: debutP2,
        fin: finP2,
        besoin: besoinJournalier,
        couverture: couvertureP2,
        gap: gapP2,
        description: `J${debutP2} → J${finP2} : couverture privée seule`,
      },
      periode3: {
        debut: debutP3,
        fin: 1095,
        besoin: besoinJournalier,
        couverture: couvertureP3,
        gap: gapP3,
        description: `J${debutP3}+ : caisse + privé`,
      },
    },
    ijComplementaireRecommandee,
    besoinCapitalDeces,
    couvertureExistanteDeces,
    gapCapitalDeces,
  };
}
