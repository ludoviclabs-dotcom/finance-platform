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
    "Veille ACPR · AMF · EBA · ECB · ESMA · EUR-Lex. Digests classifiés par impact, mapping agents touchés, task follow-up. Seed Sprint 3, fetch live en backlog.",
};

export default function RegWatchBankPage() {
  const digests = getRecentDigests(20);
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
        <div className="relative mx-auto max-w-[1280px]">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
              <Radio className="h-7 w-7 text-cyan-200" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
                AG-B005 · service transverse · seed Sprint 3
              </p>
              <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
                RegWatchBank
              </h1>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-white/70">
            Veille réglementaire banque. Chaque publication est classifiée par
            impact 1-5, mappée aux agents touchés, et déclenche une tâche de
            follow-up (update workbook, revue règle, mise à jour library).
          </p>
          <p className="mt-3 max-w-3xl text-sm text-amber-100/80">
            Seed figé : 5 digests réels publiés entre décembre 2025 et avril
            2026. Le fetch automatisé des feeds (RSS + HTML parsers +
            classifier LLM + queue) est en backlog.
          </p>
        </div>
      </section>

      {/* Feeds */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <Rss className="h-3.5 w-3.5" />
            Feeds suivis
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {BANK_REG_FEEDS.filter((f) => f.active).length} autorités actives.
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Autorité</th>
                  <th className="px-4 py-3 font-semibold">Cadence</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">URL</th>
                </tr>
              </thead>
              <tbody>
                {BANK_REG_FEEDS.map((f) => (
                  <tr key={f.feed_id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono text-[11px] text-white/50">
                      {f.feed_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{f.autorite}</td>
                    <td className="px-4 py-3 text-white/75">{f.cadence}</td>
                    <td className="px-4 py-3 text-white/75">{f.owner}</td>
                    <td className="px-4 py-3">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-white/60 transition-colors hover:text-white"
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
        </div>
      </section>

      {/* Impact levels */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Échelle d&apos;impact
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            5 niveaux · SLA de traitement.
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-5">
            {BANK_REG_IMPACT_LEVELS.map((lvl) => (
              <article
                key={lvl.impact_score}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      lvl.impact_score >= 5
                        ? "rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-semibold text-red-200"
                        : lvl.impact_score === 4
                          ? "rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-[11px] font-semibold text-orange-200"
                          : lvl.impact_score === 3
                            ? "rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
                            : "rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/60"
                    }
                  >
                    {lvl.impact_score}
                  </span>
                  <p className="font-mono text-[11px] text-white/50">
                    SLA {lvl.sla_days}j
                  </p>
                </div>
                <p className="mt-2 text-[11px] text-white/75">{lvl.label}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Digests */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Digests récents
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {digests.length} publications 2025-2026.
          </h2>
          <div className="mt-8 space-y-4">
            {digests.map((d) => (
              <article
                key={d.digest_id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      d.impact_score >= 5
                        ? "rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-200"
                        : d.impact_score === 4
                          ? "rounded-full border border-orange-400/30 bg-orange-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-orange-200"
                          : d.impact_score === 3
                            ? "rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200"
                            : "rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/60"
                    }
                  >
                    Impact {d.impact_score}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70">
                    {d.autorite}
                  </span>
                  <span className="text-[11px] text-white/55">{d.published_at}</span>
                  {d.followup_task_id ? (
                    <span className="font-mono text-[11px] text-white/50">
                      {d.followup_task_id}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-2 text-lg font-semibold text-white">{d.title}</h3>
                <p className="mt-2 text-sm text-white/70">{d.summary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {d.affected_agents.map((a) => (
                      <span
                        key={a}
                        className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 font-mono text-[10px] text-violet-200"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/55 transition-colors hover:text-white"
                  >
                    Source officielle
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Link
            href="/secteurs/banque/communication"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la branche
          </Link>
        </div>
      </section>
    </div>
  );
}
