"use client";
import { useEffect, useMemo, useState } from "react";

export function LiveKpi() {
  const [roi, setRoi] = useState(342);
  const [hours, setHours] = useState(1847);
  const [tasks, setTasks] = useState(12483);

  useEffect(() => {
    const id = setInterval(() => {
      setRoi((v) => +(v + (Math.random() - 0.3) * 2).toFixed(1));
      setHours((v) => v + Math.floor(Math.random() * 4));
      setTasks((v) => v + Math.floor(Math.random() * 7));
    }, 1600);
    return () => clearInterval(id);
  }, []);

  const initSpark = useMemo(() => Array.from({ length: 24 }, (_, i) => 30 + Math.sin(i / 3) * 15 + Math.random() * 10), []);
  const [sparkData, setSparkData] = useState(initSpark);

  useEffect(() => {
    const id = setInterval(() => {
      setSparkData((d) => [...d.slice(1), 30 + Math.random() * 40]);
    }, 900);
    return () => clearInterval(id);
  }, []);

  const sparkPath = useMemo(() => {
    const max = Math.max(...sparkData);
    const min = Math.min(...sparkData);
    const rng = max - min || 1;
    return sparkData.map((v, i) => {
      const x = (i / (sparkData.length - 1)) * 100;
      const y = 100 - ((v - min) / rng) * 80 - 10;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  }, [sparkData]);

  return (
    <div className="nhp-kpi-card">
      <div className="nhp-kpi-header">
        <div className="nhp-kpi-dot" />
        <span>Live · dernière heure</span>
      </div>
      <div className="nhp-kpi-row">
        <div>
          <div className="nhp-kpi-label">ROI annualisé</div>
          <div className="nhp-kpi-value">+{roi.toFixed(1)}<span>%</span></div>
        </div>
        <div>
          <div className="nhp-kpi-label">Heures économisées</div>
          <div className="nhp-kpi-value">{hours.toLocaleString("fr-FR")}<span>h</span></div>
        </div>
        <div>
          <div className="nhp-kpi-label">Tâches exécutées</div>
          <div className="nhp-kpi-value">{tasks.toLocaleString("fr-FR")}</div>
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
        <span>168 agents</span><span>·</span><span>42 déploiements</span><span>·</span><span>99.97% uptime</span>
      </div>
    </div>
  );
}
