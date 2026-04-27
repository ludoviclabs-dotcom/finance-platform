/**
 * GlobalStatusPill — pill principale en haut de /status.
 * Couleur dynamique selon globalStatus (operational / degraded / outage / maintenance).
 */

import { CheckCircle2, AlertTriangle, AlertOctagon, Wrench } from "lucide-react";

type GlobalStatus = "operational" | "degraded" | "outage" | "maintenance";

const CONFIG: Record<
  GlobalStatus,
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  operational: {
    label: "Tous systèmes opérationnels",
    cls: "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "Performances dégradées",
    cls: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
    Icon: AlertTriangle,
  },
  outage: {
    label: "Incident en cours",
    cls: "border-red-400/30 bg-red-400/[0.10] text-red-300",
    Icon: AlertOctagon,
  },
  maintenance: {
    label: "Maintenance planifiée",
    cls: "border-violet-400/30 bg-violet-400/[0.10] text-violet-200",
    Icon: Wrench,
  },
};

export function GlobalStatusPill({
  status,
  lastUpdated,
}: {
  status: GlobalStatus;
  lastUpdated: string;
}) {
  const cfg = CONFIG[status];
  const Icon = cfg.Icon;
  const formatted = new Date(lastUpdated).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col items-start gap-3">
      <div
        className={`inline-flex items-center gap-3 rounded-full border px-5 py-2.5 text-sm font-semibold ${cfg.cls}`}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
        </span>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {cfg.label}
      </div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
        Mise à jour : {formatted}
      </p>
    </div>
  );
}
