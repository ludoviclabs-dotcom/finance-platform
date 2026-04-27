/**
 * UptimeBarChart — mini-bars 90 jours avec hover tooltip.
 * Données générées localement à partir de l'uptime moyen (mock cohérent).
 * Transitionnera vers un fetch BetterStack/Statuspage en T3 2026.
 */

"use client";

import { useMemo, useState } from "react";

interface UptimeBarChartProps {
  uptime90d: number;
  componentName: string;
  days?: number;
}

interface DayData {
  day: number;
  date: string;
  uptime: number;
  status: "ok" | "minor" | "major" | "outage";
}

function generateDays(uptime90d: number, days: number): DayData[] {
  // Génère N jours avec une distribution réaliste cohérente avec uptime90d.
  // Quelques jours sous le seuil, mais la moyenne tombe sur uptime90d.
  const result: DayData[] = [];
  const now = new Date();
  const incidentProbability = (100 - uptime90d) / 100;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    // Pseudo-random stable basé sur le numéro du jour
    const seed = (d.getDate() * 31 + d.getMonth() * 7) % 100;
    const isIncident = seed / 100 < incidentProbability;
    const dayUptime = isIncident ? Math.max(94, 100 - (seed % 6)) : 100;
    const status: DayData["status"] =
      dayUptime >= 99.9 ? "ok" : dayUptime >= 98 ? "minor" : dayUptime >= 95 ? "major" : "outage";

    result.push({
      day: days - i,
      date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      uptime: dayUptime,
      status,
    });
  }
  return result;
}

const STATUS_BG: Record<DayData["status"], string> = {
  ok: "bg-emerald-400/80",
  minor: "bg-amber-400/80",
  major: "bg-orange-500/80",
  outage: "bg-red-500/80",
};

export function UptimeBarChart({ uptime90d, componentName, days = 90 }: UptimeBarChartProps) {
  const data = useMemo(() => generateDays(uptime90d, days), [uptime90d, days]);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);

  return (
    <div className="relative">
      <div className="flex items-end gap-[2px]" role="img" aria-label={`Uptime ${componentName} sur ${days} jours`}>
        {data.map((day) => (
          <div
            key={day.day}
            className={`h-7 flex-1 rounded-sm transition-opacity hover:opacity-80 ${STATUS_BG[day.status]}`}
            onMouseEnter={() => setHoveredDay(day)}
            onMouseLeave={() => setHoveredDay(null)}
            title={`${day.date} : ${day.uptime.toFixed(2)}%`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/35">
        <span>il y a {days}j</span>
        <span>{hoveredDay ? `${hoveredDay.date} · ${hoveredDay.uptime.toFixed(2)}%` : "aujourd'hui"}</span>
      </div>
    </div>
  );
}
