"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, TrendingUp, Building2, Target,
  ChevronRight, ChevronLeft, Play,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════ Types ══ */

type Secteur =
  | "Industrie"
  | "Services"
  | "Distribution"
  | "Technologie"
  | "Construction"
  | "Santé"
  | "Finance";

interface FormData {
  /* Step 1 — Compte de résultat */
  ca: number;
  ebe: number;
  ebit: number;
  resultatNet: number;
  /* Step 2 — Bilan simplifié */
  totalActif: number;
  capitauxPropres: number;
  dettesFinancieres: number;
  bfr: number;
  tresorerie: number;
  /* Step 3 — Secteur & benchmarks */
  secteur: Secteur;
  croissanceCA: number;
  wacc: number;
}

interface Metrics {
  zScore: number;
  gearing: number;
  roe: number;
  eva: number;
  margeEbitda: number;
  bfrJours: number;
  netteFinanciere: number;
}

/* ══════════════════════════════════════════════════════════ Constants ══ */

const STEP_LABELS = ["Compte de résultat", "Bilan simplifié", "Secteur & benchmarks"];

const SECTEURS: Secteur[] = [
  "Industrie", "Services", "Distribution", "Technologie", "Construction", "Santé", "Finance",
];

const defaultFormData: FormData = {
  ca: 50_000,
  ebe: 8_000,
  ebit: 5_000,
  resultatNet: 3_000,
  totalActif: 40_000,
  capitauxPropres: 15_000,
  dettesFinancieres: 12_000,
  bfr: 6_000,
  tresorerie: 3_000,
  secteur: "Services",
  croissanceCA: 5,
  wacc: 8,
};

/* ═══════════════════════════════════════════════════════ Computations ══ */

const IS_RATE = 0.25; /* Taux IS France 2024 */

function computeMetrics(d: FormData): Metrics {
  /* Z-Score Altman Z'' — version entreprises non cotées (1995) */
  const x1 = d.totalActif > 0 ? d.bfr / d.totalActif : 0;
  const x2 = d.totalActif > 0 ? d.capitauxPropres / d.totalActif : 0;
  const x3 = d.totalActif > 0 ? d.ebit / d.totalActif : 0;
  const x4 = d.dettesFinancieres > 0 ? d.capitauxPropres / d.dettesFinancieres : 9.99;
  const zScore = 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4;

  /* Gearing = Dettes financières / Capitaux propres */
  const gearing = d.capitauxPropres > 0 ? (d.dettesFinancieres / d.capitauxPropres) * 100 : 0;

  /* ROE = Résultat net / Capitaux propres */
  const roe = d.capitauxPropres > 0 ? (d.resultatNet / d.capitauxPropres) * 100 : 0;

  /* EVA = EBIT × (1 − IS) − WACC × Capital investi */
  const capitalInvesti = d.capitauxPropres + d.dettesFinancieres;
  const eva = d.ebit * (1 - IS_RATE) - (d.wacc / 100) * capitalInvesti;

  /* Ratios complémentaires */
  const margeEbitda = d.ca > 0 ? (d.ebe / d.ca) * 100 : 0;
  const bfrJours = d.ca > 0 ? (d.bfr / d.ca) * 365 : 0;
  const netteFinanciere = d.dettesFinancieres - d.tresorerie;

  return { zScore, gearing, roe, eva, margeEbitda, bfrJours, netteFinanciere };
}

function fmtKE(ke: number): string {
  if (Math.abs(ke) >= 1_000)
    return (ke / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M€";
  return Math.round(ke).toLocaleString("fr-FR") + " K€";
}

function fmtPct(pct: number, dec = 1): string {
  return pct.toLocaleString("fr-FR", { maximumFractionDigits: dec }) + " %";
}

type BadgeResult = { cls: string; label: string };

function zScoreBadge(z: number): BadgeResult {
  if (z > 2.6) return { cls: "badge badge-success", label: "Zone sûre" };
  if (z > 1.1) return { cls: "badge badge-warning", label: "Zone grise" };
  return { cls: "badge badge-danger", label: "Zone de détresse" };
}

function gearingBadge(g: number): BadgeResult {
  if (g < 50)  return { cls: "badge badge-success", label: "Faible" };
  if (g < 100) return { cls: "badge badge-warning", label: "Modéré" };
  return { cls: "badge badge-danger", label: "Élevé" };
}

function roeBadge(roe: number): BadgeResult {
  if (roe > 15) return { cls: "badge badge-success", label: "Excellent" };
  if (roe > 8)  return { cls: "badge badge-warning", label: "Correct" };
  return { cls: "badge badge-danger", label: "Faible" };
}

function evaBadge(eva: number): BadgeResult {
  if (eva > 0) return { cls: "badge badge-success", label: "Valeur créée" };
  return { cls: "badge badge-danger", label: "Valeur détruite" };
}

function generateInterpretation(m: Metrics, d: FormData): string {
  const parts: string[] = [];

  /* Z-Score */
  if (m.zScore > 2.6) {
    parts.push(
      `Le Z-Score Altman de ${m.zScore.toFixed(2)} place l'entreprise en zone sûre (seuil > 2,6). ` +
      `Le risque de défaillance à 2 ans est estimé faible selon le modèle Z'' (entreprises non cotées).`
    );
  } else if (m.zScore > 1.1) {
    parts.push(
      `Le Z-Score de ${m.zScore.toFixed(2)} situe l'entreprise en zone grise (1,1–2,6). ` +
      `Une surveillance accrue de la liquidité et du levier est recommandée ; le modèle ne permet pas de conclure sur la solvabilité.`
    );
  } else {
    parts.push(
      `Le Z-Score de ${m.zScore.toFixed(2)} est en zone de détresse (< 1,1). ` +
      `Le modèle Altman Z'' signale un risque élevé de défaillance à horizon 2 ans. ` +
      `Un plan de restructuration financière doit être évalué sans délai.`
    );
  }

  /* Gearing & endettement */
  const netFin = m.netteFinanciere;
  const leverageEbitda = d.ebe > 0 ? netFin / d.ebe : 0;
  if (m.gearing > 100) {
    parts.push(
      `Le gearing de ${fmtPct(m.gearing)} témoigne d'un endettement supérieur aux capitaux propres. ` +
      `La dette nette de ${fmtKE(netFin)} représente ${leverageEbitda.toFixed(1)}× l'EBE — ` +
      `au-delà du seuil covenants habituel de 3×–4× pour ce type de structure.`
    );
  } else {
    parts.push(
      `Le gearing de ${fmtPct(m.gearing)} est ${m.gearing < 50 ? "faible" : "modéré"}. ` +
      `La dette nette de ${fmtKE(netFin)} représente ${leverageEbitda.toFixed(1)}× l'EBE, ` +
      `${leverageEbitda <= 3 ? "en ligne avec" : "légèrement au-dessus de"} les standards de marché.`
    );
  }

  /* ROE */
  parts.push(
    `Le ROE de ${fmtPct(m.roe)} ${m.roe > 15 ? "est excellent et surpasse le coût des fonds propres estimé." : m.roe > 8 ? "est satisfaisant mais pourrait être optimisé par un meilleur levier opérationnel." : "est en dessous du coût des fonds propres — la création de valeur pour l'actionnaire est insuffisante."}`
  );

  /* EVA */
  if (m.eva > 0) {
    parts.push(
      `L'EVA de ${fmtKE(m.eva)} est positive : le ROCE après IS (${fmtPct((d.ebit * (1 - IS_RATE)) / (d.capitauxPropres + d.dettesFinancieres) * 100)}) ` +
      `dépasse le WACC de ${fmtPct(d.wacc)}. L'entreprise crée de la valeur économique.`
    );
  } else {
    parts.push(
      `L'EVA de ${fmtKE(m.eva)} est négative : le rendement du capital investi après IS est inférieur ` +
      `au WACC de ${fmtPct(d.wacc)}. L'entreprise détruit de la valeur économique malgré un résultat net positif.`
    );
  }

  /* Opérationnel */
  parts.push(
    `Marge EBITDA : ${fmtPct(m.margeEbitda)} — BFR en jours : ${Math.round(m.bfrJours)} jours CA.`
  );

  return parts.join(" ");
}

/* ════════════════════════════════════════════════════ Sub-components ══ */

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex mb-8">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
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
  label, id, value, onChange, unit, hint,
}: {
  label: string; id: string; value: number;
  onChange: (val: number) => void; unit?: string; hint?: string;
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
    <div className="card p-5 flex flex-col gap-3">
      <span className="data-label">{label}</span>
      <span className="kpi-value tabnum" style={{ fontSize: "var(--text-2xl)" }}>{value}</span>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={badge.cls}>{badge.label}</span>
        {sub && <span className="text-xs text-foreground-subtle">{sub}</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ Page ══ */

export default function AnalyseEntreprisePage() {
  const [currentStep, setCurrentStep]   = useState(1);
  const [formData, setFormData]         = useState<FormData>(defaultFormData);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  function update(patch: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  const metrics = computeMetrics(formData);

  /* ── Step content ───────────────────────────────────────────────────── */

  const stepContent: Record<number, React.ReactNode> = {

    /* ── Étape 1 — Compte de résultat ───────────────────────────────── */
    1: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Saisissez les données du dernier exercice clos. Toutes les valeurs sont en K€.
          L&apos;EBE (EBITDA) et l&apos;EBIT servent au calcul du Z-Score et de l&apos;EVA.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Chiffre d'affaires" id="ca" value={formData.ca}
            onChange={(v) => update({ ca: v })} unit="K€"
          />
          <FormField
            label="EBE (EBITDA)" id="ebe" value={formData.ebe}
            onChange={(v) => update({ ebe: v })} unit="K€"
            hint="Excédent Brut d'Exploitation avant amortissements et provisions."
          />
          <FormField
            label="EBIT (Résultat d'exploitation)" id="ebit" value={formData.ebit}
            onChange={(v) => update({ ebit: v })} unit="K€"
            hint="Résultat avant intérêts et impôts. Utilisé pour le Z-Score X3 et l'EVA."
          />
          <FormField
            label="Résultat net" id="resultatNet" value={formData.resultatNet}
            onChange={(v) => update({ resultatNet: v })} unit="K€"
          />
        </div>

        {/* Live marge preview */}
        {formData.ca > 0 && (
          <div className="flex gap-6 p-4 bg-surface-raised border border-border rounded-md">
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Marge EBITDA</span>
              <span className="tabnum text-sm font-semibold text-foreground">
                {fmtPct((formData.ebe / formData.ca) * 100)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Marge EBIT</span>
              <span className="tabnum text-sm font-semibold text-foreground">
                {fmtPct((formData.ebit / formData.ca) * 100)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Marge nette</span>
              <span className="tabnum text-sm font-semibold text-foreground">
                {fmtPct((formData.resultatNet / formData.ca) * 100)}
              </span>
            </div>
          </div>
        )}
      </div>
    ),

    /* ── Étape 2 — Bilan simplifié ──────────────────────────────────── */
    2: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Saisissez les postes clés du bilan au 31/12. Le BFR et la trésorerie nette conditionnent
          le calcul du Z-Score et de la dette nette.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Total actif" id="totalActif" value={formData.totalActif}
            onChange={(v) => update({ totalActif: v })} unit="K€"
          />
          <FormField
            label="Capitaux propres" id="cp" value={formData.capitauxPropres}
            onChange={(v) => update({ capitauxPropres: v })} unit="K€"
          />
          <FormField
            label="Dettes financières" id="dettes" value={formData.dettesFinancieres}
            onChange={(v) => update({ dettesFinancieres: v })} unit="K€"
            hint="Emprunts bancaires + obligations + crédit-bail financier."
          />
          <FormField
            label="BFR" id="bfr" value={formData.bfr}
            onChange={(v) => update({ bfr: v })} unit="K€"
            hint="Besoin en Fonds de Roulement = Stocks + Créances − Dettes d'exploitation."
          />
          <FormField
            label="Trésorerie nette" id="treso" value={formData.tresorerie}
            onChange={(v) => update({ tresorerie: v })} unit="K€"
          />
        </div>

        {/* Live bilan preview */}
        <div className="flex gap-6 p-4 bg-surface-raised border border-border rounded-md flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className="data-label">Gearing</span>
            <span className="tabnum text-sm font-semibold text-foreground">
              {fmtPct(formData.capitauxPropres > 0
                ? (formData.dettesFinancieres / formData.capitauxPropres) * 100 : 0)}
            </span>
          </div>
          <div className="w-px bg-border" />
          <div className="flex flex-col gap-0.5">
            <span className="data-label">Dette nette</span>
            <span className="tabnum text-sm font-semibold text-foreground">
              {fmtKE(formData.dettesFinancieres - formData.tresorerie)}
            </span>
          </div>
          <div className="w-px bg-border" />
          <div className="flex flex-col gap-0.5">
            <span className="data-label">BFR en jours</span>
            <span className="tabnum text-sm font-semibold text-foreground">
              {formData.ca > 0 ? Math.round((formData.bfr / formData.ca) * 365) : "—"} j
            </span>
          </div>
        </div>
      </div>
    ),

    /* ── Étape 3 — Secteur & benchmarks ─────────────────────────────── */
    3: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Ces paramètres contextualisent l&apos;analyse et servent au calcul de l&apos;EVA.
          Le WACC est utilisé comme coût du capital investi.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="secteur" className="text-sm font-medium text-foreground">
            Secteur d&apos;activité
          </label>
          <select
            id="secteur"
            value={formData.secteur}
            onChange={(e) => update({ secteur: e.target.value as Secteur })}
            className={INPUT_CLS}
          >
            {SECTEURS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Croissance CA attendue" id="croissanceCA" value={formData.croissanceCA}
            onChange={(v) => update({ croissanceCA: v })} unit="%"
            hint="Taux de croissance organique du chiffre d'affaires sur N+1."
          />
          <FormField
            label="WACC estimé" id="wacc" value={formData.wacc}
            onChange={(v) => update({ wacc: v })} unit="%"
            hint="Coût moyen pondéré du capital. Sert à calculer l'EVA (Economic Value Added)."
          />
        </div>

        {/* EVA live preview */}
        <div className="card p-4 flex flex-col gap-2">
          <p className="data-label">Aperçu EVA</p>
          <p className="text-xs text-foreground-muted">
            EVA = EBIT × (1 − IS 25 %) − WACC × (CP + Dettes) ={" "}
            <span className="tabnum font-semibold text-foreground">
              {fmtKE(formData.ebit * 0.75 - (formData.wacc / 100) * (formData.capitauxPropres + formData.dettesFinancieres))}
            </span>
          </p>
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
          <span className="badge badge-neutral">Module 3 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">

        {/* ══ PART A — Éditoriale ════════════════════════════════════════ */}
        <section className="flex flex-col gap-10">

          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 3 sur 8</span>
            <h1 className="text-foreground">Analyse financière d&apos;entreprise</h1>
            <p className="text-foreground-muted max-w-2xl" style={{ fontSize: "var(--text-lg)" }}>
              Évaluez la solidité financière d&apos;une entreprise : solvabilité Altman, structure du
              capital, rentabilité des fonds propres et création de valeur économique.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: TrendingUp,
                  title: "Performance opérationnelle",
                  detail: "Marges EBITDA, EBIT et nette — évolution et benchmark sectoriel pour évaluer l'efficacité opérationnelle.",
                },
                {
                  icon: Building2,
                  title: "Structure financière",
                  detail: "Gearing, dette nette/EBITDA, BFR en jours — solidité du bilan et capacité de remboursement.",
                },
                {
                  icon: Target,
                  title: "Scoring & création de valeur",
                  detail: "Z-Score Altman Z'' (solvabilité), ROE (rentabilité fonds propres) et EVA (valeur économique ajoutée).",
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
                  title: "Z-Score Altman Z'' (non cotées)",
                  detail: "Modèle de prédiction de défaillance à 2 ans. Zone sûre > 2,6 — zone grise 1,1–2,6 — zone de détresse < 1,1. Intègre liquidité, solvabilité, profitabilité et structure du capital.",
                },
                {
                  title: "Ratio d'endettement (Gearing)",
                  detail: "Dettes financières / Capitaux propres. Mesure le levier financier. Au-delà de 100 %, les créanciers financent davantage l'actif que les actionnaires — risque de refinancement accru.",
                },
                {
                  title: "ROE — Return on Equity",
                  detail: "Résultat net / Capitaux propres. Mesure la rémunération de l'actionnaire. Un ROE supérieur au coût des fonds propres (typiquement 8–12 %) signale une création de valeur actionnariale.",
                },
                {
                  title: "EVA — Economic Value Added",
                  detail: "EBIT × (1 − IS) − WACC × Capital investi. Mesure la richesse créée au-delà du coût du capital. Une EVA positive signifie que le ROCE dépasse le WACC — l'entreprise crée de la valeur.",
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
                  onClick={() => setHasSubmitted(true)}
                  className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Lancer l&apos;analyse
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ══ PART C — Résultats ═════════════════════════════════════════ */}
        {hasSubmitted && (
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <p className="data-label">Résultats de l&apos;analyse</p>
              <span className="badge badge-success">Analyse terminée</span>
            </div>

            {/* 4 KPI cards — 2×2 on mobile, 4 colonnes sur desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <ResultCard
                label="Z-Score Altman Z''"
                value={metrics.zScore.toFixed(2)}
                badge={zScoreBadge(metrics.zScore)}
                sub="modèle non cotées"
              />
              <ResultCard
                label="Gearing"
                value={fmtPct(metrics.gearing, 0)}
                badge={gearingBadge(metrics.gearing)}
                sub="dettes / CP"
              />
              <ResultCard
                label="ROE"
                value={fmtPct(metrics.roe)}
                badge={roeBadge(metrics.roe)}
                sub="résultat / CP"
              />
              <ResultCard
                label="EVA"
                value={fmtKE(metrics.eva)}
                badge={evaBadge(metrics.eva)}
                sub={`WACC ${fmtPct(formData.wacc)}`}
              />
            </div>

            {/* Ratios complémentaires */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Ratios complémentaires</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
                {[
                  { label: "Marge EBITDA",         value: fmtPct(metrics.margeEbitda) },
                  { label: "Marge EBIT",            value: fmtPct(formData.ca > 0 ? (formData.ebit / formData.ca) * 100 : 0) },
                  { label: "Marge nette",           value: fmtPct(formData.ca > 0 ? (formData.resultatNet / formData.ca) * 100 : 0) },
                  { label: "BFR en jours",          value: `${Math.round(metrics.bfrJours)} j` },
                  { label: "Dette nette / EBITDA",  value: formData.ebe > 0 ? `${(metrics.netteFinanciere / formData.ebe).toFixed(1)}×` : "—" },
                  { label: "Autonomie financière",  value: fmtPct(formData.totalActif > 0 ? (formData.capitauxPropres / formData.totalActif) * 100 : 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="data-label">{label}</span>
                    <span className="tabnum text-base font-semibold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interprétation */}
            <div className="card p-6 flex flex-col gap-3">
              <p className="data-label">Interprétation</p>
              <p className="text-sm text-foreground-muted leading-relaxed">
                {generateInterpretation(metrics, formData)}
              </p>
              <p className="text-xs text-foreground-subtle leading-relaxed border-t border-border pt-3 mt-1">
                Le Z-Score Altman est un modèle statistique de prédiction — il ne se substitue pas à une
                analyse de crédit complète. Les seuils EVA et ROE sont indicatifs et dépendent du secteur,
                du cycle économique et des conditions de marché au moment de l&apos;analyse.
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
