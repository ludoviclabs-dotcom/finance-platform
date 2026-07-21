"use client";

/**
 * DemoDirector — barre de contrôle du mode « réalisateur » (~2 min). Le minuteur
 * d'avancement vit dans DemoShell ; ce composant pilote lecture/pause. Toute
 * interaction utilisateur (navigation) interrompt l'enchaînement (DemoShell).
 */

import { Pause, Play } from "lucide-react";

export function DemoDirector({
  playing,
  onToggle,
  current,
  total,
}: {
  playing: boolean;
  onToggle: () => void;
  current: number;
  total: number;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
      data-testid="demo-director"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? "Pause" : "Lecture"}
        data-testid="demo-director-toggle"
        className="inline-flex items-center gap-1.5 rounded-lg bg-carbon-emerald px-2.5 py-1 text-xs font-semibold text-white"
      >
        {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
        {playing ? "Pause" : "Lecture"}
      </button>
      <span className="text-xs text-white/60">
        Lecture automatique · {current + 1}/{total}
      </span>
    </div>
  );
}
