import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileWarning,
  Landmark,
  Leaf,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { StatusBadge } from "@/components/site/status-badge";
import {
  BANK_COMMS_SUMMARY,
  getPublicAgents,
  getTransverseServices,
  BANK_COMMS_GATES,
  BANK_COMMS_WORKFLOW,
  BANK_COMMS_RISKS,
} from "@/lib/data/bank-comms-catalog";

export const metadata: Metadata = {
  title: "Banque / Communication — readiness Sprint 0 | NEURAL",
  description:
    "Branche Banque / Communication en préparation : RegBankComms, BankCrisisComms, ESGBankComms, ClientBankComms. Architecture trust-first, workflow de validation humaine, veille réglementaire ACPR/AMF/EBA/ECB/ESMA.",
  openGraph: {
    title: "NEURAL — Banque / Communication",
    description:
      "4 agents de préparation de communications bancaires sensibles + 2 services transverses. Aucune autopublication, toute sortie validée humainement.",
  },
};

const AGENT_ICON: Record<string, typeof ShieldCheck> = {
  "reg-bank-comms": Landmark,
  "bank-crisis-comms": ShieldAlert,
  "esg-bank-comms": Leaf,
  "client-bank-comms": Mail,
  "reg-watch-bank": FileWarning,
  "bank-evidence-guard": ShieldCheck,
};

export default function BankCommsPage() {
  const publicAgents = getPublicAgents();
  const services = getTransverseServices();

  return (
    <div className="bg-stone-50 text-neutral-900">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Link
            href="/secteurs"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Tous les secteurs
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-10 w-10 text-stone-700" />
            <StatusBadge status="planned" />
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              Sprint 0 · scaffold
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Banque <span className="text-stone-500">/</span> Communication
          </h1>
          <p className="max-w-3xl text-lg text-neutral-700">
            NEURAL prépare, contrôle, justifie et fait valider les communications
            bancaires sensibles. Pas un outil de publication : un système
            multi-agents qui produit des sorties défendables devant audit,
            régulateur ou management.
          </p>
          <div className="grid gap-3 text-sm text-neutral-700 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="font-medium text-neutral-900">Wedge MVP</p>
              <p className="mt-1 text-neutral-600">
                Communication réglementée + veille + registre de preuves.
                Extensions crise et ESG en V1, client sensible en V2.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="font-medium text-neutral-900">Périmètre initial</p>
              <p className="mt-1 text-neutral-600">
                France + UE. Cibles : banques régionales, banques privées,
                fintechs régulées. Validation humaine obligatoire, pas
                d'autopublication.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Agents publics */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          4 agents publics
        </h2>
        <p className="mt-2 text-neutral-600">
          Chacun ciblé sur un type de communication bancaire, avec ses propres
          gates déterministes, son SLA et sa politique d'approbation.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {publicAgents.map((a) => {
            const Icon = AGENT_ICON[a.slug] ?? Landmark;
            return (
              <article
                key={a.agent_id}
                className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6 text-stone-700" />
                    <div>
                      <p className="text-xs font-mono text-neutral-500">
                        {a.agent_id}
                      </p>
                      <h3 className="text-lg font-semibold">{a.name}</h3>
                    </div>
                  </div>
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                    {a.priority}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-neutral-500">Owner</dt>
                  <dd className="text-neutral-900">{a.owner}</dd>
                  <dt className="text-neutral-500">SLA</dt>
                  <dd className="text-neutral-900">
                    {a.sla_h ? `${a.sla_h} h` : "—"}
                  </dd>
                  <dt className="text-neutral-500">Priorité</dt>
                  <dd className="text-neutral-900">{a.priority}</dd>
                </dl>
              </article>
            );
          })}
        </div>
      </section>

      {/* Services transverses */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          2 services transverses
        </h2>
        <p className="mt-2 text-neutral-600">
          Non exposés comme vitrines publiques. Ils alimentent les 4 agents en
          sources admissibles et en veille réglementaire.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {services.map((s) => {
            const Icon = AGENT_ICON[s.slug] ?? ShieldCheck;
            return (
              <article
                key={s.agent_id}
                className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6 text-neutral-600" />
                  <div>
                    <p className="text-xs font-mono text-neutral-500">
                      {s.agent_id} · service
                    </p>
                    <h3 className="text-lg font-semibold">{s.name}</h3>
                  </div>
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  Owner : {s.owner}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Workflow + Gates */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Workflow</h2>
            <ol className="mt-4 space-y-3">
              {BANK_COMMS_WORKFLOW.map((step) => (
                <li
                  key={step.step}
                  className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm"
                >
                  <span className="font-mono text-neutral-500">
                    #{step.step}
                  </span>
                  <div>
                    <p className="font-medium text-neutral-900">
                      {step.stage}
                    </p>
                    <p className="text-neutral-600">
                      {step.owner} — {step.outcome}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Policy gates MVP
            </h2>
            <ul className="mt-4 space-y-3">
              {BANK_COMMS_GATES.map((g) => (
                <li
                  key={g.gate_id}
                  className="rounded-lg border border-neutral-200 bg-white p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-neutral-500">
                      {g.gate_id}
                    </p>
                    <span
                      className={
                        g.blocking
                          ? "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 ring-1 ring-inset ring-red-200"
                          : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                      }
                    >
                      {g.blocking ? "bloquant" : "info"}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-900">{g.label}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Stage : {g.stage}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Risques clés */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          Risques clés suivis
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Risque</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {BANK_COMMS_RISKS.map((r) => (
                <tr key={r.risk_id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-mono text-xs text-neutral-500">
                    {r.risk_id}
                  </td>
                  <td className="px-4 py-2 text-neutral-900">{r.label}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                      {r.score}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Readiness / Next */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            État actuel — Sprint 0 (scaffold)
          </h2>
          <ul className="mt-4 grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
            <li>
              {BANK_COMMS_SUMMARY.readiness.workbooks_built ? "✅" : "☐"}{" "}
              Workbooks Foundations + Master construits
            </li>
            <li>
              {BANK_COMMS_SUMMARY.readiness.demo_live ? "✅" : "☐"} Démo live
              RegBankComms (mode exemples pré-chargés)
            </li>
            <li>
              {BANK_COMMS_SUMMARY.readiness.regulatory_watch_branch ? "✅" : "☐"}{" "}
              Veille réglementaire branchée ACPR/AMF/EBA/ECB/ESMA
            </li>
            <li>
              {BANK_COMMS_SUMMARY.readiness.export_pack_ready ? "✅" : "☐"}{" "}
              Export pack défendable (draft + sources + approbations + hash)
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/trust"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Modèle trust-first
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/secteurs/luxe/communication"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Voir la branche Luxe / Communication (live)
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
