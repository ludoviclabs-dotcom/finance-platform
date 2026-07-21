"use client";

/**
 * Anneau de progression SVG générique — partagé par les KPI du hero et les
 * scores Stratégique/Critique (même géométrie d'arc, seuls rayon/couleur/
 * valeur changent). Évite une 3e copie du même calcul stroke-dasharray.
 */

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface Props {
  value: number; // fraction 0..1
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}

export default function MxScoreRing({ value, size, strokeWidth, color, trackColor = "var(--mx-chip)", children }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [filled, setFilled] = useState(!!prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) {
      setFilled(true);
      return;
    }
    const t = setTimeout(() => setFilled(true), 180);
    return () => clearTimeout(t);
  }, [prefersReducedMotion]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (filled ? Math.max(0, Math.min(1, value)) * circumference : 0).toFixed(1);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference.toFixed(1)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 1.3s cubic-bezier(.16,1,.3,1)" }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          {children}
        </div>
      )}
    </div>
  );
}
