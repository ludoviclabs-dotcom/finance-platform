"use client";

/**
 * DemoHeader — barre supérieure de la démo cinématique /demo.
 *
 * Composant présentationnel : il lit l'état de l'horloge via useDemoTimeline()
 * et expose les seuls contrôles globaux de la démo (lecture / pause et un
 * raccourci « Passer »). Il ne pilote jamais la progression temporelle :
 * l'auto-avancement reste géré par le hook de timeline.
 *
 * - Gauche : logo « Carbon&Co » (le « & » et « Co » en accent emerald).
 * - Droite : bouton lecture/pause (masqué une fois la démo terminée) puis le
 *   bouton « Passer » qui saute directement au CTA final.
 */

import { Pause, Play } from "lucide-react";

import { Z } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

export function DemoHeader(): React.JSX.Element {
  const { status, isComplete, togglePause, skip } = useDemoTimeline();

  const isPlaying = status === "playing";

  return (
    <header
      className="pointer-events-none fixed inset-x-0 top-0 flex items-center justify-between px-5 py-4 sm:px-8"
      style={{ zIndex: Z.header }}
    >
      {/* Gauche — logo Carbon&Co */}
      <span className="text-xl font-extrabold tracking-tighter text-white">
        Carbon<span className="text-emerald-400">&amp;Co</span>
      </span>

      {/* Droite — contrôles globaux */}
      <div className="pointer-events-auto flex items-center gap-2">
        {!isComplete ? (
          <button
            type="button"
            onClick={togglePause}
            aria-label={isPlaying ? "Mettre la démonstration en pause" : "Reprendre la démonstration"}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {isPlaying ? "Pause" : "Lecture"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={skip}
          aria-label="Passer la démonstration et accéder à l'offre"
          data-testid="demo-skip"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Passer
        </button>
      </div>
    </header>
  );
}
