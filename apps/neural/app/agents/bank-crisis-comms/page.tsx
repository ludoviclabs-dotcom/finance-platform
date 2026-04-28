import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  ListChecks,
  ShieldAlert,
  Siren,
  Users,
} from "lucide-react";

import { BankCrisisLive } from "@/components/bank-comms/BankCrisisLive";
import { AgentSafetyModelCard } from "@/components/trust/agent-safety-model-card";
import {
  BANK_CRISIS_CATALOG,
  BANK_CRISIS_HOLDING_STATEMENTS,
  BANK_CRISIS_SCENARIOS,
  BANK_CRISIS_TIMERS,
  getAgentBySlug,
} from "@/lib/data/bank-comms-catalog";
import { getAgentSafetyProfile } from "@/lib/data/agent-safety";

const SLUG = "bank-crisis-comms";

export const metadata: Metadata = {
  title: "BankCrisisComms (AG-B002) — communication de crise bancaire | NEURAL",
  description:
    "Cyber, fuite, rumeur liquidité, sanction, outage. 4 gates crise + horloge SLA par sévérité. 4 holding statements pré-approuvés, escalation 4 niveaux, testset 4 scénarios.",
};

export default function BankCrisisAgentPage() {
  const agent = getAgentBySlug(SLUG);
  const safetyProfile = getAgentSafetyProfile(SLUG);
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
        <div className="absolute inset-0 bg-gradient-to-b from-rose-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto flex max-w-[1280px] flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-400/10">
                <Siren className="h-7 w-7 text-rose-200" />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
                  {agent?.agent_id ?? "AG-B002"} · V1 · démo live
                </p>
                <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
                  BankCrisisComms
                </h1>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-white/70">
              Vite, mais jamais hors protocole. Cause racine non confirmée
              interdite, message issu de la bibliothèque approuvée, remédiation
              validée régulateur, horloge SLA par sévérité.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
            <p className="font-semibold text-white">Owner</p>
            <p className="mt-0.5 text-white/65">
              {agent?.owner ?? "Cellule crise + CISO"}
            </p>
            <p className="mt-3 font-semibold text-white">SLA cible</p>
            <p className="mt-0.5 text-white/65">60 à 480 min selon sévérité</p>
          </div>
        </div>
      </section>

      {safetyProfile ? <AgentSafetyModelCard profile={safetyProfile} /> : null}

      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Démo live
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {BANK_CRISIS_SCENARIOS.length} scénarios crise figés.
          </h2>
          <div className="mt-8">
            <BankCrisisLive />
          </div>
        </div>
      </section>

      {/* Catalogue + SLA */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-2">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
              <ShieldAlert className="h-3.5 w-3.5" />
              Catalogue incidents
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              5 types couverts.
            </h2>
            <ul className="mt-6 space-y-2">
              {BANK_CRISIS_CATALOG.map((c) => (
                <li
                  key={c.scenario_id}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{c.label}</p>
                    <span className="font-mono text-[11px] text-white/50">
                      {c.scenario_id}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-white/60">
                    Sévérité par défaut :{" "}
                    <span className="font-semibold text-white/85">
                      {c.severity_default}
                    </span>{" "}
                    · SLA initial : {c.sla_minutes_initial} min · Coord régulateur{" "}
                    {c.regulator_coord_required ? "requise" : "optionnelle"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
              <Clock className="h-3.5 w-3.5" />
              Horloge SLA
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              Par sévérité.
            </h2>
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Sévérité</th>
                    <th className="px-4 py-3 font-semibold">Publication initiale</th>
                    <th className="px-4 py-3 font-semibold">Réévaluation</th>
                  </tr>
                </thead>
                <tbody>
                  {BANK_CRISIS_TIMERS.map((t) => (
                    <tr key={t.severity} className="border-t border-white/5">
                      <td className="px-4 py-3 font-semibold text-white">
                        {t.severity}
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {t.sla_minutes_initial} min
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        toutes les {t.reassess_every_minutes} min
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Holding statements */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <ListChecks className="h-3.5 w-3.5" />
            Bibliothèque pré-approuvée
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {BANK_CRISIS_HOLDING_STATEMENTS.length} holding statements signés.
          </h2>
          <p className="mt-3 max-w-2xl text-white/65">
            Aucun message de crise publié hors dérivation d&apos;un statement
            de cette liste (GATE-CRISIS-APPROVED-MESSAGE). Chaque entrée est
            validée par DirCom + Juridique.
          </p>
          <div className="mt-8 space-y-3">
            {BANK_CRISIS_HOLDING_STATEMENTS.map((s) => (
              <article
                key={s.statement_id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] text-white/50">
                    {s.statement_id}
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70">
                    {s.scenario_id} · {s.lang}
                  </span>
                </div>
                <p className="mt-1.5 font-semibold text-white">{s.title}</p>
                <p className="mt-2 text-white/70">{s.body}</p>
                <p className="mt-2 text-[11px] text-white/50">
                  Approuvé par {s.approver} le {s.approved_at}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Testset */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <Users className="h-3.5 w-3.5" />
            Testset
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            4 scénarios figés.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {BANK_CRISIS_SCENARIOS.map((s) => (
              <article
                key={s.scenario_id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-white/50">
                      {s.scenario_id}
                    </p>
                    <h3 className="mt-0.5 font-semibold text-white">{s.label}</h3>
                  </div>
                  <span
                    className={
                      s.expected_verdict === "BLOCK"
                        ? "rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-red-200"
                        : "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-emerald-200"
                    }
                  >
                    {s.expected_verdict}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[11px] text-white/60">
                  <dt className="text-white/45">Type</dt>
                  <dd className="text-white/85">
                    {s.incident_type} · {s.severity}
                  </dd>
                  <dt className="text-white/45">T+</dt>
                  <dd className="text-white/85">
                    {s.draft.minutes_since_incident} min
                  </dd>
                  <dt className="text-white/45">Message approuvé</dt>
                  <dd className="text-white/85">
                    {s.draft.uses_approved_message ? "oui" : "non"}
                  </dd>
                  <dt className="text-white/45">Coord régulateur</dt>
                  <dd className="text-white/85">
                    {s.draft.regulator_coord_confirmed ? "oui" : "non"}
                  </dd>
                  {s.expected_blockers.length ? (
                    <>
                      <dt className="text-white/45">Gates FAIL</dt>
                      <dd className="font-mono text-[11px] text-red-200">
                        {s.expected_blockers.join(", ")}
                      </dd>
                    </>
                  ) : null}
                </dl>
              </article>
            ))}
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
            href="/agents/reg-bank-comms"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-white/90"
          >
            Voir AG-B001 RegBankComms
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
