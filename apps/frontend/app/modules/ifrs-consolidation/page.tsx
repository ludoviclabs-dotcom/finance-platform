"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Network, Scale, Users,
  ChevronRight, ChevronLeft, Play,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════ Types ══ */

interface FormData {
  /* Step 1 — Périmètre */
  nbFilialesIG: number;        // nombre de filiales en intégration globale
  tauxDetentionIG: number;     // % taux moyen de détention filiales IG
  nbFilalesMEE: number;        // nombre de filiales en MEE
  tauxDetentionMEE: number;    // % taux moyen de détention filiales MEE
  ventesIntragroupe: number;   // K€ CA intercompany à éliminer
  dividendesIntragroupe: number; // K€ dividendes versés par filiales IG à la mère
  /* Step 2 — Données financières */
  caMere: number;              // K€ CA société mère
  rnMere: number;              // K€ résultat net mère (avant éliminations)
  caFilialesIG: number;        // K€ CA agrégé des filiales IG (100 %)
  rnFilialesIG: number;        // K€ résultat net agrégé filiales IG (100 %)
  rnFilalesMEE: number;        // K€ résultat net agrégé filiales MEE (100 %)
  /* Step 3 — Retraitements IFRS */
  loyersIfrs16: number;        // K€/an loyers opérationnels à retraiter IFRS 16
  dureeIfrs16: number;         // ans durée résiduelle des contrats
  tauxIfrs16: number;          // % taux implicite IFRS 16
  diffTempImposables: number;  // K€ différences temporelles imposables → IDP
  goodwillBrut: number;        // K€ écart d'acquisition brut au bilan
  depreciationGoodwill: number; // K€ dépréciation goodwill de l'exercice (IAS 36)
}

interface Metrics {
  /* CA */
  caConsolide: number;
  caAjout: number; // K€ ajouté vs mère seule
  /* Résultat */
  quotaPartMEE: number;
  resultatConsolideBrut: number;
  nci: number;               // intérêts minoritaires
  resultatPDGAvant: number;  // avant retraitements
  /* Retraitements */
  detteIfrs16: number;       // K€ dette de location (actif ROU)
  impactIfrs16: number;      // K€ impact résultat net (négatif = charge)
  chargeIDP: number;         // K€ charge impôts différés
  goodwillNet: number;       // K€ goodwill après dépréciation
  totalRetraitements: number; // K€ total impact résultat
  /* Final */
  resultatPDGFinal: number;
  margeNette: number;        // % résultat PDG final / CA consolidé
  nciPart: number;           // % NCI / résultat consolidé brut
}

/* ══════════════════════════════════════════════════════════ Constants ══ */

const STEP_LABELS = ["Périmètre de consolidation", "Données financières", "Retraitements IFRS"];

const IS_RATE = 0.25;

const defaultFormData: FormData = {
  nbFilialesIG: 2,
  tauxDetentionIG: 80,
  nbFilalesMEE: 1,
  tauxDetentionMEE: 40,
  ventesIntragroupe: 30_000,
  dividendesIntragroupe: 5_000,
  caMere: 500_000,
  rnMere: 30_000,
  caFilialesIG: 200_000,
  rnFilialesIG: 20_000,
  rnFilalesMEE: 10_000,
  loyersIfrs16: 8_000,
  dureeIfrs16: 8,
  tauxIfrs16: 4,
  diffTempImposables: 12_000,
  goodwillBrut: 40_000,
  depreciationGoodwill: 2_000,
};

/* ═══════════════════════════════════════════════════════ Computations ══ */

/** Valeur actuelle des loyers IFRS 16 (dette de location initiale) */
function pvLoyers(loyers: number, duree: number, taux: number): number {
  if (taux <= 0) return loyers * duree;
  const r = taux / 100;
  return loyers * (1 - Math.pow(1 + r, -duree)) / r;
}

function computeMetrics(d: FormData): Metrics {
  /* ── CA consolidé ─────────────────────────────────────────────── */
  const caConsolide = d.caMere + d.caFilialesIG - d.ventesIntragroupe;
  const caAjout     = caConsolide - d.caMere;

  /* ── Résultat consolidé ───────────────────────────────────────── */
  const quotaPartMEE = d.rnFilalesMEE * (d.tauxDetentionMEE / 100);
  // Intégration globale : 100 % du résultat, puis sortie des NCI
  const resultatConsolideBrut =
    (d.rnMere - d.dividendesIntragroupe) + d.rnFilialesIG + quotaPartMEE;
  const nci = Math.max(0, (1 - d.tauxDetentionIG / 100) * d.rnFilialesIG);
  const resultatPDGAvant = resultatConsolideBrut - nci;
  const nciPart = resultatConsolideBrut > 0
    ? (nci / resultatConsolideBrut) * 100 : 0;

  /* ── Retraitements IFRS 16 ────────────────────────────────────── */
  const detteIfrs16 = d.loyersIfrs16 > 0 && d.dureeIfrs16 > 0
    ? pvLoyers(d.loyersIfrs16, d.dureeIfrs16, d.tauxIfrs16) : 0;
  // Charge an 1 = amortissement ROU + intérêts − remplacement des loyers
  const amortROU   = d.dureeIfrs16 > 0 ? detteIfrs16 / d.dureeIfrs16 : 0;
  const interetsL  = detteIfrs16 * (d.tauxIfrs16 / 100);
  // Impact P&L vs traitement loyers (négatif = charge supplémentaire)
  const impactIfrs16 = -((amortROU + interetsL - d.loyersIfrs16) * (1 - IS_RATE));

  /* ── Impôts différés ──────────────────────────────────────────── */
  const chargeIDP = d.diffTempImposables * IS_RATE;

  /* ── Goodwill ─────────────────────────────────────────────────── */
  const goodwillNet = Math.max(0, d.goodwillBrut - d.depreciationGoodwill);

  /* ── Total retraitements & résultat final ─────────────────────── */
  // impactIfrs16 est déjà signé, chargeIDP et dépréciation sont des charges
  const totalRetraitements = impactIfrs16 - chargeIDP - d.depreciationGoodwill;
  const resultatPDGFinal   = resultatPDGAvant + totalRetraitements;
  const margeNette         = caConsolide > 0
    ? (resultatPDGFinal / caConsolide) * 100 : 0;

  return {
    caConsolide, caAjout,
    quotaPartMEE, resultatConsolideBrut, nci, resultatPDGAvant,
    detteIfrs16, impactIfrs16, chargeIDP, goodwillNet, totalRetraitements,
    resultatPDGFinal, margeNette, nciPart,
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

function margeNetteBadge(pct: number): BadgeResult {
  if (pct >= 8)  return { cls: "badge badge-success", label: "Excellente" };
  if (pct >= 4)  return { cls: "badge badge-warning", label: "Correcte" };
  if (pct >= 0)  return { cls: "badge badge-neutral", label: "Faible" };
  return { cls: "badge badge-danger", label: "Déficitaire" };
}

function nciPartBadge(pct: number): BadgeResult {
  if (pct < 10)  return { cls: "badge badge-success", label: "Faible" };
  if (pct < 25)  return { cls: "badge badge-warning", label: "Significative" };
  return { cls: "badge badge-danger", label: "Élevée" };
}

function retraitBadge(total: number, pdg: number): BadgeResult {
  const pct = pdg > 0 ? Math.abs(total / pdg) * 100 : 0;
  if (total >= 0)  return { cls: "badge badge-success", label: "Positif" };
  if (pct < 10)    return { cls: "badge badge-warning", label: "Limité" };
  return { cls: "badge badge-danger", label: "Significatif" };
}

function generateInterpretation(m: Metrics, d: FormData): string {
  const parts: string[] = [];

  parts.push(
    `Le périmètre de consolidation regroupe ${d.nbFilialesIG} filiale${d.nbFilialesIG > 1 ? "s" : ""} en intégration globale ` +
    `(taux moyen ${fmtPct(d.tauxDetentionIG, 0)}) et ${d.nbFilalesMEE} en mise en équivalence ` +
    `(taux moyen ${fmtPct(d.tauxDetentionMEE, 0)}). ` +
    `Le CA consolidé s'établit à ${fmtKE(m.caConsolide)}, soit ${fmtKE(m.caAjout)} de plus ` +
    `que la société mère seule, après élimination de ${fmtKE(d.ventesIntragroupe)} de flux intragroupe.`
  );

  parts.push(
    `Les intérêts minoritaires (NCI) représentent ${fmtKE(m.nci)} ` +
    `(${fmtPct(m.nciPart)} du résultat consolidé brut). ` +
    `La quote-part de résultat des entités MEE s'élève à ${fmtKE(m.quotaPartMEE)}. ` +
    `Avant retraitements, le résultat part du groupe est de ${fmtKE(m.resultatPDGAvant)}.`
  );

  const retraitSign = m.totalRetraitements >= 0 ? "+" : "";
  parts.push(
    `Les retraitements IFRS totalisent ${retraitSign}${fmtKE(m.totalRetraitements)} : ` +
    `IFRS 16 (dette de location ${fmtKE(m.detteIfrs16)}, impact résultat ${fmtKE(m.impactIfrs16)}), ` +
    `impôts différés passifs sur ${fmtKE(d.diffTempImposables)} de différences temporelles (−${fmtKE(m.chargeIDP)}), ` +
    `dépréciation goodwill IAS 36 (−${fmtKE(d.depreciationGoodwill)}). ` +
    `Le résultat net part du groupe s'établit à ${fmtKE(m.resultatPDGFinal)}, ` +
    `pour une marge nette consolidée de ${fmtPct(m.margeNette)}.`
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

/* Ligne de passage des résultats */
function PassageLine({
  label, value, isTotal, sign, color,
}: {
  label: string; value: number; isTotal?: boolean; sign?: boolean; color?: string;
}) {
  const prefix = sign ? (value >= 0 ? "+" : "") : "";
  const cls = color ?? (value < 0 ? "text-danger" : value > 0 ? "text-success" : "text-foreground-muted");
  return (
    <div className={`flex items-center justify-between py-2.5 ${isTotal ? "border-t border-border font-semibold" : ""}`}>
      <span className={`text-sm ${isTotal ? "text-foreground" : "text-foreground-muted"}`}>{label}</span>
      <span className={`tabnum text-sm ${isTotal ? "text-base font-bold text-foreground" : cls}`}>
        {prefix}{fmtKE(value)}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ Page ══ */

export default function IfrsConsolidationPage() {
  const [currentStep, setCurrentStep]   = useState(1);
  const [formData, setFormData]         = useState<FormData>(defaultFormData);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  function update(patch: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  const metrics = computeMetrics(formData);

  /* ── Step content ───────────────────────────────────────────────────── */

  const stepContent: Record<number, React.ReactNode> = {

    /* ── Étape 1 — Périmètre de consolidation ────────────────────────── */
    1: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Définissez le périmètre de consolidation du groupe. L&apos;intégration globale (IG)
          s&apos;applique aux entités contrôlées (&gt; 50 %). La mise en équivalence (MEE)
          s&apos;applique aux participations avec influence notable (20–50 %).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="card p-4 flex flex-col gap-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Intégration Globale (IG)
            </p>
            <FormField
              label="Nombre de filiales IG" id="nbFilialesIG" value={formData.nbFilialesIG}
              onChange={(v) => update({ nbFilialesIG: v })} unit="entités"
              hint="Filiales contrôlées à plus de 50 % — intégrées à 100 % au bilan et au compte de résultat."
            />
            <FormField
              label="Taux moyen de détention" id="tauxDetentionIG" value={formData.tauxDetentionIG}
              onChange={(v) => update({ tauxDetentionIG: Math.min(100, v) })} unit="%" step={1}
              hint="Taux moyen pondéré de détention dans les filiales IG — détermine la part des intérêts minoritaires."
            />
          </div>
          <div className="card p-4 flex flex-col gap-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Mise en Équivalence (MEE)
            </p>
            <FormField
              label="Nombre de filiales MEE" id="nbFilalesMEE" value={formData.nbFilalesMEE}
              onChange={(v) => update({ nbFilalesMEE: v })} unit="entités"
              hint="Participations avec influence notable (20–50 %) — seule la quote-part du résultat est intégrée."
            />
            <FormField
              label="Taux moyen de détention" id="tauxDetentionMEE" value={formData.tauxDetentionMEE}
              onChange={(v) => update({ tauxDetentionMEE: Math.min(100, v) })} unit="%" step={1}
              hint="Taux moyen pondéré de détention dans les entités MEE."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Ventes intragroupe" id="ventesIntragroupe" value={formData.ventesIntragroupe}
            onChange={(v) => update({ ventesIntragroupe: v })} unit="K€"
            hint="CA facturé entre entités du périmètre IG — à éliminer intégralement du CA consolidé."
          />
          <FormField
            label="Dividendes intragroupe" id="dividendesIntragroupe" value={formData.dividendesIntragroupe}
            onChange={(v) => update({ dividendesIntragroupe: v })} unit="K€"
            hint="Dividendes versés par les filiales IG à la société mère — à éliminer du résultat de la mère."
          />
        </div>
      </div>
    ),

    /* ── Étape 2 — Données financières ──────────────────────────────── */
    2: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Saisissez les données financières agrégées de chaque niveau de périmètre.
          Les filiales IG sont intégrées à 100 % ; la MEE n&apos;impacte que la
          quote-part du résultat net.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="CA — Société mère" id="caMere" value={formData.caMere}
            onChange={(v) => update({ caMere: v })} unit="K€"
          />
          <FormField
            label="Résultat net — Société mère" id="rnMere" value={formData.rnMere}
            onChange={(v) => update({ rnMere: v })} unit="K€"
            hint="Avant élimination des dividendes intragroupe."
          />
          <FormField
            label="CA agrégé — Filiales IG (100 %)" id="caFilialesIG" value={formData.caFilialesIG}
            onChange={(v) => update({ caFilialesIG: v })} unit="K€"
            hint="Somme des CA des filiales en intégration globale, avant éliminations."
          />
          <FormField
            label="Résultat net agrégé — Filiales IG" id="rnFilialesIG" value={formData.rnFilialesIG}
            onChange={(v) => update({ rnFilialesIG: v })} unit="K€"
            hint="Somme des résultats nets des filiales IG à 100 %."
          />
          <FormField
            label="Résultat net agrégé — Filiales MEE" id="rnFilalesMEE" value={formData.rnFilalesMEE}
            onChange={(v) => update({ rnFilalesMEE: v })} unit="K€"
            hint="Seule la quote-part (taux de détention × résultat) sera intégrée au compte de résultat consolidé."
          />
        </div>

        {/* Live preview consolidation */}
        {formData.caMere > 0 && (
          <div className="flex flex-wrap gap-6 p-4 bg-surface-raised border border-border rounded-md">
            <div className="flex flex-col gap-0.5">
              <span className="data-label">CA consolidé</span>
              <span className="tabnum text-sm font-semibold text-foreground">
                {fmtKE(metrics.caConsolide)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Résultat PDG (avant retraitements)</span>
              <span className={`tabnum text-sm font-semibold ${metrics.resultatPDGAvant >= 0 ? "text-success" : "text-danger"}`}>
                {fmtKE(metrics.resultatPDGAvant)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Intérêts minoritaires</span>
              <span className="tabnum text-sm font-semibold text-warning">
                {fmtKE(metrics.nci)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Quote-part MEE</span>
              <span className="tabnum text-sm font-semibold text-foreground-muted">
                {fmtKE(metrics.quotaPartMEE)}
              </span>
            </div>
          </div>
        )}
      </div>
    ),

    /* ── Étape 3 — Retraitements IFRS ───────────────────────────────── */
    3: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Les retraitements IFRS ajustent le résultat consolidé pour refléter les normes :
          IFRS 16 (capitalisation des loyers), IAS 12 (impôts différés),
          et IFRS 3 / IAS 36 (goodwill et dépréciation).
        </p>

        {/* IFRS 16 */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            IFRS 16 — Contrats de location
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <FormField
              label="Loyers opérationnels" id="loyersIfrs16" value={formData.loyersIfrs16}
              onChange={(v) => update({ loyersIfrs16: v })} unit="K€/an"
              hint="Loyers annuels à capitaliser (hors contrats < 12 mois et low-value)."
            />
            <FormField
              label="Durée résiduelle" id="dureeIfrs16" value={formData.dureeIfrs16}
              onChange={(v) => update({ dureeIfrs16: Math.max(1, v) })} unit="ans" step={1} min={1}
              hint="Durée résiduelle moyenne pondérée des contrats de location."
            />
            <FormField
              label="Taux implicite" id="tauxIfrs16" value={formData.tauxIfrs16}
              onChange={(v) => update({ tauxIfrs16: v })} unit="%" step={0.25}
              hint="Taux d'emprunt marginal ou taux implicite du bailleur (IFRS 16.26)."
            />
          </div>
        </div>

        {/* Impôts différés & Goodwill */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            IAS 12 — Impôts différés & IFRS 3 — Goodwill
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <FormField
              label="Diff. temporelles imposables" id="diffTempImposables" value={formData.diffTempImposables}
              onChange={(v) => update({ diffTempImposables: v })} unit="K€"
              hint="Base des IDP (IS 25 %) : différences entre valeurs fiscales et comptables (ex. amortissements accélérés)."
            />
            <FormField
              label="Goodwill brut au bilan" id="goodwillBrut" value={formData.goodwillBrut}
              onChange={(v) => update({ goodwillBrut: v })} unit="K€"
              hint="Écart d'acquisition inscrit à l'actif (IFRS 3) — non amorti, soumis au test IAS 36."
            />
            <FormField
              label="Dépréciation goodwill" id="depreciationGoodwill" value={formData.depreciationGoodwill}
              onChange={(v) => update({ depreciationGoodwill: v })} unit="K€"
              hint="Perte de valeur constatée à l'issue du test de dépréciation IAS 36 — charge non déductible."
            />
          </div>
        </div>

        {/* Aperçu retraitements */}
        <div className="card p-4 flex flex-col gap-3">
          <p className="data-label">Aperçu retraitements</p>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Dette de location (IFRS 16)</span>
              <span className="tabnum text-sm font-semibold text-foreground">{fmtKE(metrics.detteIfrs16)}</span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Impact résultat IFRS 16</span>
              <span className={`tabnum text-sm font-semibold ${metrics.impactIfrs16 >= 0 ? "text-success" : "text-warning"}`}>
                {metrics.impactIfrs16 >= 0 ? "+" : ""}{fmtKE(metrics.impactIfrs16)}
              </span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Charge IDP (IS 25 %)</span>
              <span className="tabnum text-sm font-semibold text-danger">−{fmtKE(metrics.chargeIDP)}</span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="data-label">Total retraitements</span>
              <span className={`tabnum text-sm font-semibold ${metrics.totalRetraitements >= 0 ? "text-success" : "text-danger"}`}>
                {metrics.totalRetraitements >= 0 ? "+" : ""}{fmtKE(metrics.totalRetraitements)}
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
          <span className="badge badge-neutral">Module 6 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">

        {/* ══ PART A — Éditoriale ════════════════════════════════════════ */}
        <section className="flex flex-col gap-10">

          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 6 sur 8</span>
            <h1 className="text-foreground">Consolidation IFRS — Comptes de groupe</h1>
            <p className="text-foreground-muted max-w-2xl" style={{ fontSize: "var(--text-lg)" }}>
              Consolidez les comptes d&apos;un groupe (IG + MEE), éliminez les flux intragroupe,
              et appliquez les retraitements IFRS 16, IAS 12 et IFRS 3 pour obtenir le
              résultat net part du groupe.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Network,
                  title: "Périmètre de consolidation",
                  detail: "Intégration globale (contrôle > 50 %) et mise en équivalence (influence notable 20–50 %). Élimination des flux intragroupe (CA, dividendes, créances réciproques).",
                },
                {
                  icon: Users,
                  title: "Intérêts minoritaires (NCI)",
                  detail: "Part des résultats et capitaux propres des filiales IG revenant aux actionnaires externes au groupe. Présentée séparément dans les états financiers consolidés (IFRS 10).",
                },
                {
                  icon: Scale,
                  title: "Retraitements IFRS",
                  detail: "IFRS 16 (capitalisation des loyers → dette + ROU). IAS 12 (impôts différés passifs sur différences temporelles). IFRS 3 / IAS 36 (goodwill et test de dépréciation annuel).",
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
                  title: "CA consolidé",
                  detail: "Chiffre d'affaires du groupe après élimination des ventes entre entités du périmètre IG. Les entités MEE ne contribuent pas au CA consolidé (seule la quote-part du résultat est inscrite).",
                },
                {
                  title: "Résultat net part du groupe (PDG)",
                  detail: "Résultat après déduction des intérêts minoritaires et application des retraitements IFRS. C'est le résultat attribuable aux actionnaires de la société mère — base du BPA consolidé.",
                },
                {
                  title: "Intérêts minoritaires (NCI)",
                  detail: "Part du résultat des filiales IG revenant aux actionnaires minoritaires. Une NCI élevée (> 25 % du résultat consolidé) indique une structure de contrôle dilué ou des participations minoritaires importantes.",
                },
                {
                  title: "Dette de location IFRS 16",
                  detail: "Passif financier reconnu pour les contrats de location opérationnelle retraités. Accroît le levier financier apparent du groupe sans impact sur la trésorerie immédiate.",
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
                label="CA consolidé"
                value={fmtKE(metrics.caConsolide)}
                badge={{ cls: "badge badge-info", label: `IG + MEE` }}
                sub={`+${fmtKE(metrics.caAjout)} vs mère seule`}
              />
              <ResultCard
                label="Résultat net PDG"
                value={fmtKE(metrics.resultatPDGFinal)}
                badge={margeNetteBadge(metrics.margeNette)}
                sub={`marge nette ${fmtPct(metrics.margeNette)}`}
              />
              <ResultCard
                label="Intérêts minoritaires"
                value={fmtKE(metrics.nci)}
                badge={nciPartBadge(metrics.nciPart)}
                sub={`${fmtPct(metrics.nciPart)} du résultat consolidé`}
              />
            </div>

            {/* Tableau de passage du résultat */}
            <div className="card p-6 flex flex-col gap-1">
              <p className="data-label mb-3">Tableau de passage — résultat consolidé</p>
              <PassageLine label="Résultat net société mère" value={formData.rnMere} color="text-foreground" />
              <PassageLine label="Élimination dividendes intragroupe" value={-formData.dividendesIntragroupe} sign />
              <PassageLine label={`Résultat filiales IG (${formData.nbFilialesIG} entité${formData.nbFilialesIG > 1 ? "s" : ""}, 100 %)`} value={formData.rnFilialesIG} sign />
              <PassageLine label={`Quote-part MEE (${formData.nbFilalesMEE} entité${formData.nbFilalesMEE > 1 ? "s" : ""} × ${fmtPct(formData.tauxDetentionMEE, 0)})`} value={metrics.quotaPartMEE} sign />
              <PassageLine label="= Résultat consolidé brut" value={metrics.resultatConsolideBrut} isTotal color="text-foreground" />
              <PassageLine label={`Intérêts minoritaires (${fmtPct(100 - formData.tauxDetentionIG, 0)} × filiales IG)`} value={-metrics.nci} sign />
              <PassageLine label="= Résultat PDG avant retraitements" value={metrics.resultatPDGAvant} isTotal color="text-foreground" />
              <div className="pt-1">
                <PassageLine label="Impact IFRS 16 (net IS)" value={metrics.impactIfrs16} sign />
                <PassageLine label="Charge impôts différés passifs" value={-metrics.chargeIDP} sign />
                <PassageLine label="Dépréciation goodwill (IAS 36)" value={-formData.depreciationGoodwill} sign />
              </div>
              <PassageLine label="= Résultat net PDG (après retraitements)" value={metrics.resultatPDGFinal} isTotal color="text-foreground" />
            </div>

            {/* Retraitements bilan */}
            <div className="card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="data-label">Impact bilan des retraitements IFRS</p>
                <span className={retraitBadge(metrics.totalRetraitements, metrics.resultatPDGAvant).cls}>
                  {retraitBadge(metrics.totalRetraitements, metrics.resultatPDGAvant).label}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">Actif ROU / Dette IFRS 16</span>
                  <span className="tabnum text-xl font-bold text-foreground">{fmtKE(metrics.detteIfrs16)}</span>
                  <span className="text-xs text-foreground-subtle">
                    Loyers {fmtKE(formData.loyersIfrs16)}/an · {formData.dureeIfrs16} ans · {fmtPct(formData.tauxIfrs16)} taux
                  </span>
                </div>
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">Goodwill net (IAS 36)</span>
                  <span className="tabnum text-xl font-bold text-foreground">{fmtKE(metrics.goodwillNet)}</span>
                  <span className="text-xs text-foreground-subtle">
                    Brut {fmtKE(formData.goodwillBrut)} − dépréc. {fmtKE(formData.depreciationGoodwill)}
                  </span>
                </div>
                <div className="card p-4 flex flex-col gap-2">
                  <span className="data-label">IDP constituées (IAS 12)</span>
                  <span className="tabnum text-xl font-bold text-foreground">{fmtKE(metrics.chargeIDP)}</span>
                  <span className="text-xs text-foreground-subtle">
                    {fmtKE(formData.diffTempImposables)} diff. temp. × IS 25 %
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
                Ce module est une approximation pédagogique des normes de consolidation IFRS (IFRS 10, IFRS 11, IFRS 16,
                IAS 12, IFRS 3, IAS 36). L&apos;impact IFRS 16 est calculé sur la 1ère année (charges amortissement + intérêts
                vs loyers). Les différences temporelles sont traitées de façon agrégée. En pratique, la consolidation requiert
                des retraitements ligne à ligne. Consultez vos auditeurs pour tout arrêté consolidé officiel.
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
