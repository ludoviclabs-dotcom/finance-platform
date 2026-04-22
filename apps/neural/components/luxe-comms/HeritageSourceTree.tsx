/**
 * HeritageSourceTree — Server Component
 * Visualise les 10 sources patrimoniales par type (PRIMARY / SECONDARY / TERTIARY)
 * avec leur statut calcule (ACTIVE / STALE / REJECTED).
 */
import { Archive, BookOpen, FileText } from "lucide-react";

import {
  HERITAGE_SOURCES,
  resolveHeritageStatus,
  type HeritageSource,
  type SourceStatus,
} from "@/lib/data/luxe-comms-catalog";

const TYPE_CONFIG = {
  PRIMARY: { Icon: Archive, color: "text-emerald-300", bg: "bg-emerald-400/10", label: "Sources primaires" },
  SECONDARY: { Icon: BookOpen, color: "text-violet-200", bg: "bg-violet-400/10", label: "Sources secondaires" },
  TERTIARY: { Icon: FileText, color: "text-amber-200", bg: "bg-amber-400/10", label: "Sources tertiaires" },
} as const;

const STATUS_BADGE: Record<SourceStatus, string> = {
  ACTIVE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  STALE: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  REJECTED: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

function byType(type: HeritageSource["type"]): HeritageSource[] {
  return HERITAGE_SOURCES.filter((s) => s.type === type);
}

export function HeritageSourceTree() {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
          AG-004 Heritage
        </p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">
          Sources patrimoniales cataloguees
        </h3>
        <p className="mt-1 text-sm text-white/55">
          Aucune sortie publiee sans source active + citation formatee.
          Les sources tertiaires declenchent une revue automatique.
        </p>
      </div>

      <div className="space-y-5">
        {(["PRIMARY", "SECONDARY", "TERTIARY"] as const).map((type) => {
          const cfg = TYPE_CONFIG[type];
          const items = byType(type);
          return (
            <div key={type}>
              <div className="mb-2 flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${cfg.bg}`}>
                  <cfg.Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                </div>
                <h4 className={`text-sm font-semibold ${cfg.color}`}>
                  {cfg.label} <span className="text-white/35">({items.length})</span>
                </h4>
              </div>
              <ul className="ml-9 space-y-1.5">
                {items.map((s) => {
                  const status = resolveHeritageStatus(s);
                  return (
                    <li
                      key={s.source_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1 truncate">
                        <span className="font-mono text-xs text-white/45">{s.source_id}</span>{" "}
                        <span className="text-white/75">{s.titre}</span>
                        {s.annee ? (
                          <span className="ml-2 text-xs text-white/35">({s.annee})</span>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[status]}`}
                      >
                        {status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
