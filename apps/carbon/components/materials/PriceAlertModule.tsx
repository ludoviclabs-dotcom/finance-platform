"use client";
import { useState } from "react";

interface PriceSnapshot { date: string; value: number; unit: string; trend_3m_pct: number }
interface Material { id: string; name_fr: string; price_snapshot: PriceSnapshot | null; criticality_eu: string }
interface Props { materials: Material[]; threshold?: number }

type Severity = "MODÉRÉE" | "ÉLEVÉE" | "CRITIQUE";

function getSeverity(pct: number, threshold: number): Severity {
  const abs = Math.abs(pct);
  if (abs >= 30) return "CRITIQUE";
  if (abs >= threshold * 1.5) return "ÉLEVÉE";
  return "MODÉRÉE";
}

const SEV_STYLES: Record<Severity, { badge: string; border: string; icon: string }> = {
  "CRITIQUE":  { badge: "bg-red-500/20 text-red-400 border-red-500/30",    border: "border-red-500/20",    icon: "🔴" },
  "ÉLEVÉE":    { badge: "bg-amber-500/20 text-amber-400 border-amber-500/30", border: "border-amber-500/20", icon: "🟠" },
  "MODÉRÉE":   { badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", border: "border-yellow-500/20", icon: "🟡" },
};

export default function PriceAlertModule({ materials, threshold = 15 }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alerts = materials
    .filter(m => m.price_snapshot && Math.abs(m.price_snapshot.trend_3m_pct) >= threshold)
    .filter(m => !dismissed.has(m.id))
    .sort((a, b) => Math.abs(b.price_snapshot!.trend_3m_pct) - Math.abs(a.price_snapshot!.trend_3m_pct));

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            ⚡ Alertes volatilité
            {alerts.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                {alerts.length}
              </span>
            )}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Seuil : variation ≥ {threshold}% sur 3 mois</p>
        </div>
        {dismissed.size > 0 && (
          <button onClick={() => setDismissed(new Set())}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition">
            Restaurer ({dismissed.size})
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
          <span className="text-3xl mb-2">✅</span>
          <p className="text-sm">Aucune alerte active</p>
          <p className="text-xs mt-1">Toutes les matières sont sous le seuil de {threshold}%</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {alerts.map(m => {
            const p = m.price_snapshot!;
            const sev = getSeverity(p.trend_3m_pct, threshold);
            const s = SEV_STYLES[sev];
            const isUp = p.trend_3m_pct > 0;
            return (
              <div key={m.id} className={`rounded-xl border ${s.border} bg-zinc-800/50 px-4 py-3 flex items-center justify-between gap-3`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span>{s.icon}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-white truncate">{m.name_fr}</p>
                    <p className="text-xs text-zinc-500">{p.value} {p.unit}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-bold ${isUp ? "text-red-400" : "text-emerald-400"}`}>
                    {isUp ? "▲" : "▼"} {Math.abs(p.trend_3m_pct)}%
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.badge}`}>{sev}</span>
                  <button onClick={() => setDismissed(prev => new Set([...prev, m.id]))}
                    className="text-zinc-600 hover:text-zinc-400 transition text-xs">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
