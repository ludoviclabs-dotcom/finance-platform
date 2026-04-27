/**
 * DoesDoesntList — deux colonnes opposées : engagement vs limites assumées.
 */

import { Check, X } from "lucide-react";

interface DoesDoesntListProps {
  doesList: string[];
  doesNotList: string[];
}

export function DoesDoesntList({ doesList, doesNotList }: DoesDoesntListProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[24px] border border-emerald-400/25 bg-emerald-400/[0.06] p-6">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <h3 className="font-display text-xl font-bold tracking-tight text-white">
            Ce que NEURAL fait
          </h3>
        </div>
        <ul className="mt-5 space-y-3">
          {doesList.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed text-white/75">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[24px] border border-amber-400/25 bg-amber-400/[0.05] p-6">
        <div className="flex items-center gap-2">
          <X className="h-5 w-5 text-amber-300" aria-hidden="true" />
          <h3 className="font-display text-xl font-bold tracking-tight text-white">
            Ce que NEURAL ne fait pas
          </h3>
        </div>
        <ul className="mt-5 space-y-3">
          {doesNotList.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed text-white/75">
              <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
