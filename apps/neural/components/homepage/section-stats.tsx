"use client";
import { CountUp } from "./shared/count-up";

const stats = [
  { value: 168,   label: "Agents spécialisés",              suffix: "",   decimals: 0 },
  { value: 42,    label: "Combinaisons secteur × branche",   suffix: "",   decimals: 0 },
  { value: 99.97, label: "Uptime",                           suffix: "%",  decimals: 2 },
  { value: 340,   label: "ROI moyen an 1",                   suffix: "%",  decimals: 0, prefix: "+" },
];

export function SectionStats() {
  return (
    <section className="nhp-stats">
      <div className="nhp-container">
        <div className="nhp-stats-grid">
          {stats.map((s, i) => (
            <div key={i} className="nhp-stat-cell">
              <div className="nhp-stat-value">
                <CountUp target={s.value} suffix={s.suffix} prefix={s.prefix} decimals={s.decimals} />
              </div>
              <div className="nhp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
