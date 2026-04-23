import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Radio,
  Rss,
  ShieldCheck,
} from "lucide-react";

import {
  BANK_REG_FEEDS,
  BANK_REG_IMPACT_LEVELS,
  getRecentDigests,
} from "@/lib/data/bank-comms-catalog";

export const metadata: Metadata = {
  title: "RegWatchBank (AG-B005) — veille réglementaire banque | NEURAL",
  description:
    "Service transverse de veille ACPR / AMF / EBA / ECB / ESMA / EUR-Lex. Digest classifié par impact, task follow-up, mapping agents touchés. Seed Sprint 3, fetch hebdo automatisé en Sprint 4.",
};

export default function RegWatchBankPage() {
  const digests = getRecentDigests(20);
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
        <div className="flex items-center gap-3">
          <Radio className="h-10 w-10 text-stone-700" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">
              AG-B005 · Service transverse · Sprint 3 seed
            </p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              RegWatchBank
            </h1>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-lg text-neutral-700">
          Veille réglementaire banque : ACPR, AMF, EBA, ECB, ESMA, EUR-Lex,
          IFRS. Chaque publication est classifiée par impact (1 à 5), mappée
          aux agents NEURAL concernés (AG-B001..B004), et déclenche une tâche
          de follow-up (update workbook, mise à jour library, revue règles).
        </p>
        <p className="mt-3 max-w-3xl text-sm text-amber-800">
          <strong>Sprint 3 — seed figé</strong> : 5 digests réels publiés
          entre décembre 2025 et avril 2026. Le fetch automatisé des feeds
          (RSS / HTML parsers + classifier LLM + queue de tâches vers owners)
          est planifié en Sprint 4.
        </p>
      </section>

      {/* Feeds */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Rss className="h-6 w-6 text-stone-700" />
          Feeds suivis ({BANK_REG_FEEDS.filter((f) => f.active).length} actifs)
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Autorité</th>
                <th className="px-4 py-2">Cadence</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">URL</th>
              </tr>
            </thead>
            <tbody>
              {BANK_REG_FEEDS.map((f) => (
                <tr key={f.feed_id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-mono text-xs text-neutral-500">
                    {f.feed_id}
                  </td>
                  <td className="px-4 py-2 font-semibold text-neutral-900">
                    {f.autorite}
                  </td>
                  <td className="px-4 py-2 text-neutral-700">{f.cadence}</td>
                  <td className="px-4 py-2 text-neutral-700">{f.owner}</td>
                  <td className="px-4 py-2">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900"
                    >
                      {new URL(f.url).hostname}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Impact levels */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-stone-700" />
          Échelle d&apos;impact
        </h2>
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          {BANK_REG_IMPACT_LEVELS.map((lvl) => (
            <article
              key={lvl.impact_score}
              className="rounded-xl border border-neutral-200 bg-white p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    lvl.impact_score >= 5
                      ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900"
                      : lvl.impact_score === 4
                        ? "rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-900"
                        : lvl.impact_score === 3
                          ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                          : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700"
                  }
                >
                  {lvl.impact_score}
                </span>
                <p className="text-xs font-mono text-neutral-500">
                  SLA {lvl.sla_days}j
                </p>
              </div>
              <p className="mt-2 text-xs text-neutral-700">{lvl.label}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Digests récents */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Digests récents ({digests.length})
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Classement par date de publication décroissante. Chaque digest est
          mappé aux agents touchés et ouvre une tâche de follow-up.
        </p>
        <div className="mt-6 space-y-4">
          {digests.map((d) => (
            <article
              key={d.digest_id}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={
                    d.impact_score >= 5
                      ? "rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-200"
                      : d.impact_score === 4
                        ? "rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-800 ring-1 ring-inset ring-orange-200"
                        : d.impact_score === 3
                          ? "rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
                          : "rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700"
                  }
                >
                  Impact {d.impact_score}
                </span>
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700">
                  {d.autorite}
                </span>
                <span className="text-xs text-neutral-500">{d.published_at}</span>
                {d.followup_task_id ? (
                  <span className="font-mono text-[11px] text-neutral-500">
                    {d.followup_task_id}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-neutral-900">
                {d.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-700">{d.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {d.affected_agents.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-mono text-violet-800 ring-1 ring-inset ring-violet-200"
                    >
                      {a}
                    </span>
                  ))}
                </div>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900"
                >
                  Source officielle
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <Link
          href="/secteurs/banque/communication"
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la branche Banque / Communication
        </Link>
      </section>
    </div>
  );
}
