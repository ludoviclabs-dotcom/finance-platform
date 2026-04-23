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
  title: "ESGBankComms (AG-B003) — greenwashing & claims ESG banque | NEURAL",
  description:
    "AG-B003 ESGBankComms : vérifie les claims ESG banque contre SFDR, taxonomie UE, Loi Climat 2023, EU Green Claims Directive 2024, EBA GL 2022/09. 10 patterns library, 5 preuves registry, matrice FR/EU, testset 5 scénarios.",
};

export default function EsgBankAgentPage() {
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
              <Leaf className="h-10 w-10 text-emerald-600" />
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">
                  {agent?.agent_id ?? "AG-B003"} · {agent?.priority ?? "V1"} · démo live
                </p>
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                  ESGBankComms
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-lg text-neutral-700">
              L&apos;agent anti-greenwashing banque. Détecte les claims ESG dans un
              communiqué, matche contre une claim library éprouvée, vérifie la
              preuve (preuve ACTIVE, pas expirée), rend un verdict juridiction
              (FR / EU) et propose une reformulation qualifiée sourcée.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <p className="font-medium text-neutral-900">Owner</p>
            <p className="mt-0.5 text-neutral-600">{agent?.owner ?? "RSE + Compliance"}</p>
            <p className="mt-3 font-medium text-neutral-900">Cadres couverts</p>
            <p className="mt-0.5 text-neutral-600">
              SFDR, Taxonomie UE, EU Green Claims Directive 2024, Loi Climat 2023, EBA GL 2022/09
            </p>
          </div>
        </div>
      </section>

      {/* Démo */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        <h2 className="text-2xl font-semibold tracking-tight">Démo live</h2>
        <p className="mt-2 max-w-3xl text-neutral-600">
          {ESG_SCENARIOS.length} scénarios pré-chargés (taxonomie chiffrée,
          neutre en carbone, preuve STALE, impact vague, claim inconnu).
        </p>
        <div className="mt-6">
          <EsgBankCommsLive />
        </div>
      </section>

      {/* Claim library */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="h-6 w-6 text-violet-600" />
          Claim library ({ESG_CLAIM_LIBRARY.length})
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Patterns reconnus et leur statut d&apos;autorisation. INTERDIT bloque
          immédiatement, AUTORISE_SI_PROUVE exige une preuve ACTIVE, REVIEW
          signale une review humaine.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Pattern</th>
                <th className="px-4 py-2">Wording</th>
                <th className="px-4 py-2">Autorisation</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {ESG_CLAIM_LIBRARY.map((c) => (
                <tr key={c.lib_id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-mono text-xs text-neutral-500">
                    {c.lib_id}
                  </td>
                  <td className="px-4 py-2 font-medium text-neutral-900">
                    {c.pattern}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                      {c.wording_type}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        c.autorisation === "INTERDIT"
                          ? "rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-200"
                          : c.autorisation === "REVIEW"
                            ? "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
                            : c.autorisation === "AUTORISE_SI_PROUVE"
                              ? "rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 ring-1 ring-inset ring-blue-200"
                              : "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200"
                      }
                    >
                      {c.autorisation}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-neutral-600">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Evidence registry */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          Evidence registry ({ESG_EVIDENCE_REGISTRY.length})
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Chaque preuve possède une date d&apos;expiration : au-delà, statut
          STALE et bloquée par GATE-ESG-EVIDENCE.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {ESG_EVIDENCE_REGISTRY.map((e) => (
            <article
              key={e.evidence_id}
              className={`rounded-xl border p-4 text-sm ${
                e.status === "ACTIVE"
                  ? "border-emerald-200 bg-white"
                  : "border-amber-200 bg-amber-50/40"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-neutral-500">{e.evidence_id}</p>
                <span
                  className={
                    e.status === "ACTIVE"
                      ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200"
                      : "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
                  }
                >
                  {e.status}
                </span>
              </div>
              <p className="mt-1 font-semibold text-neutral-900">{e.titre}</p>
              <p className="mt-0.5 text-neutral-700">
                Claim : <em>{e.claim_pattern}</em>
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-neutral-600">
                <dt className="text-neutral-500">Valeur</dt>
                <dd className="text-neutral-800">{e.valeur}</dd>
                <dt className="text-neutral-500">Périmètre</dt>
                <dd className="text-neutral-800">{e.perimetre}</dd>
                <dt className="text-neutral-500">Année</dt>
                <dd className="text-neutral-800">{e.annee}</dd>
                <dt className="text-neutral-500">Expiry</dt>
                <dd className="text-neutral-800">{e.expiry_date ?? "—"}</dd>
                <dt className="text-neutral-500">Source</dt>
                <dd className="font-mono text-xs text-neutral-500">{e.source_id}</dd>
              </dl>
            </article>
          ))}
        </div>
      </section>

      {/* Jurisdiction matrix */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Scale className="h-6 w-6 text-stone-700" />
          Matrice juridiction FR / EU
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Pattern</th>
                <th className="px-4 py-2">FR</th>
                <th className="px-4 py-2">EU</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {ESG_JURISDICTION_VERDICTS.map((v) => (
                <tr key={v.claim_pattern} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-medium text-neutral-900">
                    {v.claim_pattern}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-mono text-neutral-700">
                      {v.fr}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-mono text-neutral-700">
                      {v.eu}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-neutral-600">{v.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
            href="/agents/bank-crisis-comms"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Voir AG-B002 BankCrisisComms
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
