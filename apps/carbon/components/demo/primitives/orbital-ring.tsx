"use client";

/**
 * OrbitalRing — halo orbital « réacteur de calcul » autour du compteur GES.
 *
 * C'est la « animation qui tourne » : deux anneaux pointillés concentriques
 * tournent en sens inverse (effet de profondeur), portant des nœuds en orbite
 * qui pulsent, le tout sur un voile radial emerald. Le contenu (`children` —
 * typiquement le compteur 1 847 tCO₂e) est centré au cœur de l'anneau.
 *
 * Composant PRÉSENTATIONNEL et purement décoratif (aria-hidden sur les anneaux).
 * `active` déclenche la rotation ; tant qu'il est faux (ou sous mouvement
 * réduit) les anneaux sont rendus figés, sans aucune classe d'animation.
 *
 * Les rotations sont portées par des <div> pleine taille (transform-origin
 * centré naturel) : faire tourner le conteneur fait orbiter les nœuds qu'il
 * contient. Neutralisé sous prefers-reduced-motion via les classes CSS.
 */

import type { ReactNode } from "react";

import { useReducedMotion } from "framer-motion";

import { DEMO_CSS } from "@/components/demo/demo-tokens";

type OrbitalRingProps = {
  /** Démarre la rotation des anneaux (sinon rendu figé). */
  active?: boolean;
  /** Diamètre du halo en pixels. Défaut 320. */
  size?: number;
  /** Contenu centré au cœur de l'anneau (le compteur). */
  children: ReactNode;
  /** Classes additionnelles sur le conteneur racine. */
  className?: string;
};

/** Un nœud emerald posé sur un anneau (orbite avec la rotation du parent). */
function OrbitNode({
  cx,
  cy,
  r = 3.4,
  pulse,
}: {
  cx: number;
  cy: number;
  r?: number;
  pulse: boolean;
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="#34D399"
      className={pulse ? DEMO_CSS.orbitNode : undefined}
      // fill-box + center : la pulsation scale autour du centre du nœud, quel
      // que soit le transform-box par défaut de l'agent (HTML vs SVG).
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    />
  );
}

export function OrbitalRing({
  active = false,
  size = 320,
  children,
  className,
}: OrbitalRingProps) {
  const reduce = useReducedMotion() ?? false;
  const spinning = active && !reduce;

  return (
    <div
      className={[
        "relative inline-flex items-center justify-center",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Voile radial emerald derrière le compteur. Centrage par margin:auto
          (et NON par translate) pour ne pas entrer en conflit avec le transform
          de rotation des anneaux. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto rounded-full blur-2xl"
        style={{
          width: size * 0.74,
          height: size * 0.74,
          background:
            "radial-gradient(circle, rgba(52,211,153,0.22), transparent 70%)",
        }}
      />

      {/* Anneau extérieur (rotation horaire). */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 m-auto ${
          spinning ? DEMO_CSS.orbitSpin : ""
        }`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 200 200" className="h-full w-full" focusable="false">
          <circle
            cx="100"
            cy="100"
            r="92"
            fill="none"
            stroke="rgba(52,211,153,0.35)"
            strokeWidth="1"
            strokeDasharray="2 9"
            strokeLinecap="round"
          />
          <OrbitNode cx={100} cy={8} pulse={spinning} />
          <OrbitNode cx={192} cy={100} r={2.6} pulse={spinning} />
        </svg>
      </div>

      {/* Anneau intérieur (rotation antihoraire, plein discret). */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 m-auto ${
          spinning ? DEMO_CSS.orbitSpinRev : ""
        }`}
        style={{ width: size * 0.78, height: size * 0.78 }}
      >
        <svg viewBox="0 0 200 200" className="h-full w-full" focusable="false">
          <circle
            cx="100"
            cy="100"
            r="86"
            fill="none"
            stroke="rgba(34,211,238,0.28)"
            strokeWidth="1"
            strokeDasharray="14 8"
          />
          <OrbitNode cx={100} cy={14} r={2.8} pulse={spinning} />
        </svg>
      </div>

      {/* Cœur : le compteur (au-dessus des anneaux). */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
