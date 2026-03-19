"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, BarChart2, AlertTriangle, TrendingDown,
  ChevronRight, ChevronLeft, Play,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════ Types ══ */

type Secteur = "Corporate" | "PME" | "Immobilier résidentiel" | "Collectivités" | "Banques";

interface FormData {
  /* Step 1 — Profil portefeuille */
  nbCredits: number;
  encours: number;
  secteur: Secteur;
  cet1Actuel: number;
  /* Step 2 — Paramètres de risque */
  pdMoyen: number;
  lgdMoyen: number;
  ead: number;
  /* Step 3 — Stress test */
  pertePIB: number;
  hausseChomage: number;
}

interface Metrics {
  eclS1: number;
  eclS2: number;
  eclS3: number;
  eclTotal: number;
  rwa: number;
  riskWeight: number;
  cet1Capital: number;
  cet1ProForma: number;
  stressedEcl: number;
  stressedCet1: number;
  eadS1: number;
  eadS2: number;
  eadS3: number;
}

/* ══════════════════════════════════════════════════════════ Constants ══ */

const STEP_LABELS = ["Profil portefeuille", "Paramètres de risque", "Stress test"];

const SECTEURS: Secteur[] = [
  "Corporate", "PME", "Immobilier résidentiel", "Collectivités", "Banques",
];

/* Pondérations Bâle IV — approche standard (SA) */
const RISK_WEIGHTS: Record<string, number> = {
  "Corporate":               1.00,
  "PME":                     0.85,
  "Immobilier résidentiel":  0.35,
  "Collectivités":           0.20,
  "Banques":                 0.50,
};

/* Couleurs de stage — littérales pour Tailwind scanner */
const STAGE_DOT: Record<string, string> = {
  S1: "bg-success",
  S2: "bg-warning",
  S3: "bg-danger",
};

const defaultFormData: FormData = {
  nbCredits: 850,
  encours: 300_000,
  secteur: "Corporate",
  cet1Actuel: 15,
  pdMoyen: 1.5,
  lgdMoyen: 40,
  ead: 300_000,
  pertePIB: 3,
  hausseChomage: 4,
};

/* ═══════════════════════════════════════════════════════ Computations ══ */

/** Allocation EAD aux 3 stages IFRS 9 selon PD moyen (en %) */
function stageWeights(pd: number): [number, number, number] {
  if (pd <= 1)  return [0.88, 0.09, 0.03];
  if (pd <= 2)  return [0.78, 0.17, 0.05];
  if (pd <= 5)  return [0.60, 0.28, 0.12];
  if (pd <= 10) return [0.40, 0.40, 0.20];
  return              [0.20, 0.45, 0.35];
}

function computeEcl(pd: number, lgd: number, eadS1: number, eadS2: number, eadS3: number) {
  const eclS1 = pd * lgd * eadS1;
  const eclS2 = Math.min(pd * 3, 1) * lgd * eadS2;
  const eclS3 = lgd * eadS3;
  return { eclS1, eclS2, eclS3 };
}

function computeMetrics(d: FormData): Metrics {
  const pd  = d.pdMoyen  / 100;
  const lgd = d.lgdMoyen / 100;
  const ead = d.ead;

  /* Stage allocation */
  const [w1, w2, w3] = stageWeights(d.pdMoyen);
  const eadS1 = ead * w1;
  const eadS2 = ead * w2;
  const eadS3 = ead * w3;

  /* ECL scénario central */
  const { eclS1, eclS2, eclS3 } = computeEcl(pd, lgd, eadS1, eadS2, eadS3);
  const eclTotal = eclS1 + eclS2 + eclS3;

  /* RWA — Bâle IV SA */
  const riskWeight = RISK_WEIGHTS[d.secteur] ?? 1.0;
  const rwa = ead * riskWeight;

  /* CET1 pro forma */
  const cet1Capital = (d.cet1Actuel / 100) * rwa;
  const cet1ProForma = rwa > 0
    ? (Math.max(0, cet1Capital - eclTotal) / rwa) * 100
    : 0;

  /* Stress test — choc macro sur PD */
  const stressMult  = 1 + 0.25 * d.pertePIB + 0.10 * d.hausseChomage;
  const pdStressed  = Math.min(pd * stressMult, 1);
  const { eclS1: sS1, eclS2: sS2, eclS3: sS3 } = computeEcl(pdStressed, lgd, eadS1, eadS2, eadS3);
  const stressedEcl = sS1 + sS2 + sS3;
  const stressedCet1 = rwa > 0
    ? (Math.max(0, cet1Capital - stressedEcl) / rwa) * 100
    : 0;

  return {
    eclS1, eclS2, eclS3, eclTotal,
    rwa, riskWeight, cet1Capital,
    cet1ProForma, stressedEcl, stressedCet1,
    eadS1, eadS2, eadS3,
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

type BadgeResult = { cls: string; label: string };

function eclBadge(ecl: number, ead: number): BadgeResult {
  const ratio = ead > 0 ? ecl / ead : 0;
  if (ratio < 0.01) return { cls: "badge badge-success", label: "< 1 % EAD" };
  if (ratio < 0.03) return { cls: "badge badge-warning", label: "1–3 % EAD" };
  return { cls: "badge badge-danger", label: "> 3 % EAD" };
}

function cet1Badge(cet1: number): BadgeResult {
  if (cet1 > 13)   return { cls: "badge badge-success", label: "Bien capitalisé" };
  if (cet1 > 10.5) return { cls: "badge badge-warning", label: "Adéquat" };
  return { cls: "badge badge-danger", label: "Sous buffer SREP" };
}

function rwaBadge(rw: number): BadgeResult {
  if (rw <= 0.35) return { cls: "badge badge-success", label: "Faible pondération" };
  if (rw <= 0.85) return { cls: "badge badge-warning", label: "Pondération modérée" };
  return { cls: "badge badge-neutral", label: "Pondération pleine" };
}

function generateInterpretation(m: Metrics, d: FormData): string {
  const parts: string[] = [];

  /* ECL */
  const eclRatio = d.ead > 0 ? (m.eclTotal / d.ead) * 100 : 0;
  parts.push(
    `L'ECL total IFRS 9 est estimé à ${fmtKE(m.eclTotal)} (${fmtPct(eclRatio)} de l'EAD). ` +
    `Le stage 3 (créances en défaut) représente ${fmtKE(m.eclS3)}, soit ` +
    `${fmtPct(m.eclTotal > 0 ? (m.eclS3 / m.eclTotal) * 100 : 0)} du total — ` +
    `ce poste est piloté exclusivement par le LGD moyen de ${fmtPct(d.lgdMoyen)}.`
  );

  /* RWA & CET1 */
  if (m.cet1ProForma > 13) {
    parts.push(
      `Après provisionnement complet de l'ECL, le ratio CET1 pro forma s'établit à ` +
      `${fmtPct(m.cet1ProForma)} (vs ${fmtPct(d.cet1Actuel)} initial). ` +
      `L'exigence SREP typique se situe entre 10,5 % et 12,5 % — la banque reste bien capitalisée.`
    );
  } else if (m.cet1ProForma > 10.5) {
    parts.push(
      `Le CET1 pro forma de ${fmtPct(m.cet1ProForma)} reste au-dessus du seuil minimum ` +
      `combiné (P1 8 % + P2R + conservation buffer 2,5 %), mais la marge est réduite. ` +
      `Un renforcement des fonds propres peut être envisagé.`
    );
  } else {
    parts.push(
      `Le CET1 pro forma de ${fmtPct(m.cet1ProForma)} est en dessous du seuil SREP de 10,5 %. ` +
      `Une action corrective (recapitalisation, cession d'actifs, réduction du portefeuille) ` +
      `est requise.`
    );
  }

  /* Stress */
  const stressMult = 1 + 0.25 * d.pertePIB + 0.10 * d.hausseChomage;
  const eclDelta = m.stressedEcl - m.eclTotal;
  parts.push(
    `Le scénario adverse (PIB −${fmtPct(d.pertePIB)}, chômage +${d.hausseChomage} pp) ` +
    `amplifie la PD par un facteur ${stressMult.toFixed(2)}×. ` +
    `L'ECL stressé atteint ${fmtKE(m.stressedEcl)} (+${fmtKE(eclDelta)} vs central), ` +
    `ramenant le CET1 à ${fmtPct(m.stressedCet1)}.`
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
  label, id, value, onChange, unit, hint, step: stepProp,
}: {
  label: string; id: string; value: number;
  onChange: (val: number) => void; unit?: string; hint?: string; step?: number;
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
        min={0}
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

export default function CreditRiskPage() {
  const [currentStep, setCurrentStep]   = useState(1);
  const [formData, setFormData]         = useState<FormData>(defaultFormData);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  function update(patch: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  const metrics = computeMetrics(formData);

  /* ── Step content ───────────────────────────────────────────────────── */

  const stepContent: Record<number, React.ReactNode> = {

    /* ── Étape 1 — Profil portefeuille ──────────────────────────────── */
    1: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Décrivez le portefeuille de crédit à analyser. Le CET1 actuel sert de base pour
          le calcul de l&apos;impact pro forma du provisionnement IFRS 9.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Nombre de crédits" id="nbCredits" value={formData.nbCredits}
            onChange={(v) => update({ nbCredits: v })} unit="prêts"
          />
          <FormField
            label="Encours total" id="encours" value={formData.encours}
            onChange={(v) => update({ encours: v, ead: v })} unit="K€"
            hint="Capital restant dû agrégé du portefeuille."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="secteur" className="text-sm font-medium text-foreground">
            Classe d&apos;actifs / secteur
          </label>
          <select
            id="secteur"
            value={formData.secteur}
            onChange={(e) => update({ secteur: e.target.value as Secteur })}
            className={INPUT_CLS}
          >
            {SECTEURS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-xs text-foreground-subtle">
            Détermine la pondération RWA selon l&apos;approche standard Bâle IV (SA).
            {" "}Corporate : 100 % · PME : 85 % · Immo résidentiel : 35 % · Collectivités : 20 %.
          </p>
        </div>
        <FormField
          label="Ratio CET1 actuel" id="cet1Actuel" value={formData.cet1Actuel}
          onChange={(v) => update({ cet1Actuel: v })} unit="%" step={0.1}
          hint="Common Equity Tier 1 — ratio de solvabilité de la banque avant provisionnement additionnel."
        />
      </div>
    ),

    /* ── Étape 2 — Paramètres de risque ─────────────────────────────── */
    2: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Les paramètres PD, LGD et EAD servent à calculer l&apos;ECL (Expected Credit Loss)
          selon IFRS 9. La PD est utilisée pour allouer les expositions aux stages 1, 2 et 3.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <FormField
            label="PD moyen" id="pdMoyen" value={formData.pdMoyen}
            onChange={(v) => update({ pdMoyen: v })} unit="%" step={0.1}
            hint="Probabilité de défaut sur 12 mois, moyenne pondérée du portefeuille."
          />
          <FormField
            label="LGD moyen" id="lgdMoyen" value={formData.lgdMoyen}
            onChange={(v) => update({ lgdMoyen: v })} unit="%" step={1}
            hint="Loss Given Default — perte en cas de défaut après recouvrements. Standard IFRS 9 : 40–60 %."
          />
          <FormField
            label="EAD total" id="ead" value={formData.ead}
            onChange={(v) => update({ ead: v })} unit="K€"
            hint="Exposure at Default — encours à risque au moment du défaut."
          />
        </div>

        {/* Live ECL preview */}
        {formData.ead > 0 && (() => {
          const pd = formData.pdMoyen / 100;
          const lgd = formData.lgdMoyen / 100;
          const [w1, w2, w3] = stageWeights(formData.pdMoyen);
          const s1 = pd * lgd * formData.ead * w1;
          const s2 = Math.min(pd * 3, 1) * lgd * formData.ead * w2;
          const s3 = lgd * formData.ead * w3;
          return (
            <div className="flex flex-wrap gap-6 p-4 bg-surface-raised border border-border rounded-md">
              <div className="flex flex-col gap-0.5">
                <span className="data-label">ECL S1 (12 mois)</span>
                <span className="tabnum text-sm font-semibold text-success">{fmtKE(s1)}</span>
              </div>
              <div className="w-px bg-border" />
              <div className="flex flex-col gap-0.5">
                <span className="data-label">ECL S2 (lifetime)</span>
                <span className="tabnum text-sm font-semibold text-warning">{fmtKE(s2)}</span>
              </div>
              <div className="w-px bg-border" />
              <div className="flex flex-col gap-0.5">
                <span className="data-label">ECL S3 (défaut)</span>
                <span className="tabnum text-sm font-semibold text-danger">{fmtKE(s3)}</span>
              </div>
              <div className="w-px bg-border" />
              <div className="flex flex-col gap-0.5">
                <span className="data-label">ECL Total</span>
                <span className="tabnum text-sm font-semibold text-foreground">{fmtKE(s1 + s2 + s3)}</span>
              </div>
            </div>
          );
        })()}
      </div>
    ),

    /* ── Étape 3 — Stress test ───────────────────────────────────────── */
    3: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Le scénario adverse amplifie la probabilité de défaut via un modèle macro-crédit
          simplifié. La PD stressée = PD × (1 + 0,25 × |ΔPIB| + 0,10 × ΔChômage).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Perte PIB scénario adverse" id="pertePIB" value={formData.pertePIB}
            onChange={(v) => update({ pertePIB: v })} unit="%" step={0.5}
            hint="Recul du PIB réel en points. Ex : −3 % pour un scénario récession modérée."
          />
          <FormField
            label="Hausse du chômage" id="hausseChomage" value={formData.hausseChomage}
            onChange={(v) => update({ hausseChomage: v })} unit="pp" step={0.5}
            hint="Hausse du taux de chômage en points de pourcentage vs scénario central."
          />
        </div>

        {/* Stress preview */}
        <div className="card p-4 flex flex-col gap-3">
          <p className="data-label">Aperçu stress test</p>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Multiplicateur PD</span>
              <span className="tabnum text-sm font-semibold text-foreground">
                {(1 + 0.25 * formData.pertePIB + 0.10 * formData.hausseChomage).toFixed(2)}×
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">PD stressée</span>
              <span className="tabnum text-sm font-semibold text-danger">
                {fmtPct(
                  Math.min(
                    formData.pdMoyen * (1 + 0.25 * formData.pertePIB + 0.10 * formData.hausseChomage),
                    100
                  )
                )}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">ECL stressé estimé</span>
              <span className="tabnum text-sm font-semibold text-foreground">
                {fmtKE(metrics.stressedEcl)}
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
          <span className="badge badge-neutral">Module 4 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">

        {/* ══ PART A — Éditoriale ════════════════════════════════════════ */}
        <section className="flex flex-col gap-10">

          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 4 sur 8</span>
            <h1 className="text-foreground">Crédit Risk Bancaire — IFRS 9 / Bâle IV</h1>
            <p className="text-foreground-muted max-w-2xl" style={{ fontSize: "var(--text-lg)" }}>
              Calculez l&apos;ECL par stage IFRS 9, les RWA Bâle IV et l&apos;impact CET1 pro forma
              d&apos;un provisionnement complet, avec stress test macro-crédit intégré.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: BarChart2,
                  title: "ECL IFRS 9 par stage",
                  detail: "Stage 1 (12 mois), Stage 2 (lifetime — hausse significative du risque), Stage 3 (en défaut). Allocation selon PD moyen du portefeuille.",
                },
                {
                  icon: AlertTriangle,
                  title: "RWA & CET1 Bâle IV",
                  detail: "Actifs pondérés par le risque selon l'approche standard SA. Impact CET1 pro forma après provisionnement complet IFRS 9.",
                },
                {
                  icon: TrendingDown,
                  title: "Stress Test adverse",
                  detail: "Modèle macro-crédit : choc PIB + chômage → amplification de la PD → ECL stressé → CET1 en scénario adverse.",
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
                  title: "ECL — Expected Credit Loss (IFRS 9)",
                  detail: "Perte attendue sur créances. Stage 1 : PD 12 mois × LGD × EAD. Stage 2 : PD lifetime (≈3×) × LGD × EAD. Stage 3 : LGD × EAD (défaut avéré). Doit figurer en provision au bilan.",
                },
                {
                  title: "RWA — Risk-Weighted Assets (Bâle IV SA)",
                  detail: "Base de calcul des exigences en fonds propres. Approche standard : EAD × pondération de risque réglementaire. Corporate 100 %, PME 85 %, Immo résidentiel 35 %, Collectivités 20 %.",
                },
                {
                  title: "Ratio CET1 pro forma",
                  detail: "CET1 après provisionnement additionnel IFRS 9. Seuil réglementaire combiné Bâle IV : 8 % (P1) + P2R individuel + buffer conservation 2,5 %. Les banques systémiques (O-SII) sont soumises à des buffers additionnels.",
                },
                {
                  title: "ECL stressé — scénario adverse BCE/EBA",
                  detail: "Simulation de l'ECL sous choc macro. Les stress tests EBA 2025 utilisent des scénarios de perte PIB de −3 % à −6 % et hausse du chômage de +4 à +8 pp selon les pays.",
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

            {/* 3 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ResultCard
                label="ECL total IFRS 9"
                value={fmtKE(metrics.eclTotal)}
                badge={eclBadge(metrics.eclTotal, formData.ead)}
                sub={fmtPct(formData.ead > 0 ? (metrics.eclTotal / formData.ead) * 100 : 0) + " EAD"}
              />
              <ResultCard
                label="RWA (Bâle IV SA)"
                value={fmtKE(metrics.rwa)}
                badge={rwaBadge(metrics.riskWeight)}
                sub={`pondération ${fmtPct(metrics.riskWeight * 100, 0)}`}
              />
              <ResultCard
                label="CET1 pro forma"
                value={fmtPct(metrics.cet1ProForma)}
                badge={cet1Badge(metrics.cet1ProForma)}
                sub={`vs ${fmtPct(formData.cet1Actuel)} initial`}
              />
            </div>

            {/* Breakdown par stage */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Détail ECL par stage IFRS 9</p>
              <div className="flex flex-col divide-y divide-border">
                {[
                  {
                    stage: "S1", label: "Stage 1 — 12 mois",
                    ead: metrics.eadS1, ecl: metrics.eclS1,
                  },
                  {
                    stage: "S2", label: "Stage 2 — Lifetime",
                    ead: metrics.eadS2, ecl: metrics.eclS2,
                  },
                  {
                    stage: "S3", label: "Stage 3 — En défaut",
                    ead: metrics.eadS3, ecl: metrics.eclS3,
                  },
                ].map(({ stage, label, ead, ecl }) => (
                  <div key={stage} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${STAGE_DOT[stage]}`} />
                    <span className="text-sm font-medium text-foreground w-44">{label}</span>
                    <div className="flex gap-6 ml-auto text-right">
                      <div className="flex flex-col">
                        <span className="text-xs text-foreground-subtle">EAD</span>
                        <span className="tabnum text-sm text-foreground">{fmtKE(ead)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-foreground-subtle">ECL</span>
                        <span className={`tabnum text-sm font-semibold ${
                          stage === "S3" ? "text-danger" : stage === "S2" ? "text-warning" : "text-success"
                        }`}>{fmtKE(ecl)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-foreground-subtle">Couverture</span>
                        <span className="tabnum text-sm text-foreground">
                          {ead > 0 ? fmtPct((ecl / ead) * 100) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stress test comparatif */}
            <div className="card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="data-label">Stress test — scénario adverse</p>
                <span className="badge badge-warning">
                  PIB −{fmtPct(formData.pertePIB, 0)} · Chômage +{formData.hausseChomage} pp
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">ECL central</span>
                  <span className="tabnum text-xl font-bold text-foreground">{fmtKE(metrics.eclTotal)}</span>
                  <span className="badge badge-neutral self-start">Scénario base</span>
                </div>
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">ECL stressé</span>
                  <span className="tabnum text-xl font-bold text-danger">{fmtKE(metrics.stressedEcl)}</span>
                  <span className="badge badge-warning self-start">
                    +{fmtKE(metrics.stressedEcl - metrics.eclTotal)}
                  </span>
                </div>
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">CET1 pro forma (central)</span>
                  <span className="tabnum text-xl font-bold text-foreground">{fmtPct(metrics.cet1ProForma)}</span>
                  <span className={`self-start ${cet1Badge(metrics.cet1ProForma).cls}`}>
                    {cet1Badge(metrics.cet1ProForma).label}
                  </span>
                </div>
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">CET1 stressé</span>
                  <span className="tabnum text-xl font-bold text-foreground">{fmtPct(metrics.stressedCet1)}</span>
                  <span className={`self-start ${cet1Badge(metrics.stressedCet1).cls}`}>
                    {cet1Badge(metrics.stressedCet1).label}
                  </span>
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
                Ce module est une approximation pédagogique des règles IFRS 9 et Bâle IV. L&apos;allocation
                des stages est simplifiée (PD moyen → distribution fixe). Le modèle de stress est linéaire.
                Consultez votre risk management et vos auditeurs pour tout calcul réglementaire officiel.
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
