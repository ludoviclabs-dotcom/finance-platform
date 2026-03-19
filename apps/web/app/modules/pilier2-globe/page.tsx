"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Globe, Calculator, ShieldCheck,
  ChevronRight, ChevronLeft, Play,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════ Types ══ */

type UpePays = "France" | "Irlande" | "Singapour" | "États-Unis" | "Royaume-Uni" | "Autre";

interface FormData {
  /* Step 1 — Identité groupe */
  caMondial: number;
  nbJuridictions: number;
  upePays: UpePays;
  /* Step 2 — Données par juridiction */
  frCa: number; frIsPaye: number; frRevenuGlobe: number;
  ieCa: number; ieIsPaye: number; ieRevenuGlobe: number;
  sgCa: number; sgIsPaye: number; sgRevenuGlobe: number;
  /* Step 3 — Safe harbours */
  frEtrSimplifie: boolean;
  ieEtrSimplifie: boolean;
  sgEtrSimplifie: boolean;
}

interface JuriMetrics {
  pays: string;
  code: string;
  etr: number;
  topUp: number;
  deMinimis: boolean;
  safeHarbour: boolean;
}

interface Metrics {
  juridictions: JuriMetrics[];
  topUpTotal: number;
  etrMoyen: number;
  nbExemptees: number;
}

/* ══════════════════════════════════════════════════════════ Constants ══ */

const STEP_LABELS = ["Identité groupe", "Données juridictions", "Safe harbours"];

const UPE_PAYS: UpePays[] = [
  "France", "Irlande", "Singapour", "États-Unis", "Royaume-Uni", "Autre",
];

/* Full literal strings — Tailwind scanner picks these up */
const JURI_DOTS: Record<string, string> = {
  France: "bg-accent",
  Irlande: "bg-warning",
  Singapour: "bg-success",
};

const GLOBE_RATE = 0.15; /* 15 % minimum GloBE */

const defaultFormData: FormData = {
  caMondial: 800000,
  nbJuridictions: 12,
  upePays: "France",
  frCa: 200000, frIsPaye: 50000, frRevenuGlobe: 200000,
  ieCa: 80000,  ieIsPaye: 10000, ieRevenuGlobe: 80000,
  sgCa: 40000,  sgIsPaye: 6800,  sgRevenuGlobe: 40000,
  frEtrSimplifie: false,
  ieEtrSimplifie: false,
  sgEtrSimplifie: false,
};

/* ═══════════════════════════════════════════════════════ Computations ══ */

function computeJuri(
  pays: string,
  code: string,
  ca: number,
  isPaye: number,
  revenuGlobe: number,
  etrSimplifie: boolean,
): JuriMetrics {
  const etr = revenuGlobe > 0 ? (isPaye / revenuGlobe) * 100 : 0;
  /* De minimis — art. 5.6 GloBE Model Rules: CA < 10 M€ ET revenu GloBE < 1 M€ */
  const deMinimis = ca < 10_000 && Math.abs(revenuGlobe) < 1_000;
  const safeHarbour = deMinimis || (etrSimplifie && etr >= 15);
  const topUp =
    !safeHarbour && etr < 15 && revenuGlobe > 0
      ? (GLOBE_RATE - etr / 100) * revenuGlobe
      : 0;
  return { pays, code, etr, topUp, deMinimis, safeHarbour };
}

function computeMetrics(d: FormData): Metrics {
  const juridictions = [
    computeJuri("France",    "FR", d.frCa, d.frIsPaye, d.frRevenuGlobe, d.frEtrSimplifie),
    computeJuri("Irlande",   "IE", d.ieCa, d.ieIsPaye, d.ieRevenuGlobe, d.ieEtrSimplifie),
    computeJuri("Singapour", "SG", d.sgCa, d.sgIsPaye, d.sgRevenuGlobe, d.sgEtrSimplifie),
  ];
  const topUpTotal    = juridictions.reduce((s, j) => s + j.topUp, 0);
  const totalRevenu   = d.frRevenuGlobe + d.ieRevenuGlobe + d.sgRevenuGlobe;
  const totalImpot    = d.frIsPaye + d.ieIsPaye + d.sgIsPaye;
  const etrMoyen      = totalRevenu > 0 ? (totalImpot / totalRevenu) * 100 : 0;
  const nbExemptees   = juridictions.filter((j) => j.safeHarbour).length;
  return { juridictions, topUpTotal, etrMoyen, nbExemptees };
}

function fmtKE(ke: number): string {
  if (Math.abs(ke) >= 1_000)
    return (ke / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M€";
  return Math.round(ke).toLocaleString("fr-FR") + " K€";
}

function fmtPct(pct: number): string {
  return pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
}

type BadgeResult = { cls: string; label: string };

function etrMoyenBadge(etr: number): BadgeResult {
  if (etr >= 15) return { cls: "badge badge-success", label: "Conforme GloBE" };
  if (etr >= 10) return { cls: "badge badge-warning", label: "Sous seuil GloBE" };
  return { cls: "badge badge-danger", label: "ETR critique" };
}

function topUpBadge(topUp: number): BadgeResult {
  if (topUp === 0)   return { cls: "badge badge-success", label: "Aucun" };
  if (topUp < 5_000) return { cls: "badge badge-warning", label: "Modéré" };
  return { cls: "badge badge-danger", label: "Significatif" };
}

function exemptBadge(nb: number): BadgeResult {
  if (nb === 3) return { cls: "badge badge-success", label: "3 / 3 exemptées" };
  if (nb > 0)   return { cls: "badge badge-warning", label: `${nb} / 3 exemptée${nb > 1 ? "s" : ""}` };
  return { cls: "badge badge-neutral", label: "Aucune exemption" };
}

function etrJuriBadge(etr: number, safeHarbour: boolean): BadgeResult {
  if (safeHarbour) return { cls: "badge badge-neutral",  label: "Safe harbour" };
  if (etr >= 15)   return { cls: "badge badge-success",  label: fmtPct(etr) };
  if (etr >= 10)   return { cls: "badge badge-warning",  label: fmtPct(etr) };
  return             { cls: "badge badge-danger",   label: fmtPct(etr) };
}

function generateInterpretation(m: Metrics, d: FormData): string {
  if (d.caMondial < 750_000) {
    return (
      `Le chiffre d'affaires mondial consolidé (${fmtKE(d.caMondial)}) est inférieur au seuil ` +
      `d'assujettissement GloBE de 750 M€. Ce groupe n'est pas soumis au Pilier 2, sauf option QDMTT ` +
      `nationale ou application de l'UTPR par une juridiction d'implantation.`
    );
  }

  const parts: string[] = [];
  const sousSeuilGlobe = m.juridictions.filter((j) => j.etr < 15 && !j.safeHarbour);

  if (sousSeuilGlobe.length === 0) {
    parts.push(
      `L'ETR moyen pondéré de ${fmtPct(m.etrMoyen)} est supérieur au taux minimum global de 15 %. ` +
      `Aucun impôt complémentaire IIR n'est estimé sur les trois juridictions analysées.`
    );
  } else {
    const list = sousSeuilGlobe
      .map((j) => `${j.pays} (ETR ${fmtPct(j.etr)}, top-up estimé ${fmtKE(j.topUp)})`)
      .join(", ");
    parts.push(
      `Les juridictions suivantes présentent un ETR inférieur à 15 % : ${list}. ` +
      `Un impôt complémentaire de ${fmtKE(m.topUpTotal)} (IIR — Income Inclusion Rule) est estimé, ` +
      `collecté au niveau de l'UPE résidente en ${d.upePays}.`
    );
  }

  const exemptees = m.juridictions.filter((j) => j.safeHarbour);
  if (exemptees.length > 0) {
    const noms = exemptees.map((j) =>
      j.deMinimis ? `${j.pays} (de minimis < 10 M€)` : `${j.pays} (ETR simplifié ≥ 15 %)`
    );
    parts.push(
      `Safe harbour appliqué à : ${noms.join(", ")}. ` +
      `Ces juridictions sont exonérées du calcul complémentaire sous réserve de confirmation par les autorités compétentes.`
    );
  }

  if (m.topUpTotal > 5_000) {
    parts.push(
      `L'exposition de ${fmtKE(m.topUpTotal)} est significative. L'adoption d'un QDMTT (Qualified Domestic ` +
      `Minimum Top-up Tax) dans les juridictions sous seuil permettrait de capter l'impôt localement ` +
      `et de neutraliser l'IIR au niveau de l'UPE.`
    );
  } else if (m.topUpTotal > 0) {
    parts.push(
      `Le montant estimé de ${fmtKE(m.topUpTotal)} est gérable. ` +
      `Évaluez l'opportunité d'un QDMTT dans les juridictions sous seuil.`
    );
  }

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
  label, id, value, onChange, unit,
}: {
  label: string; id: string; value: number;
  onChange: (val: number) => void; unit?: string;
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
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={INPUT_CLS}
      />
    </div>
  );
}

function ResultCard({ label, value, badge }: { label: string; value: string; badge: BadgeResult }) {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <span className="data-label">{label}</span>
      <span className="kpi-value tabnum">{value}</span>
      <span className={badge.cls}>{badge.label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ Page ══ */

export default function Pilier2GlobePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData]       = useState<FormData>(defaultFormData);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  function update(patch: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  const metrics = computeMetrics(formData);

  /* ── Step content ───────────────────────────────────────────────────── */

  const stepContent: Record<number, React.ReactNode> = {

    /* ── Étape 1 — Identité groupe ───────────────────────────────────── */
    1: (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="upePays" className="text-sm font-medium text-foreground">
            Pays de résidence de l&apos;UPE
          </label>
          <select
            id="upePays"
            value={formData.upePays}
            onChange={(e) => update({ upePays: e.target.value as UpePays })}
            className={INPUT_CLS}
          >
            {UPE_PAYS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <p className="text-xs text-foreground-subtle">
            UPE — Ultimate Parent Entity : entité faîtière ultime du groupe consolidé dont le CA
            mondial dépasse 750 M€ sur au moins 2 des 4 exercices précédents.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="CA mondial consolidé"
            id="caMondial"
            value={formData.caMondial}
            onChange={(val) => update({ caMondial: val })}
            unit="K€"
          />
          <FormField
            label="Nombre de juridictions"
            id="nbJuridictions"
            value={formData.nbJuridictions}
            onChange={(val) => update({ nbJuridictions: val })}
            unit="pays"
          />
        </div>

        {formData.caMondial < 750_000 && (
          <div className="flex items-start gap-3 p-4 bg-warning-bg border border-warning rounded-md">
            <span className="text-warning font-bold text-sm shrink-0">⚠</span>
            <p className="text-sm text-warning leading-relaxed">
              Le CA mondial déclaré ({fmtKE(formData.caMondial)}) est inférieur au seuil GloBE de 750 M€.
              Ce groupe n&apos;est généralement pas soumis au Pilier 2.
            </p>
          </div>
        )}
      </div>
    ),

    /* ── Étape 2 — Données par juridiction ──────────────────────────── */
    2: (
      <div className="flex flex-col gap-8">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Saisissez les données fiscales pour chacune des trois juridictions.
          Le revenu GloBE correspond au revenu qualifié OCDE avant substance-based income exclusions (SBIE).
        </p>

        {/* France */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="h-2 w-2 rounded-full bg-accent shrink-0" />
            <p className="text-sm font-semibold text-foreground">France</p>
            <span className="badge badge-neutral ml-auto">IS 25 %</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="CA local" id="frCa"
              value={formData.frCa} onChange={(v) => update({ frCa: v })} unit="K€" />
            <FormField label="IS payé" id="frIsPaye"
              value={formData.frIsPaye} onChange={(v) => update({ frIsPaye: v })} unit="K€" />
            <FormField label="Revenu GloBE" id="frRevenuGlobe"
              value={formData.frRevenuGlobe} onChange={(v) => update({ frRevenuGlobe: v })} unit="K€" />
          </div>
        </div>

        {/* Irlande */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="h-2 w-2 rounded-full bg-warning shrink-0" />
            <p className="text-sm font-semibold text-foreground">Irlande</p>
            <span className="badge badge-warning ml-auto">IS 12,5 % historique</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="CA local" id="ieCa"
              value={formData.ieCa} onChange={(v) => update({ ieCa: v })} unit="K€" />
            <FormField label="IS payé" id="ieIsPaye"
              value={formData.ieIsPaye} onChange={(v) => update({ ieIsPaye: v })} unit="K€" />
            <FormField label="Revenu GloBE" id="ieRevenuGlobe"
              value={formData.ieRevenuGlobe} onChange={(v) => update({ ieRevenuGlobe: v })} unit="K€" />
          </div>
        </div>

        {/* Singapour */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="h-2 w-2 rounded-full bg-success shrink-0" />
            <p className="text-sm font-semibold text-foreground">Singapour</p>
            <span className="badge badge-neutral ml-auto">IS 17 %</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="CA local" id="sgCa"
              value={formData.sgCa} onChange={(v) => update({ sgCa: v })} unit="K€" />
            <FormField label="IS payé" id="sgIsPaye"
              value={formData.sgIsPaye} onChange={(v) => update({ sgIsPaye: v })} unit="K€" />
            <FormField label="Revenu GloBE" id="sgRevenuGlobe"
              value={formData.sgRevenuGlobe} onChange={(v) => update({ sgRevenuGlobe: v })} unit="K€" />
          </div>
        </div>
      </div>
    ),

    /* ── Étape 3 — Safe harbours ─────────────────────────────────────── */
    3: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Les safe harbours permettent d&apos;exclure certaines juridictions du calcul de l&apos;impôt
          complémentaire. Le test de minimis est évalué automatiquement depuis les données saisies.
        </p>

        {/* De minimis — automatique */}
        <div className="card p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">
            Test de minimis <span className="badge badge-neutral ml-2">Automatique</span>
          </p>
          <p className="text-xs text-foreground-muted leading-relaxed">
            Exemption si CA local &lt; 10 M€ ET revenu GloBE &lt; 1 M€ (art. 5.6 OCDE GloBE Model Rules).
          </p>
          <div className="flex flex-col divide-y divide-border">
            {[
              { label: "France",    ca: formData.frCa, revenu: formData.frRevenuGlobe },
              { label: "Irlande",   ca: formData.ieCa, revenu: formData.ieRevenuGlobe },
              { label: "Singapour", ca: formData.sgCa, revenu: formData.sgRevenuGlobe },
            ].map(({ label, ca, revenu }) => {
              const ok = ca < 10_000 && Math.abs(revenu) < 1_000;
              return (
                <div key={label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm text-foreground">{label}</span>
                  <span className={ok ? "badge badge-success" : "badge badge-neutral"}>
                    {ok ? "Exempté" : "Non exempté"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ETR simplifié — Transitional Safe Harbour */}
        <div className="card p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">
            ETR simplifié — Transitional Safe Harbour
          </p>
          <p className="text-xs text-foreground-muted leading-relaxed">
            Disponible pour les exercices 2023–2026. L&apos;entité doit disposer de comptes statutaires
            locaux conformes (CbCR qualifié). Cochez si la juridiction satisfait le test ETR ≥ 15 %.
          </p>
          <div className="flex flex-col gap-3 mt-1">
            {[
              { label: "France",    key: "frEtrSimplifie" as const, value: formData.frEtrSimplifie },
              { label: "Irlande",   key: "ieEtrSimplifie" as const, value: formData.ieEtrSimplifie },
              { label: "Singapour", key: "sgEtrSimplifie" as const, value: formData.sgEtrSimplifie },
            ].map(({ label, key, value }) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-foreground">{label}</span>
                <div className="flex items-center gap-3">
                  {value && <span className="badge badge-success">Actif</span>}
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => update({ [key]: e.target.checked } as Partial<FormData>)}
                    className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>
              </label>
            ))}
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
          <span className="badge badge-neutral">Module 2 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">

        {/* ══ PART A — Éditoriale ════════════════════════════════════════ */}
        <section className="flex flex-col gap-10">

          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 2 sur 8</span>
            <h1 className="text-foreground">Fiscalité Pilier 2 GloBE</h1>
            <p className="text-foreground-muted max-w-2xl" style={{ fontSize: "var(--text-lg)" }}>
              Calculez l&apos;ETR par juridiction, estimez le top-up tax IIR et qualifiez les safe
              harbours applicables à votre groupe multinational.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Globe,
                  title: "Calcul ETR GloBE",
                  detail: "Taux effectif d'imposition par juridiction selon les règles OCDE — IS qualifié / revenu GloBE qualifié.",
                },
                {
                  icon: Calculator,
                  title: "Top-up Tax IIR / QDMTT",
                  detail: "Impôt complémentaire si ETR < 15 %. Collecté par l'UPE (IIR) ou localement (QDMTT).",
                },
                {
                  icon: ShieldCheck,
                  title: "Safe Harbours",
                  detail: "De minimis, ETR simplifié (TSH) et UTPR safe harbour — exclusions du calcul complémentaire.",
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
                  title: "ETR GloBE par juridiction",
                  detail: "Rapport IS qualifié / revenu GloBE. Si ETR < 15 %, un impôt complémentaire est dû sauf safe harbour applicable (art. 5 OCDE GloBE Model Rules, BEPS Action 15).",
                },
                {
                  title: "Top-up Tax estimé (IIR)",
                  detail: "Impôt complémentaire collecté par l'UPE : (15 % − ETR) × revenu GloBE. Peut être neutralisé par un QDMTT local adopté par la juridiction sous seuil.",
                },
                {
                  title: "Exemption de minimis",
                  detail: "Juridiction exclue automatiquement si CA < 10 M€ et revenu GloBE < 1 M€ sur l'exercice (art. 5.6 GloBE Model Rules). Aucun calcul complémentaire requis.",
                },
                {
                  title: "QDMTT — Domestic Top-up Tax",
                  detail: "Impôt national de complément permettant à la juridiction sous seuil de capter l'impôt en local. France (2024), Irlande (2024), Singapour (2025) ont adopté ou prévu le QDMTT.",
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
                label="ETR moyen pondéré"
                value={fmtPct(metrics.etrMoyen)}
                badge={etrMoyenBadge(metrics.etrMoyen)}
              />
              <ResultCard
                label="Top-up Tax estimé (IIR)"
                value={fmtKE(metrics.topUpTotal)}
                badge={topUpBadge(metrics.topUpTotal)}
              />
              <ResultCard
                label="Juridictions exemptées"
                value={`${metrics.nbExemptees} / 3`}
                badge={exemptBadge(metrics.nbExemptees)}
              />
            </div>

            {/* Détail par juridiction */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Détail par juridiction</p>
              <div className="flex flex-col divide-y divide-border">
                {metrics.juridictions.map((j) => {
                  const eb = etrJuriBadge(j.etr, j.safeHarbour);
                  return (
                    <div key={j.code} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${JURI_DOTS[j.pays] ?? "bg-border"}`} />
                      <span className="text-sm font-medium text-foreground w-28">{j.pays}</span>
                      <span className={eb.cls}>{eb.label}</span>
                      <span className="ml-auto tabnum text-sm">
                        {j.safeHarbour ? (
                          <span className="text-foreground-subtle">
                            {j.deMinimis ? "De minimis" : "ETR simplifié"}
                          </span>
                        ) : j.topUp > 0 ? (
                          <span className="text-danger font-semibold">
                            Top-up : {fmtKE(j.topUp)}
                          </span>
                        ) : (
                          <span className="text-success">Conforme</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interprétation */}
            <div className="card p-6 flex flex-col gap-3">
              <p className="data-label">Interprétation</p>
              <p className="text-sm text-foreground-muted leading-relaxed">
                {generateInterpretation(metrics, formData)}
              </p>
              <p className="text-xs text-foreground-subtle leading-relaxed border-t border-border pt-3 mt-1">
                Ces résultats sont générés à titre indicatif sur la base des données saisies et des règles
                GloBE OCDE 2024. Ils ne constituent pas un avis fiscal. Consultez votre directeur fiscal
                et vos conseils pour toute décision de provisionnement ou de dépôt déclaratif Pilier 2.
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
