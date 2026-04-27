/**
 * WizardShell — coquille générique pour les outils interactifs.
 * Gère la progress bar, les transitions entre étapes et la mise en page.
 */

"use client";

import { type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WizardShellProps {
  currentStep: number;
  totalSteps: number;
  stepLabel?: string;
  title: string;
  helpText?: string;
  children: ReactNode;
  onNext?: () => void;
  onPrev?: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
  isLastStep?: boolean;
  nextLabel?: string;
}

export function WizardShell({
  currentStep,
  totalSteps,
  stepLabel,
  title,
  helpText,
  children,
  onNext,
  onPrev,
  canGoNext = true,
  canGoPrev = true,
  isLastStep = false,
  nextLabel,
}: WizardShellProps) {
  const progressPct = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 md:p-10">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/40">
          <span>
            Étape {currentStep + 1} / {totalSteps}
          </span>
          <span>{stepLabel || `${Math.round(progressPct)} %`}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Title */}
      <div className="mt-8 md:mt-10">
        <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
          {title}
        </h2>
        {helpText ? (
          <p className="mt-2 text-sm leading-relaxed text-white/55">{helpText}</p>
        ) : null}
      </div>

      {/* Step content */}
      <div className="mt-6 md:mt-8">{children}</div>

      {/* Nav buttons */}
      {(onPrev || onNext) && (
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/8 pt-6">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canGoPrev}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/70 transition-all hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.04]"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext}
            className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neural-violet"
          >
            {nextLabel || (isLastStep ? "Voir le résultat" : "Suivant")}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

interface ChoiceListProps<T extends string> {
  options: ReadonlyArray<{ readonly id: T; readonly label: string; readonly description?: string }>;
  value?: T;
  onChange: (id: T) => void;
}

export function ChoiceList<T extends string>({ options, value, onChange }: ChoiceListProps<T>) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex w-full items-start gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-200 ${
              selected
                ? "border-violet-400/50 bg-violet-400/[0.10]"
                : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
            }`}
          >
            <div
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                selected
                  ? "border-violet-300 bg-violet-300"
                  : "border-white/30 bg-transparent"
              }`}
            >
              {selected ? (
                <span className="h-2 w-2 rounded-full bg-neural-midnight" />
              ) : null}
            </div>
            <div className="flex-1">
              <p
                className={`text-sm font-semibold ${selected ? "text-white" : "text-white/85"}`}
              >
                {opt.label}
              </p>
              {opt.description ? (
                <p className="mt-1 text-xs leading-relaxed text-white/55">{opt.description}</p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
