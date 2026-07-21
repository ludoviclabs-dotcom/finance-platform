"use client";
import { useState } from "react";
import { DataStatusBadge } from "@/components/ui/data-status-badge";
import type { Material } from "@/lib/crm/dataLoader";

interface Props { materials: Material[]; threshold?: number }

type Severity = "MODÉRÉE" | "ÉLEVÉE" | "CRITIQUE";

function getSeverity(pct: number, threshold: number): Severity {
  const abs = Math.abs(pct);
  if (abs >= 30) return "CRITIQUE";
  if (abs >= threshold * 1.5) return "ÉLEVÉE";
  return "MODÉRÉE";
}

const SEV_COLOR: Record<Severity, string> = {
  CRITIQUE: "var(--mx-red)",
  ÉLEVÉE: "var(--mx-amber)",
  MODÉRÉE: "var(--mx-muted)",
};

export default function PriceAlertModule({ materials, threshold = 15 }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alerts = materials
    .filter(m => m.price_snapshot && Math.abs(m.price_snapshot.trend_3m_pct) >= threshold)
    .filter(m => !dismissed.has(m.id))
    .sort((a, b) => Math.abs(b.price_snapshot!.trend_3m_pct) - Math.abs(a.price_snapshot!.trend_3m_pct));

  const maxAbs = alerts.length ? Math.abs(alerts[0].price_snapshot!.trend_3m_pct) : 1;

  return (
    <div className="rounded-2xl border p-5 flex flex-col h-full" style={{ borderColor: "var(--mx-border)", background: "var(--mx-card)", boxShadow: "var(--mx-shadow)" }}>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3 className="m-0 flex items-center gap-2.5 font-semibold text-base" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>
          Alertes volatilité
          {alerts.length > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full font-bold text-[11px]"
              style={{ background: "var(--mx-red)", color: "#fff", fontFamily: "var(--mx-font-mono)" }}
            >
              {alerts.length}
            </span>
          )}
          <DataStatusBadge status="ESTIMATED" />
        </h3>
        {dismissed.size > 0 && (
          <button
            onClick={() => setDismissed(new Set())}
            className="text-xs cursor-pointer transition-colors"
            style={{ color: "var(--mx-subtle)" }}
          >
            Restaurer ({dismissed.size})
          </button>
        )}
      </div>
      <p className="m-0 mb-3 text-xs" style={{ color: "var(--mx-subtle)" }}>
        Tendance 3 mois <strong style={{ color: "var(--mx-muted)" }}>estimée par le snapshot</strong> — pas une série de prix observée · seuil ≥ {threshold}%
      </p>

      <div className="flex items-center gap-2.5 my-1.5">
        <span className="flex-1" />
        <span className="font-semibold text-[9.5px] tracking-[0.1em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-em)" }}>◀ BAISSE</span>
        <span className="w-px h-3" style={{ background: "var(--mx-border-2)" }} />
        <span className="font-semibold text-[9.5px] tracking-[0.1em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-red)" }}>HAUSSE ▶</span>
        <span className="flex-1" />
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8" style={{ color: "var(--mx-subtle)" }}>
          <p className="text-sm m-0">Aucune alerte active</p>
          <p className="text-xs mt-1 m-0">Toutes les matières sont sous le seuil de {threshold}%</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-y-auto pr-1" style={{ maxHeight: 330 }}>
          {alerts.map(m => {
            const p = m.price_snapshot!;
            const t = p.trend_3m_pct;
            const abs = Math.abs(t);
            const isUp = t > 0;
            const sev = getSeverity(t, threshold);
            const sevColor = SEV_COLOR[sev];
            return (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-[10px] border border-transparent transition-colors hover:border-[var(--mx-border)]">
                <span className="w-28 shrink-0 text-[12.5px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "var(--mx-fg)" }}>
                  {m.name_fr}
                </span>
                <span className="w-[92px] shrink-0 text-right text-[10.5px]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-subtle)" }}>
                  {p.value.toLocaleString("fr-FR")} {p.unit}
                </span>
                <div className="flex-1 flex items-center h-4">
                  <div className="flex-1 flex justify-end">
                    <div
                      className="h-3 rounded-l-md"
                      style={{
                        width: !isUp ? `${(abs / maxAbs) * 100}%` : "0%",
                        background: "linear-gradient(270deg, var(--mx-em), color-mix(in srgb, var(--mx-em) 40%, transparent))",
                      }}
                    />
                  </div>
                  <div className="w-px h-4 shrink-0" style={{ background: "var(--mx-border-2)" }} />
                  <div className="flex-1">
                    <div
                      className="h-3 rounded-r-md"
                      style={{
                        width: isUp ? `${(abs / maxAbs) * 100}%` : "0%",
                        background: "linear-gradient(90deg, color-mix(in srgb, var(--mx-red) 40%, transparent), var(--mx-red))",
                      }}
                    />
                  </div>
                </div>
                <span className="w-14 shrink-0 text-right font-bold text-[12.5px]" style={{ fontFamily: "var(--mx-font-mono)", color: isUp ? "var(--mx-red)" : "var(--mx-em)" }}>
                  {isUp ? "+" : "−"}{abs}%
                </span>
                <span
                  className="w-16 shrink-0 text-center rounded-full font-semibold text-[9.5px] py-0.5"
                  style={{ color: sevColor, background: `color-mix(in srgb, ${sevColor} 14%, transparent)` }}
                >
                  {sev}
                </span>
                <button
                  onClick={() => setDismissed(prev => new Set([...prev, m.id]))}
                  className="shrink-0 text-xs cursor-pointer transition-colors"
                  style={{ color: "var(--mx-subtle)" }}
                  aria-label={`Ignorer l'alerte ${m.name_fr}`}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
