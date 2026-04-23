import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  Download,
  ExternalLink,
  Gauge,
  Inbox,
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
  EVIDENCE_SUBJECTS,
  REG_BANK_SCENARIOS,
  getPublicAgents,
  getRecentDigests,
} from "@/lib/data/bank-comms-catalog";
import { runResolverTestset } from "@/lib/ai/bank-evidence-guard";

export const metadata: Metadata = {
  title: "Dashboard opérationnel — Banque / Communication | NEURAL",
  description:
    "Vue consolidée des 4 agents + 2 services. KPIs calculés à la volée, gates, testsets, sources, digests, risques. Snapshot déterministe.",
};

type KpiColor = "violet" | "emerald" | "amber" | "cyan" | "rose" | "default";

function Kpi({
  label,
  value,
  hint,
  color = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  color?: KpiColor;
}) {
  const border: Record<KpiColor, string> = {
    default: "border-white/10",
    violet: "border-violet-400/25",
    emerald: "border-emerald-400/25",
    amber: "border-amber-400/25",
    cyan: "border-cyan-400/25",
    rose: "border-rose-400/25",
  };
  const text: Record<KpiColor, string> = {
    default: "text-white",
    violet: "text-violet-100",
    emerald: "text-emerald-100",
    amber: "text-amber-100",
    cyan: "text-cyan-100",
    rose: "text-rose-100",
  };
  return (
    <article className={`rounded-2xl border bg-white/[0.04] p-4 ${border[color]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </p>
      <p className={`mt-1 font-display text-3xl font-bold tracking-tight ${text[color]}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-white/55">{hint}</p> : null}
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

  const agentGates: Array<{
    slug: string;
    name: string;
    icon: typeof Landmark;
    tint: string;
    gateCount: number;
    scenarioCount: number;
    gateIds: string[];
    exportReady: boolean;
  }> = [
    {
      slug: "reg-bank-comms",
      name: "RegBankComms",
      icon: Landmark,
      tint: "border-violet-400/30 bg-violet-400/10 text-violet-200",
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
      tint: "border-rose-400/30 bg-rose-400/10 text-rose-200",
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
      tint: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
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
      tint: "border-blue-400/30 bg-blue-400/10 text-blue-200",
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
  const evidenceTestset = runResolverTestset();
  const evidenceTestPassed = evidenceTestset.filter((t) => t.passed).length;

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

      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
              <Gauge className="h-6 w-6 text-white/85" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
                Dashboard opérationnel
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                Banque <span className="text-white/40">/</span> Communication
              </h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-white/70">
            Tous les compteurs sont calculés à la volée depuis le catalog
            (<code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs">lib/data/bank-comms-catalog.ts</code>).
            Pas de chiffre théorique non vérifiable.
          </p>
        </div>
      </section>

      {/* KPIs */}
      <section className="border-b border-white/5 px-6 py-10 md:px-12">
        <div className="mx-auto grid max-w-[1280px] gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Agents live"
            value={`${agentsLive.length} / ${publicAgents.length}`}
            hint="scénario-id uniquement"
            color="emerald"
          />
          <Kpi
            label="Gates déterministes"
            value={totalGates}
            hint="overrident le LLM"
            color="violet"
          />
          <Kpi
            label="Scénarios testset"
            value={totalScenarios}
            hint={`${REG_BANK_SCENARIOS.length}+${BANK_CRISIS_SCENARIOS.length}+${ESG_SCENARIOS.length}+${CLIENT_SCENARIOS.length}`}
            color="cyan"
          />
          <Kpi
            label="Sources ACTIVE"
            value={BANK_COMMS_SOURCES.length}
            hint="ACPR · AMF · EBA · ECB · ESMA · IFRS · EUR-Lex"
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
            hint="score ≥ 10 (impact × proba)"
            color={criticalRisks > 0 ? "amber" : "default"}
          />
          <Kpi
            label="Digests réglementaires"
            value={BANK_COMMS_SUMMARY.reg_digests_count}
            hint="seed — fetch live en Sprint ultérieur"
            color="cyan"
          />
          <Kpi
            label="EvidenceGuard testset"
            value={`${evidenceTestPassed} / ${evidenceTestset.length}`}
            hint={`${EVIDENCE_SUBJECTS.length} subjects · zero-LLM`}
            color={evidenceTestPassed === evidenceTestset.length ? "emerald" : "amber"}
          />
        </div>
      </section>

      {/* Agents */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Snapshot agents
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            4 agents publics, chacun avec ses 4 gates.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {agentGates.map((a) => {
              const Icon = a.icon;
              const registry = publicAgents.find((p) => p.slug === a.slug);
              return (
                <Link
                  key={a.slug}
                  href={`/agents/${a.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${a.tint}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-mono text-[11px] text-white/50">
                          {registry?.agent_id ?? "?"}
                        </p>
                        <h3 className="text-lg font-semibold text-white">
                          {a.name}
                        </h3>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                        Démo live
                      </span>
                      {a.exportReady ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-white/55">
                          <Download className="h-3 w-3" />
                          Pack .md
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <dt className="text-white/55">Gates</dt>
                      <dd className="text-xl font-bold text-white">{a.gateCount}</dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <dt className="text-white/55">Scénarios</dt>
                      <dd className="text-xl font-bold text-white">
                        {a.scenarioCount}
                      </dd>
                    </div>
                  </dl>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {a.gateIds.map((g) => (
                      <li
                        key={g}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/65"
                      >
                        {g}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-violet-200 opacity-0 transition-opacity group-hover:opacity-100">
                    Ouvrir la fiche agent <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Services transverses */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Services transverses
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
            Consommés par les 4 agents.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link
              href="/agents/reg-watch-bank"
              className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 transition-colors hover:border-white/30 hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Radio className="h-5 w-5 text-white/75" />
                </div>
                <div>
                  <p className="font-mono text-[11px] text-white/50">
                    AG-B005 · service
                  </p>
                  <h3 className="text-lg font-semibold">RegWatchBank</h3>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/65">
                Veille ACPR · AMF · EBA · ECB · ESMA · EUR-Lex.{" "}
                {BANK_COMMS_SUMMARY.reg_digests_count} digests seed ·{" "}
                {BANK_COMMS_SUMMARY.reg_feeds_count} feeds suivis.
              </p>
              <p className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-violet-200">
                Voir le flux <ArrowRight className="h-3.5 w-3.5" />
              </p>
            </Link>
            <Link
              href="/agents/bank-evidence-guard"
              className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 transition-colors hover:border-white/30 hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Database className="h-5 w-5 text-white/75" />
                </div>
                <div>
                  <p className="font-mono text-[11px] text-white/50">
                    AG-B006 · service
                  </p>
                  <h3 className="text-lg font-semibold">BankEvidenceGuard</h3>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/65">
                Résolveur déterministe sans LLM · {EVIDENCE_SUBJECTS.length}{" "}
                subjects · {evidenceTestPassed}/{evidenceTestset.length} testset
                PASS.
              </p>
              <p className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-violet-200">
                Tester le résolveur <ArrowRight className="h-3.5 w-3.5" />
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Gates cross + Risques */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
              Gates MVP transverses
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              En complément des gates par agent.
            </h2>
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">ID</th>
                    <th className="px-4 py-3 font-semibold">Label</th>
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Bloquant</th>
                  </tr>
                </thead>
                <tbody>
                  {BANK_COMMS_GATES.map((g) => (
                    <tr key={g.gate_id} className="border-t border-white/5">
                      <td className="px-4 py-3 font-mono text-[11px] text-white/50">
                        {g.gate_id}
                      </td>
                      <td className="px-4 py-3 text-white">{g.label}</td>
                      <td className="px-4 py-3 text-[11px] text-white/55">
                        {g.stage}
                      </td>
                      <td className="px-4 py-3">
                        {g.blocking ? (
                          <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-semibold text-red-200">
                            oui
                          </span>
                        ) : (
                          <span className="text-[11px] text-white/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
              Registre des risques
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              Score impact × probabilité.
            </h2>
            <div className="mt-6 space-y-2">
              {BANK_COMMS_RISKS.map((r) => (
                <div
                  key={r.risk_id}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[11px] text-white/50">{r.risk_id}</p>
                    <span
                      className={
                        r.score >= 12
                          ? "rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-semibold text-red-200"
                          : r.score >= 8
                            ? "rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
                            : "rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/60"
                      }
                    >
                      {r.score}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-white">{r.label}</p>
                  <p className="mt-1 text-[11px] text-white/60">{r.mitigation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Derniers digests */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
                Derniers digests réglementaires
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
                Top 3 — seed Sprint 3.
              </h2>
            </div>
            <Link
              href="/agents/reg-watch-bank"
              className="inline-flex items-center gap-1 text-sm font-medium text-violet-200 transition-colors hover:text-violet-100"
            >
              Flux complet
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 space-y-3">
            {digests.map((d) => (
              <article
                key={d.digest_id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      d.impact_score >= 5
                        ? "rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-200"
                        : d.impact_score === 4
                          ? "rounded-full border border-orange-400/30 bg-orange-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-orange-200"
                          : "rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200"
                    }
                  >
                    Impact {d.impact_score}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70">
                    {d.autorite}
                  </span>
                  <span className="text-[11px] text-white/50">{d.published_at}</span>
                  <div className="ml-auto flex flex-wrap gap-1">
                    {d.affected_agents.map((a) => (
                      <span
                        key={a}
                        className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 font-mono text-[10px] text-violet-200"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
                <h3 className="mt-2 font-semibold text-white">{d.title}</h3>
                <p className="mt-1.5 text-white/70">{d.summary}</p>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[11px] text-white/55 transition-colors hover:text-white"
                >
                  Source officielle
                  <ExternalLink className="h-3 w-3" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Readiness */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Readiness
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
            État actuel vs. backlog.
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[
              {
                ok: BANK_COMMS_SUMMARY.readiness.demo_live,
                title: "Démos live (4 agents publics)",
                hint: "Scenario-id only · gates serveur · LLM overridé",
              },
              {
                ok: BANK_COMMS_SUMMARY.readiness.export_pack_ready,
                title: "Packs .md défendables",
                hint: "4/4 agents publics · hash SHA-256",
              },
              {
                ok: BANK_COMMS_SUMMARY.readiness.regulatory_watch_branch,
                title: "Veille réglementaire branchée",
                hint: "Seed Sprint 3 · fetch auto + classifier LLM à brancher",
              },
              {
                ok: BANK_COMMS_SUMMARY.readiness.workbooks_built,
                title: "Workbooks Excel réels",
                hint: "data/bank-comms/*.xlsx · sync via scripts/sync-bank-comms.ts",
              },
            ].map((r) => (
              <div
                key={r.title}
                className={`rounded-2xl border p-4 ${r.ok ? "border-emerald-400/25 bg-emerald-400/[0.06]" : "border-white/10 bg-white/[0.04]"}`}
              >
                <p className="flex items-center gap-2 font-semibold text-white">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${r.ok ? "bg-emerald-400/20 text-emerald-200" : "border border-white/20 text-white/40"}`}
                  >
                    {r.ok ? "✓" : "·"}
                  </span>
                  {r.title}
                </p>
                <p className="mt-1 text-[11px] text-white/55">{r.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="px-6 py-14 md:px-12">
        <div className="mx-auto flex max-w-[1280px] flex-wrap gap-3">
          <Link
            href="/secteurs/banque/communication"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Page secteur
          </Link>
          <Link
            href="/secteurs/banque/communication/inbox"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-white/90"
          >
            <Inbox className="h-4 w-4" />
            Inbox HITL des runs
          </Link>
        </div>
      </section>
    </div>
  );
}
