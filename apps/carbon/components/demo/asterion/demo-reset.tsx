"use client";

/**
 * DemoReset — recommence le parcours depuis l'étape 1 (état local du cockpit ;
 * ne touche PAS la base — le reset des DONNÉES est le workflow demo-scenario).
 */

import { RotateCcw } from "lucide-react";

export function DemoReset({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-white/70 transition hover:bg-white/5"
      data-testid="demo-reset"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      Recommencer
    </button>
  );
}
