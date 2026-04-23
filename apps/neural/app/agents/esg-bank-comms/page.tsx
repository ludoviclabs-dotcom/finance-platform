import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Leaf, Scale, ShieldCheck, Sparkles } from "lucide-react";

import { EsgBankCommsLive } from "@/components/bank-comms/EsgBankCommsLive";
import {
  ESG_CLAIM_LIBRARY,
  ESG_EVIDENCE_REGISTRY,
  ESG_JURISDICTION_VERDICTS,
  ESG_SCENARIOS,
  getAgentBySlug,
} from "@/lib/data/bank-comms-catalog";

const SLUG = "esg-bank-comms";

export const metadata: Metadata = {
  title: "ESGBankComms (AG-B003) — anti-greenwashing banque | NEURAL",
  description:
    "SFDR, Taxonomie UE, EU Green Claims Directive 2024, Loi Climat 2023, EBA GL 2022/09. 10 patterns library, 5 preuves registry, matrice FR/EU.",
};

export default function EsgBankAgentPage() {
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
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto flex max-w-[1280px] flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
                <Leaf className="h-7 w-7 text-emerald-200" />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
                  {agent?.agent_id ?? "AG-B003"} · V1 · démo live
                </p>
                <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
                  ESGBankComms
                </h1>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-white/70">
              Matche chaque claim ESG contre une library éprouvée, vérifie la
              preuve (ACTIVE, pas expirée), rend un verdict juridiction FR/EU,
              propose une reformulation qualifiée sourcée.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
            <p className="font-semibold text-white">Owner</p>
            <p className="mt-0.5 text-white/65">{agent?.owner ?? "RSE + Compliance"}</p>
            <p className="mt-3 font-semibold text-white">Cadres</p>
            <p className="mt-0.5 text-white/65">
              SFDR · Taxonomie UE · Green Claims 2024 · Loi Climat 2023 · EBA GL
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
            {ESG_SCENARIOS.length} scénarios figés.
          </h2>
          <div className="mt-8">
            <EsgBankCommsLive />
          </div>
        </div>
      </section>

      {/* Claim library */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            Claim library
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {ESG_CLAIM_LIBRARY.length} patterns avec autorisation.
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Pattern</th>
                  <th className="px-4 py-3 font-semibold">Wording</th>
                  <th className="px-4 py-3 font-semibold">Autorisation</th>
                  <th className="px-4 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {ESG_CLAIM_LIBRARY.map((c) => (
                  <tr key={c.lib_id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono text-[11px] text-white/50">
                      {c.lib_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{c.pattern}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70">
                        {c.wording_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          c.autorisation === "INTERDIT"
                            ? "rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-200"
                            : c.autorisation === "REVIEW"
                              ? "rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200"
                              : c.autorisation === "AUTORISE_SI_PROUVE"
                                ? "rounded-full border border-blue-400/30 bg-blue-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-200"
                                : "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200"
                        }
                      >
                        {c.autorisation}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-white/60">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Evidence */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Evidence registry
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {ESG_EVIDENCE_REGISTRY.length} preuves avec expiry.
          </h2>
          <p className="mt-3 max-w-2xl text-white/65">
            Au-delà de la date d&apos;expiration, la preuve bascule STALE et
            GATE-ESG-EVIDENCE bloque.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {ESG_EVIDENCE_REGISTRY.map((e) => (
              <article
                key={e.evidence_id}
                className={`rounded-2xl border p-4 text-sm ${
                  e.status === "ACTIVE"
                    ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                    : "border-amber-400/25 bg-amber-400/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] text-white/50">{e.evidence_id}</p>
                  <span
                    className={
                      e.status === "ACTIVE"
                        ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200"
                        : "rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
                    }
                  >
                    {e.status}
                  </span>
                </div>
                <p className="mt-1.5 font-semibold text-white">{e.titre}</p>
                <p className="mt-0.5 text-white/70">
                  Claim : <em>{e.claim_pattern}</em>
                </p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-white/60">
                  <dt className="text-white/45">Valeur</dt>
                  <dd className="text-white/85">{e.valeur}</dd>
                  <dt className="text-white/45">Périmètre</dt>
                  <dd className="text-white/85">{e.perimetre}</dd>
                  <dt className="text-white/45">Année</dt>
                  <dd className="text-white/85">{e.annee}</dd>
                  <dt className="text-white/45">Expiry</dt>
                  <dd className="text-white/85">{e.expiry_date ?? "—"}</dd>
                  <dt className="text-white/45">Source</dt>
                  <dd className="font-mono text-[11px] text-white/55">{e.source_id}</dd>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Jurisdiction matrix */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            <Scale className="h-3.5 w-3.5" />
            Matrice juridiction
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            Verdict FR / EU par pattern.
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Pattern</th>
                  <th className="px-4 py-3 font-semibold">FR</th>
                  <th className="px-4 py-3 font-semibold">EU</th>
                  <th className="px-4 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {ESG_JURISDICTION_VERDICTS.map((v) => (
                  <tr key={v.claim_pattern} className="border-t border-white/5">
                    <td className="px-4 py-3 font-semibold text-white">
                      {v.claim_pattern}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/70">
                        {v.fr}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/70">
                        {v.eu}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-white/60">{v.note}</td>
                  </tr>
                ))}
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
