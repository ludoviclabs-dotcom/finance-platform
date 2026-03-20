"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, TrendingDown, FileCheck, ChevronRight, ChevronLeft, Play } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════ Types ══ */

type Secteur = "Banque" | "Assurance" | "Gestion d'actifs" | "Fintech" | "Autre";
type AppetenceRisque = "Faible" | "Moyenne" | "Élevée";

interface FormData {
  /* Step 1 */
  secteur: Secteur;
  chiffreAffaires: number;
  effectif: number;
  budgetIT: number;
  budgetCyber: number;
  /* Step 2 */
  doraGouvernance: number;
  doraIncidents: number;
  doraTests: number;
  doraTiers: number;
  doraReporting: number;
  /* Step 3 */
  ransomwarePerte: number;
  ransomwareProba: number;
  fuitePerte: number;
  fuiteProba: number;
  fournisseurPerte: number;
  fournisseurProba: number;
  /* Step 4 */
  cyberAssurance: boolean;
  plafondIndemnisation: number;
  franchise: number;
  appetenceRisque: AppetenceRisque;
}

interface Metrics {
  scoreDORA: number;
  ratioCyberIT: number;
  aleKE: number;
}

/* ══════════════════════════════════════════════════════════ Constants ══ */

const STEP_LABELS = [
  "Profil entité",
  "Conformité DORA",
  "Scénarios de risque",
  "Assurance & appétence",
];

const SECTEURS: Secteur[] = ["Banque", "Assurance", "Gestion d'actifs", "Fintech", "Autre"];
const APPETENCES: AppetenceRisque[] = ["Faible", "Moyenne", "Élevée"];
const DORA_LEVEL_LABELS = ["Non initié", "Partiel", "En progression", "Avancé", "Conforme"];

type DoraKey =
  | "doraGouvernance"
  | "doraIncidents"
  | "doraTests"
  | "doraTiers"
  | "doraReporting";

const DORA_DOMAINS: { key: DoraKey; label: string }[] = [
  { key: "doraGouvernance", label: "Gouvernance des risques TIC" },
  { key: "doraIncidents",   label: "Gestion des incidents" },
  { key: "doraTests",       label: "Tests de résilience (TLPT)" },
  { key: "doraTiers",       label: "Gestion des tiers TIC" },
  { key: "doraReporting",   label: "Reporting réglementaire" },
];

const defaultFormData: FormData = {
  secteur: "Banque",
  chiffreAffaires: 100000,
  effectif: 500,
  budgetIT: 5000,
  budgetCyber: 500,
  doraGouvernance: 2,
  doraIncidents: 2,
  doraTests: 1,
  doraTiers: 2,
  doraReporting: 1,
  ransomwarePerte: 2000,
  ransomwareProba: 15,
  fuitePerte: 800,
  fuiteProba: 25,
  fournisseurPerte: 1500,
  fournisseurProba: 10,
  cyberAssurance: false,
  plafondIndemnisation: 0,
  franchise: 0,
  appetenceRisque: "Faible",
};

/* ═══════════════════════════════════════════════════════ Computations ══ */

function computeMetrics(d: FormData): Metrics {
  const avgDora = (d.doraGouvernance + d.doraIncidents + d.doraTests + d.doraTiers + d.doraReporting) / 5;
  const scoreDORA = avgDora * 25;
  const ratioCyberIT = d.budgetIT > 0 ? (d.budgetCyber / d.budgetIT) * 100 : 0;
  const aleKE =
    (d.ransomwareProba / 100) * d.ransomwarePerte +
    (d.fuiteProba / 100) * d.fuitePerte +
    (d.fournisseurProba / 100) * d.fournisseurPerte;
  return { scoreDORA, ratioCyberIT, aleKE };
}

function fmtKE(ke: number): string {
  if (ke >= 1000) {
    return (ke / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M€";
  }
  return Math.round(ke).toLocaleString("fr-FR") + " K€";
}

type BadgeResult = { cls: string; label: string };

function doraBadge(score: number): BadgeResult {
  if (score >= 75) return { cls: "badge badge-success", label: "Conforme" };
  if (score >= 50) return { cls: "badge badge-warning", label: "En vigilance" };
  return { cls: "badge badge-danger", label: "Non conforme" };
}

function ratioBadge(ratio: number): BadgeResult {
  if (ratio >= 12) return { cls: "badge badge-success", label: "Adéquat ENISA" };
  if (ratio >= 7)  return { cls: "badge badge-warning", label: "Sous-optimal" };
  return { cls: "badge badge-danger", label: "Insuffisant" };
}

function aleBadge(ale: number): BadgeResult {
  if (ale < 200)  return { cls: "badge badge-success", label: "Gérable" };
  if (ale < 1000) return { cls: "badge badge-warning", label: "Significatif" };
  return { cls: "badge badge-danger", label: "Critique" };
}

function generateInterpretation(m: Metrics, d: FormData): string {
  const parts: string[] = [];

  if (m.scoreDORA < 50) {
    parts.push(
      `Votre score DORA de ${Math.round(m.scoreDORA)}/100 place votre organisation en zone de non-conformité. ` +
      `L'ACPR et la BCE peuvent exiger un plan correctif dans les 6 mois suivant le prochain cycle de supervision.`
    );
  } else if (m.scoreDORA < 75) {
    parts.push(
      `Votre score DORA de ${Math.round(m.scoreDORA)}/100 indique une conformité partielle. ` +
      `Des progrès sont attendus sur les domaines les moins matures avant la prochaine évaluation.`
    );
  } else {
    parts.push(
      `Votre score DORA de ${Math.round(m.scoreDORA)}/100 reflète une bonne maîtrise des exigences. ` +
      `Maintenez la cadence pour conserver ce niveau lors des exercices TIBER-EU.`
    );
  }

  if (m.ratioCyberIT < 7) {
    parts.push(
      `Le ratio Cyber/IT de ${m.ratioCyberIT.toFixed(1)} % est en deçà du seuil recommandé par l'ENISA (12 %). ` +
      `Un rééquilibrage du budget est nécessaire pour couvrir les exigences des articles 8 à 10 DORA.`
    );
  } else if (m.ratioCyberIT < 12) {
    parts.push(
      `Le ratio Cyber/IT de ${m.ratioCyberIT.toFixed(1)} % est en progression, mais reste sous l'objectif ENISA de 12 % pour les entités financières.`
    );
  } else {
    parts.push(
      `Le ratio Cyber/IT de ${m.ratioCyberIT.toFixed(1)} % est conforme aux recommandations ENISA. Votre allocation budgétaire cyber est cohérente avec votre exposition.`
    );
  }

  const aleStr = fmtKE(m.aleKE);
  if (m.aleKE > 1000) {
    parts.push(
      `L'ALE agrégée de ${aleStr} dépasse 1 M€. Une provision IAS 37 doit être évaluée avec vos commissaires aux comptes si la probabilité de matérialisation est jugée probable.` +
      (d.cyberAssurance
        ? ` Votre police cyber (plafond ${fmtKE(d.plafondIndemnisation)}, franchise ${fmtKE(d.franchise)}) couvre partiellement cette exposition.`
        : " Aucune cyber-assurance déclarée — l'intégralité de l'ALE reste à la charge de l'entité.")
    );
  } else {
    parts.push(
      `L'ALE agrégée de ${aleStr} reste dans une zone gérable. Vérifiez la couverture assurantielle au regard de ce montant et des franchises en place.`
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
        const isCurrent = step === current;
        const isLast = step === STEP_LABELS.length;
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
  label,
  id,
  value,
  onChange,
  unit,
}: {
  label: string;
  id: string;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {unit && (
          <span className="ml-1 text-xs font-normal text-foreground-subtle">({unit})</span>
        )}
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

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="tabnum text-sm font-semibold text-accent">{value}/4</span>
          <span className="badge badge-neutral text-xs">{DORA_LEVEL_LABELS[value]}</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={4}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-[var(--color-accent)] h-2"
      />
      <div className="flex justify-between text-xs text-foreground-subtle">
        <span>Non initié</span>
        <span>Conforme</span>
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge: BadgeResult;
}) {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <span className="data-label">{label}</span>
      <span className="kpi-value tabnum">{value}</span>
      <span className={badge.cls}>{badge.label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ Page ══ */

export default function GouvernanceCyberPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  function update(patch: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  const metrics = computeMetrics(formData);

  /* ── Step content ───────────────────────────────────────────────────── */

  const stepContent: Record<number, React.ReactNode> = {
    1: (
      <div className="flex flex-col gap-6">
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
            {SECTEURS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Chiffre d'affaires annuel"
            id="ca"
            value={formData.chiffreAffaires}
            onChange={(val) => update({ chiffreAffaires: val })}
            unit="K€"
          />
          <FormField
            label="Effectif total"
            id="effectif"
            value={formData.effectif}
            onChange={(val) => update({ effectif: val })}
            unit="personnes"
          />
          <FormField
            label="Budget IT annuel"
            id="budgetIT"
            value={formData.budgetIT}
            onChange={(val) => update({ budgetIT: val })}
            unit="K€"
          />
          <FormField
            label="Budget cybersécurité actuel"
            id="budgetCyber"
            value={formData.budgetCyber}
            onChange={(val) => update({ budgetCyber: val })}
            unit="K€"
          />
        </div>
      </div>
    ),

    2: (
      <div className="flex flex-col gap-7">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Évaluez le niveau de maturité de votre organisation sur chacun des 5 piliers DORA.
          0 = Non initié · 4 = Pleinement conforme.
        </p>
        {DORA_DOMAINS.map((domain) => (
          <SliderField
            key={domain.key}
            label={domain.label}
            value={formData[domain.key]}
            onChange={(val) => update({ [domain.key]: val } as Partial<FormData>)}
          />
        ))}
      </div>
    ),

    3: (
      <div className="flex flex-col gap-8">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Pour chaque scénario, estimez la perte financière directe probable et la probabilité
          annuelle de survenance.
        </p>

        {/* Ransomware */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="h-2 w-2 rounded-full bg-danger shrink-0" />
            <p className="text-sm font-semibold text-foreground">Ransomware / extorsion</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Perte probable" id="ransomwarePerte" value={formData.ransomwarePerte}
              onChange={(val) => update({ ransomwarePerte: val })} unit="K€" />
            <FormField label="Probabilité annuelle" id="ransomwareProba" value={formData.ransomwareProba}
              onChange={(val) => update({ ransomwareProba: val })} unit="%" />
          </div>
        </div>

        {/* Fuite de données */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="h-2 w-2 rounded-full bg-warning shrink-0" />
            <p className="text-sm font-semibold text-foreground">Fuite de données (data breach)</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Perte probable" id="fuitePerte" value={formData.fuitePerte}
              onChange={(val) => update({ fuitePerte: val })} unit="K€" />
            <FormField label="Probabilité annuelle" id="fuiteProba" value={formData.fuiteProba}
              onChange={(val) => update({ fuiteProba: val })} unit="%" />
          </div>
        </div>

        {/* Fournisseur TIC */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="h-2 w-2 rounded-full bg-info shrink-0" />
            <p className="text-sm font-semibold text-foreground">Défaillance fournisseur TIC critique</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Perte probable" id="fournisseurPerte" value={formData.fournisseurPerte}
              onChange={(val) => update({ fournisseurPerte: val })} unit="K€" />
            <FormField label="Probabilité annuelle" id="fournisseurProba" value={formData.fournisseurProba}
              onChange={(val) => update({ fournisseurProba: val })} unit="%" />
          </div>
        </div>
      </div>
    ),

    4: (
      <div className="flex flex-col gap-6">
        {/* Cyber-assurance */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Cyber-assurance en vigueur</p>
          <div className="flex gap-4">
            {([true, false] as const).map((val) => (
              <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="cyberAssurance"
                  checked={formData.cyberAssurance === val}
                  onChange={() => update({ cyberAssurance: val })}
                  className="accent-[var(--color-accent)] h-4 w-4"
                />
                <span className="text-sm text-foreground">{val ? "Oui" : "Non"}</span>
              </label>
            ))}
          </div>
        </div>

        {formData.cyberAssurance && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pl-4 border-l-2 border-accent">
            <FormField label="Plafond d'indemnisation" id="plafond" value={formData.plafondIndemnisation}
              onChange={(val) => update({ plafondIndemnisation: val })} unit="K€" />
            <FormField label="Franchise" id="franchise" value={formData.franchise}
              onChange={(val) => update({ franchise: val })} unit="K€" />
          </div>
        )}

        {/* Appétence au risque */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="appetence" className="text-sm font-medium text-foreground">
            Appétence au risque cyber
          </label>
          <select
            id="appetence"
            value={formData.appetenceRisque}
            onChange={(e) => update({ appetenceRisque: e.target.value as AppetenceRisque })}
            className={INPUT_CLS}
          >
            {APPETENCES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <p className="text-xs text-foreground-subtle leading-relaxed">
            Niveau de risque résiduel que le conseil d&apos;administration est prêt à accepter avant
            mesures de traitement.
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
          <Link href="/dashboard"
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="badge badge-neutral">Module 1 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">

        {/* ══ PART A — Editorial ══════════════════════════════════════════ */}
        <section className="flex flex-col gap-10">

          {/* Hero */}
          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 1 sur 8</span>
            <h1 className="text-foreground">Gouvernance cyber-financière</h1>
            <p className="text-foreground-muted max-w-2xl" style={{ fontSize: "var(--text-lg)" }}>
              Mesurez votre exposition, votre conformité DORA et la provision IAS 37 associée.
            </p>
          </div>

          {/* Ce que ce module analyse */}
          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Shield,
                  title: "Conformité DORA",
                  detail: "26 articles, score sur 100 — gouvernance, tests, tiers TIC.",
                },
                {
                  icon: TrendingDown,
                  title: "Risque financier cyber",
                  detail: "ALE annualisée, VaR 95 %, provision IAS 37 recommandée.",
                },
                {
                  icon: FileCheck,
                  title: "Reporting CSRD / ESRS",
                  detail: "Data points obligatoires et narratif attendu pour E4 / S.",
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

          {/* Indicateurs clés */}
          <div className="flex flex-col gap-4">
            <p className="data-label">Indicateurs clés à surveiller</p>
            <ul className="flex flex-col gap-3">
              {[
                {
                  title: "Score DORA /100",
                  detail:
                    "Mesure l'alignement sur les 26 articles DORA. Un score < 60 expose l'entité à des mesures correctrices de l'ACPR ou de la BCE lors du prochain cycle de supervision.",
                },
                {
                  title: "Ratio Cyber/IT (%)",
                  detail:
                    "Budget cybersécurité rapporté au budget IT total. L'ENISA recommande un seuil de 12 % pour les entités financières systémiques (EIS) dans le cadre de DORA article 8.",
                },
                {
                  title: "VaR 95 % annuelle",
                  detail:
                    "Perte maximale au 95e percentile sur un an, calculée par simulation Monte-Carlo sur les scénarios déclarés. Sert de base pour la prime d'assurance cyber et le capital économique alloué.",
                },
                {
                  title: "Provision IAS 37",
                  detail:
                    "Obligation probable découlant d'incidents passés ou anticipés. Doit figurer aux états financiers si l'outflow est probable et peut être estimé de façon fiable — cf. IAS 37.14.",
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

            {/* Step title */}
            <div className="mb-7">
              <h2 className="text-foreground" style={{ fontSize: "var(--text-xl)" }}>
                Étape {currentStep} — {STEP_LABELS[currentStep - 1]}
              </h2>
            </div>

            {/* Step content */}
            {stepContent[currentStep]}

            {/* Navigation */}
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

        {/* ══ PART C — Results ══════════════════════════════════════════ */}
        {hasSubmitted && (
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <p className="data-label">Résultats de l&apos;analyse</p>
              <span className="badge badge-success">Analyse terminée</span>
            </div>

            {/* 3 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ResultCard
                label="Score de conformité DORA"
                value={`${Math.round(metrics.scoreDORA).toLocaleString("fr-FR")} / 100`}
                badge={doraBadge(metrics.scoreDORA)}
              />
              <ResultCard
                label="Ratio Cyber / IT"
                value={`${metrics.ratioCyberIT.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`}
                badge={ratioBadge(metrics.ratioCyberIT)}
              />
              <ResultCard
                label="ALE agrégée (3 scénarios)"
                value={fmtKE(metrics.aleKE)}
                badge={aleBadge(metrics.aleKE)}
              />
            </div>

            {/* Interpretation */}
            <div className="card p-6 flex flex-col gap-3">
              <p className="data-label">Interprétation</p>
              <p className="text-sm text-foreground-muted leading-relaxed">
                {generateInterpretation(metrics, formData)}
              </p>
              <p className="text-xs text-foreground-subtle leading-relaxed border-t border-border pt-3 mt-1">
                Ces résultats sont générés à titre indicatif sur la base des données saisies.
                Ils ne constituent pas un avis d&apos;expert réglementaire. Consultez votre correspondant
                DORA et vos commissaires aux comptes pour toute décision de provision ou de mise en conformité.
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
