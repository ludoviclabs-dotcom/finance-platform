"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Mail, Award } from "lucide-react";

import data from "@/content/outils/operator-score.json";
import { WizardShell, ChoiceList } from "./wizard-shell";

const COLOR_CLS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  amber: {
    bg: "bg-amber-400/[0.10]",
    border: "border-amber-400/25",
    text: "text-amber-200",
    gradient: "from-amber-400 to-orange-400",
  },
  violet: {
    bg: "bg-violet-400/[0.10]",
    border: "border-violet-400/25",
    text: "text-violet-200",
    gradient: "from-violet-400 to-fuchsia-400",
  },
  emerald: {
    bg: "bg-emerald-400/[0.10]",
    border: "border-emerald-400/25",
    text: "text-emerald-200",
    gradient: "from-emerald-400 to-teal-400",
  },
  cyan: {
    bg: "bg-cyan-400/[0.10]",
    border: "border-cyan-400/25",
    text: "text-cyan-200",
    gradient: "from-cyan-400 to-sky-400",
  },
};

interface AxisScore {
  id: string;
  label: string;
  description: string;
  score: number;
  max: number;
  pct: number;
}

function computeScores(answers: Record<string, number>) {
  const totalScore = Object.values(answers).reduce((acc, s) => acc + s, 0);
  const tier =
    data.tiers.find((t) => totalScore >= t.min && totalScore <= t.max) || data.tiers[0];

  const axisScores: AxisScore[] = data.axes.map((axis) => {
    const axisQuestions = data.questions.filter((q) => q.axis === axis.id);
    const score = axisQuestions.reduce((acc, q) => acc + (answers[q.id] || 0), 0);
    const max = axisQuestions.length * 3;
    return {
      id: axis.id,
      label: axis.label,
      description: axis.description,
      score,
      max,
      pct: Math.round((score / max) * 100),
    };
  });

  return { totalScore, tier, axisScores };
}

export function OperatorScoreWizard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [answerIds, setAnswerIds] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);

  const questions = data.questions;
  const currentQuestion = questions[step];
  const isLastQuestion = step === questions.length - 1;
  const currentAnswerId = currentQuestion ? answerIds[currentQuestion.id] : undefined;

  const result = useMemo(() => {
    if (!showResult) return null;
    return computeScores(answers);
  }, [showResult, answers]);

  const handleNext = () => {
    if (isLastQuestion) setShowResult(true);
    else setStep((s) => s + 1);
  };
  const handleReset = () => {
    setStep(0);
    setAnswers({});
    setAnswerIds({});
    setShowResult(false);
  };

  if (showResult && result) {
    const cls = COLOR_CLS[result.tier.color] || COLOR_CLS["violet"];
    const maxScore = questions.length * 3;
    return (
      <div className="space-y-6">
        <div className={`rounded-[28px] border ${cls.border} ${cls.bg} p-6 md:p-10`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${cls.border} ${cls.text}`}
              >
                <Award className="h-3 w-3" />
                Niveau opérateur
              </span>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
                {result.tier.label}
              </h2>
              <p className="mt-2 text-sm uppercase tracking-[0.18em] text-white/55">
                Score : {result.totalScore} / {maxScore}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.10]"
            >
              <RotateCcw className="h-3 w-3" /> Refaire
            </button>
          </div>
          <p className="mt-5 text-base leading-relaxed text-white/80">{result.tier.summary}</p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
          <h3 className="font-display text-xl font-bold tracking-tight text-white">
            Profil par axe — discipline opérationnelle
          </h3>
          <div className="mt-6 space-y-4">
            {result.axisScores.map((axis) => (
              <div key={axis.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{axis.label}</p>
                    <p className="text-[11px] leading-relaxed text-white/45">{axis.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold tabular-nums text-white">
                      {axis.score}
                      <span className="text-white/35">/{axis.max}</span>
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                      {axis.pct}%
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${cls.gradient} transition-all duration-700 ease-out`}
                    style={{ width: `${axis.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-violet-400/25 bg-violet-400/[0.06] p-6 md:p-8">
          <h3 className="font-display text-xl font-bold tracking-tight text-white">
            Plan d&apos;action 90 jours
          </h3>
          <ol className="mt-5 space-y-3">
            {result.tier.actions.map((action, i) => (
              <li key={action} className="flex gap-3">
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${cls.border} ${cls.bg} font-display text-xs font-bold ${cls.text}`}
                >
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-white/80">{action}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.04] to-violet-500/[0.06] p-6 md:p-8">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-emerald-300">
                <Mail className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-[0.18em]">Cadrage opérateur</span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-white">
                Approfondir le diagnostic avec NEURAL
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                30 min pour cadrer l&apos;élévation de votre niveau opérateur. Sortie : feuille de
                route 90 jours signée.
              </p>
            </div>
            <Link
              href={`/contact?source=operator-score&tier=${result.tier.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
            >
              Cadrage gratuit 30 min
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;
  const axis = data.axes.find((a) => a.id === currentQuestion.axis);

  return (
    <WizardShell
      currentStep={step}
      totalSteps={questions.length}
      stepLabel={axis?.label}
      title={currentQuestion.label}
      onPrev={step > 0 ? () => setStep((s) => s - 1) : undefined}
      onNext={handleNext}
      canGoNext={Boolean(currentAnswerId)}
      canGoPrev={step > 0}
      isLastStep={isLastQuestion}
      nextLabel={isLastQuestion ? "Voir mon score" : undefined}
    >
      <ChoiceList
        options={currentQuestion.options}
        value={currentAnswerId}
        onChange={(id) => {
          const opt = currentQuestion.options.find((o) => o.id === id);
          if (!opt) return;
          setAnswerIds((prev) => ({ ...prev, [currentQuestion.id]: id }));
          setAnswers((prev) => ({ ...prev, [currentQuestion.id]: opt.score }));
        }}
      />
    </WizardShell>
  );
}
