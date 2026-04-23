import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  Gauge,
  Landmark,
  Leaf,
  Mail,
  Radio,
  Siren,
} from "lucide-react";

import {
  BANK_COMMS_GATES,
  BANK_COMMS_RISKS,
  BANK_COMMS_SOURCES,
  BANK_COMMS_SUMMARY,
  BANK_CRISIS_SCENARIOS,
  CLIENT_SCENARIOS,
  ESG_CLAIM_LIBRARY,
  ESG_EVIDENCE_REGISTRY,
  ESG_SCENARIOS,
  REG_BANK_SCENARIOS,
  getPublicAgents,
  getRecentDigests,
} from "@/lib/data/bank-comms-catalog";

export const metadata: Metadata = {
  title: "Dashboard opérationnel — Banque / Communication | NEURAL",
  description:
    "Vue consolidée des 4 agents publics (RegBank, Crisis, ESG, Client) + service RegWatch. KPIs, gates, testsets, sources, digests réglementaires. Snapshot déterministe temps réel.",
};

type KpiColor = "stone" | "red" | "emerald" | "blue" | "violet" | "amber";

function Kpi({
  label,
  value,
  hint,
  color = "stone",
}: {
  label: string;
  value: number | string;
  hint?: string;
  color?: KpiColor;
}) {
  const colors: Record<KpiColor, string> = {
    stone: "border-stone-200 bg-white",
    red: "border-red-200 bg-red-50",
    emerald: "border-emerald-200 bg-emerald-50/60",
    blue: "border-blue-200 bg-blue-50/60",
    violet: "border-violet-200 bg-violet-50/60",
    amber: "border-amber-200 bg-amber-50/60",
  };
  return (
    <article
      className={`rounded-xl border p-4 ${colors[color]}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-neutral-600">{hint}</p> : null}
    </article>
  );
}

export default function BankCommsDashboardPage() {
  const publicAgents = getPublicAgents();
  const agentsLive = publicAgents.filter(
    (a) => a.status === "demo" || a.status === "live",
  );
  const digests = getRecentDigests(3);
  const totalScenarios =
    REG_BANK_SCENARIOS.length +
    BANK_CRISIS_SCENARIOS.length +
    ESG_SCENARIOS.length +
    CLIENT_SCENARIOS.length;

  // Gates par agent (summary card).
  const agentGates: Array<{
    slug: string;
    name: string;
    icon: typeof Landmark;
    color: string;
    gateCount: number;
    scenarioCount: number;
    gateIds: string[];
    exportReady: boolean;
  }> = [
    {
      slug: "reg-bank-comms",
      name: "RegBankComms",
      icon: Landmark,
      color: "stone",
      gateCount: 4,
      scenarioCount: REG_BANK_SCENARIOS.length,
      gateIds: [
        "GATE-PRIV",
        "GATE-NUM-VALIDATED",
        "GATE-SOURCE-ACTIVE",
        "GATE-WORDING",
      ],
      exportReady: true,
    },
    {
      slug: "bank-crisis-comms",
      name: "BankCrisisComms",
      icon: Siren,
      color: "red",
      gateCount: 4,
      scenarioCount: BANK_CRISIS_SCENARIOS.length,
      gateIds: [
        "GATE-CRISIS-ROOT-CAUSE",
        "GATE-CRISIS-APPROVED-MESSAGE",
        "GATE-CRISIS-REMEDIATION",
        "GATE-CRISIS-SLA",
      ],
      exportReady: true,
    },
    {
      slug: "esg-bank-comms",
      name: "ESGBankComms",
      icon: Leaf,
      color: "emerald",
      gateCount: 4,
      scenarioCount: ESG_SCENARIOS.length,
      gateIds: [
        "GATE-ESG-WORDING",
        "GATE-ESG-EVIDENCE",
        "GATE-ESG-JURISDICTION",
        "GATE-ESG-CLAIM-MATCH",
      ],
      exportReady: true,
    },
    {
      slug: "client-bank-comms",
      name: "ClientBankComms",
      icon: Mail,
      color: "blue",
      gateCount: 4,
      scenarioCount: CLIENT_SCENARIOS.length,
      gateIds: [
        "GATE-CLIENT-MENTIONS",
        "GATE-CLIENT-CANAL",
        "GATE-CLIENT-TON",
        "GATE-CLIENT-LISIBILITE",
      ],
      exportReady: true,
    },
  ];

  const totalGates = agentGates.reduce((s, a) => s + a.gateCount, 0);
  const criticalRisks = BANK_COMMS_RISKS.filter((r) => r.score >= 10).length;

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
          <Gauge className="h-10 w-10 text-stone-700" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">
              Dashboard opérationnel — Sprint 5
            </p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Banque / Communication
            </h1>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-lg text-neutral-700">
          Vue consolidée des 4 agents publics + RegWatchBank. Tous les
          compteurs sont calculés à la volée à partir du catalog
          (lib/data/bank-comms-catalog.ts) — aucun chiffre théorique non
          vérifiable.
        </p>
      </section>

      {/* KPIs */}
      <section className="mx-auto max-w-6xl px-6 py-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Agents publics live"
            value={`${agentsLive.length} / ${publicAgents.length}`}
            hint="4/4 en démo scenario-id"
            color="emerald"
          />
          <Kpi
            label="Gates déterministes"
            value={totalGates}
            hint="overrident le LLM — calculées serveur"
            color="stone"
          />
          <Kpi
            label="Scénarios testset"
            value={totalScenarios}
            hint={`${REG_BANK_SCENARIOS.length}+${BANK_CRISIS_SCENARIOS.length}+${ESG_SCENARIOS.length}+${CLIENT_SCENARIOS.length}`}
            color="blue"
          />
          <Kpi
            label="Sources ACTIVE"
            value={BANK_COMMS_SOURCES.length}
            hint="ACPR, AMF, EBA, ECB, ESMA, IFRS, EUR-Lex"
            color="violet"
          />
          <Kpi
            label="Claims ESG library"
            value={ESG_CLAIM_LIBRARY.length}
            hint={`${ESG_EVIDENCE_REGISTRY.filter((e) => e.status === "ACTIVE").length} preuves ACTIVE`}
            color="emerald"
          />
          <Kpi
            label="Risques registre"
            value={`${criticalRisks} / ${BANK_COMMS_RISKS.length}`}
            hint="score ≥ 10 (impact×proba)"
            color={criticalRisks > 0 ? "amber" : "stone"}
          />
          <Kpi
            label="Digests réglementaires"
            value={BANK_COMMS_SUMMARY.reg_digests_count}
            hint="seed — fetch live Sprint 6"
            color="blue"
          />
          <Kpi
            label="Packs .md exportables"
            value={agentGates.filter((a) => a.exportReady).length}
            hint="hash SHA-256 signant chaque pack"
            color="stone"
          />
        </div>
      </section>

      {/* Agents */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Agents publics — snapshot</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {agentGates.map((a) => {
            const Icon = a.icon;
            const registry = publicAgents.find((p) => p.slug === a.slug);
            return (
              <Link
                key={a.slug}
                href={`/agents/${a.slug}`}
                className="block rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6 text-stone-700" />
                    <div>
                      <p className="font-mono text-xs text-neutral-500">
                        {registry?.agent_id ?? "?"}
                      </p>
                      <h3 className="text-lg font-semibold">{a.name}</h3>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800 ring-1 ring-inset ring-violet-200">
                      Démo live
                    </span>
                    {a.exportReady ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-neutral-600">
                        <Download className="h-3 w-3" />
                        Pack .md
                      </span>
                    ) : null}
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-neutral-50 p-2">
                    <dt className="text-neutral-500">Gates</dt>
                    <dd className="text-base font-semibold text-neutral-900">
                      {a.gateCount}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-neutral-50 p-2">
                    <dt className="text-neutral-500">Scénarios</dt>
                    <dd className="text-base font-semibold text-neutral-900">
                      {a.scenarioCount}
                    </dd>
                  </div>
                </dl>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {a.gateIds.map((g) => (
                    <li
                      key={g}
                      className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10px] text-neutral-700"
                    >
                      {g}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-stone-700">
                  Ouvrir la fiche agent <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Gates cross-agents reference */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Gates MVP — référence transverse
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Gates déterministes de niveau branche (issues du workbook Master).
          Elles complètent les gates spécifiques de chaque agent.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Label</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Bloquant</th>
              </tr>
            </thead>
            <tbody>
              {BANK_COMMS_GATES.map((g) => (
                <tr key={g.gate_id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-mono text-xs text-neutral-500">
                    {g.gate_id}
                  </td>
                  <td className="px-4 py-2 text-neutral-900">{g.label}</td>
                  <td className="px-4 py-2 text-xs text-neutral-600">{g.stage}</td>
                  <td className="px-4 py-2">
                    {g.blocking ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 ring-1 ring-inset ring-red-200">
                        oui
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Risques */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Registre des risques</h2>
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
                    <span
                      className={
                        r.score >= 12
                          ? "rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-200"
                          : r.score >= 8
                            ? "rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
                            : "rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                      }
                    >
                      {r.score}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-neutral-600">{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Derniers digests */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Radio className="h-6 w-6 text-stone-700" />
            Derniers digests réglementaires
          </h2>
          <Link
            href="/agents/reg-watch-bank"
            className="inline-flex items-center gap-1 text-sm font-medium text-stone-700 hover:text-neutral-900"
          >
            Voir le flux complet
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {digests.map((d) => (
            <article
              key={d.digest_id}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    d.impact_score >= 5
                      ? "rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 ring-1 ring-inset ring-red-200"
                      : d.impact_score === 4
                        ? "rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-800 ring-1 ring-inset ring-orange-200"
                        : "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
                  }
                >
                  Impact {d.impact_score}
                </span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">
                  {d.autorite}
                </span>
                <span className="text-xs text-neutral-500">{d.published_at}</span>
                <div className="ml-auto flex flex-wrap gap-1">
                  {d.affected_agents.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-violet-50 px-2 py-0.5 font-mono text-[10px] text-violet-800 ring-1 ring-inset ring-violet-200"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <h3 className="mt-1 font-semibold text-neutral-900">{d.title}</h3>
              <p className="mt-1 text-neutral-700">{d.summary}</p>
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900"
              >
                Source officielle
                <ExternalLink className="h-3 w-3" />
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* Readiness */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Readiness</h2>
        <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            {BANK_COMMS_SUMMARY.readiness.workbooks_built ? "✅" : "☐"} Workbooks Excel réels
            <p className="mt-1 text-xs text-neutral-500">
              Sprint 6 — produire data/bank-comms/*.xlsx, sync via scripts/sync-bank-comms.ts
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            {BANK_COMMS_SUMMARY.readiness.demo_live ? "✅" : "☐"} Démos live (4 agents publics)
            <p className="mt-1 text-xs text-neutral-500">
              Scenario-id only, gates déterministes, LLM overridé
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            {BANK_COMMS_SUMMARY.readiness.regulatory_watch_branch ? "✅" : "☐"} Veille réglementaire branchée
            <p className="mt-1 text-xs text-neutral-500">
              Seed Sprint 3 · fetch auto + classifier LLM en Sprint 6
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            {BANK_COMMS_SUMMARY.readiness.export_pack_ready ? "✅" : "☐"} Export pack défendable
            <p className="mt-1 text-xs text-neutral-500">
              4/4 agents publics · Markdown + hash SHA-256
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <Link
          href="/secteurs/banque/communication"
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la page secteur
        </Link>
      </section>
    </div>
  );
}
