import Link from "next/link";
import { Activity, ArrowRight, Bell } from "lucide-react";

import statusData from "@/content/status/components.json";
import { ComponentRow } from "@/components/status/component-row";
import { GlobalStatusPill } from "@/components/status/global-status-pill";
import { IncidentTimeline } from "@/components/status/incident-timeline";
import { getLiveUptimes, isProbed } from "@/lib/status/uptime";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata = {
  title: "Status | NEURAL",
  description:
    "Statut public des composants NEURAL : plateforme, base de données, rate-limit et publications mesurés en continu ; AI Gateway, auth et observabilité documentés en attendant l'instrumentation.",
};

export default async function StatusPage() {
  const items = statusData.items as Array<{
    id: string;
    name: string;
    description: string;
    status: "operational" | "degraded" | "outage" | "maintenance";
    uptime90d: number;
    category: string;
  }>;

  const liveUptimes = await getLiveUptimes();
  const liveCount = liveUptimes.size;
  const probedCount = items.filter((i) => isProbed(i.id)).length;

  // Compute display data: prefer live probe data when available, fall back to declared.
  const display = items.map((item) => {
    const live = liveUptimes.get(item.id);
    if (live) {
      return {
        ...item,
        status: live.latestStatus,
        uptime90d: live.uptime90d,
        source: "live" as const,
        latestProbeAt: live.latestProbeAt,
        meanLatencyMs: live.meanLatencyMs,
        sampleSize: live.sampleSize,
      };
    }
    return {
      ...item,
      source: "declared" as const,
      latestProbeAt: undefined,
      meanLatencyMs: null,
      sampleSize: 0,
    };
  });

  const avgUptime =
    display.reduce((acc, item) => acc + item.uptime90d, 0) / display.length;

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-neural-violet/8 blur-[120px]" />

      <section className="relative px-6 pb-12 pt-32 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <Activity className="h-3.5 w-3.5" />
            Status
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Statut public NEURAL
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            {liveCount > 0 ? (
              <>
                {liveCount} composant{liveCount > 1 ? "s" : ""} sur {probedCount}{" "}
                instrumenté{liveCount > 1 ? "s" : ""} affiche{liveCount > 1 ? "nt" : ""}{" "}
                un uptime réel calculé à partir de sondes automatiques (toutes les 5
                minutes). Les composants restants sont déclaratifs en attendant
                l&apos;instrumentation correspondante.
              </>
            ) : (
              <>
                Les sondes actives sont configurées ({probedCount} composants probables)
                mais aucune mesure n&apos;est encore en base. La page reste déclarative
                tant que le cron <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs">/api/cron/status-probe</code> n&apos;a pas tourné.
              </>
            )}
          </p>
          <div className="mt-10">
            <GlobalStatusPill
              status={statusData.globalStatus as "operational"}
              lastUpdated={statusData.lastUpdated}
            />
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Uptime déclaré 90j
              </p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums">
                {avgUptime.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Composants listés
              </p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums">
                {items.length}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Incidents connus 30j
              </p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums text-emerald-300">
                0
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Composants
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
            Les composants tagués <span className="text-emerald-300">Live</span> sont
            mesurés en continu (sonde toutes les 5 minutes, fenêtre 90 jours). Les
            autres restent <span className="text-white/55">déclarés</span> jusqu&apos;à
            instrumentation. Ce statut ne doit pas être vendu comme SLA contractuel.
          </p>
          <div className="mt-8 space-y-4">
            {display.map((item) => (
              <ComponentRow
                key={item.id}
                name={item.name}
                description={item.description}
                status={item.status}
                uptime90d={item.uptime90d}
                source={item.source}
                latestProbeAt={item.latestProbeAt}
                meanLatencyMs={item.meanLatencyMs}
                sampleSize={item.sampleSize}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Historique des incidents
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
            Les incidents seront documentés à leur résolution. La page devra être
            reliée à des logs ou sondes avant tout engagement opérationnel.
          </p>
          <div className="mt-8">
            <IncidentTimeline />
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.04] to-violet-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  <span className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                    Notifications
                  </span>
                </div>
                <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Alertes clients en préparation
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Les notifications publiques ne sont pas encore actives. Un pilot
                  client devra préciser le canal, le niveau d'incident et le SLA.
                </p>
              </div>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
              >
                Demander le cadrage <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
