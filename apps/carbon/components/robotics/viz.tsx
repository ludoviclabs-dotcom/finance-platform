"use client";

/**
 * Briques communes des infographies de /robotics (sections 02 à 07) : un
 * graphique de 660px de large et son panneau « Lecture », qui affiche la
 * synthèse par défaut puis le détail de l'élément choisi. Le texte long vit
 * dans ce panneau, à la demande, plutôt qu'en cartes empilées.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Frame } from "@/components/materials/industry/Frame";

/** Largeur des graphiques : 660 + 32 d'écart + 280 de panneau tiennent dans
 *  le cadre de la page (1200px moins ses marges). */
export const VIZ_W = 660;

/**
 * Vrai dès que l'élément approche de la fenêtre, une fois pour toutes. Les
 * animations ne jouent qu'à partir de là : jouées au chargement, elles
 * finiraient hors champ. La marge basse déclenche l'animation avant que le
 * graphique n'entre à l'écran, pour qu'il ne disparaisse jamais sous les yeux.
 */
export function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px 160px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  return [ref, inView];
}

/**
 * Avancement 0 → 1 d'un compteur, rejoué à chaque changement de `replayKey`.
 * Vaut 1 au rendu serveur et sous prefers-reduced-motion : les chiffres
 * s'affichent toujours dans leur valeur finale sans JavaScript.
 */
export function useCountUp(run: boolean, replayKey: unknown, duration = 1100): number {
  const [t, setT] = useState(1);

  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      setT(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, replayKey, duration]);

  return t;
}

export interface ViewOption<V extends string> {
  id: V;
  label: string;
  icon?: ReactNode;
}

/** Contrôle segmenté de la peau (radios natives), comme le treemap de /materials. */
export function ViewSwitch<V extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: V;
  options: readonly ViewOption<V>[];
  onChange: (next: V) => void;
}) {
  return (
    <div className="ind-seg" role="group" aria-label="Choisir la vue">
      {options.map(o => (
        <label key={o.id} className="ind-seg-opt">
          <input type="radio" name={name} checked={value === o.id} onChange={() => onChange(o.id)} />
          {o.icon}
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** Le cadre filaire, le graphique à gauche, le panneau « Lecture » à droite. */
export function VizFrame({
  frameRef,
  play,
  chart,
  panel,
}: {
  frameRef: React.Ref<HTMLElement>;
  play: boolean;
  chart: ReactNode;
  panel: ReactNode;
}) {
  return (
    <Frame ref={frameRef} className={play ? "rb-play" : undefined} style={{ padding: 24 }}>
      <div className="rb-split">
        <div className="flex flex-wrap items-stretch" style={{ gap: "28px 32px" }}>
          <div className="min-w-0 overflow-x-auto" style={{ flex: `999 1 ${VIZ_W}px` }}>
            <div className="mx-auto" style={{ width: VIZ_W }}>
              {chart}
            </div>
          </div>
          <aside className="rb-panel min-w-0" style={{ flex: "1 1 280px" }} aria-live="polite">
            {panel}
          </aside>
        </div>
      </div>
    </Frame>
  );
}

/** En-tête de section : titre et chapô à gauche, sélecteur de vue à droite. */
export function SectionHeading({ title, lead, aside }: { title: ReactNode; lead: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between flex-wrap" style={{ gap: "20px 32px", marginBottom: 28 }}>
      <div style={{ maxWidth: 640 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 32,
            lineHeight: "36px",
            letterSpacing: ".02em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: "24px", color: "var(--ink-78)" }}>{lead}</p>
      </div>
      {aside}
    </div>
  );
}

export function PanelKicker({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        display: "block",
        margin: "0 0 6px",
        fontSize: 12,
        lineHeight: "16px",
        letterSpacing: ".08em",
        textTransform: "uppercase",
        fontWeight: 600,
        color: "var(--color-accent-700)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function PanelTitle({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <h3
      style={{
        margin: "0 0 10px",
        fontFamily: "var(--font-heading)",
        fontWeight: 600,
        fontSize: 26,
        lineHeight: "28px",
        letterSpacing: ".02em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </h3>
  );
}

export function PanelText({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return (
    <p style={{ margin: "0 0 14px", fontSize: small ? 13 : 14, lineHeight: small ? "20px" : "22px", color: "var(--ink-78)" }}>
      {children}
    </p>
  );
}

export function PanelNote({ children }: { children: ReactNode }) {
  return <p style={{ margin: "14px 0 0", fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>{children}</p>;
}

export function PanelHint({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: "18px 0 0", fontSize: 14, lineHeight: "20px", fontWeight: 600, color: "var(--color-accent-700)" }}>
      {children}
    </p>
  );
}

/** Grand chiffre du panneau, avec son libellé et sa ligne de provenance. */
export function PanelFigure({ value, label, meta }: { value: ReactNode; label: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: 2, padding: "10px 0", borderTop: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}>
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: 28,
          lineHeight: "30px",
          letterSpacing: ".02em",
          fontFeatureSettings: "'tnum' 1",
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 13, lineHeight: "18px", color: "var(--ink-78)" }}>{label}</span>
      {meta && (
        <span className="flex items-center flex-wrap" style={{ gap: 8, marginTop: 2, fontSize: 12, lineHeight: "18px", color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
          {meta}
        </span>
      )}
    </div>
  );
}

const chevron = (d: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Surtitre du détail, avec précédent / suivant / retour à la synthèse. */
export function PanelHead({
  kicker,
  onPrev,
  onNext,
  onClose,
  prevLabel = "Précédent",
  nextLabel = "Suivant",
}: {
  kicker: ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  prevLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 8 }}>
      <PanelKicker style={{ margin: 0 }}>{kicker}</PanelKicker>
      <span className="flex" style={{ gap: 4 }}>
        {onPrev && (
          <button type="button" className="rb-ib" onClick={onPrev} aria-label={prevLabel}>
            {chevron("m15 18-6-6 6-6")}
          </button>
        )}
        {onNext && (
          <button type="button" className="rb-ib" onClick={onNext} aria-label={nextLabel}>
            {chevron("m9 18 6-6-6-6")}
          </button>
        )}
        <button type="button" className="rb-ib" onClick={onClose} aria-label="Revenir à la synthèse">
          {chevron("M18 6 6 18M6 6l12 12")}
        </button>
      </span>
    </div>
  );
}

/** Pas suivant ou précédent dans une liste circulaire. */
export function cycle<T>(list: readonly T[], current: T, dir: 1 | -1): T {
  const i = list.indexOf(current);
  return list[(i + dir + list.length) % list.length];
}
