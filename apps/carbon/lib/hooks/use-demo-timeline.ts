"use client";

/**
 * useDemoTimeline — horloge de la démo cinématique /demo.
 *
 * MODÈLE : la timeline est une HORLOGE qui auto-avance de moment en moment.
 * Chaque moment a une durée fixe (MOMENT_DURATIONS, demo-tokens.ts). Quand un
 * moment se termine, on passe au suivant. Les composants de scène sont
 * PRÉSENTATIONNELS : ils lisent `currentMoment` via le contexte et jouent leurs
 * animations pour tenir dans la durée du moment — ils n'ont PAS à rappeler la
 * timeline (pas de course entre onAnimationComplete et l'horloge).
 *
 * - `pause`/`resume` gèlent la progression (reprise au temps restant exact).
 * - `skip` saute au CTA final (Phase 7) en invalidant le timer courant.
 * - `replay` rejoue depuis le début (bump de `runId` → remount des scènes).
 * - prefers-reduced-motion : pas d'auto-avancement ; navigation manuelle par
 *   phase via `goToPhase` (la scène statique est rendue par DemoExperience).
 * - L'onglet passé en arrière-plan met la démo en pause automatiquement.
 *
 * Le Provider (<DemoTimelineContext.Provider>) est monté dans
 * components/demo/demo-experience.tsx ; les scènes consomment via useDemoTimeline().
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  MOMENT_SEQUENCE,
  PHASE_OF_MOMENT,
  phaseOfMoment,
  type DemoMoment,
  type DemoPhase,
} from "@/components/demo/demo-types";
import { MOMENT_DURATIONS } from "@/components/demo/demo-tokens";

export type DemoStatus = "idle" | "playing" | "paused" | "complete";

export interface DemoTimelineApi {
  status: DemoStatus;
  currentMoment: DemoMoment;
  currentPhase: DemoPhase;
  /** Index du moment courant dans MOMENT_SEQUENCE. */
  index: number;
  isReducedMotion: boolean;
  isMobile: boolean;
  isComplete: boolean;
  /** Bumpé à chaque replay → sert de `key` pour remonter les scènes. */
  runId: number;

  start: () => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  skip: () => void;
  replay: () => void;
  /** Navigation manuelle par phase (mode reduced-motion). */
  goToPhase: (phase: DemoPhase) => void;
  /**
   * Saut interactif vers une phase EN LECTURE (scrubber de chapitres du header).
   * Repositionne l'horloge au premier moment de la phase et relance la lecture
   * (hors mouvement réduit). C'est l'équivalent « seek » d'un lecteur vidéo.
   */
  seekToPhase: (phase: DemoPhase) => void;
}

const LAST_INDEX = MOMENT_SEQUENCE.length - 1;

function firstIndexOfPhase(phase: DemoPhase): number {
  const i = MOMENT_SEQUENCE.findIndex((m) => PHASE_OF_MOMENT[m] === phase);
  return i === -1 ? 0 : i;
}

/**
 * Contrôleur de la timeline. À instancier UNE SEULE FOIS (dans DemoExperience),
 * puis à diffuser via DemoTimelineContext.
 */
export function useDemoTimelineController(): DemoTimelineApi {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [runId, setRunId] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);
  /** Temps restant pour le moment courant (null = utiliser la durée pleine). */
  const remainingRef = useRef<number | null>(null);
  /** Index courant, accessible dans les callbacks sans closure périmée. */
  const indexRef = useRef(index);
  indexRef.current = index;
  /** Vrai si la pause vient d'un passage de l'onglet en arrière-plan. */
  const autoPausedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /* ── Détection prefers-reduced-motion + mobile ────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsReducedMotion(motion.matches);
      setIsMobile(mobile.matches);
    };
    sync();
    motion.addEventListener("change", sync);
    mobile.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      mobile.removeEventListener("change", sync);
    };
  }, []);

  /* ── Reset du temps restant à chaque changement de moment ─────────────────── */
  useEffect(() => {
    remainingRef.current = null;
  }, [index]);

  /* ── Boucle d'auto-avancement ─────────────────────────────────────────────── */
  useEffect(() => {
    if (status !== "playing" || isReducedMotion) return;
    const moment = MOMENT_SEQUENCE[index];
    const duration = MOMENT_DURATIONS[moment];

    // Moment terminal (cta-final) : pas de timer, on marque complete.
    if (duration <= 0 || index >= LAST_INDEX) {
      setStatus("complete");
      return;
    }

    const wait = remainingRef.current ?? duration;
    startRef.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    timerRef.current = window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, LAST_INDEX));
    }, wait);

    return () => clearTimer();
  }, [index, status, runId, isReducedMotion, clearTimer]);

  /* ── Auto-pause quand l'onglet passe en arrière-plan ──────────────────────── */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.hidden) {
        if (status === "playing") {
          autoPausedRef.current = true;
          pauseInternal();
        }
      } else if (autoPausedRef.current) {
        autoPausedRef.current = false;
        setStatus((s) => (s === "paused" ? "playing" : s));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // pauseInternal est stable (déclaré plus bas via useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const pauseInternal = useCallback(() => {
    setStatus((s) => {
      if (s !== "playing") return s;
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = now - startRef.current;
      const moment = MOMENT_SEQUENCE[indexRef.current];
      const base = remainingRef.current ?? MOMENT_DURATIONS[moment];
      remainingRef.current = Math.max(0, base - elapsed);
      return "paused";
    });
    clearTimer();
  }, [clearTimer]);

  /* ── API publique ─────────────────────────────────────────────────────────── */

  const start = useCallback(() => {
    setStatus((s) => (s === "idle" || s === "paused" ? "playing" : s));
  }, []);

  const pause = useCallback(() => {
    autoPausedRef.current = false;
    pauseInternal();
  }, [pauseInternal]);

  const resume = useCallback(() => {
    setStatus((s) => (s === "paused" ? "playing" : s));
  }, []);

  const togglePause = useCallback(() => {
    setStatus((s) => {
      if (s === "playing") {
        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const elapsed = now - startRef.current;
        const moment = MOMENT_SEQUENCE[indexRef.current];
        const base = remainingRef.current ?? MOMENT_DURATIONS[moment];
        remainingRef.current = Math.max(0, base - elapsed);
        clearTimer();
        return "paused";
      }
      if (s === "paused") return "playing";
      return s;
    });
  }, [clearTimer]);

  const skip = useCallback(() => {
    clearTimer();
    remainingRef.current = null;
    setIndex(LAST_INDEX);
    setStatus("complete");
  }, [clearTimer]);

  const replay = useCallback(() => {
    clearTimer();
    remainingRef.current = null;
    autoPausedRef.current = false;
    setIndex(0);
    setRunId((r) => r + 1);
    setStatus("playing");
  }, [clearTimer]);

  const goToPhase = useCallback(
    (phase: DemoPhase) => {
      clearTimer();
      remainingRef.current = null;
      setIndex(firstIndexOfPhase(phase));
    },
    [clearTimer],
  );

  const seekToPhase = useCallback(
    (phase: DemoPhase) => {
      clearTimer();
      remainingRef.current = null;
      setIndex(firstIndexOfPhase(phase));
      // En lecture nominale, on relance immédiatement l'horloge depuis la phase
      // ciblée (effet « seek »). Sous mouvement réduit on ne touche pas au statut.
      if (!isReducedMotion) {
        setStatus("playing");
      }
    },
    [clearTimer, isReducedMotion],
  );

  /* ── Nettoyage au démontage ───────────────────────────────────────────────── */
  useEffect(() => clearTimer, [clearTimer]);

  const currentMoment = MOMENT_SEQUENCE[index];

  return {
    status,
    currentMoment,
    currentPhase: phaseOfMoment(currentMoment),
    index,
    isReducedMotion,
    isMobile,
    isComplete: currentMoment === "cta-final",
    runId,
    start,
    pause,
    resume,
    togglePause,
    skip,
    replay,
    goToPhase,
    seekToPhase,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   CONTEXTE
   ──────────────────────────────────────────────────────────────────────────── */

export const DemoTimelineContext = createContext<DemoTimelineApi | null>(null);

/** Consomme la timeline depuis n'importe quelle scène. */
export function useDemoTimeline(): DemoTimelineApi {
  const ctx = useContext(DemoTimelineContext);
  if (!ctx) {
    throw new Error(
      "useDemoTimeline doit être utilisé dans un <DemoTimelineContext.Provider> (voir DemoExperience).",
    );
  }
  return ctx;
}
