"use client";

/**
 * DemoShell — cockpit du parcours « Asterion Motion ».
 *
 * Orchestration : étape courante, mode (guided/director/explore), lecture
 * automatique (minuteur interruptible), raccourcis clavier, reset local, et
 * session de démonstration sécurisée (POST /auth/demo, aucun secret client) pour
 * activer les liens « Explorer dans l'application » sur le tenant réel seedé.
 *
 * Rend les VRAIS composants (ReviewGate via AiActivityTrace, DataStatusBadge).
 * IA SIMULÉE · ZÉRO APPEL EXTERNE · DÉMONSTRATION FICTIVE.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LogIn, ShieldCheck } from "lucide-react";

import { useAuth } from "@/lib/hooks/use-auth";
import { useDemoAccess } from "@/lib/hooks/use-demo-access";
import { ASTERION_BADGES } from "@/lib/demo/asterion-motion-data";
import {
  ASTERION_TOUR,
  TOUR_MODES,
  type TourMode,
  type TourStep,
} from "@/lib/demo/asterion-motion-tour";
import { AiActivityTrace } from "./ai-activity-trace";
import { DemoDirector } from "./demo-director";
import { DemoProgress } from "./demo-progress";
import { DemoReset } from "./demo-reset";
import { DemoShortcuts } from "./demo-shortcuts";
import { DemoSpotlight } from "./demo-spotlight";
import { DemoStepCard } from "./demo-step-card";

interface DemoShellProps {
  /** Parcours (défaut = tour Asterion Motion). Paramétrable pour une séquence sœur. */
  tour?: TourStep[];
  /** Badges permanents (défaut = fiction/IA simulée/hors-ligne). */
  badges?: readonly string[];
  /** Rendu de corps par étape (défaut = trace IA sur `isAiStep`). */
  renderStepBody?: (step: TourStep) => ReactNode;
  testId?: string;
  eyebrow?: string;
  title?: string;
  /**
   * Rend « Explorer dans l'application » comme une action contrôlée (assure
   * la session démo avant de naviguer vers une page protégée) au lieu d'un
   * simple lien. Défaut false : /demo/asterion-motion garde son lien direct
   * historique (destinations déjà accessibles au tenant démo courant).
   */
  controlledExplore?: boolean;
}

export function DemoShell({
  tour = ASTERION_TOUR,
  badges = ASTERION_BADGES,
  renderStepBody,
  testId = "demo-asterion",
  eyebrow = "CarbonCo · Démonstration produit",
  title = "Asterion Motion — revue ESG augmentée",
  controlledExplore = false,
}: DemoShellProps = {}) {
  const LAST = tour.length - 1;
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<TourMode>("guided");
  const [playing, setPlaying] = useState(false);

  const step = tour[current];

  const goTo = useCallback((i: number) => setCurrent(Math.max(0, Math.min(LAST, i))), [LAST]);
  const next = useCallback(() => setCurrent((c) => Math.min(LAST, c + 1)), [LAST]);
  const prev = useCallback(() => {
    setPlaying(false);
    setCurrent((c) => Math.max(0, c - 1));
  }, []);
  const reset = useCallback(() => {
    setPlaying(false);
    setCurrent(0);
  }, []);

  const selectMode = useCallback((m: TourMode) => {
    setMode(m);
    setPlaying(m === "director");
  }, []);

  // Minuteur du mode réalisateur — interrompu par tout changement d'étape/mode.
  useEffect(() => {
    if (mode !== "director" || !playing) return;
    const t = setTimeout(() => {
      setCurrent((c) => {
        if (c >= LAST) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, step.durationMs);
    return () => clearTimeout(t);
  }, [mode, playing, current, step.durationMs, LAST]);

  // Session démo sécurisée (active les liens d'exploration sur le tenant réel).
  const { auth, loginDemo } = useAuth();
  const { connected, loading: connecting, error: connectError, connect, enterDemo } =
    useDemoAccess(auth, loginDemo);

  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6"
      data-testid={testId}
    >
      {/* En-tête : marque, badges, session, raccourcis, reset */}
      <header className="relative flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-carbon-emerald-light">
              {eyebrow}
            </p>
            <h1 className="font-display text-xl font-bold text-white">
              {title}
            </h1>
          </div>
          <div className="relative flex items-center gap-2">
            <DemoShortcuts onNext={next} onPrev={prev} onReset={reset} />
            <DemoReset onReset={reset} />
          </div>
        </div>

        {/* Badges permanents (fiction, IA simulée, hors-ligne) */}
        <div className="flex flex-wrap gap-1.5" data-testid="demo-badges">
          {badges.map((b) => (
            <span
              key={b}
              className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
            >
              {b}
            </span>
          ))}
        </div>

        <DemoProgress current={current} onSelect={goTo} steps={tour} />
      </header>

      {/* Barre de mode + session */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Mode de démonstration" data-testid="demo-modes">
          {TOUR_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => selectMode(m.id)}
              title={m.help}
              data-testid={`demo-mode-${m.id}`}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                mode === m.id
                  ? "border-carbon-emerald bg-carbon-emerald/15 text-carbon-emerald-light"
                  : "border-white/15 text-white/70 hover:bg-white/5"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {connected ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border border-carbon-emerald/40 bg-carbon-emerald/10 px-2.5 py-1 text-xs font-medium text-carbon-emerald-light"
            data-testid="demo-session-connected"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Session démo active
          </span>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={connecting}
            data-testid="demo-connect"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:bg-white/5 disabled:opacity-50"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden />
            {connecting ? "Connexion…" : "Se connecter à la démo"}
          </button>
        )}
      </div>
      {connectError && (
        <p className="text-xs text-rose-300" role="alert" data-testid="demo-connect-error">
          {connectError}
        </p>
      )}

      {/* Mode réalisateur : contrôle lecture/pause */}
      {mode === "director" && (
        <DemoDirector
          playing={playing}
          onToggle={() => setPlaying((p) => !p)}
          current={current}
          total={tour.length}
        />
      )}

      {/* Contenu de l'étape */}
      <main className="flex-1">
        <DemoSpotlight active={mode !== "explore"}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
            <DemoStepCard
              step={step}
              onExplore={controlledExplore ? (href) => void enterDemo(href) : undefined}
              exploreLoading={controlledExplore ? connecting : false}
              exploreError={controlledExplore ? connectError : null}
            >
              {renderStepBody ? renderStepBody(step) : step.isAiStep ? <AiActivityTrace /> : null}
            </DemoStepCard>
          </div>
        </DemoSpotlight>
      </main>

      {/* Navigation */}
      <nav className="flex items-center justify-between" aria-label="Navigation du parcours">
        <button
          type="button"
          onClick={prev}
          disabled={current === 0}
          data-testid="demo-prev"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/5 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Précédent
        </button>
        <span className="text-xs text-white/50" data-testid="demo-step-counter">
          {current + 1} / {tour.length}
        </span>
        <button
          type="button"
          onClick={next}
          disabled={current === LAST}
          data-testid="demo-next"
          className="inline-flex items-center gap-1.5 rounded-lg bg-carbon-emerald px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-carbon-emerald/90 disabled:opacity-40"
        >
          Suivant
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </nav>
    </div>
  );
}

export default DemoShell;
