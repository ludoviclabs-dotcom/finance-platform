import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import {
  BRANCH_ENTRIES,
  PUBLIC_CLAIMS,
  PUBLIC_METRICS,
  PUBLIC_STATUS_LABELS,
  SECTOR_ENTRIES,
} from "@/lib/public-catalog";
import {
  getAiGatewayAuthMode,
  getAiRuntimeReadinessSummary,
  getAiSurfaceReadiness,
} from "@/lib/ai/router";
import { StatusBadge } from "@/components/site/status-badge";
import { getAiTelemetryReadiness } from "@/lib/telemetry/ai";

export default function TrustPage() {
  const aiRuntime = getAiRuntimeReadinessSummary();
  const aiSurfaces = getAiSurfaceReadiness();
  const telemetry = getAiTelemetryReadiness();
  const aiAuthMode = getAiGatewayAuthMode();

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-neural-violet/10 blur-[140px]" />
      <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-500/7 blur-[120px]" />

      <section className="relative px-8 pb-16 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trust
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Ce que NEURAL prouve publiquement
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Cette page relie le discours public a une seule source de verite : statuts, claims
            autorises, niveau de preuve et limites connues. Elle sert a rendre le site plus lisible
            et plus credible, pas plus large qu&apos;il ne l&apos;est reellement.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Agents live</p>
              <p className="mt-3 font-display text-4xl font-bold">{PUBLIC_METRICS.liveAgents}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Cellules alimentees</p>
              <p className="mt-3 font-display text-4xl font-bold">
                {PUBLIC_METRICS.liveCells}/{PUBLIC_METRICS.frameworkCells}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Workbooks runtime</p>
              <p className="mt-3 font-display text-4xl font-bold">{PUBLIC_METRICS.runtimeWorkbooks}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Capacite framework</p>
              <p className="mt-3 font-display text-4xl font-bold">{PUBLIC_METRICS.frameworkAgents}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">Fondations IA</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Cette couche active l&apos;etape 1 en production et prepare deja les etapes 2 et
                3 : routage unifie, fallback de modele et journalisation legere.
              </p>
            </div>
            <Link href="/secteurs/luxe/finance" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
              Voir le noyau Luxe Finance <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Auth Gateway</p>
              <p className="mt-3 font-display text-2xl font-bold">{aiRuntime.authLabel}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {aiAuthMode === "missing"
                  ? "Configuration encore requise en local."
                  : "Le chat public ne depend plus d'une cle provider directe."}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Surface live</p>
              <p className="mt-3 font-display text-2xl font-bold">{aiRuntime.liveSurface.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {aiRuntime.liveSurface.primaryModel}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Surface preparee</p>
              <p className="mt-3 font-display text-2xl font-bold">{aiRuntime.preparedSurface.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Preparee pour l&apos;etape 2 et branchee au meme routeur.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Telemetry</p>
              <p className="mt-3 font-display text-2xl font-bold">{telemetry.trackedFields.length} champs</p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Base legere preparee pour l&apos;etape 3 sans back-office lourd.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <h3 className="font-display text-2xl font-bold">Surfaces IA</h3>
              <div className="mt-5 space-y-4">
                {aiSurfaces.map((surface) => (
                  <div key={surface.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{surface.label}</p>
                        <p className="mt-1 text-sm leading-relaxed text-white/60">{surface.dataScope}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                        {surface.stage === "live" ? "Live" : "Preparee"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Modele principal</p>
                        <p className="mt-2 text-sm text-white/70">{surface.primaryModel}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Fallback prepare</p>
                        <p className="mt-2 text-sm text-white/70">{surface.fallbackModels.join(", ")}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-white/55">{surface.deliverable}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <h3 className="font-display text-2xl font-bold">Journalisation preparee</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                L&apos;observabilite reste legere dans cette phase, mais la structure est deja
                prete pour suivre les appels et preparer un vrai cockpit plus tard.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {telemetry.trackedFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70"
                  >
                    {field}
                  </span>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                {telemetry.notes.map((note) => (
                  <div key={note} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-relaxed text-white/60">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">Statuts publics</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Les secteurs et branches visibles restent publics, mais leur statut est explicite.
              </p>
            </div>
            <Link href="/contact" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
              Demander une demo guidee <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <h3 className="font-display text-2xl font-bold">Secteurs</h3>
              <div className="mt-5 space-y-4">
                {SECTOR_ENTRIES.map((entry) => (
                  <div
                    key={entry.slug}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{entry.label}</p>
                        <p className="mt-1 text-sm leading-relaxed text-white/60">{entry.tagline}</p>
                      </div>
                      <StatusBadge status={entry.status} proofLevel={entry.proofLevel} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <h3 className="font-display text-2xl font-bold">Branches</h3>
              <div className="mt-5 space-y-4">
                {BRANCH_ENTRIES.map((entry) => (
                  <div
                    key={entry.slug}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{entry.label}</p>
                        <p className="mt-1 text-sm leading-relaxed text-white/60">{entry.tagline}</p>
                      </div>
                      <StatusBadge status={entry.status} proofLevel={entry.proofLevel} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="font-display text-3xl font-bold tracking-tight">Claims publics</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            Les claims actives restent visibles, les claims retirees restent documentees ici pour
            montrer le nettoyage editorial deja effectue.
          </p>

          <div className="mt-8 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04]">
            <div className="grid grid-cols-[1.4fr_0.6fr_1fr] gap-4 border-b border-white/8 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
              <span>Claim</span>
              <span>Statut</span>
              <span>Source</span>
            </div>
            {PUBLIC_CLAIMS.map((claim) => (
              <div
                key={claim.id}
                className="grid grid-cols-1 gap-3 border-b border-white/8 px-5 py-4 last:border-b-0 md:grid-cols-[1.4fr_0.6fr_1fr]"
              >
                <div>
                  <p className="text-sm font-medium text-white">{claim.claim}</p>
                  {claim.note ? (
                    <p className="mt-1 text-sm leading-relaxed text-white/55">{claim.note}</p>
                  ) : null}
                </div>
                <div className="text-sm font-medium text-white/70">
                  {claim.status === "retired" ? "Retire" : claim.status === "qualified" ? "Qualifie" : "Actif"}
                </div>
                <div className="text-sm leading-relaxed text-white/55">{claim.source}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm leading-relaxed text-white/65">
              Labels utilises partout dans le site :
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {Object.entries(PUBLIC_STATUS_LABELS).map(([key]) => (
                <StatusBadge key={key} status={key as keyof typeof PUBLIC_STATUS_LABELS} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
