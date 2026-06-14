"use client";

/**
 * DemoExperience — COMPOSANT RACINE de la démo cinématique /demo.
 *
 * Point d'entrée monté par la page /demo. Il :
 *   1. instancie l'horloge de la timeline via useDemoTimelineController() (la
 *      SEULE instance « propriétaire » de l'état — tout le reste de l'arbre lit
 *      cet état via DemoTimelineContext / useDemoTimeline) ;
 *   2. démarre l'horloge au montage en lecture nominale (hors mouvement réduit) ;
 *   3. branche les raccourcis clavier globaux (Échap = passer, Espace = pause) ;
 *   4. expose le contexte aux enfants et choisit la scène à rendre :
 *        • mouvement réduit  → snapshot statique (état final, aucune animation) ;
 *        • lecture nominale  → scène animée pilotée par l'horloge.
 *
 * Composant ORCHESTRATEUR : c'est le seul endroit qui DÉCLENCHE l'horloge
 * (start au montage) et la réagit aux commandes utilisateur (skip / togglePause).
 * Les scènes et l'indicateur de phases restent purement présentationnels : ils
 * lisent le contexte et s'animent pour tenir dans la durée de chaque moment.
 *
 * prefers-reduced-motion : l'horloge N'EST PAS démarrée (pas d'auto-avance) et
 * l'on rend directement le snapshot statique. C'est `timeline.isReducedMotion`
 * (exposé par le contrôleur) qui fait foi.
 *
 * Nettoyage : l'effet clavier retire systématiquement son écouteur au démontage
 * (ou au changement d'identité des handlers). Aucun timer n'est posé ici —
 * l'horloge interne est gérée par le contrôleur, qui se nettoie lui-même.
 */

import { useEffect } from "react";

import { DemoHeader } from "@/components/demo/demo-header";
import { DemoPhaseIndicator } from "@/components/demo/demo-phase-indicator";
import { DemoStage } from "@/components/demo/demo-stage";
import { DemoStaticSnapshot } from "@/components/demo/demo-static-snapshot";
import {
  DemoTimelineContext,
  useDemoTimelineController,
} from "@/lib/hooks/use-demo-timeline";

export function DemoExperience() {
  // Instance « propriétaire » de l'horloge : c'est CE composant qui possède
  // l'état de la timeline et le partage via le Provider plus bas.
  const timeline = useDemoTimelineController();

  // Démarre l'horloge au montage, UNIQUEMENT en lecture nominale. Sous mouvement
  // réduit, on n'auto-avance pas : le snapshot statique est rendu à la place.
  useEffect(() => {
    if (!timeline.isReducedMotion) {
      timeline.start();
    }
    // On ne réagit qu'au passage en/hors mouvement réduit : `start` est stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline.isReducedMotion]);

  // Raccourcis clavier globaux de la démo :
  //   • Échap  → passer directement au CTA final (skip) ;
  //   • Espace → basculer pause / reprise (togglePause), sans défilement de page.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        timeline.skip();
        return;
      }
      // On teste `code` (« Space ») plutôt que `key` (" ") pour rester robuste
      // quelle que soit la disposition clavier, et on neutralise le défilement.
      if (event.code === "Space") {
        event.preventDefault();
        timeline.togglePause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // skip / togglePause sont stables (useCallback) : on dépend des méthodes,
    // pas de l'objet `timeline` recréé à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline.skip, timeline.togglePause]);

  return (
    <DemoTimelineContext.Provider value={timeline}>
      <div
        data-testid="demo-experience"
        className="relative w-full min-h-screen"
      >
        {/* En-tête fixe : branding + contrôles (passer / pause). */}
        <DemoHeader />

        {/* Scène centrale : snapshot statique en mouvement réduit, sinon la
            scène animée pilotée par l'horloge. */}
        {timeline.isReducedMotion ? <DemoStaticSnapshot /> : <DemoStage />}

        {/* Pied de page : indicateur d'avancement (masqué en mouvement réduit). */}
        <DemoPhaseIndicator />
      </div>
    </DemoTimelineContext.Provider>
  );
}
