/**
 * IncidentTimeline — historique des incidents publics.
 */

import { CheckCircle2, AlertTriangle } from "lucide-react";

import incidents from "@/content/status/incidents.json";

const SEVERITY_CLASSES: Record<string, string> = {
  minor: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
  major: "border-orange-500/30 bg-orange-500/[0.10] text-orange-200",
  critical: "border-red-500/30 bg-red-500/[0.10] text-red-200",
};

export function IncidentTimeline() {
  if (incidents.items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[20px] border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
        <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
        <p className="text-sm text-white/80">
          <span className="font-semibold">Aucun incident</span> sur les 30 derniers jours.
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-4 pl-6 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-gradient-to-b before:from-white/10 before:to-transparent">
      {incidents.items.map((incident) => (
        <div key={incident.id} className="relative">
          <span className="absolute -left-6 top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-neural-midnight bg-emerald-400" />
          <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white">{incident.title}</p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      SEVERITY_CLASSES[incident.severity] || SEVERITY_CLASSES["minor"]
                    }`}
                  >
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {incident.severity}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Résolu
                  </span>
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/35">
                  {new Date(incident.date).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · Durée : {incident.duration}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/65">{incident.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {incident.components.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/60"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
