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
    "AG-B001 RegBankComms : rédige et relit les communications réglementées (résultats, gouvernance, notices supervision). 4 gates déterministes MVP, 10 sources réelles ACPR/AMF/EBA/ECB/ESMA, 13 règles de disclosure bloquantes, 5 scénarios figés. Démo scénario-id only (correctif trust-first).",
};

export default function RegBankCommsAgentPage() {
  const agent = getAgentBySlug(SLUG);
  const blockingRules = BANK_COMMS_DISCLOSURE_RULES.filter((r) => r.blocking);

  return (
    <div className="bg-stone-50 text-neutral-900">
      {/* Header */}
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

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <Landmark className="h-10 w-10 text-stone-700" />
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">
                  {agent?.agent_id ?? "AG-B001"} · {agent?.priority ?? "MVP"} ·
                  démo live
                </p>
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                  RegBankComms
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-lg text-neutral-700">
              L&apos;agent qui rédige et relit les communications bancaires régulées
              — résultats financiers, gouvernance, notices de supervision. Zéro
              chiffre non validé, zéro info privilégiée non publique, zéro
              affirmation orpheline de source.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <p className="font-medium text-neutral-900">Owner</p>
            <p className="mt-0.5 text-neutral-600">
              {agent?.owner ?? "DirCom + Compliance"}
            </p>
            <p className="mt-3 font-medium text-neutral-900">SLA</p>
            <p className="mt-0.5 text-neutral-600">{agent?.sla_h ?? 24} h</p>
          </div>
        </div>
      </section>

      {/* Démo live */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Démo live — scénarios pré-chargés uniquement
        </h2>
        <p className="mt-2 max-w-3xl text-neutral-600">
          Aucun texte libre accepté : la démo publique expose {REG_BANK_SCENARIOS.length} scénarios
          figés couvrant chacun un gate de la stack MVP. Ce garde-fou évite
          l&apos;ingestion accidentelle d&apos;un communiqué non publié (info privilégiée).
        </p>
        <div className="mt-6">
          <RegBankCommsLive />
        </div>
      </section>

      {/* Testset détaillé */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Testset (5 scénarios)</h2>
        <p className="mt-2 text-neutral-600">
          Chaque scénario est associé à un verdict attendu et aux gates qui doivent bloquer.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {REG_BANK_SCENARIOS.map((s) => (
            <article
              key={s.scenario_id}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-neutral-500">{s.scenario_id}</p>
                  <h3 className="mt-0.5 font-semibold text-neutral-900">{s.label}</h3>
                </div>
                <span
                  className={
                    s.expected_verdict === "BLOCK"
                      ? "rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 ring-1 ring-inset ring-red-200"
                      : s.expected_verdict === "PASS"
                        ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200"
                        : "rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200"
                  }
                >
                  {s.expected_verdict}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-neutral-600">
                <dt className="text-neutral-500">Type</dt>
                <dd className="text-neutral-800">
                  {s.communication_type}
                  {s.communication_subtype ? ` · ${s.communication_subtype}` : ""}
                </dd>
                <dt className="text-neutral-500">Période</dt>
                <dd className="text-neutral-800">{s.draft.period}</dd>
                <dt className="text-neutral-500">Chiffres</dt>
                <dd className="text-neutral-800">
                  {s.draft.numbers.length} · validated :{" "}
                  {s.draft.numbers.filter((n) => n.status === "validated").length}
                </dd>
                <dt className="text-neutral-500">Privilégiée</dt>
                <dd className="text-neutral-800">
                  {s.draft.contains_privileged_info ? "oui" : "non"}
                </dd>
                {s.expected_blockers.length ? (
                  <>
                    <dt className="text-neutral-500">Gates attendues FAIL</dt>
                    <dd className="font-mono text-[11px] text-red-700">
                      {s.expected_blockers.join(", ")}
                    </dd>
                  </>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      </section>

      {/* Gates + Règles */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ShieldCheck className="h-6 w-6 text-stone-700" />
              Gates déterministes MVP
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Exécutées côté serveur avant le LLM. Le LLM ne peut pas contredire
              le verdict — ses sorties sont systématiquement overridées si elles
              divergent.
            </p>
            <ul className="mt-4 space-y-2">
              {BANK_COMMS_GATES.map((g) => (
                <li
                  key={g.gate_id}
                  className="rounded-lg border border-neutral-200 bg-white p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-neutral-500">
                      {g.gate_id}
                    </span>
                    {g.blocking ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                        bloquant
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">
                        info
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-medium text-neutral-900">{g.label}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Gavel className="h-6 w-6 text-stone-700" />
              Règles de disclosure bloquantes ({blockingRules.length})
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Extraites du workbook Foundations (`3_DISCLOSURE_RULES`).
              Autorités couvertes : ACPR, AMF, EBA, ECB, ESMA.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {blockingRules.map((r) => (
                <li
                  key={r.rule_id}
                  className="rounded-lg border border-neutral-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-neutral-500">
                      {r.rule_id}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                      {r.autorite} · {r.severite}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-900">{r.champ_obligatoire}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Restricted wording */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldAlert className="h-6 w-6 text-stone-700" />
          Termes restreints détectés par GATE-WORDING
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Terme</th>
                <th className="px-4 py-2">Sévérité</th>
                <th className="px-4 py-2">Raison</th>
              </tr>
            </thead>
            <tbody>
              {BANK_COMMS_RESTRICTED_WORDING.map((w) => (
                <tr key={w.term_id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-mono text-xs text-neutral-500">
                    {w.term_id}
                  </td>
                  <td className="px-4 py-2 font-medium text-neutral-900">
                    &laquo;{w.term}&raquo;
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        w.severite === "CRITICAL"
                          ? "rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 ring-1 ring-inset ring-red-200"
                          : w.severite === "HIGH"
                            ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
                            : "rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700"
                      }
                    >
                      {w.severite}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{w.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sources */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileCheck2 className="h-6 w-6 text-stone-700" />
          Sources réglementaires ({BANK_COMMS_SOURCES.length} ACTIVE)
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Registre fermé. Aucune sortie agent n&apos;est acceptée par GATE-SOURCE-ACTIVE
          sans un mapping vers une source de cette liste.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {BANK_COMMS_SOURCES.map((s) => (
            <article
              key={s.source_id}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-neutral-500">{s.source_id}</p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  {s.status}
                </span>
              </div>
              <p className="mt-1 font-semibold text-neutral-900">{s.autorite}</p>
              <p className="mt-0.5 text-neutral-700">{s.titre}</p>
              <p className="mt-1 text-xs text-neutral-500">
                Juridiction {s.juridiction} · dernière review {s.review_date ?? "—"}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Footer CTAs */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/secteurs/banque/communication"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la branche Banque / Communication
          </Link>
          <Link
            href="/trust"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Modèle trust-first
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
