import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  ShieldCheck,
  Tags,
  Timer,
} from "lucide-react";

import { EvidenceResolverLive } from "@/components/bank-comms/EvidenceResolverLive";
import {
  BANK_COMMS_SOURCES,
  EVIDENCE_EXPANDED,
  EVIDENCE_RESOLVER_TESTSET,
  EVIDENCE_SUBJECTS,
  FRESHNESS_POLICIES,
  getAgentBySlug,
  getEvidenceExpanded,
} from "@/lib/data/bank-comms-catalog";
import { runResolverTestset } from "@/lib/ai/bank-evidence-guard";

const SLUG = "bank-evidence-guard";

export const metadata: Metadata = {
  title: "BankEvidenceGuard (AG-B006) — service transverse de résolution de sources | NEURAL",
  description:
    "AG-B006 BankEvidenceGuard : service interne consommé par AG-B001..B004. Résolveur déterministe (sans LLM) qui filtre le registre fermé de sources réglementaires par type de communication, juridiction, subjects et policy de fraîcheur. 10 sources ACPR/AMF/EBA/ECB/ESMA/IFRS/EUR-Lex, 18 subjects, 3 policies, 4 testsets audités.",
};

export default function BankEvidenceGuardPage() {
  const agent = getAgentBySlug(SLUG);
  const testResults = runResolverTestset();
  const passed = testResults.filter((r) => r.passed).length;

  return (
    <div className="bg-stone-50 text-neutral-900">
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Link
            href="/secteurs/banque/communication"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Banque / Communication
          </Link>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <Database className="h-10 w-10 text-stone-700" />
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">
                  {agent?.agent_id ?? "AG-B006"} · service transverse · démo live
                </p>
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                  BankEvidenceGuard
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-lg text-neutral-700">
              Le service de résolution de sources admissibles consommé par les
              4 agents publics. Registre fermé, algorithme 100% déterministe
              (filtrage par type comm / juridiction / subjects / freshness
              policy), scoring pondéré. Aucun LLM — donc 100% auditable,
              reproductible, défendable.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <p className="font-medium text-neutral-900">Owner</p>
            <p className="mt-0.5 text-neutral-600">
              {agent?.owner ?? "Compliance"}
            </p>
            <p className="mt-3 font-medium text-neutral-900">Endpoint interne</p>
            <p className="mt-0.5 font-mono text-xs text-neutral-600">
              POST /api/internal/evidence-guard/resolve
            </p>
            <p className="mt-3 font-medium text-neutral-900">Testset</p>
            <p className="mt-0.5 text-neutral-600">
              {passed}/{testResults.length} queries passent
            </p>
          </div>
        </div>
      </section>

      {/* Démo */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        <h2 className="text-2xl font-semibold tracking-tight">Résolveur live</h2>
        <p className="mt-2 max-w-3xl text-neutral-600">
          Ajustez les paramètres, le résolveur retourne le paquet de sources
          avec scores, raisons de match et raisons de rejet.
        </p>
        <div className="mt-6">
          <EvidenceResolverLive />
        </div>
      </section>

      {/* Testset */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-stone-700" />
          Testset auditable ({passed}/{testResults.length} PASS)
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          4 queries pré-définies exécutées à chaque build pour détecter les
          régressions. Chaque test compare le nombre minimum de sources
          attendues et les blockers attendus vs. résultat effectif.
        </p>
        <div className="mt-4 space-y-3">
          {testResults.map((t, i) => {
            const expected = EVIDENCE_RESOLVER_TESTSET[i];
            return (
              <article
                key={t.query_id}
                className={`rounded-xl border p-4 text-sm ${
                  t.passed
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-red-200 bg-red-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-neutral-500">{t.query_id}</p>
                    <h3 className="mt-0.5 font-semibold text-neutral-900">
                      {t.label}
                    </h3>
                  </div>
                  <span
                    className={
                      t.passed
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900"
                        : "rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-900"
                    }
                  >
                    {t.passed ? "PASS" : "FAIL"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4">
                  <dt className="text-neutral-500">Comm type</dt>
                  <dd className="font-mono text-neutral-800">
                    {expected?.query.communication_type}
                  </dd>
                  <dt className="text-neutral-500">Juridiction</dt>
                  <dd className="text-neutral-800">{expected?.query.jurisdiction}</dd>
                  <dt className="text-neutral-500">Sources min</dt>
                  <dd className="text-neutral-800">
                    {t.expected_sources_min} / obtenus {t.actual_sources}
                  </dd>
                  <dt className="text-neutral-500">Blockers attendus</dt>
                  <dd className="font-mono text-[11px] text-neutral-800">
                    {t.expected_blockers.join(", ") || "—"}
                  </dd>
                </dl>
              </article>
            );
          })}
        </div>
      </section>

      {/* Subjects */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Tags className="h-6 w-6 text-stone-700" />
          Subjects ({EVIDENCE_SUBJECTS.length})
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Ontologie interne mappant chaque sujet aux agents qui le consomment.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {EVIDENCE_SUBJECTS.map((s) => (
            <article
              key={s.subject_id}
              className="rounded-lg border border-neutral-200 bg-white p-3 text-sm"
            >
              <p className="font-mono text-[11px] text-neutral-500">
                {s.subject_id}
              </p>
              <p className="mt-0.5 font-medium text-neutral-900">{s.label}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.applicable_agents.split(",").map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-violet-50 px-2 py-0.5 font-mono text-[10px] text-violet-800 ring-1 ring-inset ring-violet-200"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Freshness policies */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Timer className="h-6 w-6 text-stone-700" />
          Policies de fraîcheur ({FRESHNESS_POLICIES.length})
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Policy</th>
                <th className="px-4 py-2">Max age</th>
                <th className="px-4 py-2">Warning</th>
                <th className="px-4 py-2">Appliquée à</th>
              </tr>
            </thead>
            <tbody>
              {FRESHNESS_POLICIES.map((p) => (
                <tr key={p.policy_id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-mono text-xs text-neutral-700">
                    {p.policy_id}
                  </td>
                  <td className="px-4 py-2 text-neutral-900">
                    {p.max_age_days}j
                  </td>
                  <td className="px-4 py-2 text-amber-800">
                    ≥ {p.stale_warning_days}j
                  </td>
                  <td className="px-4 py-2 text-xs text-neutral-600">
                    {p.applicable_to}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Registre enrichi */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Registre enrichi ({EVIDENCE_EXPANDED.length} sources)
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Chaque source est enrichie de ses subjects, types de communication
          applicables et juridictions effectives pour permettre le filtrage.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Autorité</th>
                <th className="px-4 py-2">Types</th>
                <th className="px-4 py-2">Subjects</th>
                <th className="px-4 py-2">Weight</th>
              </tr>
            </thead>
            <tbody>
              {BANK_COMMS_SOURCES.map((s) => {
                const ext = getEvidenceExpanded(s.source_id);
                return (
                  <tr key={s.source_id} className="border-t border-neutral-100">
                    <td className="px-4 py-2 font-mono text-xs text-neutral-700">
                      {s.source_id}
                    </td>
                    <td className="px-4 py-2 font-semibold text-neutral-900">
                      {s.autorite}
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-700">
                      {ext?.applicable_comm_types ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-600">
                      {ext?.subjects ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-neutral-900">
                      {ext?.priority_weight ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/secteurs/banque/communication"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la branche
          </Link>
          <Link
            href="/agents/reg-watch-bank"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Voir AG-B005 RegWatchBank
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
