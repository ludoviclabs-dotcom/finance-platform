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
  title: "BankEvidenceGuard (AG-B006) — résolveur déterministe de sources | NEURAL",
  description:
    "Service interne consommé par les 4 agents publics banque. Filtre le registre fermé par type de communication, juridiction, subjects, freshness. Zero-LLM, 100 % auditable.",
};

export default function BankEvidenceGuardPage() {
  const agent = getAgentBySlug(SLUG);
  const testResults = runResolverTestset();
  const passed = testResults.filter((r) => r.passed).length;

  return (
    <div data-theme="dark" className="min-h-screen bg-[#0A1628] text-white">
      <div className="border-b border-white/5 px-6 py-6 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Link
            href="/secteurs/banque/communication"
            className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Banque / Communication
          </Link>
        </div>
      </div>

      <section className="relative overflow-hidden border-b border-white/5 px-6 pb-14 pt-16 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto flex max-w-[1280px] flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
                <Database className="h-7 w-7 text-cyan-200" />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
                  {agent?.agent_id ?? "AG-B006"} · service transverse · démo live
                </p>
                <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
                  BankEvidenceGuard
                </h1>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-white/70">
              Résolveur déterministe consommé par les 4 agents avant génération.
              Registre fermé, filtrage par type de communication × juridiction ×
              subjects × freshness, scoring pondéré. Zero-LLM : 100 %
              auditable, reproductible, défendable.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
            <p className="font-semibold text-white">Owner</p>
            <p className="mt-0.5 text-white/65">{agent?.owner ?? "Compliance"}</p>
            <p className="mt-3 font-semibold text-white">Endpoint</p>
            <p className="mt-0.5 font-mono text-[11px] text-white/65">
              POST /api/internal/evidence-guard/resolve
            </p>
            <p className="mt-3 font-semibold text-white">Testset</p>
            <p className="mt-0.5 text-white/65">
              {passed}/{testResults.length} queries PASS
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Résolveur live
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            Ajustez la query, voyez scores et rejets.
          </h2>
          <div className="mt-8">
            <EvidenceResolverLive />
          </div>
        </div>
      </section>

      {/* Testset */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Testset auditable
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {passed}/{testResults.length} PASS · exécuté à chaque build.
          </h2>
          <div className="mt-8 space-y-3">
            {testResults.map((t, i) => {
              const expected = EVIDENCE_RESOLVER_TESTSET[i];
              return (
                <article
                  key={t.query_id}
                  className={`rounded-2xl border p-4 text-sm ${
                    t.passed
                      ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                      : "border-red-400/25 bg-red-400/[0.06]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] text-white/50">
                        {t.query_id}
                      </p>
                      <h3 className="mt-0.5 font-semibold text-white">{t.label}</h3>
                    </div>
                    <span
                      className={
                        t.passed
                          ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200"
                          : "rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-200"
                      }
                    >
                      {t.passed ? "PASS" : "FAIL"}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] md:grid-cols-4">
                    <dt className="text-white/45">Comm type</dt>
                    <dd className="font-mono text-white/85">
                      {expected?.query.communication_type}
                    </dd>
                    <dt className="text-white/45">Juridiction</dt>
                    <dd className="text-white/85">{expected?.query.jurisdiction}</dd>
                    <dt className="text-white/45">Sources min</dt>
                    <dd className="text-white/85">
                      {t.expected_sources_min} / obtenus {t.actual_sources}
                    </dd>
                    <dt className="text-white/45">Blockers</dt>
                    <dd className="font-mono text-[11px] text-white/85">
                      {t.expected_blockers.join(", ") || "—"}
                    </dd>
                  </dl>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Subjects */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <Tags className="h-3.5 w-3.5" />
            Ontologie
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {EVIDENCE_SUBJECTS.length} subjects mappés aux agents.
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {EVIDENCE_SUBJECTS.map((s) => (
              <article
                key={s.subject_id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm"
              >
                <p className="font-mono text-[11px] text-white/50">{s.subject_id}</p>
                <p className="mt-0.5 font-semibold text-white">{s.label}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.applicable_agents.split(",").map((a) => (
                    <span
                      key={a}
                      className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 font-mono text-[10px] text-violet-200"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Freshness policies */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <Timer className="h-3.5 w-3.5" />
            Policies fraîcheur
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {FRESHNESS_POLICIES.length} politiques.
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Policy</th>
                  <th className="px-4 py-3 font-semibold">Max age</th>
                  <th className="px-4 py-3 font-semibold">Warning</th>
                  <th className="px-4 py-3 font-semibold">Appliquée à</th>
                </tr>
              </thead>
              <tbody>
                {FRESHNESS_POLICIES.map((p) => (
                  <tr key={p.policy_id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono text-[11px] text-white/70">
                      {p.policy_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {p.max_age_days}j
                    </td>
                    <td className="px-4 py-3 text-amber-200">
                      ≥ {p.stale_warning_days}j
                    </td>
                    <td className="px-4 py-3 text-[11px] text-white/65">
                      {p.applicable_to}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Registre enrichi */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Registre enrichi
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {EVIDENCE_EXPANDED.length} sources avec subjects + types applicables.
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Autorité</th>
                  <th className="px-4 py-3 font-semibold">Types</th>
                  <th className="px-4 py-3 font-semibold">Subjects</th>
                  <th className="px-4 py-3 font-semibold">Weight</th>
                </tr>
              </thead>
              <tbody>
                {BANK_COMMS_SOURCES.map((s) => {
                  const ext = getEvidenceExpanded(s.source_id);
                  return (
                    <tr key={s.source_id} className="border-t border-white/5">
                      <td className="px-4 py-3 font-mono text-[11px] text-white/70">
                        {s.source_id}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {s.autorite}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-white/70">
                        {ext?.applicable_comm_types ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-white/60">
                        {ext?.subjects ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-white">
                        {ext?.priority_weight ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="px-6 py-14 md:px-12">
        <div className="mx-auto flex max-w-[1280px] flex-wrap gap-3">
          <Link
            href="/secteurs/banque/communication"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la branche
          </Link>
          <Link
            href="/agents/reg-watch-bank"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-white/90"
          >
            Voir AG-B005 RegWatchBank
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
