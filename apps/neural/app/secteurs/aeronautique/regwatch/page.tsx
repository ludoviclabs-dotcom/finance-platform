import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, ShieldAlert, Activity, FileWarning } from "lucide-react";

import { StatusBadge } from "@/components/site/status-badge";
import { REGWATCH_SOURCES } from "@/lib/aero-regwatch/sources";
import {
  getHistory,
  getLatest,
  storageReady,
  type Snapshot,
} from "@/lib/aero-regwatch/storage";

export const metadata: Metadata = {
  title: "Aéronautique / RegWatch — veille sanctions OFAC | NEURAL",
  description:
    "Surveillance déterministe des sources réglementaires aéro/défense. Hash SHA-256 quotidien d'OFAC SDN, historique des changements, intégration avec DefenseCommsGuard.",
};

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<Snapshot["status"], { label: string; bg: string; text: string; border: string }> = {
  first_run: {
    label: "Premier check",
    bg: "bg-violet-300/15",
    text: "text-violet-100",
    border: "border-violet-300/40",
  },
  no_change: {
    label: "Aucun changement",
    bg: "bg-emerald-300/15",
    text: "text-emerald-100",
    border: "border-emerald-300/40",
  },
  changed: {
    label: "Changement détecté",
    bg: "bg-rose-300/15",
    text: "text-rose-100",
    border: "border-rose-300/40",
  },
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(2)} Mo`;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

export default async function AeroRegWatchPage() {
  const ready = storageReady();
  const sourceStates = await Promise.all(
    REGWATCH_SOURCES.map(async (source) => ({
      source,
      latest: ready ? await getLatest(source.id) : null,
      history: ready ? await getHistory(source.id, 10) : [],
    })),
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0e0824] text-white">
      <section className="border-b border-white/[0.08] px-6 pb-14 pt-30 md:px-12 lg:pt-34">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <Link
            href="/secteurs/aeronautique"
            className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour Aéronautique
          </Link>

          <div className="mt-10 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status="live" proofLevel="runtime_data" />
              <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-white/62">
                AM-SR001 · AeroRegWatch
              </span>
            </div>

            <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              RegWatch <span className="text-white/35">/</span> sources sous surveillance
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-white/68">
              Hash SHA-256 quotidien des registres réglementaires critiques pour le
              marketing aéro/défense. Le cron Vercel rejoue chaque source, persiste un
              snapshot dans Upstash Redis et signale tout changement aux agents
              DefenseCommsGuard et AeroSustainabilityComms.
            </p>

            {!ready && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] p-4 text-sm text-amber-100">
                <FileWarning className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  Storage Redis non provisionné dans cet environnement (KV_REST_API_URL /
                  UPSTASH_REDIS_REST_URL absent). Le watcher est prêt mais aucun snapshot
                  ne sera persisté. Configurez l'intégration Vercel × Upstash pour activer
                  l'historique.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08] px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <div className="mb-8 flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Sources surveillées ({REGWATCH_SOURCES.length})
            </h2>
            <span className="hidden font-mono text-xs text-white/45 md:inline">
              Cron quotidien · 06:00 UTC
            </span>
          </div>

          <div className="grid gap-6">
            {sourceStates.map(({ source, latest, history }) => {
              const status = latest?.status ?? null;
              const style = status ? STATUS_STYLES[status] : null;
              return (
                <article
                  key={source.id}
                  className="rounded-[22px] border border-white/10 bg-white/[0.04] p-6"
                >
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-white/40">{source.id}</p>
                      <h3 className="mt-1 text-xl font-semibold text-white">
                        {source.name}
                      </h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-violet-200/80">
                        {source.authority} · {source.domain}
                      </p>
                    </div>
                    {style && (
                      <span
                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${style.border} ${style.bg} ${style.text}`}
                      >
                        <Activity className="h-3 w-3" />
                        {style.label}
                      </span>
                    )}
                  </header>

                  <p className="mt-4 text-sm leading-relaxed text-white/68">
                    {source.description}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    Impact si changement : {source.impactIfChanged}
                  </p>

                  {latest ? (
                    <div className="mt-5 grid gap-3 rounded-2xl border border-white/[0.08] bg-[#160c30] p-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                          Dernier fetch
                        </p>
                        <p className="mt-1 text-sm text-white/75">
                          {formatRelative(latest.fetchedAt)}{" "}
                          <span className="text-white/40">·</span>{" "}
                          <span className="font-mono text-xs text-white/55">
                            {latest.fetchedAt}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                          Taille / latence
                        </p>
                        <p className="mt-1 text-sm text-white/75">
                          {formatBytes(latest.sizeBytes)}{" "}
                          <span className="text-white/40">·</span>{" "}
                          {latest.latencyMs} ms
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                          Hash SHA-256 actuel
                        </p>
                        <p className="mt-1 break-all font-mono text-[11px] text-emerald-200">
                          {latest.hash}
                        </p>
                        {latest.previousHash && latest.previousHash !== latest.hash && (
                          <p className="mt-2 break-all font-mono text-[11px] text-rose-200/60">
                            ↑ précédent : {latest.previousHash}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#160c30] p-4 text-sm text-white/55">
                      <Clock className="h-4 w-4 text-white/40" />
                      Aucun snapshot enregistré. Premier check au prochain cron run
                      (06:00 UTC) ou via{" "}
                      <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-white/65">
                        GET /api/cron/aero-regwatch
                      </code>
                      .
                    </div>
                  )}

                  {history.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55 hover:text-white">
                        Historique ({history.length} entrées persistées)
                      </summary>
                      <ol className="mt-3 grid gap-2">
                        {history.map((snap, i) => {
                          const s = STATUS_STYLES[snap.status];
                          return (
                            <li
                              key={`${snap.fetchedAt}-${i}`}
                              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                            >
                              <span className="font-mono text-[11px] text-white/55">
                                {snap.fetchedAt.slice(0, 16).replace("T", " ")}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${s.border} ${s.bg} ${s.text}`}
                              >
                                {s.label}
                              </span>
                              <span className="hidden font-mono text-[10px] text-white/35 sm:inline">
                                {snap.hash.slice(0, 12)}…
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    </details>
                  )}
                </article>
              );
            })}
          </div>

          <p className="mt-10 max-w-3xl text-xs text-white/45">
            <ShieldAlert className="mr-1 inline h-3 w-3 text-white/35" />
            Le périmètre MVP couvre OFAC SDN uniquement. BIS Entity List, UK OFSI,
            EUR-Lex AI Act, ASD Charter et EASA Décision 2024/015 seront ajoutés dans
            les sprints suivants.
          </p>
        </div>
      </section>
    </main>
  );
}
