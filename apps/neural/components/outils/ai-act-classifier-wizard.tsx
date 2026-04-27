"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw, Mail } from "lucide-react";

import data from "@/content/outils/ai-act-classifier.json";
import { WizardShell, ChoiceList } from "./wizard-shell";

type ResultClass = "interdit" | "haut" | "limite" | "minimal";

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string }> = {
  red: {
    bg: "bg-red-500/[0.10]",
    border: "border-red-500/30",
    text: "text-red-300",
  },
  orange: {
    bg: "bg-orange-500/[0.10]",
    border: "border-orange-500/30",
    text: "text-orange-300",
  },
  amber: {
    bg: "bg-amber-400/[0.10]",
    border: "border-amber-400/25",
    text: "text-amber-200",
  },
  emerald: {
    bg: "bg-emerald-400/[0.10]",
    border: "border-emerald-400/25",
    text: "text-emerald-300",
  },
};

function computeResult(answers: Record<string, string>): ResultClass {
  const questions = data.questions;
  const weights = questions.map((q) => {
    const optId = answers[q.id];
    const opt = q.options.find((o) => o.id === optId);
    return opt?.weight as string | undefined;
  });

  // Priorité décroissante : interdit > haut > limite > minimal
  if (weights.some((w) => w === "interdit")) return "interdit";
  if (weights.some((w) => w === "haut" || w === "haut_aggrave" || w === "annexe_iii")) {
    return "haut";
  }
  if (weights.some((w) => w === "limite")) return "limite";
  return "minimal";
}

export function AiActClassifierWizard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);

  const questions = data.questions;
  const currentQuestion = questions[step];
  const isLastQuestion = step === questions.length - 1;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const result = useMemo(() => {
    if (!showResult) return null;
    const cls = computeResult(answers);
    const r = data.results[cls];
    return { cls, ...r };
  }, [showResult, answers]);

  const handleNext = () => {
    if (isLastQuestion) {
      setShowResult(true);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleReset = () => {
    setStep(0);
    setAnswers({});
    setShowResult(false);
  };

  if (showResult && result) {
    const cls = COLOR_CLASSES[result.color];
    return (
      <div className="space-y-6">
        <div className={`rounded-[28px] border ${cls.border} ${cls.bg} p-6 md:p-10`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${cls.border} ${cls.text}`}
              >
                Résultat
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
                {result.label}
              </h2>
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
          <p className="mt-5 text-base leading-relaxed text-white/80">{result.summary}</p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
          <h3 className="font-display text-xl font-bold tracking-tight text-white">
            Obligations applicables
          </h3>
          <ul className="mt-5 space-y-3">
            {result.obligations.map((obl) => (
              <li key={obl} className="flex gap-3 text-sm leading-relaxed text-white/75">
                <Check
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 ${cls.text}`}
                  aria-hidden="true"
                />
                <span>{obl}</span>
              </li>
            ))}
          </ul>
        </div>

        {result.neuralAgent ? (
          <div className="rounded-[24px] border border-violet-400/25 bg-violet-400/[0.06] p-6 md:p-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              Suggestion NEURAL
            </span>
            <p className="mt-3 font-display text-lg font-bold tracking-tight text-white">
              Agent recommandé
            </p>
            <p className="mt-1 text-sm leading-relaxed text-white/70">{result.neuralAgent}</p>
          </div>
        ) : null}

        <div className="rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.04] to-violet-500/[0.06] p-6 md:p-8">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-emerald-300">
                <Mail className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-[0.18em]">Rapport complet</span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-white">
                Recevoir le rapport personnalisé
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Synthèse PDF avec votre classification, vos obligations détaillées par article, et
                les agents NEURAL adaptés à votre cas. Envoyé sous 24h.
              </p>
            </div>
            <Link
              href="/contact?source=ai-act-classifier"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
            >
              Recevoir par email
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            href="/conformite/ai-act"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08]"
          >
            Voir la page AI Act complète
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <WizardShell
      currentStep={step}
      totalSteps={questions.length}
      title={currentQuestion.label}
      helpText={currentQuestion.help}
      onPrev={step > 0 ? handlePrev : undefined}
      onNext={handleNext}
      canGoNext={Boolean(currentAnswer)}
      canGoPrev={step > 0}
      isLastStep={isLastQuestion}
    >
      <ChoiceList
        options={currentQuestion.options}
        value={currentAnswer}
        onChange={(id) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: id }))}
      />
    </WizardShell>
  );
}
