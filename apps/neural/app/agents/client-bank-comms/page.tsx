import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Mail,
  MessageSquare,
  Smartphone,
  Users,
} from "lucide-react";

import { ClientBankCommsLive } from "@/components/bank-comms/ClientBankCommsLive";
import {
  CLIENT_CHANNELS,
  CLIENT_NOTICES,
  CLIENT_SCENARIOS,
  CLIENT_SEGMENTS,
  CLIENT_USE_CASES,
  getAgentBySlug,
} from "@/lib/data/bank-comms-catalog";

const SLUG = "client-bank-comms";

const CANAL_ICON: Record<string, typeof Mail> = {
  EMAIL: Mail,
  SMS: MessageSquare,
  APP: Smartphone,
  PUSH: Smartphone,
  MAIL: Mail,
};

export const metadata: Metadata = {
  title: "ClientBankComms (AG-B004) — communications clients sensibles banque | NEURAL",
  description:
    "AG-B004 ClientBankComms : vérifie les communications clients (hausse tarifs, fermeture agence, incident, fraude). 4 gates déterministes : mentions légales, limite canal, ton, lisibilité Flesch FR. 5 use cases, 4 segments, 5 scénarios pré-chargés.",
};

export default function ClientBankCommsAgentPage() {
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
              <Mail className="h-10 w-10 text-blue-600" />
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">
                  {agent?.agent_id ?? "AG-B004"} · {agent?.priority ?? "V2"} · démo live
                </p>
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                  ClientBankComms
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-lg text-neutral-700">
              Ton, clarté, mentions obligatoires, segmentation, canal. AG-B004
              valide chaque communication client sensible (hausse tarifs,
              fermeture agence, incident, alerte fraude) avec 4 gates
              déterministes — dont un scoring Flesch FR de lisibilité par
              segment.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <p className="font-medium text-neutral-900">Owner</p>
            <p className="mt-0.5 text-neutral-600">
              {agent?.owner ?? "Service client + Juridique"}
            </p>
            <p className="mt-3 font-medium text-neutral-900">Cadres couverts</p>
            <p className="mt-0.5 text-neutral-600">
              Art. L.312-1-1 CMF, RGPD Art. 34, Code consommation, Médiation bancaire
            </p>
          </div>
        </div>
      </section>

      {/* Démo */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        <h2 className="text-2xl font-semibold tracking-tight">Démo live</h2>
        <p className="mt-2 max-w-3xl text-neutral-600">
          {CLIENT_SCENARIOS.length} scénarios pré-chargés : hausse tarifs email,
          hausse tarifs sans mentions, SMS alerte fraude trop long, fermeture
          agence ton promotionnel, incident technique corporate.
        </p>
        <div className="mt-6">
          <ClientBankCommsLive />
        </div>
      </section>

      {/* Use cases */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Users className="h-6 w-6 text-stone-700" />
          Use cases couverts ({CLIENT_USE_CASES.length})
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {CLIENT_USE_CASES.map((u) => (
            <article
              key={u.use_case_id}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-neutral-500">
                    {u.use_case_id}
                  </p>
                  <h3 className="mt-0.5 font-semibold text-neutral-900">{u.label}</h3>
                </div>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-mono text-neutral-700">
                  {u.preavis_jours} j
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-neutral-500">Canaux</dt>
                <dd className="text-neutral-800">{u.canaux_autorises}</dd>
                <dt className="text-neutral-500">Base légale</dt>
                <dd className="text-neutral-800">{u.base_legale}</dd>
              </dl>
            </article>
          ))}
        </div>
      </section>

      {/* Segments */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Segments & lisibilité ({CLIENT_SEGMENTS.length})
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Segment</th>
                <th className="px-4 py-2">Lisibilité max</th>
                <th className="px-4 py-2">Ton attendu</th>
              </tr>
            </thead>
            <tbody>
              {CLIENT_SEGMENTS.map((s) => (
                <tr key={s.segment_id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-mono text-xs text-neutral-500">
                    {s.segment_id}
                  </td>
                  <td className="px-4 py-2 font-medium text-neutral-900">
                    {s.label}
                  </td>
                  <td className="px-4 py-2 text-neutral-700">
                    Index {s.reading_level_max} · Flesch FR ≥{" "}
                    {Math.max(0, 100 - s.reading_level_max)}
                  </td>
                  <td className="px-4 py-2 text-xs text-neutral-600">{s.ton}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mentions légales */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileText className="h-6 w-6 text-stone-700" />
          Mentions légales obligatoires ({CLIENT_NOTICES.length})
        </h2>
        <div className="mt-4 space-y-3">
          {CLIENT_NOTICES.map((n) => (
            <article
              key={n.notice_id}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-neutral-500">{n.notice_id}</p>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-mono text-neutral-700">
                  {n.required_for}
                </span>
              </div>
              <p className="mt-1 font-semibold text-neutral-900">{n.label}</p>
              <p className="mt-2 italic text-neutral-700">
                &laquo;&nbsp;{n.text}&nbsp;&raquo;
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Channel matrix */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Matrice canal ({CLIENT_CHANNELS.length})
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {CLIENT_CHANNELS.map((c) => {
            const Icon = CANAL_ICON[c.canal] ?? Mail;
            return (
              <article
                key={c.canal}
                className="rounded-xl border border-neutral-200 bg-white p-4 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-neutral-700" />
                  <p className="font-semibold text-neutral-900">{c.canal}</p>
                </div>
                <p className="mt-2 text-xs font-mono text-neutral-500">
                  {c.char_limit !== null
                    ? `≤ ${c.char_limit} chars`
                    : "pas de limite"}
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-neutral-600">
                  <li>HTML : {c.supports_html ? "✓" : "—"}</li>
                  <li>Liens : {c.supports_links ? "✓" : "—"}</li>
                  <li>PJ : {c.supports_attachments ? "✓" : "—"}</li>
                </ul>
              </article>
            );
          })}
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
            href="/agents/esg-bank-comms"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Voir AG-B003 ESGBankComms
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
