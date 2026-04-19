"use client";
import { CountUp } from "./shared/count-up";

// Sprint P0 (19 avril 2026) — KPIs vérifiables publiquement.
// Ancienne liste (168 agents spécialisés, 99.97 % uptime, +340 % ROI an 1)
// retirée faute de preuve documentable immédiatement sur /trust.
const stats = [
  { value: 7,  label: "Branches métier catalogées",     suffix: "", decimals: 0 },
  { value: 42, label: "Combinaisons secteur × branche", suffix: "", decimals: 0 },
  { value: 1,  label: "Noyau live — Luxe Finance",      suffix: "", decimals: 0 },
  { value: 2,  label: "Démonstrations cadrées",         suffix: "", decimals: 0 },
];

export function SectionStats() {
  return (
    <section className="nhp-stats">
      <div className="nhp-container">
        <div className="nhp-stats-grid">
          {stats.map((s, i) => (
            <div key={i} className="nhp-stat-cell">
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
