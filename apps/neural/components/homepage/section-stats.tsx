"use client";

import { PUBLIC_METRICS } from "@/lib/public-catalog";
import { CountUp } from "./shared/count-up";

const stats = [
  {
    value: PUBLIC_METRICS.liveAgents,
    label: "Agents avec donnees Excel",
    suffix: "",
    decimals: 0,
  },
  {
    value: PUBLIC_METRICS.runtimeWorkbooks,
    label: "Workbooks embarques",
    suffix: "",
    decimals: 0,
  },
  {
    value: PUBLIC_METRICS.externalNeuralWorkbooks,
    label: "Workbooks NEURAL audites",
    suffix: "",
    decimals: 0,
  },
  {
    value: PUBLIC_METRICS.liveCells,
    label: `Cellules alimentees / ${PUBLIC_METRICS.frameworkCells}`,
    suffix: "",
    decimals: 0,
  },
];

export function SectionStats() {
  return (
    <section className="nhp-stats">
      <div className="nhp-container">
        <div className="nhp-stats-grid">
          {stats.map((s) => (
            <div key={s.label} className="nhp-stat-cell">
              <div className="nhp-stat-value">
                <CountUp target={s.value} suffix={s.suffix} decimals={s.decimals} />
              </div>
              <div className="nhp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
