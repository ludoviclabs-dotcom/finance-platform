'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import type { DonneesEntreprise } from '@/lib/types/analyse-entreprise';
import { calculerTout, calculerTotauxBilan, calculerSIG } from '@/lib/calculs/analyse-entreprise';

// ================================================================
// DONNÉES EXEMPLE — Acier Côte Ouest SAS
// ================================================================
function getDonneesExemple(): DonneesEntreprise {
  return {
    identite: {
      raisonSociale: 'Acier Côte Ouest SAS', secteur: 'Industrie manufacturière',
      formeJuridique: 'SAS', dateCreation: '2005-03-15', effectifs: 215,
      chiffreAffaires: 32400000, devise: '€', exerciceFiscal: '2025',
      nombreExercices: 4, diviseurUnite: 1000000, suffixeUnite: 'M€',
    },
    bilan: {
      annees: ['2022', '2023', '2024', '2025'],
      actif: {
        immobilisationsIncorporelles: [250000, 220000, 190000, 160000],
        immobilisationsCorporelles:   [8500000, 9200000, 10500000, 12800000],
        immobilisationsFinancieres:   [350000, 400000, 450000, 500000],
        stocksMatieresPremières:      [1200000, 1450000, 1750000, 2050000],
        stocksProduitsFinis:          [800000, 950000, 1100000, 1350000],
        stocksEnCours:                [300000, 350000, 400000, 450000],
        stocksMarchandises:           [100000, 120000, 150000, 180000],
        creancesClients:              [3200000, 3550000, 3950000, 4450000],
        autresCreances:               [450000, 480000, 520000, 560000],
        tresorerieActive:             [1800000, 1950000, 2100000, 1950000],
        vmp:                          [200000, 250000, 300000, 350000],
        chargesConstateesAvance:      [80000, 90000, 100000, 110000],
      },
      passif: {
        capitalSocial:             [2000000, 2000000, 2000000, 2000000],
        reserves:                  [3500000, 3800000, 4200000, 4700000],
        reportANouveau:            [200000, 350000, 500000, 650000],
        resultatExercice:          [850000, 1050000, 1350000, 1650000],
        provisionsReglementees:    [100000, 100000, 100000, 100000],
        empruntsObligataires:      [0, 0, 0, 0],
        empruntsbanairesLT:        [3500000, 3800000, 4200000, 5500000],
        provisionsRisques:         [200000, 250000, 300000, 350000],
        dettesFournisseurs:        [2800000, 3100000, 3450000, 3900000],
        dettesFiscalesSociales:    [1200000, 1300000, 1450000, 1600000],
        concoursBancairesCourants: [500000, 450000, 400000, 350000],
        autresDettes:              [350000, 380000, 420000, 460000],
        produitsConstatesAvance:   [30000, 35000, 40000, 45000],
      },
    },
    cpc: {
      annees: ['2022', '2023', '2024', '2025'],
      chiffreAffaires:             [27000000, 29200000, 31000000, 32400000],
      productionStockee:           [150000, 180000, 200000, 250000],
      productionImmobilisee:       [80000, 100000, 120000, 150000],
      subventionsExploitation:     [50000, 60000, 70000, 80000],
      autresProduitsExploitation:  [120000, 140000, 160000, 180000],
      achatsMatieresPremieres:     [14500000, 15600000, 16400000, 17000000],
      variationStocksMP:           [-60000, -180000, -300000, -250000],
      autresAchatsChargesExternes: [3800000, 4100000, 4400000, 4700000],
      impotsTaxes:                 [420000, 450000, 480000, 510000],
      chargesPersonnel:            [5800000, 6200000, 6600000, 7000000],
      dotationsAmortissements:     [1100000, 1200000, 1350000, 1500000],
      dotationsProvisions:         [150000, 180000, 200000, 220000],
      autresChargesExploitation:   [80000, 90000, 100000, 110000],
      produitsFinanciers:          [25000, 30000, 35000, 40000],
      chargesFinancieres:          [280000, 310000, 350000, 420000],
      produitsExceptionnels:       [40000, 50000, 60000, 70000],
      chargesExceptionnelles:      [60000, 70000, 80000, 90000],
      participationSalaries:       [50000, 60000, 70000, 80000],
      impotSurBenefices:           [350000, 420000, 500000, 580000],
    },
    tftHistorique: {
      annees: ['2023', '2024', '2025'],
      resultatNet:                 [1050000, 1350000, 1650000],
      dotationsAmortissements:     [1200000, 1350000, 1500000],
      dotationsProvisions:         [180000, 200000, 220000],
      plusMoinsValuesCessions:     [-20000, 80000, -30000],
      variationStocks:             [-250000, -300000, -300000],
      variationCreancesClients:    [-350000, -400000, -500000],
      variationDettesFournisseurs: [300000, 350000, 450000],
      variationAutresBFR:          [-80000, -60000, -70000],
      acquisitionsImmobilisations: [-1800000, -2100000, -3200000],
      cessionsImmobilisations:     [50000, 120000, 40000],
      investissementsFinanciers:   [-100000, -50000, -50000],
      augmentationCapital:         [0, 0, 0],
      nouveauxEmprunts:            [800000, 1000000, 2000000],
      remboursementsEmprunts:      [-500000, -600000, -700000],
      dividendesVerses:            [-200000, -250000, -300000],
    },
    previsionTresorerie: {
      moisLabels: ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'],
      encaissementsExploitation:       [2500000, 2600000, 2800000, 2700000, 2900000, 3000000, 2400000, 1800000, 2700000, 3100000, 3200000, 3000000],
      encaissementsFinanciers:         [3000, 3000, 3000, 3000, 3500, 3500, 3500, 3500, 4000, 4000, 4000, 4000],
      encaissementsExceptionnels:      [0, 0, 10000, 0, 0, 20000, 0, 0, 0, 10000, 0, 30000],
      decaissementsFournisseurs:       [1300000, 1350000, 1450000, 1400000, 1500000, 1550000, 1250000, 950000, 1400000, 1600000, 1650000, 1550000],
      decaissementsPersonnel:          [580000, 580000, 580000, 585000, 585000, 585000, 590000, 590000, 590000, 595000, 595000, 595000],
      decaissementsChargesSociales:    [280000, 280000, 280000, 285000, 285000, 285000, 290000, 290000, 290000, 295000, 295000, 295000],
      decaissementsImpots:             [0, 0, 130000, 0, 0, 130000, 0, 0, 130000, 0, 0, 130000],
      decaissementsInvestissements:    [0, 200000, 0, 300000, 0, 500000, 0, 0, 400000, 0, 800000, 1000000],
      decaissementsRemboursementsEmprunts: [58000, 58000, 58000, 58000, 58000, 58000, 58000, 58000, 58000, 58000, 58000, 58000],
      decaissementsAutres:             [40000, 40000, 45000, 40000, 45000, 40000, 45000, 40000, 45000, 40000, 45000, 40000],
      soldeInitial: 1950000,
    },
    budget: {
      postes: ["Chiffre d'affaires",'Coût matières premières','Charges de personnel',
        'Autres charges externes','Amortissements','Charges financières',
        'Impôts & taxes','CAPEX','Résultat net'],
      montantsBudget: [33000000, 17200000, 6800000, 4500000, 1400000, 380000, 500000, 2800000, 1800000],
      montantsReel:   [32400000, 17000000, 7000000, 4700000, 1500000, 420000, 510000, 3200000, 1650000],
    },
    stocks: {
      articles: [],
      methodeValorisation: 'CUMP',
      parametresWilson: {
        niveauService: 1.65, ecartTypeDemande: 50,
        delaiApprovisionnement: 15, coutPassationCommande: 150,
        coutPossessionUnitaire: 2.5, saisonnaliteActivee: false,
        coefficientSaisonnier: 1,
      },
    },
    immobilisations: { immobilisations: [] },
    businessUnits: [
      { nom: 'Acier Plat',       ca: 12000000, caBudget: 13000000, coutVariables: 8400000,  chargesFixesSpecifiques: 1200000, effectifs: 52, quantiteVendue: 4800, quantiteBudget: 5200, prixUnitaireReel: 2500, prixUnitaireBudget: 2500 },
      { nom: 'Acier Long',       ca: 9500000,  caBudget: 9500000,  coutVariables: 6650000,  chargesFixesSpecifiques: 950000,  effectifs: 41, quantiteVendue: 3800, quantiteBudget: 3800, prixUnitaireReel: 2500, prixUnitaireBudget: 2500 },
      { nom: 'Inox & Alu',       ca: 5200000,  caBudget: 5000000,  coutVariables: 3120000,  chargesFixesSpecifiques: 650000,  effectifs: 28, quantiteVendue: 1300, quantiteBudget: 1250, prixUnitaireReel: 4000, prixUnitaireBudget: 4000 },
      { nom: 'Découpe Laser',    ca: 3800000,  caBudget: 4000000,  coutVariables: 2280000,  chargesFixesSpecifiques: 500000,  effectifs: 22, quantiteVendue: 950,  quantiteBudget: 1000, prixUnitaireReel: 4000, prixUnitaireBudget: 4000 },
      { nom: 'Services & Négoce',ca: 1900000,  caBudget: 2500000,  coutVariables: 1330000,  chargesFixesSpecifiques: 250000,  effectifs: 12, quantiteVendue: 380,  quantiteBudget: 500,  prixUnitaireReel: 5000, prixUnitaireBudget: 5000 },
    ],
    departementsFonctionnels: [
      { nom: 'Marketing', effectifs: 8, postes: [
        { libelle: 'Masse salariale', budget: 384000, reel: 392000 },
        { libelle: 'Prestations & sous-traitance', budget: 120000, reel: 135000 },
        { libelle: 'Outils & licences', budget: 42000, reel: 48000 },
        { libelle: 'Formation', budget: 15000, reel: 11000 },
        { libelle: 'Déplacements', budget: 65000, reel: 78000 },
        { libelle: 'Fournitures', budget: 18000, reel: 21000 },
        { libelle: 'Loyers', budget: 24000, reel: 24000 },
        { libelle: 'Communication', budget: 95000, reel: 112000 },
        { libelle: 'Honoraires', budget: 25000, reel: 22000 },
        { libelle: 'Amortissements', budget: 12000, reel: 12000 },
      ]},
      { nom: 'Comptabilité / Finance', effectifs: 6, postes: [
        { libelle: 'Masse salariale', budget: 312000, reel: 318000 },
        { libelle: 'Prestations & sous-traitance', budget: 45000, reel: 52000 },
        { libelle: 'Outils & licences', budget: 38000, reel: 41000 },
        { libelle: 'Formation', budget: 12000, reel: 9000 },
        { libelle: 'Déplacements', budget: 15000, reel: 18000 },
        { libelle: 'Fournitures', budget: 8000, reel: 9000 },
        { libelle: 'Loyers', budget: 18000, reel: 18000 },
        { libelle: 'Communication', budget: 5000, reel: 6000 },
        { libelle: 'Honoraires', budget: 85000, reel: 92000 },
        { libelle: 'Amortissements', budget: 8000, reel: 8000 },
      ]},
      { nom: 'Ressources Humaines', effectifs: 5, postes: [
        { libelle: 'Masse salariale', budget: 260000, reel: 265000 },
        { libelle: 'Prestations & sous-traitance', budget: 35000, reel: 38000 },
        { libelle: 'Outils & licences', budget: 22000, reel: 25000 },
        { libelle: 'Formation', budget: 28000, reel: 31000 },
        { libelle: 'Déplacements', budget: 12000, reel: 14000 },
        { libelle: 'Fournitures', budget: 6000, reel: 7000 },
        { libelle: 'Loyers', budget: 15000, reel: 15000 },
        { libelle: 'Communication', budget: 8000, reel: 9000 },
        { libelle: 'Honoraires', budget: 18000, reel: 16000 },
        { libelle: 'Amortissements', budget: 5000, reel: 5000 },
      ]},
      { nom: "Systèmes d'Information", effectifs: 7, postes: [
        { libelle: 'Masse salariale', budget: 364000, reel: 371000 },
        { libelle: 'Prestations & sous-traitance', budget: 95000, reel: 112000 },
        { libelle: 'Outils & licences', budget: 125000, reel: 138000 },
        { libelle: 'Formation', budget: 18000, reel: 15000 },
        { libelle: 'Déplacements', budget: 10000, reel: 12000 },
        { libelle: 'Fournitures', budget: 12000, reel: 14000 },
        { libelle: 'Loyers', budget: 20000, reel: 20000 },
        { libelle: 'Communication', budget: 8000, reel: 9000 },
        { libelle: 'Honoraires', budget: 35000, reel: 28000 },
        { libelle: 'Amortissements', budget: 42000, reel: 42000 },
      ]},
      { nom: 'Autres (DG, Juridique, QSE)', effectifs: 4, postes: [
        { libelle: 'Masse salariale', budget: 280000, reel: 285000 },
        { libelle: 'Prestations & sous-traitance', budget: 55000, reel: 62000 },
        { libelle: 'Outils & licences', budget: 15000, reel: 17000 },
        { libelle: 'Formation', budget: 10000, reel: 8000 },
        { libelle: 'Déplacements', budget: 25000, reel: 29000 },
        { libelle: 'Fournitures', budget: 8000, reel: 9000 },
        { libelle: 'Loyers', budget: 12000, reel: 12000 },
        { libelle: 'Communication', budget: 15000, reel: 17000 },
        { libelle: 'Honoraires', budget: 45000, reel: 51000 },
        { libelle: 'Amortissements', budget: 6000, reel: 6000 },
      ]},
    ],
    parametres: {
      tauxSansRisque: 0.032, primeRisqueMarche: 0.055, beta: 0.95,
      tauxCroissanceTerminale: 0.02, tauxIS: 0.25,
      horizonProjection: 5, tauxCroissanceCA: 0.05,
      benchmarkSecteur: {
        liquiditeGenerale: 1.8,    liquiditeGeneraleQ3: 2.2,
        margeEBITDA: 0.125,        margeEBITDAQ3: 0.18,
        roe: 0.10,                 roeQ3: 0.15,
        ratioEndettement: 0.8,     ratioEndettementQ3: 0.5,
        dso: 50,                   dsoQ3: 35,
        ccc: 55,                   cccQ3: 40,
        rotationActifs: 1.2,       rotationActifsQ3: 1.6,
        altmanZScore: 2.5,         altmanZScoreQ3: 3.5,
        margeNette: 0.04,          margeNetteQ3: 0.07,
        couvertureInterets: 4,     couvertureInteretsQ3: 8,
      },
    },
  };
}

// ================================================================
// HELPERS UI
// ================================================================
const fmt = (n: number, d = 2) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);
const fmtM = (n: number) => `${fmt(n / 1_000_000, 2)} M\u20AC`;
const fmtPct = (n: number) => `${fmt(n * 100, 1)} %`;

function tooltipFmt(v: ValueType | undefined): string {
  const n = Number(v ?? 0);
  return `${n.toLocaleString('fr-FR')} \u20AC`;
}

// ================================================================
// TABS CONFIG
// ================================================================
const TABS = [
  { id: 1, label: 'Identit\u00E9 & Bilan' },
  { id: 2, label: 'Tr\u00E9sorerie & Budget' },
  { id: 3, label: 'Ratios & SIG' },
  { id: 4, label: 'Scoring & Benchmark' },
  { id: 5, label: 'Valorisation DCF' },
  { id: 6, label: 'Stocks' },
  { id: 7, label: 'BU & D\u00E9partements' },
  { id: 8, label: 'Analyse Approfondie' },
];

// ================================================================
// PAGE PRINCIPALE
// ================================================================
export default function AnalyseEntreprisePage() {
  const [donnees]    = useState<DonneesEntreprise>(getDonneesExemple);
  const [activeTab, setActiveTab] = useState(1);

  const resultats = useMemo(() => calculerTout(donnees), [donnees]);
  const totaux    = useMemo(() => calculerTotauxBilan(donnees), [donnees]);
  const sig       = useMemo(() => calculerSIG(donnees), [donnees]);
  const annees    = donnees.bilan.annees;
  const last      = annees.length - 1;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Analyse Financi\u00E8re — {donnees.identite.raisonSociale}
        </h1>
        <p className="text-gray-500 mt-1">
          {donnees.identite.secteur} · {donnees.identite.formeJuridique} · {donnees.identite.effectifs} ETP · Exercice {donnees.identite.exerciceFiscal}
        </p>
      </div>

      {/* KPI BANNER */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'CA 2025',    val: fmtM(donnees.cpc.chiffreAffaires[last]) },
          { label: 'EBITDA',     val: fmtPct(resultats.ratios.margeEBITDA[last]) },
          { label: 'Score /150', val: `${fmt(resultats.scoring.scoreTotal, 0)} / 150` },
          { label: 'Altman Z',   val: fmt(resultats.scoring.zScore, 2) },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{k.label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{k.val}</p>
          </div>
        ))}
      </div>

      {/* TABS NAV */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTENU */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">

        {/* ─── ONGLET 1 — Identité & Bilan ─────────────────────── */}
        {activeTab === 1 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Bilan — 4 exercices</h2>

            {/* Contrôle bilan */}
            <div className="flex gap-4 mb-4">
              {annees.map((a, i) => {
                const ecart = totaux.ecartBilan[i];
                return (
                  <div
                    key={a}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      Math.abs(ecart) < 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {a} : {Math.abs(ecart) < 1 ? '\u2705 \u00C9quilibr\u00E9' : `\u26A0\uFE0F \u00C9cart ${fmt(ecart)}`}
                  </div>
                );
              })}
            </div>

            {/* Tableau bilan simplifié */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 pr-4 w-64">Poste</th>
                    {annees.map(a => <th key={a} className="text-right py-2 px-3">{a}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {/* ACTIF */}
                  <tr className="bg-blue-50"><td colSpan={5} className="py-1 px-2 font-bold text-blue-800 text-xs uppercase">ACTIF</td></tr>
                  {([
                    { label: 'Immo. incorporelles',  arr: donnees.bilan.actif.immobilisationsIncorporelles },
                    { label: 'Immo. corporelles',    arr: donnees.bilan.actif.immobilisationsCorporelles },
                    { label: 'Immo. financi\u00E8res',    arr: donnees.bilan.actif.immobilisationsFinancieres },
                    { label: 'Stocks MP',            arr: donnees.bilan.actif.stocksMatieresPremières },
                    { label: 'Stocks PF',            arr: donnees.bilan.actif.stocksProduitsFinis },
                    { label: 'Stocks EC / March.',   arr: donnees.bilan.actif.stocksEnCours },
                    { label: 'Cr\u00E9ances clients',     arr: donnees.bilan.actif.creancesClients },
                    { label: 'Tr\u00E9sorerie + VMP',     arr: annees.map((_, i) => (donnees.bilan.actif.tresorerieActive[i] ?? 0) + (donnees.bilan.actif.vmp[i] ?? 0)) },
                  ] as { label: string; arr: number[]; bold?: boolean }[]).concat([
                    { label: 'TOTAL ACTIF', arr: totaux.totalActif, bold: true },
                  ]).map(row => (
                    <tr key={row.label} className={`border-b border-gray-100 hover:bg-gray-50 ${row.bold ? 'font-bold bg-gray-50' : ''}`}>
                      <td className="py-1.5 pr-4 text-gray-700">{row.label}</td>
                      {row.arr.map((val, i) => <td key={i} className="text-right py-1.5 px-3 tabular-nums">{fmt(val / 1000, 0)} k\u20AC</td>)}
                    </tr>
                  ))}
                  {/* PASSIF */}
                  <tr className="bg-purple-50"><td colSpan={5} className="py-1 px-2 font-bold text-purple-800 text-xs uppercase">PASSIF</td></tr>
                  {([
                    { label: 'Capitaux propres',    arr: totaux.totalCP },
                    { label: 'Dettes fin. LT',       arr: totaux.totalDettesNC },
                    { label: 'Dettes fournisseurs',  arr: donnees.bilan.passif.dettesFournisseurs },
                    { label: 'Dettes fisc. & soc.',  arr: donnees.bilan.passif.dettesFiscalesSociales },
                    { label: 'Autres dettes CT',     arr: donnees.bilan.passif.autresDettes },
                  ] as { label: string; arr: number[]; bold?: boolean }[]).concat([
                    { label: 'TOTAL PASSIF', arr: totaux.totalPassif, bold: true },
                  ]).map(row => (
                    <tr key={row.label} className={`border-b border-gray-100 hover:bg-gray-50 ${row.bold ? 'font-bold bg-gray-50' : ''}`}>
                      <td className="py-1.5 pr-4 text-gray-700">{row.label}</td>
                      {row.arr.map((val, i) => <td key={i} className="text-right py-1.5 px-3 tabular-nums">{fmt(val / 1000, 0)} k\u20AC</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ─── ONGLET 2 — Trésorerie & Budget ──────────────────── */}
        {activeTab === 2 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Tableau de Flux de Tr\u00E9sorerie — historique</h2>
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 pr-4">Flux</th>
                    {donnees.tftHistorique.annees.map(a => <th key={a} className="text-right py-2 px-3">{a}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Flux exploitation', arr: resultats.tft.fluxExploitation, color: 'text-green-700' },
                    { label: 'Flux investissement', arr: resultats.tft.fluxInvestissement, color: 'text-orange-600' },
                    { label: 'Flux financement', arr: resultats.tft.fluxFinancement, color: 'text-blue-700' },
                    { label: 'FLUX NET TOTAL', arr: resultats.tft.fluxNetTotal, color: 'font-bold', bold: true },
                  ].map(row => (
                    <tr key={row.label} className={`border-b border-gray-100 hover:bg-gray-50 ${row.bold ? 'bg-gray-50' : ''}`}>
                      <td className={`py-1.5 pr-4 ${row.color}`}>{row.label}</td>
                      {row.arr.map((val, i) => (
                        <td key={i} className={`text-right py-1.5 px-3 tabular-nums ${val >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {fmt(val / 1000, 0)} k\u20AC
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-bold mb-4">Budget vs R\u00E9el</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 pr-4">Poste</th>
                    <th className="text-right py-2 px-3">Budget</th>
                    <th className="text-right py-2 px-3">R\u00E9el</th>
                    <th className="text-right py-2 px-3">\u00C9cart</th>
                    <th className="text-right py-2 px-3">\u00C9cart %</th>
                    <th className="text-center py-2 px-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {donnees.budget.postes.map((poste, i) => {
                    const budget = donnees.budget.montantsBudget[i] ?? 0;
                    const reel   = donnees.budget.montantsReel[i] ?? 0;
                    const ecart  = reel - budget;
                    const ecartPct = budget !== 0 ? ecart / Math.abs(budget) : 0;
                    const isRevenu = i === 0 || i === donnees.budget.postes.length - 1;
                    const favorable = isRevenu ? ecart >= 0 : ecart <= 0;
                    return (
                      <tr key={poste} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-1.5 pr-4">{poste}</td>
                        <td className="text-right py-1.5 px-3 tabular-nums">{fmt(budget / 1000, 0)} k\u20AC</td>
                        <td className="text-right py-1.5 px-3 tabular-nums">{fmt(reel / 1000, 0)} k\u20AC</td>
                        <td className={`text-right py-1.5 px-3 tabular-nums ${favorable ? 'text-green-700' : 'text-red-600'}`}>
                          {ecart >= 0 ? '+' : ''}{fmt(ecart / 1000, 0)} k\u20AC
                        </td>
                        <td className={`text-right py-1.5 px-3 tabular-nums ${favorable ? 'text-green-700' : 'text-red-600'}`}>
                          {ecartPct >= 0 ? '+' : ''}{fmtPct(ecartPct)}
                        </td>
                        <td className="text-center py-1.5 px-3">
                          {favorable ? '\uD83D\uDFE2' : Math.abs(ecartPct) < 0.05 ? '\uD83D\uDFE0' : '\uD83D\uDD34'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ─── ONGLET 3 — Ratios & SIG ──────────────────────────── */}
        {activeTab === 3 && (
          <section>
            {/* Graphique évolution CA / EBITDA / RN */}
            <h2 className="text-xl font-bold mb-4">\u00C9volution CA · EBITDA · R\u00E9sultat net</h2>
            <div className="h-72 mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annees.map((a, i) => ({
                  annee: a,
                  CA:      +(donnees.cpc.chiffreAffaires[i] / 1_000_000).toFixed(2),
                  EBITDA:  +((sig[i]?.ebe ?? 0) / 1_000_000).toFixed(2),
                  RN:      +((sig[i]?.rn ?? 0) / 1_000_000).toFixed(2),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="annee" />
                  <YAxis unit=" M\u20AC" />
                  <Tooltip formatter={(v: ValueType | undefined) => `${Number(v ?? 0)} M\u20AC`} />
                  <Legend />
                  <Bar dataKey="CA" fill="#3b82f6" />
                  <Bar dataKey="EBITDA" fill="#10b981" />
                  <Bar dataKey="RN" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tableau ratios clés */}
            <h2 className="text-xl font-bold mb-4">Ratios cl\u00E9s — exercice {annees[last]}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {[
                { cat: 'Liquidit\u00E9', items: [
                  { label: 'Ratio de liquidit\u00E9 g\u00E9n\u00E9rale', val: fmt(resultats.ratios.liquiditeGenerale[last], 2), seuil: '> 1,5' },
                  { label: 'Liquidit\u00E9 r\u00E9duite',           val: fmt(resultats.ratios.liquiditeReduite[last], 2),  seuil: '> 1,0' },
                  { label: 'BFR / CA (jours)',            val: `${fmt(resultats.ratios.bfrJoursCA[last], 0)} j`, seuil: '< 60 j' },
                  { label: 'FRNG',                        val: fmtM(resultats.ratios.frng[last]),                seuil: '> 0' },
                ]},
                { cat: 'Solvabilit\u00E9', items: [
                  { label: 'Ratio endettement (D/E)',     val: fmt(resultats.ratios.ratioEndettement[last], 2),     seuil: '< 1,0' },
                  { label: 'Autonomie financi\u00E8re',        val: fmtPct(resultats.ratios.autonomieFinanciere[last]),   seuil: '> 30%' },
                  { label: 'Capacit\u00E9 remboursement',      val: `${fmt(resultats.ratios.capaciteRemboursement[last], 1)} ans`, seuil: '< 3 ans' },
                  { label: 'Gearing',                     val: fmt(resultats.ratios.gearing[last], 2),              seuil: '< 1,0' },
                ]},
                { cat: 'Rentabilit\u00E9', items: [
                  { label: 'Marge EBITDA',                val: fmtPct(resultats.ratios.margeEBITDA[last]),          seuil: '> 10%' },
                  { label: 'Marge op\u00E9rationnelle',        val: fmtPct(resultats.ratios.margeOperationnelle[last]),   seuil: '> 5%' },
                  { label: 'Marge nette',                 val: fmtPct(resultats.ratios.margeNette[last]),            seuil: '> 4%' },
                  { label: 'ROE',                         val: fmtPct(resultats.ratios.roe[last]),                   seuil: '> 10%' },
                ]},
                { cat: 'Efficience (CCC)', items: [
                  { label: 'DIO (jours stock)',           val: `${fmt(resultats.ratios.dio[last], 0)} j`,            seuil: '< 50 j' },
                  { label: 'DSO (jours clients)',         val: `${fmt(resultats.ratios.dso[last], 0)} j`,            seuil: '< 45 j' },
                  { label: 'DPO (jours fournisseurs)',    val: `${fmt(resultats.ratios.dpo[last], 0)} j`,            seuil: '> 30 j' },
                  { label: 'CCC',                        val: `${fmt(resultats.ratios.ccc[last], 0)} j`,            seuil: '< 60 j' },
                ]},
              ].map(cat => (
                <div key={cat.cat} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-700 text-sm">{cat.cat}</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {cat.items.map(item => (
                        <tr key={item.label} className="border-t border-gray-100">
                          <td className="py-2 px-4 text-gray-600">{item.label}</td>
                          <td className="py-2 px-4 text-right font-semibold tabular-nums">{item.val}</td>
                          <td className="py-2 px-4 text-right text-xs text-gray-400">{item.seuil}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* SIG */}
            <h2 className="text-xl font-bold mb-4">Soldes Interm\u00E9diaires de Gestion (PCG)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 pr-4">Solde</th>
                    {annees.map(a => <th key={a} className="text-right py-2 px-3">{a}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Marge commerciale',    key: 'margeCommerciale' },
                    { label: 'Valeur ajout\u00E9e',        key: 'valeurAjoutee' },
                    { label: 'EBE (EBITDA)',           key: 'ebe' },
                    { label: 'R\u00E9sultat exploitation', key: 'resExploitation' },
                    { label: 'R\u00E9sultat financier',    key: 'resFinancier' },
                    { label: 'R\u00E9sultat courant',      key: 'resCourant' },
                    { label: 'R\u00E9sultat net',          key: 'rn', bold: true },
                    { label: 'CAF',                   key: 'caf', bold: true },
                  ].map(row => (
                    <tr key={row.label} className={`border-b border-gray-100 hover:bg-gray-50 ${row.bold ? 'font-bold bg-gray-50' : ''}`}>
                      <td className="py-1.5 pr-4 text-gray-700">{row.label}</td>
                      {sig.map((s, i) => {
                        const val = (s as Record<string, number>)[row.key] ?? 0;
                        return (
                          <td key={i} className={`text-right py-1.5 px-3 tabular-nums ${val >= 0 ? '' : 'text-red-600'}`}>
                            {fmt(val / 1000, 0)} k\u20AC
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ─── ONGLET 4 — Scoring & Benchmark ──────────────────── */}
        {activeTab === 4 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Scoring Global</h2>

            {/* 4 cartes score */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Liquidit\u00E9',    val: resultats.scoring.scoreLiquidite,   max: 30 },
                { label: 'Solvabilit\u00E9',  val: resultats.scoring.scoreSolvabilite,  max: 30 },
                { label: 'Rentabilit\u00E9',  val: resultats.scoring.scoreRentabilite,  max: 50 },
                { label: 'Efficience',   val: resultats.scoring.scoreEfficience,   max: 40 },
              ].map(s => (
                <div key={s.label} className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase">{s.label}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{fmt(s.val, 1)}</p>
                  <p className="text-xs text-gray-400">/ {s.max}</p>
                  <div className="mt-2 h-2 bg-gray-100 rounded-full">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(s.val / s.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Score total */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-8 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Score total</p>
                <p className="text-5xl font-black text-gray-800">{fmt(resultats.scoring.scoreTotal, 0)} <span className="text-2xl text-gray-400">/ 150</span></p>
                <p className="text-lg mt-1">{resultats.scoring.notation}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Altman Z-Score</p>
                <p className="text-3xl font-bold text-gray-800">{fmt(resultats.scoring.zScore, 2)}</p>
                <p className={`text-sm font-medium mt-1 ${
                  resultats.scoring.zScoreInterpretation === 'Saine' ? 'text-green-600' :
                  resultats.scoring.zScoreInterpretation === 'Zone grise' ? 'text-orange-500' : 'text-red-600'
                }`}>{resultats.scoring.zScoreInterpretation}</p>
              </div>
            </div>

            {/* Benchmark */}
            <h2 className="text-xl font-bold mb-4">Benchmark sectoriel</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 pr-4">Ratio</th>
                    <th className="text-right py-2 px-3">Entreprise</th>
                    <th className="text-right py-2 px-3">M\u00E9diane sect.</th>
                    <th className="text-right py-2 px-3">Top 25%</th>
                    <th className="text-center py-2 px-3">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Liquidit\u00E9 g\u00E9n\u00E9rale',   val: resultats.ratios.liquiditeGenerale[last],       med: donnees.parametres.benchmarkSecteur.liquiditeGenerale,   q3: donnees.parametres.benchmarkSecteur.liquiditeGeneraleQ3,   fmtFn: (v: number) => fmt(v, 2) },
                    { label: 'Marge EBITDA',          val: resultats.ratios.margeEBITDA[last],             med: donnees.parametres.benchmarkSecteur.margeEBITDA,          q3: donnees.parametres.benchmarkSecteur.margeEBITDAQ3,         fmtFn: (v: number) => fmtPct(v) },
                    { label: 'ROE',                   val: resultats.ratios.roe[last],                     med: donnees.parametres.benchmarkSecteur.roe,                  q3: donnees.parametres.benchmarkSecteur.roeQ3,                 fmtFn: (v: number) => fmtPct(v) },
                    { label: 'Ratio endettement',     val: resultats.ratios.ratioEndettement[last],        med: donnees.parametres.benchmarkSecteur.ratioEndettement,     q3: donnees.parametres.benchmarkSecteur.ratioEndettementQ3,    fmtFn: (v: number) => fmt(v, 2) },
                    { label: 'DSO (jours)',           val: resultats.ratios.dso[last],                     med: donnees.parametres.benchmarkSecteur.dso,                  q3: donnees.parametres.benchmarkSecteur.dsoQ3,                 fmtFn: (v: number) => `${fmt(v, 0)} j` },
                    { label: 'CCC (jours)',           val: resultats.ratios.ccc[last],                     med: donnees.parametres.benchmarkSecteur.ccc,                  q3: donnees.parametres.benchmarkSecteur.cccQ3,                 fmtFn: (v: number) => `${fmt(v, 0)} j` },
                    { label: 'Rotation actifs',       val: resultats.ratios.rotationActifs[last],          med: donnees.parametres.benchmarkSecteur.rotationActifs,       q3: donnees.parametres.benchmarkSecteur.rotationActifsQ3,      fmtFn: (v: number) => fmt(v, 2) },
                    { label: 'Marge nette',           val: resultats.ratios.margeNette[last],              med: donnees.parametres.benchmarkSecteur.margeNette,           q3: donnees.parametres.benchmarkSecteur.margeNetteQ3,          fmtFn: (v: number) => fmtPct(v) },
                    { label: 'Couverture int\u00E9r\u00EAts',   val: resultats.ratios.couvertureChargesFinancieres[last], med: donnees.parametres.benchmarkSecteur.couvertureInterets, q3: donnees.parametres.benchmarkSecteur.couvertureInteretsQ3, fmtFn: (v: number) => fmt(v, 1) },
                    { label: 'Altman Z-Score',        val: resultats.scoring.zScore,                       med: donnees.parametres.benchmarkSecteur.altmanZScore,         q3: donnees.parametres.benchmarkSecteur.altmanZScoreQ3,        fmtFn: (v: number) => fmt(v, 2) },
                  ].map(row => {
                    const position = row.val >= row.q3 ? '\uD83E\uDD47 Top 25%' : row.val >= row.med ? '\uD83D\uDCCA M\u00E9diane' : '\uD83D\uDCC9 Sous m\u00E9diane';
                    return (
                      <tr key={row.label} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-4 text-gray-700">{row.label}</td>
                        <td className="text-right py-2 px-3 font-semibold tabular-nums">{row.fmtFn(row.val)}</td>
                        <td className="text-right py-2 px-3 text-gray-500 tabular-nums">{row.fmtFn(row.med)}</td>
                        <td className="text-right py-2 px-3 text-gray-400 tabular-nums">{row.fmtFn(row.q3)}</td>
                        <td className="text-center py-2 px-3">{position}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ─── ONGLET 5 — DCF ───────────────────────────────────── */}
        {activeTab === 5 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Valorisation DCF</h2>

            {/* Paramètres WACC */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Taux sans risque (Rf)', val: fmtPct(donnees.parametres.tauxSansRisque) },
                { label: 'B\u00EAta',                  val: fmt(donnees.parametres.beta, 2) },
                { label: 'Prime de march\u00E9',        val: fmtPct(donnees.parametres.primeRisqueMarche) },
                { label: 'WACC calcul\u00E9',           val: fmtPct(resultats.dcf.wacc), bold: true },
                { label: 'g terminal',             val: fmtPct(donnees.parametres.tauxCroissanceTerminale) },
              ].map(p => (
                <div key={p.label} className={`border rounded-lg p-3 ${p.bold ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                  <p className="text-xs text-gray-400">{p.label}</p>
                  <p className={`text-xl font-bold mt-1 ${p.bold ? 'text-blue-700' : 'text-gray-800'}`}>{p.val}</p>
                </div>
              ))}
            </div>

            {/* Projections FCFF */}
            <h3 className="font-semibold text-gray-700 mb-3">Projections FCFF — {donnees.parametres.horizonProjection} ans</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    {['Ann\u00E9e','CA','EBITDA','Imp\u00F4ts','CAPEX','\u0394BFR','FCFF','FCFF actualis\u00E9'].map(h => (
                      <th key={h} className="text-right py-2 px-3 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultats.dcf.projectionFCFF.map(row => (
                    <tr key={row.annee} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-semibold">{row.annee}</td>
                      {[row.ca, row.ebitda, row.impots, row.capex, row.deltaBFR, row.fcff, row.fcffActualise].map((val, i) => (
                        <td key={i} className={`text-right py-2 px-3 tabular-nums ${val < 0 ? 'text-red-600' : ''}`}>
                          {fmt(val / 1000, 0)} k\u20AC
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Résultat valorisation */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: '\u03A3 Flux actualis\u00E9s', val: fmtM(resultats.dcf.sommeFluxActualises) },
                { label: 'Valeur terminale actualis\u00E9e', val: fmtM(resultats.dcf.vtActualisee) },
                { label: 'Enterprise Value', val: fmtM(resultats.dcf.enterpriseValue), big: true },
                { label: 'Equity Value', val: fmtM(resultats.dcf.equityValue), big: true },
              ].map(k => (
                <div key={k.label} className={`rounded-xl p-4 border ${k.big ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                  <p className="text-xs text-gray-400">{k.label}</p>
                  <p className={`font-bold mt-1 ${k.big ? 'text-2xl text-blue-700' : 'text-xl text-gray-800'}`}>{k.val}</p>
                </div>
              ))}
            </div>

            {/* Table de sensibilité */}
            <h3 className="font-semibold text-gray-700 mb-3">Sensibilit\u00E9 EV — WACC × g</h3>
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-300 p-2 bg-gray-100">WACC \ g</th>
                    {resultats.dcf.tableSensibilite.gValues.map(g => (
                      <th key={g} className="border border-gray-300 p-2 bg-gray-100">{fmtPct(g)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultats.dcf.tableSensibilite.waccValues.map((w, wi) => (
                    <tr key={w}>
                      <td className="border border-gray-300 p-2 font-semibold bg-gray-100">{fmtPct(w)}</td>
                      {resultats.dcf.tableSensibilite.matrix[wi].map((val, gi) => {
                        const isBase = wi === 2 && gi === 2;
                        const delta  = val - resultats.dcf.enterpriseValue;
                        const bg     = delta > 1_000_000 ? 'bg-green-100' : delta < -1_000_000 ? 'bg-red-100' : 'bg-yellow-50';
                        return (
                          <td key={gi} className={`border border-gray-300 p-2 text-right tabular-nums ${bg} ${isBase ? 'font-bold ring-2 ring-blue-400' : ''}`}>
                            {fmtM(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ─── ONGLET 6 — Stocks ────────────────────────────────── */}
        {activeTab === 6 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Gestion des Stocks</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'M\u00E9thode valorisation', val: donnees.stocks.methodeValorisation },
                { label: 'Niveau de service',    val: `${donnees.stocks.parametresWilson.niveauService === 1.65 ? '95%' : donnees.stocks.parametresWilson.niveauService === 1.28 ? '90%' : '99%'}` },
                { label: 'Co\u00FBt passation Cc',    val: `${fmt(donnees.stocks.parametresWilson.coutPassationCommande, 0)} \u20AC` },
                { label: 'Co\u00FBt possession Cp',   val: `${fmt(donnees.stocks.parametresWilson.coutPossessionUnitaire, 2)} \u20AC/u/an` },
              ].map(k => (
                <div key={k.label} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{k.label}</p>
                  <p className="text-lg font-semibold mt-1">{k.val}</p>
                </div>
              ))}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              Aucun article saisi pour l&apos;instant. Ajoutez des articles dans le formulaire de saisie pour calculer la rotation, le DIO, les provisions et l&apos;optimum Wilson.
            </div>
          </section>
        )}

        {/* ─── ONGLET 7 — BU & Départements ────────────────────── */}
        {activeTab === 7 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Business Units — \u00C9carts Budget / R\u00E9el</h2>
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    {['BU','CA R\u00E9el','CA Budget','\u00C9cart \u20AC','\u00C9cart %','MCV','Taux MCV','Seuil rent.'].map(h => (
                      <th key={h} className={`py-2 px-3 ${h === 'BU' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {donnees.businessUnits.map(bu => {
                    const ecart    = bu.ca - bu.caBudget;
                    const ecartPct = bu.caBudget !== 0 ? ecart / bu.caBudget : 0;
                    const mcv      = bu.ca - bu.coutVariables;
                    const tauxMCV  = bu.ca !== 0 ? mcv / bu.ca : 0;
                    const sr       = bu.chargesFixesSpecifiques / (tauxMCV || 1);
                    return (
                      <tr key={bu.nom} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-semibold">{bu.nom}</td>
                        <td className="text-right py-2 px-3 tabular-nums">{fmt(bu.ca / 1000, 0)} k\u20AC</td>
                        <td className="text-right py-2 px-3 tabular-nums">{fmt(bu.caBudget / 1000, 0)} k\u20AC</td>
                        <td className={`text-right py-2 px-3 tabular-nums font-semibold ${ecart >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {ecart >= 0 ? '+' : ''}{fmt(ecart / 1000, 0)} k\u20AC
                        </td>
                        <td className={`text-right py-2 px-3 tabular-nums ${ecart >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {ecartPct >= 0 ? '+' : ''}{fmtPct(ecartPct)}
                        </td>
                        <td className="text-right py-2 px-3 tabular-nums">{fmt(mcv / 1000, 0)} k\u20AC</td>
                        <td className="text-right py-2 px-3 tabular-nums">{fmtPct(tauxMCV)}</td>
                        <td className="text-right py-2 px-3 tabular-nums">{fmt(sr / 1000, 0)} k\u20AC</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-bold mb-4">Frais g\u00E9n\u00E9raux — D\u00E9partements</h2>
            {donnees.departementsFonctionnels.map(dept => {
              const totalBudget = dept.postes.reduce((s, p) => s + p.budget, 0);
              const totalReel   = dept.postes.reduce((s, p) => s + p.reel, 0);
              const ecart       = totalReel - totalBudget;
              return (
                <div key={dept.nom} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                    <span className="font-semibold text-gray-800">{dept.nom} ({dept.effectifs} ETP)</span>
                    <span className={`text-sm font-medium ${ecart <= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {ecart >= 0 ? '+' : ''}{fmt(ecart / 1000, 0)} k\u20AC vs budget
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="text-left py-1 px-4">Poste</th>
                        <th className="text-right py-1 px-3">Budget</th>
                        <th className="text-right py-1 px-3">R\u00E9el</th>
                        <th className="text-right py-1 px-3">\u00C9cart</th>
                        <th className="text-center py-1 px-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dept.postes.map(p => {
                        const e = p.reel - p.budget;
                        return (
                          <tr key={p.libelle} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="py-1 px-4 text-gray-700">{p.libelle}</td>
                            <td className="text-right py-1 px-3 tabular-nums">{fmt(p.budget / 1000, 1)} k\u20AC</td>
                            <td className="text-right py-1 px-3 tabular-nums">{fmt(p.reel / 1000, 1)} k\u20AC</td>
                            <td className={`text-right py-1 px-3 tabular-nums ${e <= 0 ? 'text-green-700' : 'text-red-600'}`}>
                              {e >= 0 ? '+' : ''}{fmt(e / 1000, 1)} k\u20AC
                            </td>
                            <td className="text-center py-1 px-3">
                              {e <= 0 ? '\u2705' : Math.abs(e / p.budget) < 0.05 ? '\u26A0\uFE0F' : '\uD83D\uDEA8'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </section>
        )}

        {/* ─── ONGLET 8 — Analyse Approfondie ──────────────────── */}
        {activeTab === 8 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Sc\u00E9narios de projection</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { nom: 'Pessimiste', croissance: -0.05, color: 'border-red-300 bg-red-50' },
                { nom: 'Base',       croissance:  0.05, color: 'border-blue-300 bg-blue-50' },
                { nom: 'Optimiste',  croissance:  0.12, color: 'border-green-300 bg-green-50' },
              ].map(s => {
                const caBase = donnees.cpc.chiffreAffaires[last];
                const ca1    = caBase * (1 + s.croissance);
                const ebitda = ca1 * (resultats.ratios.margeEBITDA[last] ?? 0.15);
                return (
                  <div key={s.nom} className={`rounded-xl border-2 p-5 ${s.color}`}>
                    <p className="font-bold text-lg text-gray-800">{s.nom}</p>
                    <p className="text-xs text-gray-500 mb-3">Croissance CA : {s.croissance >= 0 ? '+' : ''}{fmtPct(s.croissance)}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">CA N+1</span><span className="font-semibold">{fmtM(ca1)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">EBITDA N+1</span><span className="font-semibold">{fmtM(ebitda)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Prévision trésorerie mensuelle */}
            <h2 className="text-xl font-bold mb-4">Pr\u00E9vision de tr\u00E9sorerie mensuelle</h2>
            <div className="h-72 mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={donnees.previsionTresorerie.moisLabels.map((mois, i) => {
                  const enc = (donnees.previsionTresorerie.encaissementsExploitation[i] ?? 0) +
                              (donnees.previsionTresorerie.encaissementsFinanciers[i] ?? 0) +
                              (donnees.previsionTresorerie.encaissementsExceptionnels[i] ?? 0);
                  const dec = (donnees.previsionTresorerie.decaissementsFournisseurs[i] ?? 0) +
                              (donnees.previsionTresorerie.decaissementsPersonnel[i] ?? 0) +
                              (donnees.previsionTresorerie.decaissementsChargesSociales[i] ?? 0) +
                              (donnees.previsionTresorerie.decaissementsImpots[i] ?? 0) +
                              (donnees.previsionTresorerie.decaissementsInvestissements[i] ?? 0) +
                              (donnees.previsionTresorerie.decaissementsRemboursementsEmprunts[i] ?? 0) +
                              (donnees.previsionTresorerie.decaissementsAutres[i] ?? 0);
                  return { mois, encaissements: +(enc / 1000).toFixed(0), decaissements: +(dec / 1000).toFixed(0), flux: +((enc - dec) / 1000).toFixed(0) };
                })}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" />
                  <YAxis unit=" k\u20AC" />
                  <Tooltip formatter={(v: ValueType | undefined) => `${Number(v ?? 0)} k\u20AC`} />
                  <Legend />
                  <Bar dataKey="encaissements" fill="#10b981" name="Encaissements" />
                  <Bar dataKey="decaissements" fill="#ef4444" name="D\u00E9caissements" />
                  <ReferenceLine y={0} stroke="#333" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ratios avancés */}
            <h2 className="text-xl font-bold mb-4">Ratios avanc\u00E9s</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Rule of 40',          val: fmt(resultats.ratios.avances.ruleOf40[last], 1), seuil: '> 40' },
                { label: 'Net Debt / EBITDA',    val: fmt(resultats.ratios.avances.netDebtEBITDA[last], 1), seuil: '< 3,0' },
                { label: 'ROIC',                 val: fmtPct(resultats.ratios.avances.roic[last]), seuil: '> WACC' },
                { label: 'EVA',                  val: fmtM(resultats.ratios.avances.eva[last]), seuil: '> 0' },
                { label: 'Piotroski F-Score',    val: `${fmt(resultats.ratios.avances.piotroskiFScore[last], 0)} / 9`, seuil: '\u2265 7' },
                { label: 'Marge CAF',            val: fmtPct(resultats.ratios.avances.margeCaf[last]), seuil: '> 8%' },
                { label: 'Quality of Earnings',  val: fmt(resultats.ratios.avances.qualityOfEarnings[last], 2), seuil: '> 1,0' },
                { label: 'Croissance soutenable', val: fmtPct(resultats.ratios.avances.sustainableGrowthRate[last]), seuil: '> g r\u00E9el' },
              ].map(r => (
                <div key={r.label} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{r.label}</p>
                  <p className="text-lg font-bold text-gray-800 mt-1">{r.val}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.seuil}</p>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
