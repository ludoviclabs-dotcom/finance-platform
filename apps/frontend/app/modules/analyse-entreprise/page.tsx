// TODO(refactor): This file is ~1500 lines with 15+ useState hooks.
// Recommended decomposition:
//   1. Extract upload/file-handling into a useFileUpload hook
//   2. Extract each result section (bilan, SIG, ratios) into its own component
//   3. Extract chart wrappers into shared components
//   4. Move financial computation logic into a pure utility module

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, TrendingUp, Layers, BarChart2, Activity,
  ChevronRight, ChevronLeft, Play,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import type { DonneesEntreprise, NomDepartement } from '@/lib/types/analyse-entreprise';
import { calculerTout, calculerTotauxBilan } from '@/lib/calculs/analyse-entreprise';

/* ═══════════════════════════════════════════════════════════ Constants ══ */

const STEP_LABELS = [
  'Identité',
  'Bilan (4 exercices)',
  'Compte de résultat',
  'Trésorerie & Budget',
  'Stocks & Immobilisations',
  'BU, Départements & DCF',
];

const INPUT_CLS =
  'w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border-strong transition-colors';

const INPUT_NUM_CLS =
  'w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground tabnum text-right focus:outline-none focus:border-border-strong transition-colors';

/* ═══════════════════════════════════════════════════════════ Helpers ══ */

const fmt = (n: number, d = 2) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);
const fmtM = (n: number) => `${fmt(n / 1_000_000, 2)} M€`;
const fmtPct = (n: number, d = 1) => `${fmt(n * 100, d)} %`;

function scoreBadge(score: number) {
  if (score >= 100) return { cls: 'badge badge-success', label: 'Sain' };
  if (score >= 60) return { cls: 'badge badge-warning', label: 'Vigilance' };
  return { cls: 'badge badge-danger', label: 'Risqué' };
}

function zBadge(z: number) {
  if (z >= 3) return { cls: 'badge badge-success', label: 'Zone saine' };
  if (z >= 1.8) return { cls: 'badge badge-warning', label: 'Zone grise' };
  return { cls: 'badge badge-danger', label: 'Risque faillite' };
}

/* ══════════════════════════════════════════════════════ Default data ══ */

function getDefaults(): DonneesEntreprise {
  return {
    identite: {
      raisonSociale: 'Acier Côte Ouest SAS',
      secteur: 'Industrie manufacturière',
      formeJuridique: 'SAS',
      dateCreation: '2005-03-15',
      effectifs: 215,
      chiffreAffaires: 32400000,
      devise: '€',
      exerciceFiscal: '2025',
      nombreExercices: 4,
      diviseurUnite: 1000000,
      suffixeUnite: 'M€',
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
      encaissementsExploitation:           [2500000,2600000,2800000,2700000,2900000,3000000,2400000,1800000,2700000,3100000,3200000,3000000],
      encaissementsFinanciers:             [3000,3000,3000,3000,3500,3500,3500,3500,4000,4000,4000,4000],
      encaissementsExceptionnels:          [0,0,10000,0,0,20000,0,0,0,10000,0,30000],
      decaissementsFournisseurs:           [1300000,1350000,1450000,1400000,1500000,1550000,1250000,950000,1400000,1600000,1650000,1550000],
      decaissementsPersonnel:              [580000,580000,580000,585000,585000,585000,590000,590000,590000,595000,595000,595000],
      decaissementsChargesSociales:        [280000,280000,280000,285000,285000,285000,290000,290000,290000,295000,295000,295000],
      decaissementsImpots:                 [0,0,130000,0,0,130000,0,0,130000,0,0,130000],
      decaissementsInvestissements:        [0,200000,0,300000,0,500000,0,0,400000,0,800000,1000000],
      decaissementsRemboursementsEmprunts: [58000,58000,58000,58000,58000,58000,58000,58000,58000,58000,58000,58000],
      decaissementsAutres:                 [40000,40000,45000,40000,45000,40000,45000,40000,45000,40000,45000,40000],
      soldeInitial: 1950000,
    },
    budget: {
      postes: ["Chiffre d'affaires",'Coût matières premières','Charges de personnel',
        'Autres charges externes','Amortissements','Charges financières',
        'Impôts & taxes','CAPEX','Résultat net'],
      montantsBudget: [33000000,17200000,6800000,4500000,1400000,380000,500000,2800000,1800000],
      montantsReel:   [32400000,17000000,7000000,4700000,1500000,420000,510000,3200000,1650000],
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
      { nom: 'Acier Plat',        ca: 12000000, caBudget: 13000000, coutVariables: 8400000,  chargesFixesSpecifiques: 1200000, effectifs: 52, quantiteVendue: 4800, quantiteBudget: 5200, prixUnitaireReel: 2500, prixUnitaireBudget: 2500 },
      { nom: 'Acier Long',        ca: 9500000,  caBudget: 9500000,  coutVariables: 6650000,  chargesFixesSpecifiques: 950000,  effectifs: 41, quantiteVendue: 3800, quantiteBudget: 3800, prixUnitaireReel: 2500, prixUnitaireBudget: 2500 },
      { nom: 'Inox & Alu',        ca: 5200000,  caBudget: 5000000,  coutVariables: 3120000,  chargesFixesSpecifiques: 650000,  effectifs: 28, quantiteVendue: 1300, quantiteBudget: 1250, prixUnitaireReel: 4000, prixUnitaireBudget: 4000 },
      { nom: 'Découpe Laser',     ca: 3800000,  caBudget: 4000000,  coutVariables: 2280000,  chargesFixesSpecifiques: 500000,  effectifs: 22, quantiteVendue: 950,  quantiteBudget: 1000, prixUnitaireReel: 4000, prixUnitaireBudget: 4000 },
      { nom: 'Services & Négoce', ca: 1900000,  caBudget: 2500000,  coutVariables: 1330000,  chargesFixesSpecifiques: 250000,  effectifs: 12, quantiteVendue: 380,  quantiteBudget: 500,  prixUnitaireReel: 5000, prixUnitaireBudget: 5000 },
    ],
    departementsFonctionnels: [
      { nom: 'Marketing' as NomDepartement, effectifs: 8, postes: [
        { libelle: 'Masse salariale', budget: 384000, reel: 392000 },
        { libelle: 'Prestations & sous-traitance', budget: 120000, reel: 135000 },
        { libelle: 'Outils & licences', budget: 42000, reel: 48000 },
        { libelle: 'Formation', budget: 15000, reel: 11000 },
        { libelle: 'Déplacements', budget: 65000, reel: 78000 },
      ]},
      { nom: 'Comptabilité / Finance' as NomDepartement, effectifs: 6, postes: [
        { libelle: 'Masse salariale', budget: 312000, reel: 318000 },
        { libelle: 'Prestations & sous-traitance', budget: 45000, reel: 52000 },
        { libelle: 'Honoraires', budget: 85000, reel: 92000 },
        { libelle: 'Outils & licences', budget: 38000, reel: 41000 },
      ]},
      { nom: 'Ressources Humaines' as NomDepartement, effectifs: 5, postes: [
        { libelle: 'Masse salariale', budget: 260000, reel: 265000 },
        { libelle: 'Prestations & sous-traitance', budget: 35000, reel: 38000 },
        { libelle: 'Formation', budget: 28000, reel: 31000 },
      ]},
      { nom: "Systèmes d'Information" as NomDepartement, effectifs: 7, postes: [
        { libelle: 'Masse salariale', budget: 364000, reel: 371000 },
        { libelle: 'Outils & licences', budget: 125000, reel: 138000 },
        { libelle: 'Prestations & sous-traitance', budget: 95000, reel: 112000 },
      ]},
      { nom: 'Autres (DG, Juridique, QSE)' as NomDepartement, effectifs: 4, postes: [
        { libelle: 'Masse salariale', budget: 280000, reel: 285000 },
        { libelle: 'Honoraires', budget: 45000, reel: 51000 },
        { libelle: 'Prestations & sous-traitance', budget: 55000, reel: 62000 },
      ]},
    ],
    parametres: {
      tauxSansRisque: 0.032,
      primeRisqueMarche: 0.055,
      beta: 0.95,
      tauxCroissanceTerminale: 0.02,
      tauxIS: 0.25,
      horizonProjection: 5,
      tauxCroissanceCA: 0.05,
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

/* ════════════════════════════════════════════════════ Sub-components ══ */

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex mb-8 overflow-x-auto pb-1">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const isCompleted = step < current;
        const isCurrent = step === current;
        const isLast = step === STEP_LABELS.length;
        return (
          <div key={step} className={`flex flex-col shrink-0 ${!isLast ? 'flex-1 min-w-[60px]' : ''}`}>
            <div className="flex items-center">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                isCompleted ? 'bg-success text-white' : isCurrent ? 'bg-accent text-white' : 'bg-surface-raised border border-border text-foreground-subtle'
              }`}>
                {isCompleted ? '✓' : step}
              </div>
              {!isLast && (
                <div className={`flex-1 h-px ml-2 transition-colors ${step < current ? 'bg-success' : 'bg-border'}`} />
              )}
            </div>
            <span className={`text-xs mt-1.5 hidden sm:block whitespace-nowrap ${isCurrent ? 'text-foreground font-medium' : 'text-foreground-subtle'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FormField({ label, id, value, onChange, unit, hint, step: stepProp, min }: {
  label: string; id: string; value: number;
  onChange: (v: number) => void; unit?: string; hint?: string; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {unit && <span className="ml-1 text-xs font-normal text-foreground-subtle">({unit})</span>}
      </label>
      <input id={id} type="number" min={min ?? 0} step={stepProp ?? 1} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className={INPUT_CLS} />
      {hint && <p className="text-xs text-foreground-subtle leading-relaxed">{hint}</p>}
    </div>
  );
}

function TextField({ label, id, value, onChange, hint }: {
  label: string; id: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      <input id={id} type="text" value={value}
        onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />
      {hint && <p className="text-xs text-foreground-subtle leading-relaxed">{hint}</p>}
    </div>
  );
}

function KpiCard({ label, value, badge, sub }: {
  label: string; value: string; badge: { cls: string; label: string }; sub?: string;
}) {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <span className="data-label">{label}</span>
      <span className="kpi-value tabnum">{value}</span>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={badge.cls}>{badge.label}</span>
        {sub && <span className="text-xs text-foreground-subtle">{sub}</span>}
      </div>
    </div>
  );
}

/* 4-year numeric row table */
function BilanTable({ rows, annees, getVal, setVal }: {
  rows: { key: string; label: string }[];
  annees: string[];
  getVal: (key: string, i: number) => number;
  setVal: (key: string, i: number, v: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-3 text-foreground-subtle font-medium w-56">Poste</th>
            {annees.map((a) => (
              <th key={a} className="text-right py-2 px-2 text-foreground-subtle font-medium w-32">{a}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/50 hover:bg-surface-raised/50">
              <td className="py-1.5 pr-3 text-foreground-muted">{row.label}</td>
              {annees.map((_, i) => (
                <td key={i} className="py-1.5 px-2">
                  <input
                    type="number"
                    value={getVal(row.key, i)}
                    onChange={(e) => setVal(row.key, i, Number(e.target.value))}
                    className={INPUT_NUM_CLS}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ Page ══ */

export default function AnalyseEntreprisePage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<DonneesEntreprise>(getDefaults);
  const [submitted, setSubmitted] = useState(false);

  /* ── Deep update helpers ────────────────────────────────────────── */
  function patchIdentite(patch: Partial<typeof data.identite>) {
    setData((d) => ({ ...d, identite: { ...d.identite, ...patch } }));
  }
  function patchParametres(patch: Partial<typeof data.parametres>) {
    setData((d) => ({ ...d, parametres: { ...d.parametres, ...patch } }));
  }
  function patchBenchmark(patch: Partial<typeof data.parametres.benchmarkSecteur>) {
    setData((d) => ({ ...d, parametres: { ...d.parametres, benchmarkSecteur: { ...d.parametres.benchmarkSecteur, ...patch } } }));
  }
  function patchBilanActif(key: keyof typeof data.bilan.actif, i: number, v: number) {
    setData((d) => {
      const arr = [...d.bilan.actif[key]];
      arr[i] = v;
      return { ...d, bilan: { ...d.bilan, actif: { ...d.bilan.actif, [key]: arr } } };
    });
  }
  function patchBilanPassif(key: keyof typeof data.bilan.passif, i: number, v: number) {
    setData((d) => {
      const arr = [...d.bilan.passif[key]];
      arr[i] = v;
      return { ...d, bilan: { ...d.bilan, passif: { ...d.bilan.passif, [key]: arr } } };
    });
  }
  function patchCPC(key: keyof Omit<typeof data.cpc, 'annees'>, i: number, v: number) {
    setData((d) => {
      const arr = [...d.cpc[key]];
      arr[i] = v;
      return { ...d, cpc: { ...d.cpc, [key]: arr } };
    });
  }
  function patchTFT(key: keyof Omit<typeof data.tftHistorique, 'annees'>, i: number, v: number) {
    setData((d) => {
      const arr = [...(d.tftHistorique[key] as number[])];
      arr[i] = v;
      return { ...d, tftHistorique: { ...d.tftHistorique, [key]: arr } };
    });
  }
  function patchPrevision(key: keyof Omit<typeof data.previsionTresorerie, 'moisLabels' | 'soldeInitial'>, i: number, v: number) {
    setData((d) => {
      const arr = [...(d.previsionTresorerie[key] as number[])];
      arr[i] = v;
      return { ...d, previsionTresorerie: { ...d.previsionTresorerie, [key]: arr } };
    });
  }
  function patchBudget(field: 'montantsBudget' | 'montantsReel', i: number, v: number) {
    setData((d) => {
      const arr = [...d.budget[field]];
      arr[i] = v;
      return { ...d, budget: { ...d.budget, [field]: arr } };
    });
  }
  function patchWilson(patch: Partial<typeof data.stocks.parametresWilson>) {
    setData((d) => ({ ...d, stocks: { ...d.stocks, parametresWilson: { ...d.stocks.parametresWilson, ...patch } } }));
  }
  function addBU() {
    setData((d) => ({
      ...d,
      businessUnits: [...d.businessUnits, { nom: 'Nouvelle BU', ca: 0, caBudget: 0, coutVariables: 0, chargesFixesSpecifiques: 0, effectifs: 0, quantiteVendue: 0, quantiteBudget: 0, prixUnitaireReel: 0, prixUnitaireBudget: 0 }],
    }));
  }
  function removeBU(i: number) {
    setData((d) => ({ ...d, businessUnits: d.businessUnits.filter((_, idx) => idx !== i) }));
  }
  function patchBU(i: number, patch: Partial<typeof data.businessUnits[0]>) {
    setData((d) => {
      const arr = [...d.businessUnits];
      arr[i] = { ...arr[i], ...patch };
      return { ...d, businessUnits: arr };
    });
  }

  /* ── Results ────────────────────────────────────────────────────── */
  const resultats = useMemo(() => {
    try { return calculerTout(data); } catch { return null; }
  }, [data]);
  const totaux = useMemo(() => {
    try { return calculerTotauxBilan(data); } catch { return null; }
  }, [data]);

  const annees = data.bilan.annees;
  const last = annees.length - 1;

  /* ── Step content ───────────────────────────────────────────────── */

  /* STEP 1 — Identité */
  const step1 = (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-foreground-muted leading-relaxed">
        Renseignez les informations générales de l&apos;entreprise. Ces données alimentent l&apos;en-tête du rapport et certains ratios (effectifs, exercice fiscal).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <TextField label="Raison sociale" id="raisonSociale" value={data.identite.raisonSociale}
          onChange={(v) => patchIdentite({ raisonSociale: v })} />
        <TextField label="Secteur" id="secteur" value={data.identite.secteur}
          onChange={(v) => patchIdentite({ secteur: v })} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="formeJuridique" className="text-sm font-medium text-foreground">Forme juridique</label>
          <select id="formeJuridique" value={data.identite.formeJuridique}
            onChange={(e) => patchIdentite({ formeJuridique: e.target.value })}
            className={INPUT_CLS}>
            {['SAS','SARL','SA','SNC','EURL','SC','GIE','Autre'].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <TextField label="Date de création" id="dateCreation" value={data.identite.dateCreation}
          onChange={(v) => patchIdentite({ dateCreation: v })} hint="Format AAAA-MM-JJ" />
        <FormField label="Effectifs (ETP)" id="effectifs" value={data.identite.effectifs}
          onChange={(v) => patchIdentite({ effectifs: v })} unit="ETP" />
        <TextField label="Exercice fiscal" id="exerciceFiscal" value={data.identite.exerciceFiscal}
          onChange={(v) => patchIdentite({ exerciceFiscal: v })} hint="Dernière année clôturée (ex : 2025)" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="devise" className="text-sm font-medium text-foreground">Devise / Unité affichage</label>
          <select id="devise" value={data.identite.suffixeUnite}
            onChange={(e) => {
              const s = e.target.value as typeof data.identite.suffixeUnite;
              const div = s === '€' ? 1 : s === 'k€' ? 1000 : s === 'M€' ? 1000000 : 1000000000;
              patchIdentite({ suffixeUnite: s, devise: s, diviseurUnite: div as typeof data.identite.diviseurUnite });
            }}
            className={INPUT_CLS}>
            {(['€','k€','M€','Mrd€'] as const).map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <FormField label="Chiffre d'affaires (€)" id="caIdentite" value={data.identite.chiffreAffaires}
          onChange={(v) => patchIdentite({ chiffreAffaires: v })} unit="€" hint="CA annuel de référence pour l'identité." />
      </div>
    </div>
  );

  /* STEP 2 — Bilan */
  const actifRows: { key: keyof typeof data.bilan.actif; label: string }[] = [
    { key: 'immobilisationsIncorporelles', label: 'Immo. incorporelles' },
    { key: 'immobilisationsCorporelles',   label: 'Immo. corporelles' },
    { key: 'immobilisationsFinancieres',   label: 'Immo. financières' },
    { key: 'stocksMatieresPremières',      label: 'Stocks MP' },
    { key: 'stocksProduitsFinis',          label: 'Stocks PF' },
    { key: 'stocksEnCours',               label: 'Stocks en-cours' },
    { key: 'stocksMarchandises',           label: 'Stocks marchandises' },
    { key: 'creancesClients',              label: 'Créances clients' },
    { key: 'autresCreances',              label: 'Autres créances' },
    { key: 'tresorerieActive',            label: 'Trésorerie active' },
    { key: 'vmp',                         label: 'VMP' },
    { key: 'chargesConstateesAvance',     label: 'Charges constatées avance' },
  ];
  const passifRows: { key: keyof typeof data.bilan.passif; label: string }[] = [
    { key: 'capitalSocial',             label: 'Capital social' },
    { key: 'reserves',                  label: 'Réserves' },
    { key: 'reportANouveau',            label: 'Report à nouveau' },
    { key: 'resultatExercice',          label: 'Résultat exercice' },
    { key: 'provisionsReglementees',    label: 'Provisions réglementées' },
    { key: 'empruntsObligataires',      label: 'Emprunts obligataires' },
    { key: 'empruntsbanairesLT',        label: 'Emprunts bancaires LT' },
    { key: 'provisionsRisques',         label: 'Provisions risques' },
    { key: 'dettesFournisseurs',        label: 'Dettes fournisseurs' },
    { key: 'dettesFiscalesSociales',    label: 'Dettes fiscales & sociales' },
    { key: 'concoursBancairesCourants', label: 'Concours bancaires courants' },
    { key: 'autresDettes',              label: 'Autres dettes' },
    { key: 'produitsConstatesAvance',   label: 'Produits constatés avance' },
  ];

  const step2 = (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-foreground-muted leading-relaxed">
        Saisissez le bilan sur 4 exercices. Les valeurs sont en euros. Les totaux (actif / passif) sont calculés automatiquement.
      </p>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">ACTIF</p>
        <BilanTable
          rows={actifRows}
          annees={annees}
          getVal={(key, i) => (data.bilan.actif[key as keyof typeof data.bilan.actif])[i] ?? 0}
          setVal={(key, i, v) => patchBilanActif(key as keyof typeof data.bilan.actif, i, v)}
        />
        {totaux && (
          <div className="flex gap-6 mt-2 p-3 bg-surface-raised border border-border rounded-md">
            {annees.map((a, i) => (
              <div key={a} className="flex flex-col gap-0.5">
                <span className="data-label">Total actif {a}</span>
                <span className="tabnum text-sm font-bold text-foreground">{fmtM(totaux.totalActif[i] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">PASSIF</p>
        <BilanTable
          rows={passifRows}
          annees={annees}
          getVal={(key, i) => (data.bilan.passif[key as keyof typeof data.bilan.passif])[i] ?? 0}
          setVal={(key, i, v) => patchBilanPassif(key as keyof typeof data.bilan.passif, i, v)}
        />
        {totaux && (
          <div className="flex gap-6 mt-2 p-3 bg-surface-raised border border-border rounded-md">
            {annees.map((a, i) => (
              <div key={a} className="flex flex-col gap-0.5">
                <span className="data-label">Total passif {a}</span>
                <span className="tabnum text-sm font-bold text-foreground">{fmtM(totaux.totalPassif[i] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /* STEP 3 — CPC */
  const cpcRows: { key: keyof Omit<typeof data.cpc, 'annees'>; label: string }[] = [
    { key: 'chiffreAffaires',             label: "Chiffre d'affaires" },
    { key: 'productionStockee',           label: 'Production stockée' },
    { key: 'productionImmobilisee',       label: 'Production immobilisée' },
    { key: 'subventionsExploitation',     label: "Subventions d'exploitation" },
    { key: 'autresProduitsExploitation',  label: "Autres produits d'exploitation" },
    { key: 'achatsMatieresPremieres',     label: 'Achats matières premières' },
    { key: 'variationStocksMP',           label: 'Variation stocks MP' },
    { key: 'autresAchatsChargesExternes', label: 'Autres achats & charges externes' },
    { key: 'impotsTaxes',                 label: 'Impôts & taxes' },
    { key: 'chargesPersonnel',            label: 'Charges de personnel' },
    { key: 'dotationsAmortissements',     label: 'Dotations amortissements' },
    { key: 'dotationsProvisions',         label: 'Dotations provisions' },
    { key: 'autresChargesExploitation',   label: "Autres charges d'exploitation" },
    { key: 'produitsFinanciers',          label: 'Produits financiers' },
    { key: 'chargesFinancieres',          label: 'Charges financières' },
    { key: 'produitsExceptionnels',       label: 'Produits exceptionnels' },
    { key: 'chargesExceptionnelles',      label: 'Charges exceptionnelles' },
    { key: 'participationSalaries',       label: 'Participation salariés' },
    { key: 'impotSurBenefices',           label: 'Impôt sur bénéfices' },
  ];

  const step3 = (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-foreground-muted leading-relaxed">
        Compte de résultat (CPC) sur 4 exercices. Produits en positif, charges en positif également (le calcul SIG les soustrait). La variation de stocks MP peut être négative.
      </p>
      <BilanTable
        rows={cpcRows}
        annees={annees}
        getVal={(key, i) => (data.cpc[key as keyof Omit<typeof data.cpc, 'annees'>])[i] ?? 0}
        setVal={(key, i, v) => patchCPC(key as keyof Omit<typeof data.cpc, 'annees'>, i, v)}
      />
    </div>
  );

  /* STEP 4 — Trésorerie & Budget */
  const tftRows: { key: keyof Omit<typeof data.tftHistorique, 'annees'>; label: string }[] = [
    { key: 'resultatNet',                 label: 'Résultat net' },
    { key: 'dotationsAmortissements',     label: 'DAP' },
    { key: 'dotationsProvisions',         label: 'Provisions' },
    { key: 'plusMoinsValuesCessions',     label: '+/- Values cessions' },
    { key: 'variationStocks',             label: 'Variation stocks' },
    { key: 'variationCreancesClients',    label: 'Variation créances clients' },
    { key: 'variationDettesFournisseurs', label: 'Variation dettes fournisseurs' },
    { key: 'variationAutresBFR',          label: 'Variation autres BFR' },
    { key: 'acquisitionsImmobilisations', label: 'Acquisitions immo.' },
    { key: 'cessionsImmobilisations',     label: 'Cessions immo.' },
    { key: 'investissementsFinanciers',   label: 'Investissements financiers' },
    { key: 'augmentationCapital',         label: 'Augmentation capital' },
    { key: 'nouveauxEmprunts',            label: 'Nouveaux emprunts' },
    { key: 'remboursementsEmprunts',      label: 'Remboursements emprunts' },
    { key: 'dividendesVerses',            label: 'Dividendes versés' },
  ];

  const step4 = (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-foreground-muted leading-relaxed">
        Tableau de flux de trésorerie historique (3 derniers exercices) et prévision de trésorerie mensuelle pour l&apos;exercice en cours.
      </p>

      {/* TFT Historique */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">TFT Historique (3 exercices)</p>
        <BilanTable
          rows={tftRows}
          annees={data.tftHistorique.annees}
          getVal={(key, i) => ((data.tftHistorique[key as keyof Omit<typeof data.tftHistorique, 'annees'>]) as number[])[i] ?? 0}
          setVal={(key, i, v) => patchTFT(key as keyof Omit<typeof data.tftHistorique, 'annees'>, i, v)}
        />
      </div>

      {/* Solde initial */}
      <FormField label="Solde de trésorerie initial (€)" id="soldeInitial"
        value={data.previsionTresorerie.soldeInitial}
        onChange={(v) => setData((d) => ({ ...d, previsionTresorerie: { ...d.previsionTresorerie, soldeInitial: v } }))}
        unit="€" hint="Solde en début de période pour la prévision mensuelle." />

      {/* Prévision mensuelle — encaissements */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">Prévision mensuelle — Encaissements (€)</p>
        {(['encaissementsExploitation','encaissementsFinanciers','encaissementsExceptionnels'] as const).map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <p className="text-xs text-foreground-muted capitalize">{k.replace('encaissements', 'Encaissements ')}</p>
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
              {data.previsionTresorerie.moisLabels.map((m, i) => (
                <div key={m} className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-foreground-subtle text-center">{m}</span>
                  <input type="number" value={(data.previsionTresorerie[k] as number[])[i] ?? 0}
                    onChange={(e) => patchPrevision(k, i, Number(e.target.value))}
                    className={INPUT_NUM_CLS} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Budget écarts */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">Budget — Écarts Budget / Réel</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 text-foreground-subtle font-medium">Poste</th>
                <th className="text-right py-2 px-2 text-foreground-subtle font-medium w-32">Budget (€)</th>
                <th className="text-right py-2 px-2 text-foreground-subtle font-medium w-32">Réel (€)</th>
                <th className="text-right py-2 px-2 text-foreground-subtle font-medium w-28">Écart</th>
              </tr>
            </thead>
            <tbody>
              {data.budget.postes.map((poste, i) => {
                const ecart = (data.budget.montantsReel[i] ?? 0) - (data.budget.montantsBudget[i] ?? 0);
                return (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 pr-3 text-foreground-muted">{poste}</td>
                    <td className="py-1.5 px-2">
                      <input type="number" value={data.budget.montantsBudget[i] ?? 0}
                        onChange={(e) => patchBudget('montantsBudget', i, Number(e.target.value))}
                        className={INPUT_NUM_CLS} />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" value={data.budget.montantsReel[i] ?? 0}
                        onChange={(e) => patchBudget('montantsReel', i, Number(e.target.value))}
                        className={INPUT_NUM_CLS} />
                    </td>
                    <td className={`py-1.5 px-2 text-right tabnum font-semibold ${ecart >= 0 ? 'text-success' : 'text-danger'}`}>
                      {ecart >= 0 ? '+' : ''}{ecart.toLocaleString('fr-FR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  /* STEP 5 — Stocks & Immobilisations */
  const step5 = (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-foreground-muted leading-relaxed">
        Paramètres de valorisation des stocks et modèle de Wilson. Les immobilisations sont utilisées pour le calcul des amortissements et du taux de vétusté.
      </p>

      {/* Méthode valorisation */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-foreground">Valorisation des stocks</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Méthode de valorisation</label>
            <select value={data.stocks.methodeValorisation}
              onChange={(e) => setData((d) => ({ ...d, stocks: { ...d.stocks, methodeValorisation: e.target.value as 'CUMP'|'FIFO'|'LIFO' } }))}
              className={INPUT_CLS}>
              {(['CUMP','FIFO','LIFO'] as const).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Wilson */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-foreground">Paramètres Wilson (gestion des commandes)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Niveau de service</label>
            <select value={data.stocks.parametresWilson.niveauService}
              onChange={(e) => patchWilson({ niveauService: Number(e.target.value) as 1.28|1.65|2.33 })}
              className={INPUT_CLS}>
              <option value={1.28}>90 % (z=1.28)</option>
              <option value={1.65}>95 % (z=1.65)</option>
              <option value={2.33}>99 % (z=2.33)</option>
            </select>
          </div>
          <FormField label="Écart-type demande" id="ecartType" value={data.stocks.parametresWilson.ecartTypeDemande}
            onChange={(v) => patchWilson({ ecartTypeDemande: v })} unit="unités/j" />
          <FormField label="Délai appro." id="delaiAppro" value={data.stocks.parametresWilson.delaiApprovisionnement}
            onChange={(v) => patchWilson({ delaiApprovisionnement: v })} unit="jours" />
          <FormField label="Coût passation" id="coutPassation" value={data.stocks.parametresWilson.coutPassationCommande}
            onChange={(v) => patchWilson({ coutPassationCommande: v })} unit="€/commande" />
          <FormField label="Coût possession unit." id="coutPossession" value={data.stocks.parametresWilson.coutPossessionUnitaire}
            onChange={(v) => patchWilson({ coutPossessionUnitaire: v })} unit="€/unité/an" />
          <FormField label="Coeff. saisonnalité" id="coeffSaisonnalite" value={data.stocks.parametresWilson.coefficientSaisonnier}
            onChange={(v) => patchWilson({ coefficientSaisonnier: v })} step={0.1} />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" checked={data.stocks.parametresWilson.saisonnaliteActivee}
            onChange={(e) => patchWilson({ saisonnaliteActivee: e.target.checked })}
            className="rounded" />
          Activer la saisonnalité
        </label>
      </div>

      {/* Immobilisations — add/remove */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Immobilisations</p>
          <button type="button" onClick={() => setData((d) => ({
            ...d,
            immobilisations: { immobilisations: [...d.immobilisations.immobilisations, {
              designation: 'Nouvelle immobilisation', categorie: 'Corporelle' as const,
              dateAcquisition: '2024-01-01', valeurOrigine: 100000,
              dureeAmortissement: 5, methode: 'Lineaire' as const,
              amortissementsCumules: 0,
            }]},
          }))}
            className="text-xs px-3 py-1.5 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors">
            + Ajouter
          </button>
        </div>
        {data.immobilisations.immobilisations.length === 0 && (
          <p className="text-xs text-foreground-subtle italic">Aucune immobilisation saisie — les calculs utiliseront les dotations du CPC.</p>
        )}
        {data.immobilisations.immobilisations.map((immo, i) => (
          <div key={i} className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{immo.designation}</span>
              <button type="button" onClick={() => setData((d) => ({
                ...d,
                immobilisations: { immobilisations: d.immobilisations.immobilisations.filter((_, idx) => idx !== i) },
              }))} className="text-xs text-danger hover:underline">Supprimer</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-foreground-muted">Désignation</label>
                <input type="text" value={immo.designation} className={INPUT_CLS}
                  onChange={(e) => setData((d) => {
                    const arr = [...d.immobilisations.immobilisations];
                    arr[i] = { ...arr[i], designation: e.target.value };
                    return { ...d, immobilisations: { immobilisations: arr } };
                  })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-foreground-muted">Catégorie</label>
                <select value={immo.categorie} className={INPUT_CLS}
                  onChange={(e) => setData((d) => {
                    const arr = [...d.immobilisations.immobilisations];
                    arr[i] = { ...arr[i], categorie: e.target.value as typeof immo.categorie };
                    return { ...d, immobilisations: { immobilisations: arr } };
                  })}>
                  {(['Incorporelle','Corporelle','Financière'] as const).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-foreground-muted">Valeur d&apos;origine (€)</label>
                <input type="number" value={immo.valeurOrigine} className={INPUT_NUM_CLS}
                  onChange={(e) => setData((d) => {
                    const arr = [...d.immobilisations.immobilisations];
                    arr[i] = { ...arr[i], valeurOrigine: Number(e.target.value) };
                    return { ...d, immobilisations: { immobilisations: arr } };
                  })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-foreground-muted">Durée (années)</label>
                <input type="number" value={immo.dureeAmortissement} className={INPUT_NUM_CLS}
                  onChange={(e) => setData((d) => {
                    const arr = [...d.immobilisations.immobilisations];
                    arr[i] = { ...arr[i], dureeAmortissement: Number(e.target.value) };
                    return { ...d, immobilisations: { immobilisations: arr } };
                  })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-foreground-muted">Amort. cumulés (€)</label>
                <input type="number" value={immo.amortissementsCumules} className={INPUT_NUM_CLS}
                  onChange={(e) => setData((d) => {
                    const arr = [...d.immobilisations.immobilisations];
                    arr[i] = { ...arr[i], amortissementsCumules: Number(e.target.value) };
                    return { ...d, immobilisations: { immobilisations: arr } };
                  })} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* STEP 6 — BU, Depts & DCF */
  const step6 = (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-foreground-muted leading-relaxed">
        Définissez les business units et les paramètres DCF (WACC, croissance terminale) pour la valorisation.
      </p>

      {/* Business Units */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Business Units</p>
          <button type="button" onClick={addBU}
            className="text-xs px-3 py-1.5 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors">
            + Ajouter BU
          </button>
        </div>
        {data.businessUnits.map((bu, i) => (
          <div key={i} className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <input type="text" value={bu.nom} className="text-sm font-medium text-foreground bg-transparent border-0 p-0 focus:outline-none"
                onChange={(e) => patchBU(i, { nom: e.target.value })} />
              <button type="button" onClick={() => removeBU(i)} className="text-xs text-danger hover:underline">Supprimer</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {([
                { label: 'CA Réel (€)', field: 'ca' as const },
                { label: 'CA Budget (€)', field: 'caBudget' as const },
                { label: 'Coûts variables (€)', field: 'coutVariables' as const },
                { label: 'Charges fixes (€)', field: 'chargesFixesSpecifiques' as const },
                { label: 'Effectifs', field: 'effectifs' as const },
                { label: 'Qté vendue', field: 'quantiteVendue' as const },
                { label: 'Prix unitaire réel (€)', field: 'prixUnitaireReel' as const },
                { label: 'Prix unitaire budget (€)', field: 'prixUnitaireBudget' as const },
              ]).map(({ label, field }) => (
                <div key={field} className="flex flex-col gap-0.5">
                  <label className="text-foreground-subtle">{label}</label>
                  <input type="number" value={bu[field]} className={INPUT_NUM_CLS}
                    onChange={(e) => patchBU(i, { [field]: Number(e.target.value) })} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Paramètres DCF */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-foreground">Paramètres DCF & WACC</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <FormField label="Taux sans risque" id="rf" value={data.parametres.tauxSansRisque * 100}
            onChange={(v) => patchParametres({ tauxSansRisque: v / 100 })} unit="%" step={0.1}
            hint="OAT 10 ans ou équivalent (ex : 3.2 %)" />
          <FormField label="Prime de risque marché" id="prm" value={data.parametres.primeRisqueMarche * 100}
            onChange={(v) => patchParametres({ primeRisqueMarche: v / 100 })} unit="%" step={0.1} />
          <FormField label="Bêta" id="beta" value={data.parametres.beta}
            onChange={(v) => patchParametres({ beta: v })} step={0.05}
            hint="Bêta désendetté redendetté du secteur" />
          <FormField label="Taux croissance terminale" id="g" value={data.parametres.tauxCroissanceTerminale * 100}
            onChange={(v) => patchParametres({ tauxCroissanceTerminale: v / 100 })} unit="%" step={0.1} />
          <FormField label="Taux IS" id="tis" value={data.parametres.tauxIS * 100}
            onChange={(v) => patchParametres({ tauxIS: v / 100 })} unit="%" step={0.5} />
          <FormField label="Horizon projection" id="horizon" value={data.parametres.horizonProjection}
            onChange={(v) => patchParametres({ horizonProjection: v })} unit="années" step={1} min={1} />
          <FormField label="Croissance CA (projections)" id="gca" value={data.parametres.tauxCroissanceCA * 100}
            onChange={(v) => patchParametres({ tauxCroissanceCA: v / 100 })} unit="%" step={0.5} />
        </div>
      </div>

      {/* Benchmark sectoriel */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-foreground">Benchmark sectoriel (médiane)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <FormField label="Liquidité générale (médiane)" id="bLG" value={data.parametres.benchmarkSecteur.liquiditeGenerale}
            onChange={(v) => patchBenchmark({ liquiditeGenerale: v })} step={0.1} />
          <FormField label="Marge EBITDA (médiane)" id="bEB" value={data.parametres.benchmarkSecteur.margeEBITDA * 100}
            onChange={(v) => patchBenchmark({ margeEBITDA: v / 100 })} unit="%" step={0.5} />
          <FormField label="ROE (médiane)" id="bROE" value={data.parametres.benchmarkSecteur.roe * 100}
            onChange={(v) => patchBenchmark({ roe: v / 100 })} unit="%" step={0.5} />
          <FormField label="DSO (médiane)" id="bDSO" value={data.parametres.benchmarkSecteur.dso}
            onChange={(v) => patchBenchmark({ dso: v })} unit="jours" step={1} />
          <FormField label="Ratio endettement (médiane)" id="bDE" value={data.parametres.benchmarkSecteur.ratioEndettement}
            onChange={(v) => patchBenchmark({ ratioEndettement: v })} step={0.05} />
          <FormField label="Altman Z (médiane)" id="bZ" value={data.parametres.benchmarkSecteur.altmanZScore}
            onChange={(v) => patchBenchmark({ altmanZScore: v })} step={0.1} />
        </div>
      </div>
    </div>
  );

  const stepContent: Record<number, React.ReactNode> = {
    1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6,
  };

  /* ═════════════════════════════════════════════ Results helpers ══ */
  function generateInterpretation(): string {
    if (!resultats) return 'Calcul non disponible.';
    const r = resultats.ratios;
    const sc = resultats.scoring;
    const dcf = resultats.dcf;
    const ca = data.cpc.chiffreAffaires[last] ?? 0;
    const ebitdaPct = r.margeEBITDA[last] ?? 0;
    const rn = data.cpc.chiffreAffaires[last];
    const parts: string[] = [];
    parts.push(
      `${data.identite.raisonSociale} affiche un score de santé financière de ${fmt(sc.scoreTotal, 0)}/150 ` +
      `(${sc.notation.replace(/[🟢🟠🔴]/g, '').trim()}). ` +
      `L'Altman Z-Score est de ${fmt(sc.zScore, 2)} (${sc.zScoreInterpretation}).`
    );
    parts.push(
      `Le chiffre d'affaires 2025 s'élève à ${fmtM(ca)}, avec une marge EBITDA de ${fmtPct(ebitdaPct)}. ` +
      `La liquidité générale (${fmt(r.liquiditeGenerale[last] ?? 0, 2)}) ` +
      `${(r.liquiditeGenerale[last] ?? 0) >= data.parametres.benchmarkSecteur.liquiditeGenerale ? 'dépasse' : 'est en-dessous de'} le benchmark sectoriel (${fmt(data.parametres.benchmarkSecteur.liquiditeGenerale, 1)}).`
    );
    parts.push(
      `La valorisation DCF (WACC ${fmtPct(dcf.wacc)}) ressort à ${fmtM(dcf.equityValue)} (Equity Value), ` +
      `pour une Enterprise Value de ${fmtM(dcf.enterpriseValue)}.`
    );
    return parts.join(' ');
  }

  /* ═══════════════════════════════════════════════════ Render ══ */
  return (
    <div className="flex flex-col min-h-svh bg-background">

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="badge badge-neutral">Module 3 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">

        {/* ══ PART A — Éditoriale ══════════════════════════════════════════ */}
        <section className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 3 sur 8</span>
            <h1 className="text-foreground">Analyse Financière d&apos;Entreprise</h1>
            <p className="text-foreground-muted max-w-2xl" style={{ fontSize: 'var(--text-lg)' }}>
              Analyse complète sur 4 exercices : ratios de liquidité, solvabilité, rentabilité, cycle d&apos;exploitation,
              scoring Altman, valorisation DCF et tableau de bord benchmark sectoriel.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: TrendingUp, title: 'Ratios & SIG', detail: 'Liquidité générale, réduite, immédiate. BFR, FRNG, gearing. Marges EBITDA, nette, ROE, ROA, ROCE. Soldes intermédiaires de gestion (VA, EBE, RE, RN).' },
                { icon: BarChart2, title: 'Cycle d\'exploitation', detail: 'DIO, DSO, DPO et CCC sur 4 ans. Seuil de rentabilité, point mort en jours. Analyse de la rotation des actifs et des stocks.' },
                { icon: Activity, title: 'Scoring & Altman', detail: 'Score /150 (liquidité 30 + solvabilité 30 + rentabilité 50 + efficience 40). Altman Z-Score avec interprétation et benchmark sectoriel.' },
                { icon: Layers, title: 'Valorisation DCF', detail: 'WACC par CAPM, projections FCFF sur horizon choisi, valeur terminale Gordon-Shapiro, Equity Value et matrice de sensibilité WACC × g.' },
              ].map(({ icon: Icon, title, detail }) => (
                <div key={title} className="card p-5 flex flex-col gap-3">
                  <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                    <p className="text-xs text-foreground-muted leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <p className="data-label">Indicateurs clés à surveiller</p>
            <ul className="flex flex-col gap-3">
              {[
                { title: 'Liquidité générale', detail: 'Ratio actif courant / passif courant. Seuil minimum 1,0 — en-dessous le risque de défaut à court terme est réel. Médiane sectorielle industrie : 1.8.' },
                { title: 'Altman Z-Score', detail: 'Score composite (5 ratios pondérés). Z > 3 : zone saine ; 1.8–3 : zone grise ; < 1.8 : risque de faillite élevé dans les 2 ans.' },
                { title: 'Marge EBITDA', detail: "Proxy de la génération de cash opérationnelle avant structure financière et fiscale. Industrie manufacturière : médiane 12 %, top quartile 18 %." },
                { title: 'WACC & DCF', detail: "Coût moyen pondéré du capital (Ke × CP/EV + Kd×(1-IS) × D/EV). Un WACC de 8–10 % est standard en industrie. La valeur terminale représente souvent 60–80 % de l'EV." },
              ].map(({ title, detail }) => (
                <li key={title} className="flex gap-3 items-start">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 mt-[7px]" />
                  <div>
                    <span className="text-sm font-semibold text-foreground">{title}</span>
                    <span className="text-sm text-foreground-muted"> — {detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ══ PART B — Wizard ══════════════════════════════════════════════ */}
        <section className="flex flex-col gap-4">
          <p className="data-label">Saisie des données</p>
          <div className="card-raised p-6 sm:p-8">
            <StepIndicator current={step} />

            <div className="mb-7">
              <h2 className="text-foreground" style={{ fontSize: 'var(--text-xl)' }}>
                Étape {step} — {STEP_LABELS[step - 1]}
              </h2>
            </div>

            {stepContent[step]}

            <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
              <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 1}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground-muted border border-border rounded-md hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>

              {step < STEP_LABELS.length ? (
                <button type="button" onClick={() => setStep((s) => s + 1)}
                  className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover transition-colors">
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={() => setSubmitted(true)}
                  className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover transition-colors">
                  <Play className="h-4 w-4" />
                  Lancer l&apos;analyse
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ══ PART C — Résultats ═══════════════════════════════════════════ */}
        {submitted && resultats && (
          <section className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <p className="data-label">Résultats de l&apos;analyse — {data.identite.raisonSociale}</p>
              <span className="badge badge-success">Analyse terminée</span>
            </div>

            {/* ── KPI Cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Score /150"
                value={`${fmt(resultats.scoring.scoreTotal, 0)} / 150`}
                badge={scoreBadge(resultats.scoring.scoreTotal)}
                sub={`${fmt(resultats.scoring.tauxAtteint * 100, 0)} % atteint`}
              />
              <KpiCard
                label="Altman Z-Score"
                value={fmt(resultats.scoring.zScore, 2)}
                badge={zBadge(resultats.scoring.zScore)}
                sub={resultats.scoring.zScoreInterpretation}
              />
              <KpiCard
                label={`EBITDA ${annees[last]}`}
                value={fmtM((resultats.ratios.sig.ebe[last] ?? 0))}
                badge={{ cls: (resultats.ratios.margeEBITDA[last] ?? 0) >= 0.1 ? 'badge badge-success' : 'badge badge-warning', label: `Marge ${fmtPct(resultats.ratios.margeEBITDA[last] ?? 0)}` }}
                sub={`CA ${fmtM(data.cpc.chiffreAffaires[last] ?? 0)}`}
              />
              <KpiCard
                label="Equity Value (DCF)"
                value={fmtM(resultats.dcf.equityValue)}
                badge={{ cls: 'badge badge-info', label: `WACC ${fmtPct(resultats.dcf.wacc)}` }}
                sub={`EV ${fmtM(resultats.dcf.enterpriseValue)}`}
              />
            </div>

            {/* ── Ratios de liquidité ───────────────────────────────────── */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Ratios de liquidité (4 exercices)</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={annees.map((a, i) => ({
                  année: a,
                  'Liquidité générale': resultats.ratios.liquiditeGenerale[i] ?? 0,
                  'Liquidité réduite':  resultats.ratios.liquiditeReduite[i] ?? 0,
                  'Liquidité immédiate':resultats.ratios.liquiditeImmediate[i] ?? 0,
                }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="année" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: ValueType | undefined, _n: NameType | undefined) => [Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 }), _n]} />
                  <Legend />
                  <Bar dataKey="Liquidité générale"  fill="var(--color-accent)" radius={[3,3,0,0]} />
                  <Bar dataKey="Liquidité réduite"   fill="var(--color-warning)" radius={[3,3,0,0]} />
                  <Bar dataKey="Liquidité immédiate" fill="var(--color-success)" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border text-center">
                {['Liquidité générale','Liquidité réduite','Liquidité immédiate'].map((k, ki) => {
                  const vals = [resultats.ratios.liquiditeGenerale, resultats.ratios.liquiditeReduite, resultats.ratios.liquiditeImmediate][ki];
                  return (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="data-label">{k} {annees[last]}</span>
                      <span className="tabnum font-bold text-lg text-foreground">{fmt(vals[last] ?? 0, 2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Structure financière ──────────────────────────────────── */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Structure financière</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={annees.map((a, i) => ({
                  année: a,
                  'BFR (M€)':  (resultats.ratios.bfr[i] ?? 0) / 1e6,
                  'FRNG (M€)': (resultats.ratios.frng[i] ?? 0) / 1e6,
                }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="année" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} M€`} />
                  <Tooltip formatter={(v: ValueType | undefined, _n: NameType | undefined) => [`${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M€`, _n]} />
                  <Legend />
                  <Bar dataKey="BFR (M€)"  fill="var(--color-accent)"  radius={[3,3,0,0]} />
                  <Bar dataKey="FRNG (M€)" fill="var(--color-success)" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border">
                {[
                  { label: 'BFR', val: resultats.ratios.bfr[last] ?? 0 },
                  { label: 'FRNG', val: resultats.ratios.frng[last] ?? 0 },
                  { label: 'Ratio endettement', val: resultats.ratios.ratioEndettement[last] ?? 0, pct: false, x: true },
                  { label: 'Autonomie financière', val: resultats.ratios.autonomieFinanciere[last] ?? 0, pct: false, x: true },
                ].map(({ label, val, x }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="data-label">{label}</span>
                    <span className="tabnum font-bold text-foreground">{x ? fmt(val, 2) : fmtM(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Rentabilité ───────────────────────────────────────────── */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Rentabilité (évolution sur 4 ans)</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={annees.map((a, i) => ({
                  année: a,
                  'ROE %':  ((resultats.ratios.roe[i] ?? 0) * 100),
                  'ROA %':  ((resultats.ratios.roa[i] ?? 0) * 100),
                  'ROCE %': ((resultats.ratios.roce[i] ?? 0) * 100),
                  'Marge EBITDA %': ((resultats.ratios.margeEBITDA[i] ?? 0) * 100),
                }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="année" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} %`} />
                  <Tooltip formatter={(v: ValueType | undefined, _n: NameType | undefined) => [`${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`, _n]} />
                  <Legend />
                  <Line type="monotone" dataKey="ROE %"          stroke="var(--color-accent)"  strokeWidth={2} dot />
                  <Line type="monotone" dataKey="ROA %"          stroke="var(--color-success)" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="ROCE %"         stroke="var(--color-warning)" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="Marge EBITDA %" stroke="var(--color-danger)"  strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border">
                {[
                  { label: 'ROE', val: resultats.ratios.roe[last] ?? 0 },
                  { label: 'ROA', val: resultats.ratios.roa[last] ?? 0 },
                  { label: 'ROCE', val: resultats.ratios.roce[last] ?? 0 },
                  { label: 'Marge nette', val: resultats.ratios.margeNette[last] ?? 0 },
                ].map(({ label, val }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="data-label">{label} {annees[last]}</span>
                    <span className={`tabnum font-bold text-lg ${val >= 0 ? 'text-success' : 'text-danger'}`}>{fmtPct(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Cycle d'exploitation ─────────────────────────────────── */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Cycle d&apos;exploitation — DIO / DSO / DPO / CCC (jours)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={annees.map((a, i) => ({
                  année: a,
                  'DIO': resultats.ratios.dio[i] ?? 0,
                  'DSO': resultats.ratios.dso[i] ?? 0,
                  'DPO': resultats.ratios.dpo[i] ?? 0,
                  'CCC': resultats.ratios.ccc[i] ?? 0,
                }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="année" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}j`} />
                  <Tooltip formatter={(v: ValueType | undefined, _n: NameType | undefined) => [`${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} j`, _n]} />
                  <Legend />
                  <Bar dataKey="DIO" fill="var(--color-accent)"  radius={[3,3,0,0]} />
                  <Bar dataKey="DSO" fill="var(--color-warning)" radius={[3,3,0,0]} />
                  <Bar dataKey="DPO" fill="var(--color-success)" radius={[3,3,0,0]} />
                  <Bar dataKey="CCC" fill="var(--color-danger)"  radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-4 gap-4 pt-2 border-t border-border text-center">
                {[
                  { label: 'DIO', val: resultats.ratios.dio[last] ?? 0 },
                  { label: 'DSO', val: resultats.ratios.dso[last] ?? 0 },
                  { label: 'DPO', val: resultats.ratios.dpo[last] ?? 0 },
                  { label: 'CCC', val: resultats.ratios.ccc[last] ?? 0 },
                ].map(({ label, val }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="data-label">{label}</span>
                    <span className="tabnum font-bold text-lg text-foreground">{fmt(val, 0)} j</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── SIG ──────────────────────────────────────────────────── */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Soldes Intermédiaires de Gestion (SIG) — {annees[last]}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 text-foreground-subtle font-medium">Solde</th>
                      {annees.map((a) => <th key={a} className="text-right py-2 px-3 text-foreground-subtle font-medium">{a}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Marge commerciale', key: 'margeCommerciale' as const },
                      { label: "Production de l'exercice", key: 'productionExercice' as const },
                      { label: 'Valeur ajoutée', key: 'valeurAjoutee' as const },
                      { label: 'EBE (EBITDA)', key: 'ebe' as const },
                      { label: "Résultat d'exploitation (EBIT)", key: 'resultatExploitation' as const },
                      { label: 'Résultat financier', key: 'resultatFinancier' as const },
                      { label: 'Résultat courant', key: 'resultatCourant' as const },
                      { label: 'Résultat exceptionnel', key: 'resultatExceptionnel' as const },
                      { label: 'Résultat net', key: 'resultatNet' as const },
                      { label: 'CAF', key: 'caf' as const },
                    ].map(({ label, key }) => {
                      const vals = resultats.ratios.sig[key];
                      return (
                        <tr key={key} className="border-b border-border/50 hover:bg-surface-raised/50">
                          <td className="py-2 pr-4 text-foreground-muted font-medium">{label}</td>
                          {annees.map((_, i) => {
                            const v = vals[i] ?? 0;
                            return (
                              <td key={i} className={`py-2 px-3 text-right tabnum font-semibold ${v >= 0 ? 'text-foreground' : 'text-danger'}`}>
                                {fmtM(v)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── TFT ──────────────────────────────────────────────────── */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Tableau de Flux de Trésorerie</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.tftHistorique.annees.map((a, i) => ({
                  année: a,
                  'Exploitation (M€)':    (resultats.tft.fluxExploitation[i] ?? 0) / 1e6,
                  'Investissement (M€)':  (resultats.tft.fluxInvestissement[i] ?? 0) / 1e6,
                  'Financement (M€)':     (resultats.tft.fluxFinancement[i] ?? 0) / 1e6,
                }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="année" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} M€`} />
                  <Tooltip formatter={(v: ValueType | undefined, _n: NameType | undefined) => [`${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M€`, _n]} />
                  <Legend />
                  <Bar dataKey="Exploitation (M€)"   fill="var(--color-success)" radius={[3,3,0,0]} />
                  <Bar dataKey="Investissement (M€)" fill="var(--color-danger)"  radius={[3,3,0,0]} />
                  <Bar dataKey="Financement (M€)"    fill="var(--color-accent)"  radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── DCF Valorisation ─────────────────────────────────────── */}
            <div className="card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="data-label">Valorisation DCF</p>
                <span className="badge badge-info">WACC {fmtPct(resultats.dcf.wacc)} · g {fmtPct(data.parametres.tauxCroissanceTerminale)}</span>
              </div>

              {/* Projection table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {['Année','CA (M€)','EBITDA (M€)','IS (M€)','CAPEX (M€)','ΔBFR (M€)','FCFF (M€)','FCFF act. (M€)'].map((h) => (
                        <th key={h} className="text-right py-2 px-2 text-foreground-subtle font-medium first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultats.dcf.projectionFCFF.map((row) => (
                      <tr key={row.annee} className="border-b border-border/50">
                        <td className="py-1.5 px-2 text-foreground-muted">N+{row.annee}</td>
                        {[row.ca, row.ebitda, row.impots, row.capex, row.deltaBFR, row.fcff, row.fcffActualise].map((v, ci) => (
                          <td key={ci} className={`py-1.5 px-2 text-right tabnum ${v < 0 ? 'text-danger' : 'text-foreground'}`}>
                            {(v / 1e6).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border">
                {[
                  { label: 'Somme flux actualisés', val: fmtM(resultats.dcf.sommeFluxActualises) },
                  { label: 'Valeur terminale act.', val: fmtM(resultats.dcf.vtActualisee) },
                  { label: 'Enterprise Value', val: fmtM(resultats.dcf.enterpriseValue) },
                  { label: 'Equity Value', val: fmtM(resultats.dcf.equityValue) },
                ].map(({ label, val }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="data-label">{label}</span>
                    <span className="tabnum font-bold text-foreground">{val}</span>
                  </div>
                ))}
              </div>

              {/* Sensitivity matrix */}
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-xs font-medium text-foreground-muted">Matrice de sensibilité Equity Value — WACC × g (M€)</p>
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="py-1 px-3 text-foreground-subtle">WACC \ g</th>
                        {resultats.dcf.tableSensibilite.gValues.map((g) => (
                          <th key={g} className="py-1 px-3 text-right text-foreground-subtle">{fmtPct(g)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultats.dcf.tableSensibilite.waccValues.map((w, wi) => (
                        <tr key={w} className="border-t border-border/50">
                          <td className="py-1 px-3 text-foreground-muted">{fmtPct(w)}</td>
                          {resultats.dcf.tableSensibilite.matrix[wi]?.map((cell, gi) => {
                            const isBase = Math.abs(w - resultats.dcf.wacc) < 0.005 && Math.abs(resultats.dcf.tableSensibilite.gValues[gi]! - data.parametres.tauxCroissanceTerminale) < 0.005;
                            return (
                              <td key={gi} className={`py-1 px-3 text-right tabnum ${isBase ? 'font-bold text-accent' : 'text-foreground'}`}>
                                {(cell / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── DuPont ───────────────────────────────────────────────── */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Décomposition DuPont — ROE = Marge nette × Rotation actifs × Levier</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Marge nette',     val: fmtPct(resultats.ratios.dupont.margeNette[last] ?? 0) },
                  { label: 'Rotation actifs', val: fmt(resultats.ratios.dupont.rotationActifs[last] ?? 0, 2) + '×' },
                  { label: 'Levier financier',val: fmt(resultats.ratios.dupont.levier[last] ?? 0, 2) + '×' },
                  { label: 'ROE (DuPont)',    val: fmtPct(resultats.ratios.dupont.roe[last] ?? 0) },
                ].map(({ label, val }, i, arr) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="card p-4 flex-1 flex flex-col gap-1">
                      <span className="data-label">{label}</span>
                      <span className="tabnum font-bold text-lg text-foreground">{val}</span>
                    </div>
                    {i < arr.length - 1 && <span className="text-foreground-subtle font-bold text-lg hidden sm:block">×</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Scoring détaillé ─────────────────────────────────────── */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Scoring détaillé /150</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Liquidité',   val: resultats.scoring.scoreLiquidite,   max: 30, cls: 'text-accent' },
                  { label: 'Solvabilité', val: resultats.scoring.scoreSolvabilite,  max: 30, cls: 'text-warning' },
                  { label: 'Rentabilité', val: resultats.scoring.scoreRentabilite,  max: 50, cls: 'text-success' },
                  { label: 'Efficience',  val: resultats.scoring.scoreEfficience,   max: 40, cls: 'text-danger' },
                ].map(({ label, val, max, cls }) => (
                  <div key={label} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="data-label">{label}</span>
                      <span className={`tabnum font-bold ${cls}`}>{fmt(val, 0)}<span className="text-foreground-subtle font-normal">/{max}</span></span>
                    </div>
                    <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cls.replace('text-', 'bg-')}`}
                        style={{ width: `${Math.min((val / max) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-border flex items-center gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="data-label">Score total</span>
                  <span className="tabnum font-bold text-2xl text-foreground">{fmt(resultats.scoring.scoreTotal, 0)} / 150</span>
                </div>
                <span className={scoreBadge(resultats.scoring.scoreTotal).cls}>{scoreBadge(resultats.scoring.scoreTotal).label}</span>
              </div>
            </div>

            {/* ── Benchmark ────────────────────────────────────────────── */}
            {resultats.benchmark.comparaisons.length > 0 && (
              <div className="card p-6 flex flex-col gap-4">
                <p className="data-label">Benchmark sectoriel</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        {['Ratio','Entreprise','Médiane','Q3','Position','Analyse'].map((h) => (
                          <th key={h} className="text-left py-2 px-3 text-foreground-subtle font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultats.benchmark.comparaisons.map((c, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-surface-raised/50">
                          <td className="py-2 px-3 font-medium text-foreground">{c.ratio}</td>
                          <td className="py-2 px-3 tabnum text-foreground">{c.valeurEntreprise.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                          <td className="py-2 px-3 tabnum text-foreground-muted">{c.medianeSecteur.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                          <td className="py-2 px-3 tabnum text-foreground-muted">{c.quartileSuperieur.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                          <td className="py-2 px-3 text-xs">{c.position}</td>
                          <td className="py-2 px-3 text-xs text-foreground-muted">{c.analyse}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Interprétation ───────────────────────────────────────── */}
            <div className="card p-6 flex flex-col gap-3">
              <p className="data-label">Interprétation synthétique</p>
              <p className="text-sm text-foreground-muted leading-relaxed">
                {generateInterpretation()}
              </p>
              <p className="text-xs text-foreground-subtle leading-relaxed border-t border-border pt-3 mt-1">
                Ce module est un outil d&apos;aide à la décision. Les calculs suivent les normes comptables françaises (plan OHADA/PCG).
                Le DCF repose sur des projections linéaires et un WACC CAPM — consulter un expert pour tout dossier de financement ou cession.
                L&apos;Altman Z-Score a été développé pour les entreprises manufacturières cotées ; interpréter avec précaution pour d&apos;autres secteurs.
              </p>
            </div>

            {/* Reset */}
            <div className="flex justify-end">
              <button type="button"
                onClick={() => { setSubmitted(false); setStep(1); setData(getDefaults()); }}
                className="text-sm text-foreground-subtle hover:text-foreground-muted transition-colors underline underline-offset-4">
                Réinitialiser l&apos;analyse
              </button>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
