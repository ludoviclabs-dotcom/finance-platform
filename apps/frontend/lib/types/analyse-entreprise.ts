// ================================================================
// lib/types/analyse-entreprise.ts
// Aligné sur simulateur Excel 20 onglets — 4 exercices 2022–2025
// ================================================================

export interface DonneesEntreprise {
  identite: IdentiteEntreprise;
  bilan: BilanData;
  cpc: CPCData;
  tftHistorique: TFTHistoriqueData;
  previsionTresorerie: PrevisionMensuelleData;
  budget: BudgetData;
  stocks: StocksData;
  immobilisations: ImmobilisationsData;
  businessUnits: BusinessUnitData[];
  departementsFonctionnels: DepartementFonctionnel[];
  parametres: ParametresAnalyse;
}

export interface IdentiteEntreprise {
  raisonSociale: string;
  secteur: string;
  formeJuridique: string;
  dateCreation: string;
  effectifs: number;
  chiffreAffaires: number;
  devise: '€' | 'k€' | 'M€' | 'Mrd€';
  exerciceFiscal: string;
  nombreExercices: 4;
  diviseurUnite: 1 | 1000 | 1000000 | 1000000000;
  suffixeUnite: '€' | 'k€' | 'M€' | 'Mrd€';
}

export interface BilanData {
  annees: string[]; // ["2022", "2023", "2024", "2025"]
  actif: {
    immobilisationsIncorporelles: number[];
    immobilisationsCorporelles: number[];
    immobilisationsFinancieres: number[];
    stocksMatieresPremières: number[];
    stocksProduitsFinis: number[];
    stocksEnCours: number[];
    stocksMarchandises: number[];
    creancesClients: number[];
    autresCreances: number[];
    tresorerieActive: number[];
    vmp: number[];
    chargesConstateesAvance: number[];
  };
  passif: {
    capitalSocial: number[];
    reserves: number[];
    reportANouveau: number[];
    resultatExercice: number[];
    provisionsReglementees: number[];
    empruntsObligataires: number[];
    empruntsbanairesLT: number[];
    provisionsRisques: number[];
    dettesFournisseurs: number[];
    dettesFiscalesSociales: number[];
    concoursBancairesCourants: number[];
    autresDettes: number[];
    produitsConstatesAvance: number[];
  };
}

export interface CPCData {
  annees: string[];
  chiffreAffaires: number[];
  productionStockee: number[];
  productionImmobilisee: number[];
  subventionsExploitation: number[];
  autresProduitsExploitation: number[];
  achatsMatieresPremieres: number[];
  variationStocksMP: number[];
  autresAchatsChargesExternes: number[];
  impotsTaxes: number[];
  chargesPersonnel: number[];
  dotationsAmortissements: number[];
  dotationsProvisions: number[];
  autresChargesExploitation: number[];
  produitsFinanciers: number[];
  chargesFinancieres: number[];
  produitsExceptionnels: number[];
  chargesExceptionnelles: number[];
  participationSalaries: number[];
  impotSurBenefices: number[];
}

export interface TFTHistoriqueData {
  annees: string[]; // ["2023", "2024", "2025"]
  resultatNet: number[];
  dotationsAmortissements: number[];
  dotationsProvisions: number[];
  plusMoinsValuesCessions: number[];
  variationStocks: number[];
  variationCreancesClients: number[];
  variationDettesFournisseurs: number[];
  variationAutresBFR: number[];
  acquisitionsImmobilisations: number[];
  cessionsImmobilisations: number[];
  investissementsFinanciers: number[];
  augmentationCapital: number[];
  nouveauxEmprunts: number[];
  remboursementsEmprunts: number[];
  dividendesVerses: number[];
}

export interface PrevisionMensuelleData {
  moisLabels: string[];
  encaissementsExploitation: number[];
  encaissementsFinanciers: number[];
  encaissementsExceptionnels: number[];
  decaissementsFournisseurs: number[];
  decaissementsPersonnel: number[];
  decaissementsChargesSociales: number[];
  decaissementsImpots: number[];
  decaissementsInvestissements: number[];
  decaissementsRemboursementsEmprunts: number[];
  decaissementsAutres: number[];
  soldeInitial: number;
}

export interface BudgetData {
  postes: string[];
  montantsBudget: number[];
  montantsReel: number[];
}

export interface ParametresWilson {
  niveauService: 1.28 | 1.65 | 2.33;
  ecartTypeDemande: number;
  delaiApprovisionnement: number;
  coutPassationCommande: number;
  coutPossessionUnitaire: number;
  saisonnaliteActivee: boolean;
  coefficientSaisonnier: number;
}

export interface ArticleStock {
  reference: string;
  designation: string;
  categorie: 'Matières premières' | 'En-cours' | 'Produits finis' | 'Marchandises';
  siQte: number;
  siValeur: number;
  entreesQte: number;
  entreesValeur: number;
  sortiesQte: number;
  valeurNette: number;
  demandeAnnuelle: number;
}

export interface StocksData {
  articles: ArticleStock[];
  methodeValorisation: 'CUMP' | 'FIFO' | 'LIFO';
  parametresWilson: ParametresWilson;
}

export interface Immobilisation {
  designation: string;
  categorie: 'Incorporelle' | 'Corporelle' | 'Financière';
  dateAcquisition: string;
  valeurOrigine: number;
  dureeAmortissement: number;
  methode: 'Lineaire' | 'Degressif';
  tauxDegressif?: number;
  amortissementsCumules: number;
}

export interface ImmobilisationsData {
  immobilisations: Immobilisation[];
}

export interface BusinessUnitData {
  nom: string;
  ca: number;
  caBudget: number;
  coutVariables: number;
  chargesFixesSpecifiques: number;
  effectifs: number;
  quantiteVendue: number;
  quantiteBudget: number;
  prixUnitaireReel: number;
  prixUnitaireBudget: number;
}

export type NomDepartement =
  | 'Marketing'
  | 'Comptabilité / Finance'
  | 'Ressources Humaines'
  | "Systèmes d'Information"
  | 'Autres (DG, Juridique, QSE)';

export interface PosteChargeDepartement {
  libelle: string;
  budget: number;
  reel: number;
}

export interface DepartementFonctionnel {
  nom: NomDepartement;
  effectifs: number;
  postes: PosteChargeDepartement[];
}

export interface ParametresAnalyse {
  tauxSansRisque: number;
  primeRisqueMarche: number;
  beta: number;
  tauxCroissanceTerminale: number;
  tauxIS: number;
  horizonProjection: number;
  tauxCroissanceCA: number;
  benchmarkSecteur: {
    liquiditeGenerale: number;
    liquiditeGeneraleQ3: number;
    margeEBITDA: number;
    margeEBITDAQ3: number;
    roe: number;
    roeQ3: number;
    ratioEndettement: number;
    ratioEndettementQ3: number;
    dso: number;
    dsoQ3: number;
    ccc: number;
    cccQ3: number;
    rotationActifs: number;
    rotationActifsQ3: number;
    altmanZScore: number;
    altmanZScoreQ3: number;
    margeNette: number;
    margeNetteQ3: number;
    couvertureInterets: number;
    couvertureInteretsQ3: number;
  };
}

// ================================================================
// RÉSULTATS
// ================================================================

export interface ResultatsAnalyse {
  ratios: ResultatRatios;
  dcf: ResultatDCF;
  scoring: ResultatScoring;
  benchmark: ResultatBenchmark;
  stocks: ResultatStocks;
  amortissements: ResultatAmortissements;
  ecartsBU: ResultatEcartsBU;
  ecartsDepartements: ResultatEcartsDepartements;
  tft: ResultatTFT;
  analyseApprofondie: ResultatAnalyseApprofondie;
}

export interface ResultatRatios {
  liquiditeGenerale: number[];
  liquiditeReduite: number[];
  liquiditeImmediate: number[];
  bfr: number[];
  bfrJoursCA: number[];
  frng: number[];
  ratioEndettement: number[];
  autonomieFinanciere: number[];
  capaciteRemboursement: number[];
  couvertureChargesFinancieres: number[];
  gearing: number[];
  altmanZScore: number[];
  zScoreInterpretation: ('Saine' | 'Zone grise' | 'Risque faillite')[];
  seuilRentabilite: number[];
  pointMortJours: number[];
  margeCommerciale: number[];
  margeEBITDA: number[];
  margeOperationnelle: number[];
  margeNette: number[];
  roe: number[];
  roa: number[];
  roce: number[];
  rotationActifs: number[];
  rotationStocks: number[];
  dio: number[];
  dso: number[];
  dpo: number[];
  ccc: number[];
  dupont: {
    margeNette: number[];
    rotationActifs: number[];
    levier: number[];
    roe: number[];
  };
  sig: {
    margeCommerciale: number[];
    productionExercice: number[];
    valeurAjoutee: number[];
    ebe: number[];
    resultatExploitation: number[];
    resultatFinancier: number[];
    resultatCourant: number[];
    resultatExceptionnel: number[];
    resultatNet: number[];
    caf: number[];
  };
  avances: {
    ruleOf40: number[];
    netDebtEBITDA: number[];
    roic: number[];
    eva: number[];
    piotroskiFScore: number[];
    interestCoverageRatio: number[];
    margeCaf: number[];
    fcfYield: number[];
    earningsYield: number[];
    sustainableGrowthRate: number[];
    payoutRatio: number[];
    qualityOfEarnings: number[];
    capexDotation: number[];
    tauxVetuste: number[];
    ageMoyenParc: number[];
    roceBU: number[];
    evaGroupe: number[];
  };
  variationsYoY: {
    ca: number[];
    ebitda: number[];
    rn: number[];
    bfr: number[];
  };
}

export interface ResultatDCF {
  wacc: number;
  ke: number;
  kdNet: number;
  poidsCP: number;
  poidsD: number;
  projectionFCFF: {
    annee: number;
    ca: number;
    ebitda: number;
    impots: number;
    capex: number;
    deltaBFR: number;
    fcff: number;
    fcffActualise: number;
  }[];
  sommeFluxActualises: number;
  valeurTerminale: number;
  vtActualisee: number;
  enterpriseValue: number;
  tresorerieNette: number;
  dettesNettes: number;
  equityValue: number;
  tableSensibilite: {
    waccValues: number[];
    gValues: number[];
    matrix: number[][];
  };
}

export interface ResultatScoring {
  scoreLiquidite: number;    // /30
  scoreSolvabilite: number;  // /30
  scoreRentabilite: number;  // /50
  scoreEfficience: number;   // /40
  scoreTotal: number;        // /150
  tauxAtteint: number;
  notation: '🟢 Sain' | '🟠 Vigilance' | '🔴 Risqué';
  zScore: number;
  zScoreInterpretation: 'Saine' | 'Zone grise' | 'Risque faillite';
  scoreRisqueGlobal: number; // /100
}

export interface ResultatBenchmark {
  comparaisons: {
    ratio: string;
    valeurEntreprise: number;
    medianeSecteur: number;
    quartileSuperieur: number;
    position: '🥇 Top 25%' | '📊 Médiane' | '📉 Sous médiane';
    analyse: string;
  }[];
  alertes: {
    rang: number;
    libelle: string;
    valeur: number;
    seuil: string;
    statut: 'OK' | 'Attention' | 'CRITIQUE';
    actionRecommandee: string;
  }[];
  syntheseAlertes: string;
}

export interface ResultatStocks {
  valorisationTotale: number;
  valorisationParCategorie: {
    matieresPremières: number;
    enCours: number;
    produitsFinis: number;
    marchandises: number;
  };
  comparaisonMethodes: {
    cump: number;
    fifo: number;
    lifo: number;
  };
  rotationGlobale: number;
  dioGlobal: number;
  dioMP: number;
  dioPF: number;
  provisionsNecessaires: number;
  tauxDepreciation: number;
  stockMortEstime: number;
  wilson: {
    stockSecurite: number;
    pointCommande: number;
    qteOptimale: number;
    nbCommandesAn: number;
    coutTotalOptimal: number;
    wilsonSaisonnalite?: number;
  };
  reconciliationEcart: number;
  impactBFR: number;
}

export interface ResultatAmortissements {
  tableauParImmobilisation: {
    designation: string;
    vo: number;
    amortCumule: number;
    vnc: number;
    dotationN: number;
    tauxVetuste: number;
  }[];
  syntheseAnnuelle: {
    annee: number;
    dotationTotale: number;
    vncTotale: number;
  }[];
  tauxVetusteMoyen: number;
  ageMoyenParc: number;
  capexVsDotation: number;
}

export interface ResultatEcartsBU {
  parBU: {
    nom: string;
    caReel: number;
    caBudget: number;
    ecartVolume: number;
    ecartPrix: number;
    ecartTotal: number;
    mcv: number;
    tauxMCV: number;
    contributionNette: number;
    seuilRentabilite: number;
    eva: number;
    roce: number;
  }[];
  ecartConsolide: number;
  controleEcarts: number;
  heatmapData: {
    bu: string;
    metrique: string;
    valeur: number;
    statut: 'positif' | 'neutre' | 'negatif';
  }[];
}

export interface ResultatEcartsDepartements {
  parDepartement: {
    nom: NomDepartement;
    effectifs: number;
    budget: number;
    reel: number;
    ecartEur: number;
    ecartPct: number;
    sens: 'Fav.' | 'Défav.' | '—';
    coutParETP: number;
    indiceDerive: '✅ Maîtrisé' | '⚠️ Surveiller' | '🚨 Dérive';
  }[];
  totalFraisGeneraux: {
    budget: number;
    reel: number;
    ecart: number;
    ecartPct: number;
  };
  top5PostesInvestiguer: {
    rang: number;
    departement: NomDepartement;
    poste: string;
    budget: number;
    reel: number;
    ecart: number;
    ecartPct: number;
  }[];
}

export interface ResultatTFT {
  fluxExploitation: number[];
  fluxInvestissement: number[];
  fluxFinancement: number[];
  fluxNetTotal: number[];
}

export interface ResultatAnalyseApprofondie {
  scenarios: {
    nom: 'Base' | 'Pessimiste' | 'Modéré' | 'Optimiste';
    ca: number;
    ebitda: number;
    rn: number;
    tresorerie12mois: number;
  }[];
  previsionTresorerie: {
    mois: string;
    encaissements: number;
    decaissements: number;
    fluxNet: number;
    cumulFlux: number;
    solde: number;
  }[];
  soldeFinal: number;
  moisCritiques: string[];
  besoinFinancement: number;
  waterfallBudgetReel: {
    poste: string;
    budget: number;
    reel: number;
    ecart: number;
    type: 'positif' | 'negatif';
    commentaire: string;
  }[];
  sensibilite: {
    variable: string;
    variation: number;
    impactTresorerie: number;
  }[];
}
