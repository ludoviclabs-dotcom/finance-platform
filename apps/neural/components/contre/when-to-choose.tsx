/**
 * WhenToChoose — deux cards opposées : critères pour choisir l'un vs l'autre.
 * Approche honnête : on ne dit pas "NEURAL est mieux", on dit "voici quand
 * chaque option fait sens".
 */

import { Check } from "lucide-react";

interface ChoiceCriteria {
  title: string;
  criteria: string[];
}

interface WhenToChooseProps {
  competitor: ChoiceCriteria;
  neural: ChoiceCriteria;
}

export function WhenToChoose({ competitor, neural }: WhenToChooseProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[24px] border border-violet-400/25 bg-violet-400/[0.06] p-6">
        <h3 className="font-display text-xl font-bold tracking-tight text-white">
          {competitor.title}
        </h3>
        <ul className="mt-5 space-y-3">
          {competitor.criteria.map((c) => (
            <li key={c} className="flex gap-3 text-sm leading-relaxed text-white/75">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-300" aria-hidden="true" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[24px] border border-emerald-400/25 bg-emerald-400/[0.06] p-6">
        <h3 className="font-display text-xl font-bold tracking-tight text-white">
          {neural.title}
        </h3>
        <ul className="mt-5 space-y-3">
          {neural.criteria.map((c) => (
            <li key={c} className="flex gap-3 text-sm leading-relaxed text-white/75">
              <Check
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300"
                aria-hidden="true"
              />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
