"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, TrendingUp, Layers, Zap,
  ChevronRight, ChevronLeft, Play, Loader2,
} from "lucide-react";
import { calculateMA } from "@/lib/api-client";
import type { MAApiInput, MAApiOutput } from "@/lib/types/ma";

/* ═══════════════════════════════════════════════════════════════ Types ══ */

type Secteur = "Technologie" | "Industrie" | "Santé" | "Finance" | "Consommation" | "Énergie";

interface FormData {
  /* Step 1 — Cible */
  caCible: number;         // K€ chiffre d'affaires
  ebitdaCible: number;     // K€ EBITDA
  rnCible: number;         // K€ résultat net
  detteNetteCible: number; // K€ dette nette de la cible
  veProposeee: number;     // K€ valeur d'entreprise proposée (offre)
  secteur: Secteur;
  /* Step 2 — Financement */
  pctDette: number;           // % financement par dette d'acquisition
  pctActions: number;         // % financement par émission d'actions
  tauxDette: number;          // % taux d'intérêt sur la dette d'acquisition
  nbActionsAcquereur: number; // millions d'actions de l'acquéreur
  rnAcquereur: number;        // K€ résultat net de l'acquéreur
  /* Step 3 — Synergies */
  synergiesRevenu: number;  // K€/an impact EBITDA des synergies commerciales
  synergiesCouts: number;   // K€/an économies de coûts
  delaiRealisation: number; // années pour atteindre 100 % des synergies
  coutIntegration: number;  // K€ coûts one-time d'intégration
}

interface Metrics {
  /* Valorisation */
  multipleEvEbitda: number;
  multipleEvCa: number;
  equityValue: number;
  prime: number; // % vs benchmark sectoriel EV/EBITDA
  /* Financement */
  montantDette: number;
  montantActions: number;
  montantCash: number;
  chargesInterets: number; // K€/an after-tax
  nouvellesActions: number; // millions
  bpaActuel: number;       // €
  bpaProForma: number;     // €
  accretion: number;       // %
  /* Synergies & retour */
  synergiesAnnuelles: number; // K€/an total brut
  vanSynergies: number;       // K€
  tri: number;               // %
  benchmarkEvEbitda: number;
  peSectoriel: number;
}

/* ══════════════════════════════════════════════════════════ Constants ══ */

const STEP_LABELS = ["Cible & valorisation", "Financement", "Synergies & retour"];

const SECTEURS: Secteur[] = [
  "Technologie", "Industrie", "Santé", "Finance", "Consommation", "Énergie",
];

/* Multiples sectoriels de référence (EV/EBITDA médian de marché, P/E implicite) */
const BENCHMARKS: Record<string, { evEbitda: number; pe: number }> = {
  "Technologie":  { evEbitda: 18, pe: 25 },
  "Industrie":    { evEbitda: 10, pe: 15 },
  "Santé":        { evEbitda: 14, pe: 20 },
  "Finance":      { evEbitda: 11, pe: 12 },
  "Consommation": { evEbitda: 11, pe: 18 },
  "Énergie":      { evEbitda:  8, pe: 10 },
};

const IS_RATE   = 0.25;
const WACC      = 0.08;
const HORIZON   = 10;  // ans pour VAN synergies
const SORTIE_AN = 5;   // horizon de sortie TRI

const defaultFormData: FormData = {
  caCible: 200_000,
  ebitdaCible: 30_000,
  rnCible: 12_000,
  detteNetteCible: 50_000,
  veProposeee: 300_000,
  secteur: "Industrie",
  pctDette: 40,
  pctActions: 20,
  tauxDette: 5,
  nbActionsAcquereur: 50,
  rnAcquereur: 25_000,
  synergiesRevenu: 5_000,
  synergiesCouts: 8_000,
  delaiRealisation: 3,
  coutIntegration: 15_000,
};

/* ═══════════════════════════════════════════════════════ Computations ══ */

function computeMetrics(d: FormData): Metrics {
  const bench = BENCHMARKS[d.secteur] ?? BENCHMARKS["Industrie"];

  /* ── Valorisation ─────────────────────────────────────────────── */
  const multipleEvEbitda = d.ebitdaCible > 0 ? d.veProposeee / d.ebitdaCible : 0;
  const multipleEvCa     = d.caCible     > 0 ? d.veProposeee / d.caCible     : 0;
  const equityValue      = d.veProposeee - d.detteNetteCible;
  const prime            = bench.evEbitda > 0
    ? ((multipleEvEbitda - bench.evEbitda) / bench.evEbitda) * 100
    : 0;

  /* ── Financement ──────────────────────────────────────────────── */
  const pctCash      = Math.max(0, 100 - d.pctDette - d.pctActions);
  const montantDette   = d.veProposeee * d.pctDette   / 100;
  const montantActions = d.veProposeee * d.pctActions  / 100;
  const montantCash    = d.veProposeee * pctCash       / 100;

  /* Charge d'intérêts annuelle nette d'IS */
  const chargesInterets = montantDette * (d.tauxDette / 100) * (1 - IS_RATE);

  /* BPA actuel de l'acquéreur (€) */
  const bpaActuel = d.nbActionsAcquereur > 0
    ? (d.rnAcquereur * 1_000) / (d.nbActionsAcquereur * 1_000_000)
    : 0;

  /* Nouvelles actions émises — prix implicite = BPA × P/E sectoriel */
  const prixAction = bpaActuel * bench.pe;
  const nouvellesActions = prixAction > 0
    ? (montantActions * 1_000) / (prixAction * 1_000_000)  // M actions
    : 0;

  /* BPA pro forma */
  const benAdditionnel   = d.rnCible - chargesInterets;  // K€
  const totalBenefice    = d.rnAcquereur + benAdditionnel; // K€
  const totalActions     = d.nbActionsAcquereur + nouvellesActions; // M actions
  const bpaProForma      = totalActions > 0
    ? (totalBenefice * 1_000) / (totalActions * 1_000_000)
    : 0;
  const accretion        = bpaActuel > 0
    ? ((bpaProForma - bpaActuel) / bpaActuel) * 100
    : 0;

  /* ── Synergies & TRI ──────────────────────────────────────────── */
  const synergiesAnnuelles = d.synergiesRevenu + d.synergiesCouts; // K€/an brut

  /* VAN synergies sur HORIZON ans, après IS, avec ramping sur delaiRealisation */
  let vanSynergies = -d.coutIntegration;
  for (let t = 1; t <= HORIZON; t++) {
    const ramp    = d.delaiRealisation > 0 ? Math.min(t / d.delaiRealisation, 1) : 1;
    const flux    = ramp * synergiesAnnuelles * (1 - IS_RATE);
    vanSynergies += flux / Math.pow(1 + WACC, t);
  }

  /* TRI — sortie au même multiple EV/EBITDA sectoriel dans SORTIE_AN ans */
  const ebitdaTerminal   = d.ebitdaCible + synergiesAnnuelles; // synergies pleinement réalisées
  const veDesSortie      = ebitdaTerminal * bench.evEbitda;
  const detteInitiale    = d.detteNetteCible + montantDette;
  const detteResiduelle  = detteInitiale * 0.60; // hypothèse : 40 % remboursé sur 5 ans
  const equitySortie     = Math.max(0, veDesSortie - detteResiduelle);
  const equityInvestie   = montantActions + montantCash; // K€ apporté par l'acquéreur
  const tri = equityInvestie > 0 && equitySortie > 0
    ? (Math.pow(equitySortie / equityInvestie, 1 / SORTIE_AN) - 1) * 100
    : 0;

  return {
    multipleEvEbitda, multipleEvCa, equityValue, prime,
    montantDette, montantActions, montantCash, chargesInterets,
    nouvellesActions, bpaActuel, bpaProForma, accretion,
    synergiesAnnuelles, vanSynergies, tri,
    benchmarkEvEbitda: bench.evEbitda,
    peSectoriel: bench.pe,
  };
}

function fmtKE(ke: number): string {
  if (Math.abs(ke) >= 1_000)
    return (ke / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M€";
  return Math.round(ke).toLocaleString("fr-FR") + " K€";
}

function fmtPct(pct: number, dec = 1): string {
  return pct.toLocaleString("fr-FR", { maximumFractionDigits: dec }) + " %";
}

function fmtX(v: number, dec = 1): string {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: dec }) + "×";
}

type BadgeResult = { cls: string; label: string };

function multipleBadge(multiple: number, bench: number): BadgeResult {
  if (multiple <= bench)        return { cls: "badge badge-success", label: "Raisonnable" };
  if (multiple <= bench * 1.30) return { cls: "badge badge-warning", label: "Tendu" };
  return { cls: "badge badge-danger", label: "Élevé" };
}

function accretionBadge(pct: number): BadgeResult {
  if (pct > 0)   return { cls: "badge badge-success", label: "Accrétif" };
  if (pct >= -5) return { cls: "badge badge-warning", label: "Légèrement dilutif" };
  return { cls: "badge badge-danger", label: "Dilutif" };
}

function triBadge(tri: number): BadgeResult {
  if (tri > 15) return { cls: "badge badge-success", label: "Attractive" };
  if (tri > 10) return { cls: "badge badge-warning", label: "Modérée" };
  return { cls: "badge badge-danger", label: "Faible" };
}

function vanBadge(van: number): BadgeResult {
  if (van > 0) return { cls: "badge badge-success", label: "Positive" };
  return { cls: "badge badge-danger", label: "Négative" };
}

function generateInterpretation(m: Metrics, d: FormData): string {
  const parts: string[] = [];

  /* Valorisation */
  const primeSign = m.prime >= 0 ? "+" : "";
  parts.push(
    `La cible est valorisée à ${fmtX(m.multipleEvEbitda)} l'EBITDA (EV/CA : ${fmtX(m.multipleEvCa)}), ` +
    `soit une prime de ${primeSign}${fmtPct(m.prime, 0)} vs le benchmark sectoriel ${d.secteur} ` +
    `(${fmtX(m.benchmarkEvEbitda, 0)} EV/EBITDA médian). ` +
    `La valeur des fonds propres (Equity Value) s'établit à ${fmtKE(m.equityValue)}.`
  );

  /* Financement & accrétion */
  const accSign = m.accretion >= 0 ? "+" : "";
  parts.push(
    `Le financement (${d.pctDette} % dette / ${d.pctActions} % actions / ${Math.max(0, 100 - d.pctDette - d.pctActions)} % cash) ` +
    `génère une charge d'intérêts nette de ${fmtKE(m.chargesInterets)}/an. ` +
    `Le BPA de l'acquéreur passe de ${m.bpaActuel.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € ` +
    `à ${m.bpaProForma.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € pro forma ` +
    `(${accSign}${fmtPct(m.accretion)} — ${m.accretion >= 0 ? "accrétif" : "dilutif"}).`
  );

  /* Synergies & TRI */
  parts.push(
    `Les synergies totales atteignent ${fmtKE(m.synergiesAnnuelles)}/an (réalisées en ${d.delaiRealisation} ans), ` +
    `pour une VAN sur 10 ans de ${fmtKE(m.vanSynergies)} (nette des coûts d'intégration de ${fmtKE(d.coutIntegration)}). ` +
    `Le TRI estimé sur ${SORTIE_AN} ans (sortie au multiple sectoriel ${fmtX(m.benchmarkEvEbitda, 0)}) est de ${fmtPct(m.tri)}.`
  );

  return parts.join(" ");
}

/* ════════════════════════════════════════════════════ Sub-components ══ */

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex mb-8">
      {STEP_LABELS.map((label, i) => {
        const step      = i + 1;
        const isCompleted = step < current;
        const isCurrent   = step === current;
        const isLast      = step === STEP_LABELS.length;
        return (
          <div key={step} className={`flex flex-col ${!isLast ? "flex-1" : ""}`}>
            <div className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  isCompleted
                    ? "bg-success text-white"
                    : isCurrent
                    ? "bg-accent text-white"
                    : "bg-surface-raised border border-border text-foreground-subtle"
                }`}
              >
                {isCompleted ? "✓" : step}
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-px ml-2 transition-colors ${
                    step < current ? "bg-success" : "bg-border"
                  }`}
                />
              )}
            </div>
            <span
              className={`text-xs mt-1.5 hidden sm:block whitespace-nowrap ${
                isCurrent ? "text-foreground font-medium" : "text-foreground-subtle"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const INPUT_CLS =
  "w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border-strong transition-colors";

function FormField({
  label, id, value, onChange, unit, hint, step: stepProp, min,
}: {
  label: string; id: string; value: number;
  onChange: (val: number) => void; unit?: string; hint?: string; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {unit && <span className="ml-1 text-xs font-normal text-foreground-subtle">({unit})</span>}
      </label>
      <input
        id={id}
        type="number"
        min={min ?? 0}
        step={stepProp ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={INPUT_CLS}
      />
      {hint && <p className="text-xs text-foreground-subtle leading-relaxed">{hint}</p>}
    </div>
  );
}

function ResultCard({ label, value, badge, sub }: {
  label: string; value: string; badge: BadgeResult; sub?: string;
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

/* ═══════════════════════════════════════════════════════════════ Page ══ */

export default function MaSimulatorPage() {
  const [currentStep, setCurrentStep]   = useState(1);
  const [formData, setFormData]         = useState<FormData>(defaultFormData);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [apiResult, setApiResult]       = useState<MAApiOutput | null>(null);
  const [loading, setLoading]           = useState(false);
  const [apiError, setApiError]         = useState<string | null>(null);

  function update(patch: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  /** Local metrics — always computed, serves as fallback & source of rich KPIs. */
  const metrics = computeMetrics(formData);

  /** Map the rich frontend form to the simplified backend payload. */
  function buildApiPayload(): MAApiInput {
    const ebitdaMargin = formData.caCible > 0
      ? formData.ebitdaCible / formData.caCible
      : 0;
    const entryMultiple = formData.ebitdaCible > 0
      ? formData.veProposeee / formData.ebitdaCible
      : 0;
    const benchEv = (BENCHMARKS[formData.secteur] ?? BENCHMARKS["Industrie"]).evEbitda;
    const premiumPct = benchEv > 0
      ? Math.max(0, (entryMultiple - benchEv) / benchEv)
      : 0;

    return {
      targetRevenue: formData.caCible,
      targetEbitdaMargin: ebitdaMargin,
      entryMultiple,
      netDebt: formData.detteNetteCible,
      synergyAmount: formData.synergiesRevenu + formData.synergiesCouts,
      purchasePremiumPct: premiumPct,
    };
  }

  async function handleSubmit() {
    setHasSubmitted(true);
    setLoading(true);
    setApiError(null);
    setApiResult(null);

    try {
      const result = await calculateMA(buildApiPayload());
      setApiResult(result);
    } catch {
      setApiError("API indisponible, affichage des calculs locaux temporaires.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Step content ───────────────────────────────────────────────────── */

  const stepContent: Record<number, React.ReactNode> = {

    /* ── Étape 1 — Cible & valorisation ─────────────────────────────── */
    1: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Renseignez les données financières de la cible et la valorisation proposée.
          La VE (Valeur d&apos;Entreprise) inclut la dette nette ; l&apos;Equity Value en est déduite.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Chiffre d'affaires" id="caCible" value={formData.caCible}
            onChange={(v) => update({ caCible: v })} unit="K€"
            hint="CA annuel de la cible (derniers comptes ou budget)."
          />
          <FormField
            label="EBITDA" id="ebitdaCible" value={formData.ebitdaCible}
            onChange={(v) => update({ ebitdaCible: v })} unit="K€"
            hint="Earnings Before Interest, Taxes, Depreciation & Amortization."
          />
          <FormField
            label="Résultat net" id="rnCible" value={formData.rnCible}
            onChange={(v) => update({ rnCible: v })} unit="K€"
            hint="Résultat net part du groupe — base de l'analyse accrétion/dilution."
          />
          <FormField
            label="Dette nette de la cible" id="detteNetteCible" value={formData.detteNetteCible}
            onChange={(v) => update({ detteNetteCible: v })} unit="K€"
            hint="Dette financière brute − trésorerie. Soustraite de la VE pour obtenir l'Equity Value."
          />
        </div>
        <FormField
          label="VE proposée (offre)" id="veProposeee" value={formData.veProposeee}
          onChange={(v) => update({ veProposeee: v })} unit="K€"
          hint="Valorisation totale offerte — Enterprise Value (avant ajustement de la dette)."
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="secteur" className="text-sm font-medium text-foreground">Secteur</label>
          <select
            id="secteur"
            value={formData.secteur}
            onChange={(e) => update({ secteur: e.target.value as Secteur })}
            className={INPUT_CLS}
          >
            {SECTEURS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-xs text-foreground-subtle">
            Détermine le multiple EV/EBITDA de référence pour calibrer la prime payée
            et le multiple de sortie du TRI.
          </p>
        </div>

        {/* Live preview valorisation */}
        {formData.ebitdaCible > 0 && (
          <div className="flex flex-wrap gap-6 p-4 bg-surface-raised border border-border rounded-md">
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Multiple EV/EBITDA</span>
              <span className="tabnum text-sm font-semibold text-foreground">
                {fmtX(metrics.multipleEvEbitda)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Benchmark sectoriel</span>
              <span className="tabnum text-sm font-semibold text-foreground-muted">
                {fmtX(metrics.benchmarkEvEbitda, 0)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Prime vs marché</span>
              <span className={`tabnum text-sm font-semibold ${metrics.prime > 30 ? "text-danger" : metrics.prime > 0 ? "text-warning" : "text-success"}`}>
                {metrics.prime >= 0 ? "+" : ""}{fmtPct(metrics.prime, 0)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Equity Value</span>
              <span className="tabnum text-sm font-semibold text-foreground">
                {fmtKE(metrics.equityValue)}
              </span>
            </div>
          </div>
        )}
      </div>
    ),

    /* ── Étape 2 — Financement ───────────────────────────────────────── */
    2: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Définissez la structure de financement de l&apos;acquisition. La somme dette + actions
          ne doit pas dépasser 100 % (le solde est financé en cash). Le BPA pro forma mesure
          l&apos;impact sur le bénéfice par action de l&apos;acquéreur.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <FormField
            label="Part dette" id="pctDette" value={formData.pctDette}
            onChange={(v) => update({ pctDette: v })} unit="%" step={5}
            hint="% de la VE financé par endettement bancaire ou obligataire."
          />
          <FormField
            label="Part actions" id="pctActions" value={formData.pctActions}
            onChange={(v) => update({ pctActions: v })} unit="%" step={5}
            hint="% de la VE financé par émission de nouvelles actions de l'acquéreur."
          />
          <FormField
            label="Taux dette" id="tauxDette" value={formData.tauxDette}
            onChange={(v) => update({ tauxDette: v })} unit="%" step={0.25}
            hint="Taux d'intérêt annuel sur la dette d'acquisition."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Actions acquéreur (actuelles)" id="nbActionsAcquereur"
            value={formData.nbActionsAcquereur}
            onChange={(v) => update({ nbActionsAcquereur: v })} unit="M actions"
            hint="Nombre total d'actions en circulation avant l'opération."
          />
          <FormField
            label="Résultat net acquéreur" id="rnAcquereur" value={formData.rnAcquereur}
            onChange={(v) => update({ rnAcquereur: v })} unit="K€"
            hint="Résultat net annuel de l'acquéreur avant l'opération — base du BPA."
          />
        </div>

        {/* Live accrétion/dilution */}
        {formData.nbActionsAcquereur > 0 && formData.rnAcquereur > 0 && (
          <div className="flex flex-wrap gap-6 p-4 bg-surface-raised border border-border rounded-md">
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Montant dette acquis.</span>
              <span className="tabnum text-sm font-semibold text-foreground">{fmtKE(metrics.montantDette)}</span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Nouvelles actions</span>
              <span className="tabnum text-sm font-semibold text-foreground">
                {metrics.nouvellesActions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">BPA actuel</span>
              <span className="tabnum text-sm font-semibold text-foreground-muted">
                {metrics.bpaActuel.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">BPA pro forma</span>
              <span className={`tabnum text-sm font-semibold ${metrics.accretion >= 0 ? "text-success" : "text-danger"}`}>
                {metrics.bpaProForma.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                {" "}({metrics.accretion >= 0 ? "+" : ""}{fmtPct(metrics.accretion)})
              </span>
            </div>
          </div>
        )}
      </div>
    ),

    /* ── Étape 3 — Synergies & retour ────────────────────────────────── */
    3: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Les synergies sont valorisées en VAN sur 10 ans (WACC 8 %, IS 25 %, avec
          ramping progressif sur la durée de réalisation). Le TRI est calculé sur un horizon
          de 5 ans, avec sortie au multiple EV/EBITDA sectoriel.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Synergies revenus" id="synergiesRevenu" value={formData.synergiesRevenu}
            onChange={(v) => update({ synergiesRevenu: v })} unit="K€/an EBITDA"
            hint="Impact annuel sur l'EBITDA des synergies commerciales (cross-sell, pricing, nouveaux marchés)."
          />
          <FormField
            label="Synergies coûts" id="synergiesCouts" value={formData.synergiesCouts}
            onChange={(v) => update({ synergiesCouts: v })} unit="K€/an"
            hint="Économies annuelles (duplication fonctions, achats groupés, optimisation SI)."
          />
          <FormField
            label="Délai de réalisation" id="delaiRealisation" value={formData.delaiRealisation}
            onChange={(v) => update({ delaiRealisation: Math.max(1, v) })} unit="ans" step={1} min={1}
            hint="Nombre d'années pour atteindre 100 % des synergies (ramping linéaire)."
          />
          <FormField
            label="Coûts d'intégration" id="coutIntegration" value={formData.coutIntegration}
            onChange={(v) => update({ coutIntegration: v })} unit="K€"
            hint="Coûts one-time (restructuration, IT, redondances) à déduire de la VAN."
          />
        </div>

        {/* Aperçu synergies & TRI */}
        <div className="card p-4 flex flex-col gap-3">
          <p className="data-label">Aperçu synergies & retour</p>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Synergies totales / an</span>
              <span className="tabnum text-sm font-semibold text-success">
                {fmtKE(metrics.synergiesAnnuelles)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">VAN synergies (10 ans)</span>
              <span className={`tabnum text-sm font-semibold ${metrics.vanSynergies >= 0 ? "text-success" : "text-danger"}`}>
                {fmtKE(metrics.vanSynergies)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">TRI estimé (5 ans)</span>
              <span className={`tabnum text-sm font-semibold ${metrics.tri > 15 ? "text-success" : metrics.tri > 10 ? "text-warning" : "text-danger"}`}>
                {fmtPct(metrics.tri)}
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col min-h-svh bg-background">

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="badge badge-neutral">Module 5 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">

        {/* ══ PART A — Éditoriale ════════════════════════════════════════ */}
        <section className="flex flex-col gap-10">

          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 5 sur 8</span>
            <h1 className="text-foreground">Simulateur M&amp;A — Fusions &amp; Acquisitions</h1>
            <p className="text-foreground-muted max-w-2xl" style={{ fontSize: "var(--text-lg)" }}>
              Valorisez une cible d&apos;acquisition, simulez la structure de financement,
              calculez l&apos;accrétion/dilution BPA et estimez le TRI et la VAN des synergies.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: TrendingUp,
                  title: "Valorisation & Multiples",
                  detail: "Multiple EV/EBITDA et EV/CA vs benchmark sectoriel. Prime de contrôle, Equity Value déduite de la dette nette, analyse du prix payé.",
                },
                {
                  icon: Layers,
                  title: "Structure de financement",
                  detail: "Allocation dette / actions / cash, charge d'intérêts nette d'IS, dilution actionnariale et calcul de l'accrétion ou dilution du BPA pro forma.",
                },
                {
                  icon: Zap,
                  title: "Synergies & TRI",
                  detail: "VAN des synergies sur 10 ans (ramping progressif, WACC 8 %, IS 25 %). TRI sur 5 ans avec sortie au multiple sectoriel et amortissement partiel de la dette.",
                },
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
                {
                  title: "Multiple EV/EBITDA",
                  detail: "Principal multiple de valorisation en M&A. Benchmarks : Tech 15–20×, Industrie 8–12×, Santé 12–16×. Au-delà de 1,3× le médian sectoriel, la prime est considérée élevée.",
                },
                {
                  title: "Accrétion/Dilution BPA",
                  detail: "Impact de l'opération sur le bénéfice par action de l'acquéreur, après prise en compte de la charge d'intérêts et des nouvelles actions émises. Une opération accrétive renforce le BPA.",
                },
                {
                  title: "TRI — Taux de Retour Interne",
                  detail: "Rendement annualisé de l'investissement sur 5 ans, calculé sur l'equity investie et la valeur de sortie estimée. Cible typique PE : > 20 % ; M&A stratégique : > 12 %.",
                },
                {
                  title: "VAN des synergies",
                  detail: "Valeur actuelle nette des synergies nettes d'IS sur 10 ans, nette des coûts d'intégration. Doit idéalement couvrir la prime payée au-dessus du benchmark pour que l'opération crée de la valeur.",
                },
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

        {/* ══ PART B — Wizard ════════════════════════════════════════════ */}
        <section className="flex flex-col gap-4">
          <p className="data-label">Saisie des données</p>

          <div className="card-raised p-6 sm:p-8">
            <StepIndicator current={currentStep} />

            <div className="mb-7">
              <h2 className="text-foreground" style={{ fontSize: "var(--text-xl)" }}>
                Étape {currentStep} — {STEP_LABELS[currentStep - 1]}
              </h2>
            </div>

            {stepContent[currentStep]}

            <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
              <button
                type="button"
                onClick={() => setCurrentStep((s) => s - 1)}
                disabled={currentStep === 1}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground-muted border border-border rounded-md hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>

              {currentStep < STEP_LABELS.length ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => s + 1)}
                  className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover transition-colors"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {loading ? "Analyse en cours…" : "Lancer l\u2019analyse"}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ══ PART C — Résultats ═════════════════════════════════════════ */}
        {hasSubmitted && !loading && (
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <p className="data-label">Résultats de l&apos;analyse</p>
              <div className="flex items-center gap-2">
                {apiResult && (
                  <span className="badge badge-success">API connectée</span>
                )}
                {apiError && (
                  <span className="badge badge-warning">{apiError}</span>
                )}
                <span className="badge badge-success">Analyse terminée</span>
              </div>
            </div>

            {/* 4 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ResultCard
                label="Multiple EV/EBITDA"
                value={fmtX(metrics.multipleEvEbitda)}
                badge={multipleBadge(metrics.multipleEvEbitda, metrics.benchmarkEvEbitda)}
                sub={`ref. ${fmtX(metrics.benchmarkEvEbitda, 0)} (${formData.secteur})`}
              />
              <ResultCard
                label="Accrétion BPA"
                value={`${metrics.accretion >= 0 ? "+" : ""}${fmtPct(metrics.accretion)}`}
                badge={accretionBadge(metrics.accretion)}
                sub={`${metrics.bpaActuel.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € → ${metrics.bpaProForma.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
              />
              <ResultCard
                label="TRI (5 ans)"
                value={fmtPct(metrics.tri)}
                badge={triBadge(metrics.tri)}
                sub={`sortie ${fmtX(metrics.benchmarkEvEbitda, 0)} EV/EBITDA`}
              />
              <ResultCard
                label="VAN synergies"
                value={fmtKE(metrics.vanSynergies)}
                badge={vanBadge(metrics.vanSynergies)}
                sub={`10 ans · WACC 8 %`}
              />
            </div>

            {/* Structure de financement */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Structure de financement de l&apos;acquisition</p>
              <div className="flex flex-col divide-y divide-border">
                {[
                  {
                    label: "Dette d'acquisition",
                    montant: metrics.montantDette,
                    pct: formData.pctDette,
                    cls: "text-danger",
                  },
                  {
                    label: "Émission d'actions",
                    montant: metrics.montantActions,
                    pct: formData.pctActions,
                    cls: "text-warning",
                  },
                  {
                    label: "Cash / trésorerie",
                    montant: metrics.montantCash,
                    pct: Math.max(0, 100 - formData.pctDette - formData.pctActions),
                    cls: "text-success",
                  },
                ].map(({ label, montant, pct, cls }) => (
                  <div key={label} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="text-sm font-medium text-foreground w-40">{label}</span>
                    <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cls.replace("text-", "bg-")}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex gap-4 ml-auto text-right">
                      <div className="flex flex-col">
                        <span className="text-xs text-foreground-subtle">Montant</span>
                        <span className={`tabnum text-sm font-semibold ${cls}`}>{fmtKE(montant)}</span>
                      </div>
                      <div className="flex flex-col w-10">
                        <span className="text-xs text-foreground-subtle">Part</span>
                        <span className="tabnum text-sm text-foreground">{fmtPct(pct, 0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-border flex flex-wrap gap-6 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="data-label">Equity Value cible</span>
                  <span className="tabnum font-semibold text-foreground">{fmtKE(metrics.equityValue)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="data-label">Charge intérêts (after-tax)</span>
                  <span className="tabnum font-semibold text-foreground">{fmtKE(metrics.chargesInterets)}/an</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="data-label">Nouvelles actions émises</span>
                  <span className="tabnum font-semibold text-foreground">
                    {metrics.nouvellesActions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M
                    {" "}(+{fmtPct(formData.nbActionsAcquereur > 0 ? (metrics.nouvellesActions / formData.nbActionsAcquereur) * 100 : 0, 1)})
                  </span>
                </div>
              </div>
            </div>

            {/* Synergies détail */}
            <div className="card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="data-label">Détail synergies</p>
                <span className="badge badge-info">Réalisation sur {formData.delaiRealisation} an{formData.delaiRealisation > 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">Synergies revenus</span>
                  <span className="tabnum text-xl font-bold text-success">{fmtKE(formData.synergiesRevenu)}/an</span>
                  <span className="text-xs text-foreground-subtle">EBITDA additionnel (cross-sell, pricing)</span>
                </div>
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">Synergies coûts</span>
                  <span className="tabnum text-xl font-bold text-success">{fmtKE(formData.synergiesCouts)}/an</span>
                  <span className="text-xs text-foreground-subtle">Économies opérationnelles</span>
                </div>
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">Coûts d&apos;intégration</span>
                  <span className="tabnum text-xl font-bold text-danger">−{fmtKE(formData.coutIntegration)}</span>
                  <span className="text-xs text-foreground-subtle">One-time (restructuration, IT)</span>
                </div>
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">VAN nette synergies</span>
                  <span className={`tabnum text-xl font-bold ${metrics.vanSynergies >= 0 ? "text-success" : "text-danger"}`}>
                    {fmtKE(metrics.vanSynergies)}
                  </span>
                  <span className="text-xs text-foreground-subtle">10 ans · WACC 8 % · IS 25 %</span>
                </div>
              </div>
            </div>

            {/* Interprétation */}
            <div className="card p-6 flex flex-col gap-3">
              <p className="data-label">Interprétation</p>
              <p className="text-sm text-foreground-muted leading-relaxed">
                {generateInterpretation(metrics, formData)}
              </p>
              <p className="text-xs text-foreground-subtle leading-relaxed border-t border-border pt-3 mt-1">
                Ce module est une approximation pédagogique des modèles M&amp;A. Le TRI repose sur
                un scénario de sortie au multiple médian sectoriel avec remboursement partiel de la dette (40 % sur 5 ans).
                La VAN des synergies utilise un WACC fixe de 8 %. L&apos;accrétion/dilution BPA est calculée
                sans amortissement du goodwill (IFRS 3 — test de dépréciation annuel). Consultez vos advisors
                M&amp;A pour tout projet réel.
              </p>
            </div>

            {/* Reset */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setHasSubmitted(false);
                  setCurrentStep(1);
                  setFormData(defaultFormData);
                  setApiResult(null);
                  setApiError(null);
                }}
                className="text-sm text-foreground-subtle hover:text-foreground-muted transition-colors underline underline-offset-4"
              >
                Réinitialiser l&apos;analyse
              </button>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
