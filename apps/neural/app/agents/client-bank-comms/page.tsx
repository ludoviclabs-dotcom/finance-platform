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
    "Hausse tarifs, fermeture agence, incident, fraude. 4 gates : mentions légales, char_limit canal, ton non-promotionnel, Flesch FR par segment. 5 use cases, 4 segments, 5 canaux.",
};

export default function ClientBankCommsAgentPage() {
  const agent = getAgentBySlug(SLUG);

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
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto flex max-w-[1280px] flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-400/10">
                <Mail className="h-7 w-7 text-blue-200" />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
                  {agent?.agent_id ?? "AG-B004"} · V2 · démo live
                </p>
                <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
                  ClientBankComms
                </h1>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-white/70">
              Ton, clarté, mentions obligatoires, segmentation, canal. Chaque
              communication client sensible passe 4 gates avant diffusion — dont
              un scoring Flesch FR de lisibilité calculé serveur.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
            <p className="font-semibold text-white">Owner</p>
            <p className="mt-0.5 text-white/65">
              {agent?.owner ?? "Service client + Juridique"}
            </p>
            <p className="mt-3 font-semibold text-white">Cadres</p>
            <p className="mt-0.5 text-white/65">
              Art. L.312-1-1 CMF · RGPD Art. 34 · Code consommation
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Démo live
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {CLIENT_SCENARIOS.length} scénarios figés.
          </h2>
          <div className="mt-8">
            <ClientBankCommsLive />
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <Users className="h-3.5 w-3.5" />
            Use cases
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {CLIENT_USE_CASES.length} cas d&apos;usage couverts.
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {CLIENT_USE_CASES.map((u) => (
              <article
                key={u.use_case_id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-white/50">
                      {u.use_case_id}
                    </p>
                    <h3 className="mt-0.5 font-semibold text-white">{u.label}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/70">
                    {u.preavis_jours} j
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                  <dt className="text-white/45">Canaux</dt>
                  <dd className="text-white/85">{u.canaux_autorises}</dd>
                  <dt className="text-white/45">Base légale</dt>
                  <dd className="text-white/85">{u.base_legale}</dd>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Segments */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Segments + lisibilité
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            Flesch FR adapté par segment.
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Segment</th>
                  <th className="px-4 py-3 font-semibold">Lisibilité</th>
                  <th className="px-4 py-3 font-semibold">Ton attendu</th>
                </tr>
              </thead>
              <tbody>
                {CLIENT_SEGMENTS.map((s) => (
                  <tr key={s.segment_id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono text-[11px] text-white/50">
                      {s.segment_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{s.label}</td>
                    <td className="px-4 py-3 text-white/75">
                      Index {s.reading_level_max} · Flesch FR ≥{" "}
                      {Math.max(0, 100 - s.reading_level_max)}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-white/65">{s.ton}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Mentions légales */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <FileText className="h-3.5 w-3.5" />
            Mentions obligatoires
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {CLIENT_NOTICES.length} mentions contrôlées par GATE-MENTIONS.
          </h2>
          <div className="mt-8 space-y-3">
            {CLIENT_NOTICES.map((n) => (
              <article
                key={n.notice_id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] text-white/50">{n.notice_id}</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[11px] text-white/70">
                    {n.required_for}
                  </span>
                </div>
                <p className="mt-1.5 font-semibold text-white">{n.label}</p>
                <p className="mt-2 italic text-white/70">
                  &laquo;&nbsp;{n.text}&nbsp;&raquo;
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Channel matrix */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Matrice canal
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {CLIENT_CHANNELS.length} canaux avec char_limit.
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-5">
            {CLIENT_CHANNELS.map((c) => {
              const Icon = CANAL_ICON[c.canal] ?? Mail;
              return (
                <article
                  key={c.canal}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-blue-200" />
                    <p className="font-semibold text-white">{c.canal}</p>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-white/50">
                    {c.char_limit !== null ? `≤ ${c.char_limit} chars` : "illimité"}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-white/65">
                    <li>HTML : {c.supports_html ? "✓" : "—"}</li>
                    <li>Liens : {c.supports_links ? "✓" : "—"}</li>
                    <li>PJ : {c.supports_attachments ? "✓" : "—"}</li>
                  </ul>
                </article>
              );
            })}
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
            href="/agents/esg-bank-comms"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-white/90"
          >
            Voir AG-B003 ESGBankComms
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
