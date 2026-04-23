import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Database,
  Filter,
  Inbox,
  Landmark,
  Leaf,
  Mail,
  Siren,
  XCircle,
} from "lucide-react";

import { env } from "@/lib/env";
import {
  BANK_COMMS_AGENT_SLUGS_ARR,
  BANK_COMMS_RUN_STATUSES,
  getBankCommsRunsCounts,
  getRecentBankCommsRuns,
  type BankCommsRunStatus,
} from "@/lib/ai/bank-comms-persistence";

export const metadata: Metadata = {
  title: "Inbox HITL — Banque / Communication | NEURAL",
  description:
    "Runs persistés dans AgentRun, filtrables par agent et par status. WAITING_APPROVAL en priorité. Mode dégradé si DATABASE_URL absent.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ agent?: string; status?: string; limit?: string }>;

const AGENT_META: Record<
  string,
  { label: string; icon: typeof Landmark; tint: string; href: string }
> = {
  "reg-bank-comms": {
    label: "RegBankComms",
    icon: Landmark,
    tint: "text-violet-200",
    href: "/agents/reg-bank-comms",
  },
  "bank-crisis-comms": {
    label: "BankCrisisComms",
    icon: Siren,
    tint: "text-rose-200",
    href: "/agents/bank-crisis-comms",
  },
  "esg-bank-comms": {
    label: "ESGBankComms",
    icon: Leaf,
    tint: "text-emerald-200",
    href: "/agents/esg-bank-comms",
  },
  "client-bank-comms": {
    label: "ClientBankComms",
    icon: Mail,
    tint: "text-blue-200",
    href: "/agents/client-bank-comms",
  },
};

const STATUS_STYLE: Record<BankCommsRunStatus, string> = {
  RUNNING: "border-white/15 bg-white/5 text-white/75",
  WAITING_APPROVAL:
    "border-amber-400/30 bg-amber-400/10 text-amber-200",
  DONE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  FAILED: "border-red-400/30 bg-red-400/10 text-red-200",
  REJECTED: "border-white/15 bg-white/5 text-white/60",
};

const STATUS_ICON: Record<BankCommsRunStatus, typeof CheckCircle2> = {
  RUNNING: Clock,
  WAITING_APPROVAL: AlertTriangle,
  DONE: CheckCircle2,
  FAILED: XCircle,
  REJECTED: XCircle,
};

function isValidStatus(s: string | undefined): s is BankCommsRunStatus {
  return !!s && (BANK_COMMS_RUN_STATUSES as readonly string[]).includes(s);
}
function isValidAgent(s: string | undefined): s is (typeof BANK_COMMS_AGENT_SLUGS_ARR)[number] {
  return !!s && (BANK_COMMS_AGENT_SLUGS_ARR as readonly string[]).includes(s);
}

function buildFilterHref(params: {
  agent?: string;
  status?: string;
  newAgent?: string | null;
  newStatus?: string | null;
}): string {
  const agent = params.newAgent === null ? undefined : params.newAgent ?? params.agent;
  const status = params.newStatus === null ? undefined : params.newStatus ?? params.status;
  const qs = new URLSearchParams();
  if (agent) qs.set("agent", agent);
  if (status) qs.set("status", status);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

function timeAgo(d: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}j`;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const agent = isValidAgent(raw.agent) ? raw.agent : undefined;
  const status = isValidStatus(raw.status) ? raw.status : undefined;
  const limit = Math.max(10, Math.min(200, Number(raw.limit) || 50));

  const [rows, counts] = await Promise.all([
    getRecentBankCommsRuns({ agentSlug: agent, status, limit }),
    getBankCommsRunsCounts(),
  ]);

  const dbReady = env.database.ready;

  return (
    <div data-theme="dark" className="min-h-screen bg-[#0A1628] text-white">
      <div className="border-b border-white/5 px-6 py-6 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Link
            href="/secteurs/banque/communication/dashboard"
            className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard Banque / Communication
          </Link>
        </div>
      </div>

      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
              <Inbox className="h-6 w-6 text-white/85" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
                Inbox HITL · Banque / Communication
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                Runs à relire
              </h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-white/70">
            Runs des 4 agents publics persistés dans{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs">
              AgentRun
            </code>
            . PASS → DONE, PASS_WITH_REVIEW → WAITING_APPROVAL, BLOCK →
            FAILED. Prioriser WAITING_APPROVAL.
          </p>

          {!dbReady ? (
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              <p className="flex items-center gap-2 font-semibold">
                <Database className="h-4 w-4" />
                DATABASE_URL non configuré
              </p>
              <p className="mt-1 text-amber-100/90">
                La persistance est en no-op : les runs des démos publiques ne
                sont pas enregistrés. Les 4 agents continuent à répondre
                normalement, seule cette inbox reste vide.
              </p>
              <p className="mt-2 text-[11px] text-amber-100/70">
                Fix local :{" "}
                <code className="rounded bg-amber-400/10 px-1.5 py-0.5 font-mono">
                  cp .env.example .env.local
                </code>{" "}
                + DATABASE_URL. Vercel : intégration Neon via Marketplace.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Compteurs */}
      <section className="border-b border-white/5 px-6 py-10 md:px-12">
        <div className="mx-auto grid max-w-[1280px] gap-3 md:grid-cols-3 lg:grid-cols-6">
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Total
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-white">
              {counts.total}
            </p>
          </article>
          {BANK_COMMS_RUN_STATUSES.map((s) => (
            <article
              key={s}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                {s.replace("_", " ").toLowerCase()}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-white">
                {counts.byStatus[s]}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Filtres */}
      <section className="border-b border-white/5 px-6 py-8 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-white/55" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Filtres
                </span>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-white/55">Agent</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Link
                    href={buildFilterHref({ agent, status, newAgent: null })}
                    className={
                      !agent
                        ? "rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0A1628]"
                        : "rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    }
                  >
                    Tous
                  </Link>
                  {BANK_COMMS_AGENT_SLUGS_ARR.map((a) => (
                    <Link
                      key={a}
                      href={buildFilterHref({ agent, status, newAgent: a })}
                      className={
                        agent === a
                          ? "rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0A1628]"
                          : "rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                      }
                    >
                      {AGENT_META[a]?.label ?? a}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-white/55">Status</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Link
                    href={buildFilterHref({ agent, status, newStatus: null })}
                    className={
                      !status
                        ? "rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0A1628]"
                        : "rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    }
                  >
                    Tous
                  </Link>
                  {BANK_COMMS_RUN_STATUSES.map((s) => (
                    <Link
                      key={s}
                      href={buildFilterHref({ agent, status, newStatus: s })}
                      className={
                        status === s
                          ? "rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0A1628]"
                          : "rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                      }
                    >
                      {s.toLowerCase().replace("_", " ")}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tableau */}
      <section className="px-6 py-10 pb-20 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
              <Inbox className="mx-auto h-8 w-8 text-white/40" />
              <p className="mt-4 font-semibold text-white">
                {dbReady
                  ? "Aucun run pour ces filtres."
                  : "Aucun run persisté (DB non configurée)."}
              </p>
              <p className="mt-1 text-[11px] text-white/55">
                {dbReady
                  ? "Changer un filtre, ou lancer une démo depuis la page secteur pour générer un run."
                  : "Brancher Neon (Vercel Marketplace) puis relancer une démo."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Agent</th>
                    <th className="px-4 py-3 font-semibold">Scénario</th>
                    <th className="px-4 py-3 font-semibold">Décision</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Mode</th>
                    <th className="px-4 py-3 font-semibold">Âge</th>
                    <th className="px-4 py-3 font-semibold">Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const meta = AGENT_META[r.agentId];
                    const Icon = meta?.icon ?? Landmark;
                    const statusKey = (
                      (BANK_COMMS_RUN_STATUSES as readonly string[]).includes(r.status)
                        ? r.status
                        : "RUNNING"
                    ) as BankCommsRunStatus;
                    const StatusIcon = STATUS_ICON[statusKey];
                    return (
                      <tr key={r.id} className="border-t border-white/5">
                        <td className="px-4 py-3">
                          {meta ? (
                            <Link
                              href={meta.href}
                              className="inline-flex items-center gap-2 text-white transition-colors hover:text-violet-200"
                            >
                              <Icon className={`h-4 w-4 ${meta.tint}`} />
                              {meta.label}
                            </Link>
                          ) : (
                            <span className="font-mono text-[11px] text-white/65">
                              {r.agentId}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-white/70">
                          {r.scenarioId}
                        </td>
                        <td className="px-4 py-3">
                          {r.decision === "PASS" ? (
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                              PASS
                            </span>
                          ) : r.decision === "PASS_WITH_REVIEW" ? (
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                              PASS_WITH_REVIEW
                            </span>
                          ) : r.decision === "BLOCK" ? (
                            <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-semibold text-red-200">
                              BLOCK
                            </span>
                          ) : (
                            <span className="text-[11px] text-white/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[statusKey]}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusKey.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-white/55">
                          {r.model ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-white/55">
                          {timeAgo(r.startedAt)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-white/40">
                          {r.id.slice(0, 8)}…
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-[11px] text-white/50">
            Limite : {limit} runs les plus récents. Trace complète côté Langfuse
            pour les runs en mode gateway.
          </p>
        </div>
      </section>
    </div>
  );
}
