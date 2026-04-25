"use client";

import { useMemo } from "react";

import { CountUp } from "./count-up";

interface DemoMetric {
  label: string;
  value: number;
  suffix?: string;
}

const demoMetrics: DemoMetric[] = [
  { label: "Heures économisées / mois", value: 38, suffix: "h" },
  { label: "Tâches exécutées", value: 124 },
  { label: "Consolidations livrées", value: 12 },
];

/**
 * LiveKpi — aperçu visuel d'un dashboard DAF type.
 *
 * Cette carte reste un aperçu : les chiffres sont fixes, utilisés uniquement
 * pour montrer le rendu visuel du dashboard sans simuler une activité live.
 */
export function LiveKpi() {
  // Courbe décorative déterministe — pas de simulation temps réel.
  const sparkPath = useMemo(() => {
    const pts = Array.from(
      { length: 24 },
      (_, i) => 32 + Math.sin(i / 3) * 14 + i * 1.2,
    );
    const max = Math.max(...pts);
    const min = Math.min(...pts);
    const rng = max - min || 1;

    return pts
      .map((v, i) => {
        const x = (i / (pts.length - 1)) * 100;
        const y = 100 - ((v - min) / rng) * 80 - 10;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, []);

  return (
    <div className="nhp-kpi-card">
      <div className="nhp-kpi-header">
        <div className="nhp-kpi-dot" />
        <span>Aperçu dashboard DAF</span>
      </div>

      <div className="nhp-kpi-row">
        {demoMetrics.map((metric) => (
          <div key={metric.label}>
            <div className="nhp-kpi-label">{metric.label}</div>
            <div className="nhp-kpi-value">
              <CountUp target={metric.value} />
              {metric.suffix ? <span>{metric.suffix}</span> : null}
            </div>
          </div>
        ))}
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="nhp-kpi-spark">
        <defs>
          <linearGradient id="nhp-sp1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${sparkPath} L 100 100 L 0 100 Z`} fill="url(#nhp-sp1)" />
        <path d={sparkPath} stroke="#A78BFA" strokeWidth="1" fill="none" />
      </svg>

      <div className="nhp-kpi-foot">
        <span>Données générées à titre de démonstration</span>
      </div>
    </div>
  );
}
