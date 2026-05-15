/**
 * ComponentRow — ligne d'un composant surveillé sur /status.
 */

import { Activity, Eye } from "lucide-react";

import { UptimeBarChart } from "./uptime-bar-chart";

interface ComponentRowProps {
  name: string;
  description: string;
  status: "operational" | "degraded" | "outage" | "maintenance";
  uptime90d: number;
  /** "live" — uptime from real probes; "declared" — from static JSON. */
  source?: "live" | "declared";
  /** Latest probe timestamp ISO when source === "live". */
  latestProbeAt?: string;
  /** Mean latency in ms over the probe window when source === "live". */
  meanLatencyMs?: number | null;
  /** Probe sample count over the window when source === "live". */
  sampleSize?: number;
}

const STATUS_LABELS: Record<ComponentRowProps["status"], string> = {
  operational: "Opérationnel",
  degraded: "Dégradé",
  outage: "En panne",
  maintenance: "Maintenance",
};

const STATUS_DOT: Record<ComponentRowProps["status"], string> = {
  operational: "bg-emerald-400",
  degraded: "bg-amber-400",
  outage: "bg-red-400",
  maintenance: "bg-violet-400",
};

const STATUS_TEXT: Record<ComponentRowProps["status"], string> = {
  operational: "text-emerald-300",
  degraded: "text-amber-200",
  outage: "text-red-300",
  maintenance: "text-violet-200",
};

export function ComponentRow({
  name,
  description,
  status,
  uptime90d,
  source = "declared",
  latestProbeAt,
  meanLatencyMs,
  sampleSize,
}: ComponentRowProps) {
  const isLive = source === "live";
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-5 transition-colors hover:border-white/16">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="md:max-w-md">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${STATUS_DOT[status]}`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${STATUS_DOT[status]}`}
              />
            </span>
            <p className="text-sm font-semibold text-white">{name}</p>
            <span className={`text-[10px] uppercase tracking-[0.16em] ${STATUS_TEXT[status]}`}>
              {STATUS_LABELS[status]}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${
                isLive
                  ? "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300"
                  : "border-white/15 bg-white/[0.04] text-white/45"
              }`}
              title={
                isLive
                  ? `Sonde active${sampleSize ? ` · ${sampleSize} mesures` : ""}`
                  : "Statut déclaratif — pas encore branché à une sonde"
              }
            >
              {isLive ? (
                <>
                  <Activity className="h-2.5 w-2.5" />
                  Live
                </>
              ) : (
                <>
                  <Eye className="h-2.5 w-2.5" />
                  Déclaré
                </>
              )}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-white/55">{description}</p>
          {isLive && latestProbeAt ? (
            <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/35">
              Dernière sonde · {new Date(latestProbeAt).toISOString().slice(0, 16).replace("T", " ")} UTC
              {meanLatencyMs !== null && meanLatencyMs !== undefined
                ? ` · latence moyenne ${meanLatencyMs} ms`
                : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 md:items-end">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Uptime 90j</p>
          <p className="font-display text-2xl font-bold tabular-nums text-white">
            {uptime90d.toFixed(2)}%
          </p>
        </div>
      </div>
      <div className="mt-4">
        <UptimeBarChart uptime90d={uptime90d} componentName={name} />
      </div>
    </div>
  );
}
