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
import {
  BANK_CRISIS_CATALOG,
  BANK_CRISIS_HOLDING_STATEMENTS,
  BANK_CRISIS_SCENARIOS,
  BANK_CRISIS_TIMERS,
  getAgentBySlug,
} from "@/lib/data/bank-comms-catalog";

const SLUG = "bank-crisis-comms";

export const metadata: Metadata = {
  title: "BankCrisisComms (AG-B002) — communication de crise bancaire | NEURAL",
  description:
    "AG-B002 BankCrisisComms : assemble et valide les communications de crise bancaire (cyber, fuite, rumeur liquidité, indisponibilité). 4 gates déterministes + horloge SLA + bibliothèque de holding statements pré-approuvés. Démo scénario-id uniquement.",
};

export default function BankCrisisAgentPage() {
  const agent = getAgentBySlug(SLUG);
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
              <Siren className="h-10 w-10 text-red-600" />
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">
                  {agent?.agent_id ?? "AG-B002"} · {agent?.priority ?? "V1"} · démo live
                </p>
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                  BankCrisisComms
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-lg text-neutral-700">
              Vite, mais jamais hors protocole. AG-B002 assemble les
              communications de crise bancaire à partir de holding statements
              pré-approuvés, bloque toute cause racine non confirmée, toute
              remédiation non validée, et calque une horloge SLA sur le niveau
              de sévérité.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <p className="font-medium text-neutral-900">Owner</p>
            <p className="mt-0.5 text-neutral-600">
              {agent?.owner ?? "Cellule crise + CISO"}
            </p>
            <p className="mt-3 font-medium text-neutral-900">SLA cible</p>
            <p className="mt-0.5 text-neutral-600">
              Variable selon SEV (60 min à 480 min)
            </p>
          </div>
        </div>
      </section>

      {/* Démo */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        <h2 className="text-2xl font-semibold tracking-tight">Démo live</h2>
        <p className="mt-2 max-w-3xl text-neutral-600">
          {BANK_CRISIS_SCENARIOS.length} scénarios figés couvrant cyber, fuite de
          données, rumeur de liquidité, indisponibilité service.
        </p>
        <div className="mt-6">
          <BankCrisisLive />
        </div>
      </section>

      {/* Catalogue incidents + SLA timers */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ShieldAlert className="h-6 w-6 text-red-600" />
              Catalogue incidents
            </h2>
            <ul className="mt-4 space-y-2">
              {BANK_CRISIS_CATALOG.map((c) => (
                <li
                  key={c.scenario_id}
                  className="rounded-lg border border-neutral-200 bg-white p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-neutral-900">{c.label}</p>
                    <span className="font-mono text-xs text-neutral-500">
                      {c.scenario_id}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">
                    Sévérité par défaut : <strong>{c.severity_default}</strong> · SLA
                    initial : {c.sla_minutes_initial} min · Coord régulateur :{" "}
                    {c.regulator_coord_required ? "requise" : "optionnelle"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Clock className="h-6 w-6 text-stone-700" />
              Horloge SLA par sévérité
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-2">Sévérité</th>
                    <th className="px-4 py-2">Publication initiale</th>
                    <th className="px-4 py-2">Réévaluation</th>
                  </tr>
                </thead>
                <tbody>
                  {BANK_CRISIS_TIMERS.map((t) => (
                    <tr key={t.severity} className="border-t border-neutral-100">
                      <td className="px-4 py-2 font-semibold text-neutral-900">
                        {t.severity}
                      </td>
                      <td className="px-4 py-2 text-neutral-700">
                        {t.sla_minutes_initial} min
                      </td>
                      <td className="px-4 py-2 text-neutral-700">
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

      {/* Bibliothèque de holding statements */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ListChecks className="h-6 w-6 text-stone-700" />
          Bibliothèque de holding statements pré-approuvés (
          {BANK_CRISIS_HOLDING_STATEMENTS.length})
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Aucun message de crise publié sans dérivation d&apos;un statement de cette
          bibliothèque (GATE-CRISIS-APPROVED-MESSAGE). Chaque entrée est signée
          par DirCom + Juridique.
        </p>
        <div className="mt-4 space-y-3">
          {BANK_CRISIS_HOLDING_STATEMENTS.map((s) => (
            <article
              key={s.statement_id}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-neutral-500">
                  {s.statement_id}
                </p>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">
                  {s.scenario_id} · {s.lang}
                </span>
              </div>
              <p className="mt-1 font-semibold text-neutral-900">{s.title}</p>
              <p className="mt-2 text-neutral-700">{s.body}</p>
              <p className="mt-2 text-xs text-neutral-500">
                Approuvé par {s.approver} le {s.approved_at}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Testset */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Users className="h-6 w-6 text-stone-700" />
          Testset (4 scénarios)
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {BANK_CRISIS_SCENARIOS.map((s) => (
            <article
              key={s.scenario_id}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-neutral-500">
                    {s.scenario_id}
                  </p>
                  <h3 className="mt-0.5 font-semibold text-neutral-900">
                    {s.label}
                  </h3>
                </div>
                <span
                  className={
                    s.expected_verdict === "BLOCK"
                      ? "rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-800 ring-1 ring-inset ring-red-200"
                      : "rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200"
                  }
                >
                  {s.expected_verdict}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-neutral-600">
                <dt className="text-neutral-500">Type</dt>
                <dd className="text-neutral-800">
                  {s.incident_type} · {s.severity}
                </dd>
                <dt className="text-neutral-500">T+</dt>
                <dd className="text-neutral-800">
                  {s.draft.minutes_since_incident} min
                </dd>
                <dt className="text-neutral-500">Message approuvé</dt>
                <dd className="text-neutral-800">
                  {s.draft.uses_approved_message ? "oui" : "non"}
                </dd>
                <dt className="text-neutral-500">Coord régulateur</dt>
                <dd className="text-neutral-800">
                  {s.draft.regulator_coord_confirmed ? "oui" : "non"}
                </dd>
                {s.expected_blockers.length ? (
                  <>
                    <dt className="text-neutral-500">Gates FAIL</dt>
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
            href="/agents/reg-bank-comms"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Voir AG-B001 RegBankComms
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
