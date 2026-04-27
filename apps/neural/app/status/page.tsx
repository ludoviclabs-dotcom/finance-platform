import Link from "next/link";
import { Activity, Bell, ArrowRight } from "lucide-react";

import statusData from "@/content/status/components.json";
import { GlobalStatusPill } from "@/components/status/global-status-pill";
import { ComponentRow } from "@/components/status/component-row";
import { IncidentTimeline } from "@/components/status/incident-timeline";

export const metadata = {
  title: "Status — NEURAL",
  description:
    "État opérationnel en temps réel des composants NEURAL : plateforme, agents, IA Gateway, base de données, observabilité. Uptime 90 jours et historique des incidents.",
};

export default function StatusPage() {
  const items = statusData.items as Array<{
    id: string;
    name: string;
    description: string;
    status: "operational" | "degraded" | "outage" | "maintenance";
    uptime90d: number;
    category: string;
  }>;

  const avgUptime =
    items.reduce((acc, item) => acc + item.uptime90d, 0) / items.length;

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-neural-violet/8 blur-[120px]" />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <Activity className="h-3.5 w-3.5" />
            Status
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Statut NEURAL en temps réel
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            État opérationnel public de chaque composant. Aucune zone d&apos;ombre, pas de
            maquillage. Les incidents passés restent visibles, avec leur durée et leur résolution.
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
                Uptime moyen 90j
              </p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums">
                {avgUptime.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Composants surveillés
              </p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums">{items.length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Incidents 30j
              </p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums text-emerald-300">
                0
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Composants ───────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                Composants surveillés
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Chaque ligne correspond à une surface technique distincte. Les barres représentent
                l&apos;état jour par jour sur les 90 derniers jours.
              </p>
            </div>
          </div>
          <div className="mt-8 space-y-4">
            {items.map((item) => (
              <ComponentRow
                key={item.id}
                name={item.name}
                description={item.description}
                status={item.status}
                uptime90d={item.uptime90d}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Incidents ────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                Historique des incidents
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Chaque incident est documenté à sa résolution. Pas de réécriture a posteriori,
                pas d&apos;effacement.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <IncidentTimeline />
          </div>
        </div>
      </section>

      {/* ── Subscribe / Closing ──────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
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
                  Recevoir les alertes status
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Les clients actifs sont automatiquement notifiés en cas d&apos;incident impactant
                  leurs surfaces. Subscribe public en préparation pour T2 2026.
                </p>
              </div>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
              >
                Demander l&apos;accès <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
