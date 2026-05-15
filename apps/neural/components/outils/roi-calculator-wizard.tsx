"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Mail, FileDown, Loader2 } from "lucide-react";

import { WizardShell, ChoiceList } from "./wizard-shell";
import {
  computeRoi,
  getForfaitTier,
  ROI_SECTORS as SECTORS,
  ROI_BRANCHES as BRANCHES,
  ROI_FREQUENCIES as FREQUENCIES,
  ETP_HOURLY_LOADED,
  type RoiInputs,
} from "@/lib/outils/compute/roi-calculator";

interface Inputs {
  sector?: string;
  branches: string[];
  users: number;
  frequency?: string;
}

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function RoiCalculatorWizard() {
  const [step, setStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [inputs, setInputs] = useState<Inputs>({ branches: [], users: 250 });
  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "error">("idle");

  const totalSteps = 4;

  const result = useMemo(() => {
    if (!showResult) return null;
    if (!inputs.sector || !inputs.frequency || inputs.branches.length === 0) return null;
    return computeRoi(inputs as RoiInputs);
  }, [showResult, inputs]);

  const handleDownloadPdf = async () => {
    if (!inputs.sector || !inputs.frequency || inputs.branches.length === 0) return;
    setDownloadState("loading");
    try {
      const resp = await fetch("/api/outils/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "roi-calculator",
          inputs: {
            sector: inputs.sector,
            branches: inputs.branches,
            users: inputs.users,
            frequency: inputs.frequency,
          } satisfies RoiInputs,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const hash = resp.headers.get("X-Receipt-Hash") ?? "estimation";
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `neural-roi-calculator-${hash.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloadState("idle");
    } catch (err) {
      console.error("PDF download failed", err);
      setDownloadState("error");
    }
  };

  const canGoNext = (() => {
    if (step === 0) return Boolean(inputs.sector);
    if (step === 1) return inputs.branches.length > 0;
    if (step === 2) return inputs.users > 0;
    if (step === 3) return Boolean(inputs.frequency);
    return false;
  })();

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      setShowResult(true);
    }
  };

  const handleReset = () => {
    setStep(0);
    setInputs({ branches: [], users: 250 });
    setShowResult(false);
  };

  if (showResult && result) {
    return (
      <div className="space-y-6">
        <div className="rounded-[28px] border border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.04] to-violet-500/[0.06] p-6 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Estimation ROI
              </span>
              <p className="mt-3 font-display text-2xl font-bold tracking-tight text-white">
                {result.tier.label}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.10]"
            >
              <RotateCcw className="h-3 w-3" />
              Refaire
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[20px] border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
                ROI annuel net
              </p>
              <p className="mt-3 font-display text-5xl font-bold tabular-nums text-emerald-200">
                +{result.roiPct}%
              </p>
              <p className="mt-2 text-sm text-white/65">
                Économies nettes : {formatEuro(result.monthlyRoi * 12)} sur 12 mois
              </p>
            </div>
            <div className="rounded-[20px] border border-violet-400/20 bg-violet-400/[0.06] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">
                Payback estimé
              </p>
              <p className="mt-3 font-display text-5xl font-bold tabular-nums text-violet-200">
                {result.paybackMonths === Infinity ? "—" : `${result.paybackMonths} mo`}
              </p>
              <p className="mt-2 text-sm text-white/65">
                Setup estimé : {formatEuro(result.neuralMonthly * 2)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Coût NEURAL/mo
            </p>
            <p className="mt-3 font-display text-3xl font-bold tabular-nums text-white">
              {formatEuro(result.neuralMonthly)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              Tier {result.tier.label.split("—")[0].trim()}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Heures économisées/mo
            </p>
            <p className="mt-3 font-display text-3xl font-bold tabular-nums text-white">
              {new Intl.NumberFormat("fr-FR").format(result.hoursSavedMonth)}h
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              Sur {result.activeUsers} utilisateurs actifs (~35% adoption)
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              ETP équivalents
            </p>
            <p className="mt-3 font-display text-3xl font-bold tabular-nums text-white">
              {result.etpEquivalent}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              ETP-mois libérés sur tâches à valeur ajoutée
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/[0.05] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">
            Hypothèses utilisées
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-white/65">
            <li>• Coût horaire ETP chargé : {ETP_HOURLY_LOADED} €/h (mid-cap français)</li>
            <li>• Taux d&apos;adoption initial : 35% des users sur les branches activées</li>
            <li>• Setup one-shot : ~2× le coût mensuel NEURAL</li>
            <li>• Estimation conservative — ROI réel souvent supérieur en année 2+</li>
          </ul>
        </div>

        <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-emerald-500/[0.06] p-6 md:p-8">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-violet-300">
                <FileDown className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-[0.18em]">Estimation signée</span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-white">
                Télécharger l&apos;estimation en PDF
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Paramètres saisis, calcul détaillé (heures économisées, payback, ROI annuel),
                hypothèses utilisées. Pied de page signé (hash SHA-256 + URL de vérification) pour
                partage interne.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadState === "loading"}
              className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadState === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération…
                </>
              ) : (
                <>
                  Télécharger le PDF
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
          {downloadState === "error" ? (
            <p className="mt-4 text-xs text-red-300">
              Génération échouée. Réessayez ou{" "}
              <Link href={`/contact?source=roi-calculator&sector=${inputs.sector}`} className="underline">
                planifiez un cadrage
              </Link>
              .
            </p>
          ) : (
            <p className="mt-4 text-xs text-white/40">
              Besoin d&apos;un cadrage personnalisé 30 min ?{" "}
              <Link
                href={`/contact?source=roi-calculator&sector=${inputs.sector}`}
                className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200"
              >
                <Mail className="h-3 w-3" />
                Nous contacter
              </Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (step === 0) {
    return (
      <WizardShell
        currentStep={step}
        totalSteps={totalSteps}
        title="Quel est votre secteur d'activité ?"
        helpText="Cela conditionne les agents NEURAL applicables et les hypothèses de gain de productivité."
        onNext={handleNext}
        canGoNext={canGoNext}
        canGoPrev={false}
      >
        <ChoiceList
          options={SECTORS}
          value={inputs.sector}
          onChange={(id) => setInputs((p) => ({ ...p, sector: id }))}
        />
      </WizardShell>
    );
  }

  if (step === 1) {
    return (
      <WizardShell
        currentStep={step}
        totalSteps={totalSteps}
        title="Quelles branches métier voulez-vous activer ?"
        helpText="Sélectionnez 1 à 3 branches. Plus vous activez de branches, plus l'effet de levier est important."
        onPrev={() => setStep(0)}
        onNext={handleNext}
        canGoNext={canGoNext}
      >
        <div className="grid gap-2 md:grid-cols-2">
          {BRANCHES.map((b) => {
            const selected = inputs.branches.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() =>
                  setInputs((p) => ({
                    ...p,
                    branches: selected
                      ? p.branches.filter((id) => id !== b.id)
                      : [...p.branches, b.id],
                  }))
                }
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                  selected
                    ? "border-violet-400/50 bg-violet-400/[0.10]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
                }`}
              >
                <div
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-all ${
                    selected
                      ? "border-violet-300 bg-violet-300"
                      : "border-white/30 bg-transparent"
                  }`}
                >
                  {selected ? (
                    <svg className="h-3 w-3 text-neural-midnight" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0l-3.7-3.7a1 1 0 011.4-1.4l3 3 6.7-6.7a1 1 0 011.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : null}
                </div>
                <span
                  className={`text-sm font-semibold ${selected ? "text-white" : "text-white/85"}`}
                >
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-white/45">
          {inputs.branches.length} branche{inputs.branches.length > 1 ? "s" : ""} sélectionnée
          {inputs.branches.length > 1 ? "s" : ""}
        </p>
      </WizardShell>
    );
  }

  if (step === 2) {
    return (
      <WizardShell
        currentStep={step}
        totalSteps={totalSteps}
        title="Combien d'utilisateurs concernés ?"
        helpText="Nombre total de personnes qui auront accès aux agents NEURAL (toutes branches confondues)."
        onPrev={() => setStep(1)}
        onNext={handleNext}
        canGoNext={canGoNext}
      >
        <div className="space-y-6">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                Utilisateurs
              </p>
              <p className="font-display text-5xl font-bold tabular-nums text-white">
                {new Intl.NumberFormat("fr-FR").format(inputs.users)}
              </p>
            </div>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={inputs.users}
              onChange={(e) =>
                setInputs((p) => ({ ...p, users: Number(e.target.value) }))
              }
              className="mt-6 w-full accent-violet-400"
            />
            <div className="mt-2 flex justify-between text-[11px] uppercase tracking-[0.18em] text-white/35">
              <span>50</span>
              <span>5 000</span>
            </div>
          </div>
          <div className="rounded-[20px] border border-violet-400/20 bg-violet-400/[0.05] px-5 py-4">
            <p className="text-sm text-white/75">
              <span className="font-semibold text-violet-200">Tier estimé :</span>{" "}
              {getForfaitTier(inputs.users).label}
            </p>
          </div>
        </div>
      </WizardShell>
    );
  }

  // step === 3
  return (
    <WizardShell
      currentStep={step}
      totalSteps={totalSteps}
      title="Quelle fréquence d'usage par utilisateur ?"
      helpText="Estimer la fréquence à laquelle chaque utilisateur sollicitera les agents NEURAL."
      onPrev={() => setStep(2)}
      onNext={handleNext}
      canGoNext={canGoNext}
      isLastStep
      nextLabel="Calculer le ROI"
    >
      <ChoiceList
        options={FREQUENCIES}
        value={inputs.frequency}
        onChange={(id) => setInputs((p) => ({ ...p, frequency: id }))}
      />
    </WizardShell>
  );
}
