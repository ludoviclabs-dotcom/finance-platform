"use client";

/**
 * <TermTooltip term="ESRS">ESRS</TermTooltip>
 *
 * Affiche un tooltip explicatif au survol / focus avec la définition tirée
 * de `lib/glossary.ts`. Tooltip pur CSS+state, sans dépendance Radix —
 * accessible (role="tooltip", aria-describedby), focusable au clavier, et
 * masqué proprement si le terme n'est pas connu (l'enfant reste visible
 * sans surlignage).
 */

import { useId, useState } from "react";
import { getDefinition } from "@/lib/glossary";

interface TermTooltipProps {
  term: string;
  children?: React.ReactNode;
  className?: string;
}

export function TermTooltip({ term, children, className = "" }: TermTooltipProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const def = getDefinition(term);
  const label = children ?? term;

  if (!def) return <>{label}</>;

  return (
    <span className={`relative inline-flex items-baseline ${className}`}>
      <button
        type="button"
        aria-describedby={tipId}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="border-b border-dotted border-current text-inherit cursor-help bg-transparent p-0"
      >
        {label}
      </button>
      {open && (
        <span
          role="tooltip"
          id={tipId}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 z-50 px-3 py-2.5 rounded-lg bg-neutral-900 text-white text-xs leading-relaxed shadow-xl"
        >
          <span className="block font-bold mb-1">{def.label}</span>
          <span className="block text-neutral-300">{def.definition}</span>
        </span>
      )}
    </span>
  );
}
