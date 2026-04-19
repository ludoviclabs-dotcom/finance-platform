"use client";
import { useMemo } from "react";

/**
 * LiveKpi — aperçu visuel d'un dashboard DAF type (non connecté à des données réelles).
 *
 * Sprint P0 (19 avril 2026) : la version précédente simulait des incréments aléatoires
 * sous le libellé « Live · dernière heure », ce qui relevait d'un "fake product".
 * Cette version est explicitement marquée comme aperçu, avec des valeurs statiques
 * d'exemple et sans simulation trompeuse.
 */
export function LiveKpi() {
  // Courbe décorative déterministe — pas de simulation live.
  const sparkPath = useMemo(() => {
    const pts = Array.from({ length: 24 }, (_, i) => 32 + Math.sin(i / 3) * 14 + (i * 1.2));
    const max = Math.max(...pts);
    const min = Math.min(...pts);
    const rng = max - min || 1;
    return pts.map((v, i) => {
      const x = (i / (pts.length - 1)) * 100;
      const y = 100 - ((v - min) / rng) * 80 - 10;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  }, []);

  return (
    <div className="nhp-kpi-card">
      <div className="nhp-kpi-header">
        <div className="nhp-kpi-dot" />
        <span>Aperçu dashboard DAF</span>
      </div>
      <div className="nhp-kpi-row">
        <div>
          <div className="nhp-kpi-label">Heures économisées / mois</div>
          <div className="nhp-kpi-value">—<span>h</span></div>
        </div>
        <div>
          <div className="nhp-kpi-label">Tâches exécutées</div>
          <div className="nhp-kpi-value">—</div>
        </div>
        <div>
          <div className="nhp-kpi-label">Consolidations livrées</div>
          <div className="nhp-kpi-value">—</div>
        </div>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="nhp-kpi-spark">
        <defs>
          <linearGradient id="nhp-sp1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={`${sparkPath} L 100 100 L 0 100 Z`} fill="url(#nhp-sp1)"/>
        <path d={sparkPath} stroke="#A78BFA" strokeWidth="1" fill="none"/>
      </svg>
      <div className="nhp-kpi-foot">
        <span>Chiffres renseignés après cadrage</span>
      </div>
    </div>
  );
}
