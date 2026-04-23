import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  FileCheck2,
  Gavel,
  Landmark,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { RegBankCommsLive } from "@/components/bank-comms/RegBankCommsLive";
import {
  BANK_COMMS_DISCLOSURE_RULES,
  BANK_COMMS_GATES,
  BANK_COMMS_RESTRICTED_WORDING,
  BANK_COMMS_SOURCES,
  REG_BANK_SCENARIOS,
  getAgentBySlug,
} from "@/lib/data/bank-comms-catalog";

const SLUG = "reg-bank-comms";

export const metadata: Metadata = {
  title: "RegBankComms (AG-B001) — communication bancaire régulée | NEURAL",
  description:
    "Résultats financiers, gouvernance, notices supervision. 4 gates serveur (info privilégiée, chiffres validated, sources ACTIVE, termes restreints). 5 scénarios figés, pack .md signé SHA-256.",
};

export default function RegBankCommsAgentPage() {
  const agent = getAgentBySlug(SLUG);
  const blockingRules = BANK_COMMS_DISCLOSURE_RULES.filter((r) => r.blocking);

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
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto flex max-w-[1280px] flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-400/10">
                <Landmark className="h-7 w-7 text-violet-200" />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
                  {agent?.agent_id ?? "AG-B001"} · MVP · démo live
                </p>
                <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
                  RegBankComms
                </h1>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-white/70">
              Rédige et relit les communications bancaires régulées. Zéro
              chiffre non validé. Zéro info privilégiée non publique. Zéro
              affirmation orpheline de source.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
            <p className="font-semibold text-white">Owner</p>
            <p className="mt-0.5 text-white/65">
              {agent?.owner ?? "DirCom + Compliance"}
            </p>
            <p className="mt-3 font-semibold text-white">SLA</p>
            <p className="mt-0.5 text-white/65">{agent?.sla_h ?? 24} h</p>
          </div>
        </div>
      </section>

      {/* Démo */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Démo live
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {REG_BANK_SCENARIOS.length} scénarios figés · pas de texte libre.
          </h2>
          <p className="mt-3 max-w-2xl text-white/65">
            Le visiteur ne peut pas coller un communiqué non publié. Chaque
            scénario exerce un gate différent de la stack MVP.
          </p>
          <div className="mt-8">
            <RegBankCommsLive />
          </div>
        </div>
      </section>

      {/* Testset */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Testset
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            5 scénarios + verdict attendu.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {REG_BANK_SCENARIOS.map((s) => (
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
                        : s.expected_verdict === "PASS"
                          ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-emerald-200"
                          : "rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-amber-200"
                    }
                  >
                    {s.expected_verdict}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[11px] text-white/60">
                  <dt className="text-white/45">Type</dt>
                  <dd className="text-white/85">
                    {s.communication_type}
                    {s.communication_subtype ? ` · ${s.communication_subtype}` : ""}
                  </dd>
                  <dt className="text-white/45">Période</dt>
                  <dd className="text-white/85">{s.draft.period}</dd>
                  <dt className="text-white/45">Chiffres</dt>
                  <dd className="text-white/85">
                    {s.draft.numbers.length} · validated :{" "}
                    {s.draft.numbers.filter((n) => n.status === "validated").length}
                  </dd>
                  <dt className="text-white/45">Privilégiée</dt>
                  <dd className="text-white/85">
                    {s.draft.contains_privileged_info ? "oui" : "non"}
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

      {/* Gates + Règles */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-2">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Gates MVP
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              Calculées serveur. Jamais par le LLM.
            </h2>
            <ul className="mt-6 space-y-2">
              {BANK_COMMS_GATES.map((g) => (
                <li
                  key={g.gate_id}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] text-white/50">
                      {g.gate_id}
                    </span>
                    {g.blocking ? (
                      <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-200">
                        bloquant
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/40">info</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-white">{g.label}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
              <Gavel className="h-3.5 w-3.5" />
              Règles de disclosure bloquantes
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              {blockingRules.length} règles ACPR · AMF · EBA · ECB · ESMA.
            </h2>
            <ul className="mt-6 space-y-2">
              {blockingRules.map((r) => (
                <li
                  key={r.rule_id}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] text-white/50">
                      {r.rule_id}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                      {r.autorite} · {r.severite}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white">{r.champ_obligatoire}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Restricted wording */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <ShieldAlert className="h-3.5 w-3.5" />
            Restricted wording
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            Termes bloqués par GATE-WORDING.
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Terme</th>
                  <th className="px-4 py-3 font-semibold">Sévérité</th>
                  <th className="px-4 py-3 font-semibold">Raison</th>
                </tr>
              </thead>
              <tbody>
                {BANK_COMMS_RESTRICTED_WORDING.map((w) => (
                  <tr key={w.term_id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono text-[11px] text-white/50">
                      {w.term_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      &laquo;&nbsp;{w.term}&nbsp;&raquo;
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          w.severite === "CRITICAL"
                            ? "rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-semibold text-red-200"
                            : w.severite === "HIGH"
                              ? "rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
                              : "rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/60"
                        }
                      >
                        {w.severite}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/65">{w.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Sources */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <FileCheck2 className="h-3.5 w-3.5" />
            Registre de sources
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {BANK_COMMS_SOURCES.length} sources ACTIVE.
          </h2>
          <p className="mt-3 max-w-2xl text-white/65">
            Registre fermé. GATE-SOURCE-ACTIVE rejette toute sortie agent
            sans un mapping vers une source de cette liste.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {BANK_COMMS_SOURCES.map((s) => (
              <article
                key={s.source_id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] text-white/50">{s.source_id}</p>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                    {s.status}
                  </span>
                </div>
                <p className="mt-1.5 font-semibold text-white">{s.autorite}</p>
                <p className="mt-0.5 text-white/70">{s.titre}</p>
                <p className="mt-1 text-[11px] text-white/50">
                  Juridiction {s.juridiction} · review {s.review_date ?? "—"}
                </p>
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
            href="/agents/bank-crisis-comms"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-white/90"
          >
            Voir AG-B002 BankCrisisComms
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
