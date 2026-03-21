import type {
  DonneesEntreprise,
  ResultatsAnalyse,
  ResultatRatios,
  ResultatDCF,
  ResultatScoring,
  ResultatBenchmark,
  ResultatStocks,
  ResultatAmortissements,
  ResultatEcartsBU,
  ResultatEcartsDepartements,
  ResultatTFT,
  ResultatAnalyseApprofondie,
} from '@/lib/types/analyse-entreprise';

// ─── HELPERS ────────────────────────────────────────────────────
function safe(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}
function v(arr: number[], idx: number): number {
  return arr[idx] ?? 0;
}

// ─── TOTAUX BILAN ───────────────────────────────────────────────
export function calculerTotauxBilan(d: DonneesEntreprise) {
  const { actif, passif } = d.bilan;
  const n = d.bilan.annees.length;

  const totalActifNC = Array.from({ length: n }, (_, i) =>
    v(actif.immobilisationsIncorporelles, i) +
    v(actif.immobilisationsCorporelles, i) +
    v(actif.immobilisationsFinancieres, i)
  );
  const totalStocks = Array.from({ length: n }, (_, i) =>
    v(actif.stocksMatieresPremières, i) +
    v(actif.stocksProduitsFinis, i) +
    v(actif.stocksEnCours, i) +
    v(actif.stocksMarchandises, i)
  );
  const totalActifC = Array.from({ length: n }, (_, i) =>
    v(totalStocks, i) +
    v(actif.creancesClients, i) +
    v(actif.autresCreances, i) +
    v(actif.tresorerieActive, i) +
    v(actif.vmp, i) +
    v(actif.chargesConstateesAvance, i)
  );
  const totalActif = Array.from({ length: n }, (_, i) =>
    v(totalActifNC, i) + v(totalActifC, i)
  );
  const totalCP = Array.from({ length: n }, (_, i) =>
    v(passif.capitalSocial, i) +
    v(passif.reserves, i) +
    v(passif.reportANouveau, i) +
    v(passif.resultatExercice, i) +
    v(passif.provisionsReglementees, i)
  );
  const totalDettesNC = Array.from({ length: n }, (_, i) =>
    v(passif.empruntsObligataires, i) +
    v(passif.empruntsbanairesLT, i) +
    v(passif.provisionsRisques, i)
  );
  const totalDettesC = Array.from({ length: n }, (_, i) =>
    v(passif.dettesFournisseurs, i) +
    v(passif.dettesFiscalesSociales, i) +
    v(passif.concoursBancairesCourants, i) +
    v(passif.autresDettes, i) +
    v(passif.produitsConstatesAvance, i)
  );
  const totalPassif = Array.from({ length: n }, (_, i) =>
    v(totalCP, i) + v(totalDettesNC, i) + v(totalDettesC, i)
  );
  const ecartBilan = Array.from({ length: n }, (_, i) =>
    v(totalActif, i) - v(totalPassif, i)
  );

  return {
    totalActifNC, totalActifC, totalActif, totalStocks,
    totalCP, totalDettesNC, totalDettesC, totalPassif, ecartBilan,
  };
}

// ─── SIG ────────────────────────────────────────────────────────
export function calculerSIG(d: DonneesEntreprise) {
  const c = d.cpc;
  const n = c.annees.length;

  return Array.from({ length: n }, (_, i) => {
    const ca        = v(c.chiffreAffaires, i);
    const achatsMP  = v(c.achatsMatieresPremieres, i);
    const varMP     = v(c.variationStocksMP, i);
    const autresAch = v(c.autresAchatsChargesExternes, i);
    const subv      = v(c.subventionsExploitation, i);
    const autresProd= v(c.autresProduitsExploitation, i);
    const impots    = v(c.impotsTaxes, i);
    const perso     = v(c.chargesPersonnel, i);
    const da        = v(c.dotationsAmortissements, i);
    const dp        = v(c.dotationsProvisions, i);
    const autresCh  = v(c.autresChargesExploitation, i);
    const prodFin   = v(c.produitsFinanciers, i);
    const chFin     = v(c.chargesFinancieres, i);
    const prodExc   = v(c.produitsExceptionnels, i);
    const chExc     = v(c.chargesExceptionnelles, i);
    const partic    = v(c.participationSalaries, i);
    const is        = v(c.impotSurBenefices, i);

    const margeCommerciale = ca - achatsMP - varMP;
    const valeurAjoutee    = margeCommerciale + autresProd + subv - autresAch;
    const ebe              = valeurAjoutee - perso - impots;
    const resExploitation  = ebe - da - dp - autresCh;
    const resFinancier     = prodFin - chFin;
    const resCourant       = resExploitation + resFinancier;
    const resExceptionnel  = prodExc - chExc;
    const rn               = resCourant + resExceptionnel - partic - is;
    const caf              = rn + da + dp - prodExc + chExc;

    return {
      margeCommerciale, valeurAjoutee, ebe,
      resExploitation, resFinancier, resCourant,
      resExceptionnel, rn, caf, da,
    };
  });
}

// ─── RATIOS ─────────────────────────────────────────────────────
export function calculerRatios(d: DonneesEntreprise): ResultatRatios {
  const bil = calculerTotauxBilan(d);
  const sig = calculerSIG(d);
  const n   = d.bilan.annees.length;
  const { actif, passif } = d.bilan;
  const c = d.cpc;

  const liquiditeGenerale = Array.from({ length: n }, (_, i) =>
    safe(v(bil.totalActifC, i), v(bil.totalDettesC, i))
  );
  const liquiditeReduite = Array.from({ length: n }, (_, i) =>
    safe(
      v(actif.creancesClients, i) + v(actif.autresCreances, i) +
      v(actif.tresorerieActive, i) + v(actif.vmp, i),
      v(bil.totalDettesC, i)
    )
  );
  const liquiditeImmediate = Array.from({ length: n }, (_, i) =>
    safe(v(actif.tresorerieActive, i) + v(actif.vmp, i), v(bil.totalDettesC, i))
  );
  const bfr = Array.from({ length: n }, (_, i) =>
    v(bil.totalStocks, i) + v(actif.creancesClients, i) + v(actif.autresCreances, i)
    - v(passif.dettesFournisseurs, i) - v(passif.dettesFiscalesSociales, i)
  );
  const bfrJoursCA = Array.from({ length: n }, (_, i) =>
    safe(v(bfr, i) * 365, v(c.chiffreAffaires, i))
  );
  const frng = Array.from({ length: n }, (_, i) =>
    v(bil.totalCP, i) + v(bil.totalDettesNC, i) - v(bil.totalActifNC, i)
  );
  const dettesFinancieres = Array.from({ length: n }, (_, i) =>
    v(passif.empruntsObligataires, i) + v(passif.empruntsbanairesLT, i) +
    v(passif.concoursBancairesCourants, i)
  );
  const ratioEndettement     = Array.from({ length: n }, (_, i) => safe(v(dettesFinancieres, i), v(bil.totalCP, i)));
  const autonomieFinanciere  = Array.from({ length: n }, (_, i) => safe(v(bil.totalCP, i), v(bil.totalActif, i)));
  const capaciteRemboursement= Array.from({ length: n }, (_, i) => safe(v(dettesFinancieres, i), sig[i]?.caf ?? 1));
  const couvertureChargesFinancieres = Array.from({ length: n }, (_, i) =>
    safe(sig[i]?.ebe ?? 0, v(c.chargesFinancieres, i))
  );
  const gearing = Array.from({ length: n }, (_, i) =>
    safe(
      v(dettesFinancieres, i) - v(actif.tresorerieActive, i) - v(actif.vmp, i),
      v(bil.totalCP, i)
    )
  );

  // Altman Z-Score
  const altmanZScore = Array.from({ length: n }, (_, i) => {
    const ta = v(bil.totalActif, i);
    if (ta === 0) return 0;
    const X1 = safe(v(frng, i), ta);
    const X2 = safe(v(passif.reserves, i) + v(passif.reportANouveau, i), ta);
    const X3 = safe(sig[i]?.resExploitation ?? 0, ta);
    const X4 = safe(v(bil.totalCP, i), v(dettesFinancieres, i));
    const X5 = safe(v(c.chiffreAffaires, i), ta);
    return 1.2 * X1 + 1.4 * X2 + 3.3 * X3 + 0.6 * X4 + 0.999 * X5;
  });
  const zScoreInterpretation = altmanZScore.map(z =>
    z > 2.99 ? 'Saine' : z > 1.81 ? 'Zone grise' : 'Risque faillite'
  ) as ('Saine' | 'Zone grise' | 'Risque faillite')[];

  // Seuil de rentabilité
  const seuilRentabilite = Array.from({ length: n }, (_, i) => {
    const ca = v(c.chiffreAffaires, i);
    const cv = v(c.achatsMatieresPremieres, i) + v(c.variationStocksMP, i) + v(c.autresAchatsChargesExternes, i);
    const cf = v(c.chargesPersonnel, i) + v(c.impotsTaxes, i) + v(c.dotationsAmortissements, i) +
               v(c.dotationsProvisions, i) + v(c.autresChargesExploitation, i) + v(c.chargesFinancieres, i);
    const mcvRate = safe(ca - cv, ca);
    return safe(cf, mcvRate);
  });
  const pointMortJours = Array.from({ length: n }, (_, i) =>
    safe(v(seuilRentabilite, i) * 365, v(c.chiffreAffaires, i))
  );

  // Rentabilité
  const margeCommerciale   = Array.from({ length: n }, (_, i) => safe(sig[i]?.margeCommerciale ?? 0, v(c.chiffreAffaires, i)));
  const margeEBITDA        = Array.from({ length: n }, (_, i) => safe(sig[i]?.ebe ?? 0, v(c.chiffreAffaires, i)));
  const margeOperationnelle= Array.from({ length: n }, (_, i) => safe(sig[i]?.resExploitation ?? 0, v(c.chiffreAffaires, i)));
  const margeNette         = Array.from({ length: n }, (_, i) => safe(sig[i]?.rn ?? 0, v(c.chiffreAffaires, i)));
  const capitalEmploye     = Array.from({ length: n }, (_, i) => v(bil.totalCP, i) + v(bil.totalDettesNC, i));
  const roe  = Array.from({ length: n }, (_, i) => safe(sig[i]?.rn ?? 0, v(bil.totalCP, i)));
  const roa  = Array.from({ length: n }, (_, i) => safe(sig[i]?.rn ?? 0, v(bil.totalActif, i)));
  const roce = Array.from({ length: n }, (_, i) => safe(sig[i]?.resExploitation ?? 0, v(capitalEmploye, i)));

  // Efficience / CCC
  const rotationActifs = Array.from({ length: n }, (_, i) => safe(v(c.chiffreAffaires, i), v(bil.totalActif, i)));
  const rotationStocks = Array.from({ length: n }, (_, i) => safe(v(c.chiffreAffaires, i), v(bil.totalStocks, i)));
  const dio = Array.from({ length: n }, (_, i) => safe(v(bil.totalStocks, i) * 365, v(c.chiffreAffaires, i)));
  const dso = Array.from({ length: n }, (_, i) => safe(v(actif.creancesClients, i) * 365, v(c.chiffreAffaires, i)));
  const dpo = Array.from({ length: n }, (_, i) =>
    safe(
      v(passif.dettesFournisseurs, i) * 365,
      v(c.achatsMatieresPremieres, i) + v(c.variationStocksMP, i) + v(c.autresAchatsChargesExternes, i)
    )
  );
  const ccc = Array.from({ length: n }, (_, i) => v(dio, i) + v(dso, i) - v(dpo, i));

  // DuPont 3F
  const levier = Array.from({ length: n }, (_, i) => safe(v(bil.totalActif, i), v(bil.totalCP, i)));
  const dupont = {
    margeNette,
    rotationActifs,
    levier,
    roe: Array.from({ length: n }, (_, i) => v(margeNette, i) * v(rotationActifs, i) * v(levier, i)),
  };

  // SIG structuré
  const sig_result = {
    margeCommerciale:     sig.map(s => s.margeCommerciale),
    productionExercice:   sig.map(s => s.margeCommerciale),
    valeurAjoutee:        sig.map(s => s.valeurAjoutee),
    ebe:                  sig.map(s => s.ebe),
    resultatExploitation: sig.map(s => s.resExploitation),
    resultatFinancier:    sig.map(s => s.resFinancier),
    resultatCourant:      sig.map(s => s.resCourant),
    resultatExceptionnel: sig.map(s => s.resExceptionnel),
    resultatNet:          sig.map(s => s.rn),
    caf:                  sig.map(s => s.caf),
  };

  // Ratios avancés
  const caGrowth = Array.from({ length: n }, (_, i) =>
    i === 0 ? 0 : safe(v(c.chiffreAffaires, i) - v(c.chiffreAffaires, i - 1), v(c.chiffreAffaires, i - 1))
  );
  const ruleOf40        = Array.from({ length: n }, (_, i) => v(caGrowth, i) * 100 + v(margeEBITDA, i) * 100);
  const netDebtEBITDA   = Array.from({ length: n }, (_, i) =>
    safe(v(dettesFinancieres, i) - v(actif.tresorerieActive, i) - v(actif.vmp, i), sig[i]?.ebe ?? 1)
  );
  const roic = Array.from({ length: n }, (_, i) =>
    safe((sig[i]?.resExploitation ?? 0) * (1 - d.parametres.tauxIS), v(capitalEmploye, i))
  );
  const eva  = Array.from({ length: n }, (_, i) =>
    (v(roic, i) - d.parametres.tauxSansRisque) * v(capitalEmploye, i)
  );
  const piotroskiFScore = Array.from({ length: n }, (_, i) => {
    if (i === 0) return 0;
    const rn   = sig[i]?.rn ?? 0;
    const ta   = v(bil.totalActif, i);
    const caf_v= sig[i]?.caf ?? 0;
    const F1 = rn > 0 ? 1 : 0;
    const F2 = safe(caf_v, ta) > 0 ? 1 : 0;
    const F3 = safe(rn, ta) > safe(sig[i - 1]?.rn ?? 0, v(bil.totalActif, i - 1)) ? 1 : 0;
    const F4 = caf_v > rn ? 1 : 0;
    const F5 = v(ratioEndettement, i) < v(ratioEndettement, i - 1) ? 1 : 0;
    const F6 = v(liquiditeGenerale, i) > v(liquiditeGenerale, i - 1) ? 1 : 0;
    const F8 = v(margeOperationnelle, i) > v(margeOperationnelle, i - 1) ? 1 : 0;
    const F9 = v(rotationActifs, i) > v(rotationActifs, i - 1) ? 1 : 0;
    return (F1 + F2 + F3 + F4 + F5 + F6 + 1 + F8 + F9);
  });
  const margeCaf          = Array.from({ length: n }, (_, i) => safe(sig[i]?.caf ?? 0, v(c.chiffreAffaires, i)));
  const qualityOfEarnings = Array.from({ length: n }, (_, i) => safe(sig[i]?.caf ?? 0, Math.abs(sig[i]?.rn ?? 1)));
  const payoutRatio       = new Array(n).fill(0);
  const sustainableGrowthRate = Array.from({ length: n }, (_, i) => v(roe, i) * (1 - v(payoutRatio, i)));
  const zeros             = new Array(n).fill(0);

  const variationsYoY = {
    ca:     Array.from({ length: n }, (_, i) => i === 0 ? 0 : safe(v(c.chiffreAffaires, i) - v(c.chiffreAffaires, i - 1), v(c.chiffreAffaires, i - 1))),
    ebitda: Array.from({ length: n }, (_, i) => i === 0 ? 0 : safe((sig[i]?.ebe ?? 0) - (sig[i - 1]?.ebe ?? 0), Math.abs(sig[i - 1]?.ebe ?? 1))),
    rn:     Array.from({ length: n }, (_, i) => i === 0 ? 0 : safe((sig[i]?.rn ?? 0) - (sig[i - 1]?.rn ?? 0), Math.abs(sig[i - 1]?.rn ?? 1))),
    bfr:    Array.from({ length: n }, (_, i) => i === 0 ? 0 : safe(v(bfr, i) - v(bfr, i - 1), Math.abs(v(bfr, i - 1)))),
  };

  return {
    liquiditeGenerale, liquiditeReduite, liquiditeImmediate,
    bfr, bfrJoursCA, frng,
    ratioEndettement, autonomieFinanciere, capaciteRemboursement,
    couvertureChargesFinancieres, gearing,
    altmanZScore, zScoreInterpretation,
    seuilRentabilite, pointMortJours,
    margeCommerciale, margeEBITDA, margeOperationnelle, margeNette,
    roe, roa, roce,
    rotationActifs, rotationStocks, dio, dso, dpo, ccc,
    dupont, sig: sig_result,
    avances: {
      ruleOf40, netDebtEBITDA, roic, eva, piotroskiFScore,
      interestCoverageRatio: couvertureChargesFinancieres,
      margeCaf, fcfYield: zeros, earningsYield: zeros,
      sustainableGrowthRate, payoutRatio, qualityOfEarnings,
      capexDotation: zeros, tauxVetuste: zeros, ageMoyenParc: zeros,
      roceBU: zeros, evaGroupe: zeros,
    },
    variationsYoY,
  };
}

// ─── DCF ────────────────────────────────────────────────────────
export function calculerDCF(d: DonneesEntreprise, ratios: ResultatRatios): ResultatDCF {
  const p       = d.parametres;
  const sig     = calculerSIG(d);
  const bil     = calculerTotauxBilan(d);
  const last    = d.bilan.annees.length - 1;
  const c       = d.cpc;

  const ke          = p.tauxSansRisque + p.beta * p.primeRisqueMarche;
  const totalCP_l   = v(bil.totalCP, last);
  const dettesF_l   = v(bil.totalDettesNC, last);
  const totalFin    = totalCP_l + dettesF_l;
  const poidsCP     = safe(totalCP_l, totalFin);
  const poidsD      = safe(dettesF_l, totalFin);
  const kdNet       = safe(v(c.chargesFinancieres, last), dettesF_l) * (1 - p.tauxIS);
  const wacc        = poidsCP * ke + poidsD * kdNet;

  const caBase      = v(c.chiffreAffaires, last);
  const ebitdaRate  = safe(sig[last]?.ebe ?? 0, caBase);
  const bfrPct      = safe(ratios.bfr[last] ?? 0, caBase);

  const projectionFCFF = Array.from({ length: p.horizonProjection }, (_, i) => {
    const annee   = parseInt(d.bilan.annees[last]) + i + 1;
    const ca      = caBase * Math.pow(1 + p.tauxCroissanceCA, i + 1);
    const ebitda  = ca * ebitdaRate;
    const impots  = ebitda * p.tauxIS;
    const capex   = v(c.dotationsAmortissements, last) * (1 + p.tauxCroissanceCA * (i + 1));
    const prevBFR = caBase * Math.pow(1 + p.tauxCroissanceCA, i) * bfrPct;
    const currBFR = ca * bfrPct;
    const deltaBFR= currBFR - prevBFR;
    const fcff    = ebitda - impots - capex - deltaBFR;
    const fcffActualise = fcff / Math.pow(1 + wacc, i + 1);
    return { annee, ca, ebitda, impots, capex, deltaBFR, fcff, fcffActualise };
  });

  const sommeFluxActualises = projectionFCFF.reduce((s, f) => s + f.fcffActualise, 0);
  const fcffN = projectionFCFF[projectionFCFF.length - 1]?.fcff ?? 0;
  const g     = p.tauxCroissanceTerminale;
  const valeurTerminale = safe(fcffN * (1 + g), wacc - g);
  const vtActualisee    = valeurTerminale / Math.pow(1 + wacc, p.horizonProjection);
  const tresorerieNette = v(d.bilan.actif.tresorerieActive, last) + v(d.bilan.actif.vmp, last);
  const dettesNettes    = dettesF_l - tresorerieNette;
  const enterpriseValue = sommeFluxActualises + vtActualisee;
  const equityValue     = Math.max(0, enterpriseValue - dettesNettes);

  const waccValues = [-0.02, -0.01, 0, 0.01, 0.02].map(delta => wacc + delta);
  const gValues    = [-0.01, -0.005, 0, 0.005, 0.01].map(delta => g + delta);
  const matrix     = waccValues.map(w =>
    gValues.map(gi => {
      const vt = safe(fcffN * (1 + gi), w - gi) / Math.pow(1 + w, p.horizonProjection);
      return sommeFluxActualises + vt;
    })
  );

  return {
    wacc, ke, kdNet, poidsCP, poidsD,
    projectionFCFF, sommeFluxActualises, valeurTerminale,
    vtActualisee, enterpriseValue, tresorerieNette, dettesNettes, equityValue,
    tableSensibilite: { waccValues, gValues, matrix },
  };
}

// ─── SCORING /150 ───────────────────────────────────────────────
export function calculerScoring(ratios: ResultatRatios, lastIdx: number): ResultatScoring {
  const cr  = ratios.liquiditeGenerale[lastIdx] ?? 0;
  const de  = ratios.ratioEndettement[lastIdx]  ?? 0;
  const roe = ratios.roe[lastIdx]               ?? 0;
  const ra  = ratios.rotationActifs[lastIdx]    ?? 0;

  const scoreLiquidite   = Math.min(30, cr * 15);
  const scoreSolvabilite = Math.min(30, Math.max(0, 30 - de * 20));
  const scoreRentabilite = Math.min(50, roe * 200);
  const scoreEfficience  = Math.min(40, ra * 20);
  const scoreTotal       = scoreLiquidite + scoreSolvabilite + scoreRentabilite + scoreEfficience;
  const tauxAtteint      = scoreTotal / 150;
  const notation         = tauxAtteint >= 0.75 ? '🟢 Sain' : tauxAtteint >= 0.5 ? '🟠 Vigilance' : '🔴 Risqué';
  const zScore           = ratios.altmanZScore[lastIdx] ?? 0;
  const zScoreInterpretation = ratios.zScoreInterpretation[lastIdx] ?? 'Zone grise';
  const scoreRisqueGlobal= 100;

  return {
    scoreLiquidite, scoreSolvabilite, scoreRentabilite, scoreEfficience,
    scoreTotal, tauxAtteint, notation, zScore, zScoreInterpretation, scoreRisqueGlobal,
  };
}

// ─── TFT ────────────────────────────────────────────────────────
export function calculerTFT(d: DonneesEntreprise): ResultatTFT {
  const t = d.tftHistorique;
  const n = t.annees.length;

  const fluxExploitation = Array.from({ length: n }, (_, i) =>
    v(t.resultatNet, i) + v(t.dotationsAmortissements, i) + v(t.dotationsProvisions, i) +
    v(t.plusMoinsValuesCessions, i) + v(t.variationStocks, i) +
    v(t.variationCreancesClients, i) + v(t.variationDettesFournisseurs, i) +
    v(t.variationAutresBFR, i)
  );
  const fluxInvestissement = Array.from({ length: n }, (_, i) =>
    v(t.acquisitionsImmobilisations, i) + v(t.cessionsImmobilisations, i) +
    v(t.investissementsFinanciers, i)
  );
  const fluxFinancement = Array.from({ length: n }, (_, i) =>
    v(t.augmentationCapital, i) + v(t.nouveauxEmprunts, i) +
    v(t.remboursementsEmprunts, i) + v(t.dividendesVerses, i)
  );
  const fluxNetTotal = Array.from({ length: n }, (_, i) =>
    v(fluxExploitation, i) + v(fluxInvestissement, i) + v(fluxFinancement, i)
  );

  return { fluxExploitation, fluxInvestissement, fluxFinancement, fluxNetTotal };
}

// ─── STUBS (modules Phase 4) ────────────────────────────────────
function stubBenchmark(): ResultatBenchmark {
  return { comparaisons: [], alertes: [], syntheseAlertes: '' };
}
function stubStocks(): ResultatStocks {
  return {
    valorisationTotale: 0,
    valorisationParCategorie: { matieresPremières: 0, enCours: 0, produitsFinis: 0, marchandises: 0 },
    comparaisonMethodes: { cump: 0, fifo: 0, lifo: 0 },
    rotationGlobale: 0, dioGlobal: 0, dioMP: 0, dioPF: 0,
    provisionsNecessaires: 0, tauxDepreciation: 0, stockMortEstime: 0,
    wilson: { stockSecurite: 0, pointCommande: 0, qteOptimale: 0, nbCommandesAn: 0, coutTotalOptimal: 0 },
    reconciliationEcart: 0, impactBFR: 0,
  };
}
function stubAmort(): ResultatAmortissements {
  return { tableauParImmobilisation: [], syntheseAnnuelle: [], tauxVetusteMoyen: 0, ageMoyenParc: 0, capexVsDotation: 0 };
}
function stubEcartsBU(): ResultatEcartsBU {
  return { parBU: [], ecartConsolide: 0, controleEcarts: 0, heatmapData: [] };
}
function stubEcartsDepts(): ResultatEcartsDepartements {
  return { parDepartement: [], totalFraisGeneraux: { budget: 0, reel: 0, ecart: 0, ecartPct: 0 }, top5PostesInvestiguer: [] };
}
function stubAnalyse(): ResultatAnalyseApprofondie {
  return { scenarios: [], previsionTresorerie: [], soldeFinal: 0, moisCritiques: [], besoinFinancement: 0, waterfallBudgetReel: [], sensibilite: [] };
}

// ─── EXPORT PRINCIPAL ───────────────────────────────────────────
export function calculerTout(d: DonneesEntreprise): ResultatsAnalyse {
  const ratios = calculerRatios(d);
  const lastIdx = d.bilan.annees.length - 1;
  const dcf    = calculerDCF(d, ratios);
  const scoring= calculerScoring(ratios, lastIdx);
  const tft    = calculerTFT(d);

  return {
    ratios, dcf, scoring, tft,
    benchmark:           stubBenchmark(),
    stocks:              stubStocks(),
    amortissements:      stubAmort(),
    ecartsBU:            stubEcartsBU(),
    ecartsDepartements:  stubEcartsDepts(),
    analyseApprofondie:  stubAnalyse(),
  };
}
