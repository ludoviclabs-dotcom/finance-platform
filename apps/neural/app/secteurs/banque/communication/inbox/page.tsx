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
    "Vue reviewer des runs banque persistés (AgentRun). Filtrage par agent et par status — WAITING_APPROVAL en priorité. Mode dégradé si DATABASE_URL absent.",
};

export const dynamic = "force-dynamic"; // toujours lire l'état le plus récent

type SearchParams = Promise<{ agent?: string; status?: string; limit?: string }>;

const AGENT_META: Record<
  string,
  { label: string; icon: typeof Landmark; color: string; href: string }
> = {
  "reg-bank-comms": {
    label: "RegBankComms",
    icon: Landmark,
    color: "text-stone-700",
    href: "/agents/reg-bank-comms",
  },
  "bank-crisis-comms": {
    label: "BankCrisisComms",
    icon: Siren,
    color: "text-red-600",
    href: "/agents/bank-crisis-comms",
  },
  "esg-bank-comms": {
    label: "ESGBankComms",
    icon: Leaf,
    color: "text-emerald-600",
    href: "/agents/esg-bank-comms",
  },
  "client-bank-comms": {
    label: "ClientBankComms",
    icon: Mail,
    color: "text-blue-600",
    href: "/agents/client-bank-comms",
  },
};

const STATUS_STYLE: Record<BankCommsRunStatus, string> = {
  RUNNING: "bg-neutral-100 text-neutral-700",
  WAITING_APPROVAL: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  DONE: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  FAILED: "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200",
  REJECTED: "bg-neutral-100 text-neutral-600",
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
    <div className="bg-stone-50 text-neutral-900">
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Link
            href="/secteurs/banque/communication/dashboard"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard Banque / Communication
          </Link>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center gap-3">
          <Inbox className="h-10 w-10 text-stone-700" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">
              Inbox HITL · Banque / Communication
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Runs à relire
            </h1>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-neutral-700">
          Vue consolidée des runs des 4 agents publics banque, persistés dans
          la table <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs">AgentRun</code>{" "}
          (mapping trust-first : PASS → DONE, PASS_WITH_REVIEW → WAITING_APPROVAL,
          BLOCK → FAILED). Prioriser <em>WAITING_APPROVAL</em> pour la revue
          juridique et compliance.
        </p>

        {!dbReady ? (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-medium">
              <Database className="h-4 w-4" />
              DATABASE_URL non configuré
            </p>
            <p className="mt-1">
              La persistance est en mode no-op : les runs des démos publiques
              ne sont pas enregistrés tant que Neon (ou toute Postgres
              compatible) n&apos;est pas branché. Les 4 agents continuent à
              répondre normalement ; seule cette inbox reste vide.
            </p>
            <p className="mt-2 text-xs text-amber-800">
              Fix : en local <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">cp .env.example .env.local</code> + renseigner DATABASE_URL. En Vercel : installer l&apos;intégration Neon via Marketplace.
            </p>
          </div>
        ) : null}
      </section>

      {/* Compteurs globaux */}
      <section className="mx-auto max-w-6xl px-6 py-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <article className="rounded-xl border border-neutral-200 bg-white p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Total runs
            </p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{counts.total}</p>
          </article>
          {BANK_COMMS_RUN_STATUSES.map((s) => (
            <article
              key={s}
              className="rounded-xl border border-neutral-200 bg-white p-3 text-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {s.replace("_", " ").toLowerCase()}
              </p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">
                {counts.byStatus[s]}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Filtres */}
      <section className="mx-auto max-w-6xl px-6 py-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-neutral-500" />
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Filtres
              </span>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-neutral-500">Agent</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Link
                  href={buildFilterHref({ agent, status, newAgent: null })}
                  className={
                    !agent
                      ? "rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white"
                      : "rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:border-neutral-400"
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
                        ? "rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white"
                        : "rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:border-neutral-400"
                    }
                  >
                    {AGENT_META[a]?.label ?? a}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-neutral-500">Status</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Link
                  href={buildFilterHref({ agent, status, newStatus: null })}
                  className={
                    !status
                      ? "rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white"
                      : "rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:border-neutral-400"
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
                        ? "rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white"
                        : "rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:border-neutral-400"
                    }
                  >
                    {s.toLowerCase().replace("_", " ")}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tableau */}
      <section className="mx-auto max-w-6xl px-6 py-4 pb-16">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-600">
            <Inbox className="mx-auto h-8 w-8 text-neutral-400" />
            <p className="mt-3 font-medium text-neutral-900">
              {dbReady ? "Aucun run pour ces filtres." : "Aucun run persisté (DB non configurée)."}
            </p>
            <p className="mt-1 text-xs">
              {dbReady
                ? "Essayer un autre filtre, ou lancer une démo depuis /secteurs/banque/communication pour générer un run."
                : "Brancher Neon (Vercel Marketplace ou DATABASE_URL local), puis relancer une démo."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Agent</th>
                  <th className="px-4 py-2">Scénario</th>
                  <th className="px-4 py-2">Décision</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Mode</th>
                  <th className="px-4 py-2">Âge</th>
                  <th className="px-4 py-2">Trace</th>
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
                    <tr key={r.id} className="border-t border-neutral-100">
                      <td className="px-4 py-2">
                        {meta ? (
                          <Link
                            href={meta.href}
                            className="inline-flex items-center gap-2 text-neutral-900 hover:text-neutral-700"
                          >
                            <Icon className={`h-4 w-4 ${meta.color}`} />
                            {meta.label}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-neutral-600">
                            {r.agentId}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-neutral-700">
                        {r.scenarioId}
                      </td>
                      <td className="px-4 py-2">
                        {r.decision === "PASS" ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                            PASS
                          </span>
                        ) : r.decision === "PASS_WITH_REVIEW" ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                            PASS_WITH_REVIEW
                          </span>
                        ) : r.decision === "BLOCK" ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 ring-1 ring-inset ring-red-200">
                            BLOCK
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[statusKey]}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusKey.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-600">
                        {r.model ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-600">
                        {timeAgo(r.startedAt)}
                      </td>
                      <td className="px-4 py-2 font-mono text-[10px] text-neutral-500">
                        {r.id.slice(0, 8)}…
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-neutral-500">
          Limite : {limit} runs les plus récents. Trace complète disponible côté
          Langfuse pour les runs en mode <em>gateway</em>.
        </p>
      </section>
    </div>
  );
}
