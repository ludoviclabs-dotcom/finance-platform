"use client";

/**
 * DemoProgress — barre + pastilles de progression du parcours Asterion.
 * Cliquable en mode explore/guided ; reflète l'étape courante (aria-current).
 */

import { ASTERION_TOUR, type TourStep } from "@/lib/demo/asterion-motion-tour";

export function DemoProgress({
  current,
  onSelect,
  steps = ASTERION_TOUR,
}: {
  current: number;
  onSelect: (index: number) => void;
  /** Parcours affiché (défaut = tour Asterion Motion) — paramétrable pour réutilisation. */
  steps?: TourStep[];
}) {
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <div className="w-full" data-testid="demo-progress">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-carbon-emerald transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={current + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`Étape ${current + 1} sur ${steps.length}`}
        />
      </div>
      <ol className="mt-3 flex flex-wrap gap-1.5">
        {steps.map((step, i) => {
          const active = i === current;
          const done = i < current;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                aria-label={`Étape ${step.index} : ${step.title}`}
                data-testid={`demo-step-dot-${i}`}
                className={`grid h-7 w-7 place-items-center rounded-full border text-[11px] font-semibold transition ${
                  active
                    ? "border-carbon-emerald bg-carbon-emerald text-white"
                    : done
                      ? "border-carbon-emerald/40 bg-carbon-emerald/15 text-carbon-emerald-light"
                      : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                }`}
              >
                {step.index}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
