import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  FileWarning,
  Gavel,
  Network,
  ScanSearch,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { InsuranceScConsole } from "@/components/insurance-supply-chain/InsuranceScConsole";
import {
  INSURANCE_SC_AGENTS,
  INSURANCE_SC_GATES,
  INSURANCE_SC_SERVICES,
  INSURANCE_SC_SOURCES,
  INSURANCE_SC_SUMMARY,
} from "@/lib/data/insurance-supply-chain-catalog";

export const metadata: Metadata = {
  title: "Assurance / Supply Chain - reparateurs, experts, fraude et Sapin II | NEURAL",
  description:
    "Branche Assurance / Supply Chain : 4 agents portfolio, 2 services reserves, 10 gates deterministes, 6 workbooks Excel generes. Libre choix reparateur, mandat expert, fraude HITL, Sapin II et DORA.",
  openGraph: {
    title: "NEURAL - Assurance / Supply Chain",
    description:
      "RepairNetworkInsur, ExpertMgmtInsur, FraudDetectSC, Sapin2Compliance. Workbooks Excel, gates deterministes et scenarios PASS / REVIEW / BLOCK.",
  },
};

const AGENT_ICON = {
  "repair-network-insur": Wrench,
  "expert-mgmt-insur": ClipboardCheck,
  "fraud-detect-sc": ScanSearch,
  "sapin2-compliance": Gavel,
} as const;

const PROBLEMS = [
  {
    problem: "Gestion du reseau de reparateurs",
    solution:
      "RepairNetworkInsur pilote qualite, couts et delais sans jamais masquer le libre choix du reparateur.",
    agent: "ISC-A001",
  },
  {
    problem: "Gestion des experts",
    solution:
      "ExpertMgmtInsur dispatch les experts et verifie mandat, rapport, contestation et pieces obligatoires.",
    agent: "ISC-A002",
  },
  {
    problem: "Fraude fournisseur",
    solution:
      "FraudDetectSC detecte surfacturation, collusion et factures suspectes comme alertes explicables avec revue humaine.",
    agent: "ISC-A003",
  },
  {
    problem: "Conformite loi Sapin II",
    solution:
      "Sapin2Compliance controle evaluation tiers, conflits d'interets, risque pays et preuves comptables.",
    agent: "ISC-A004",
  },
];

const WORKBOOKS = [
  "NEURAL_INSURANCE_SC_FOUNDATIONS.xlsx",
  "NEURAL_INSURANCE_SC_MASTER.xlsx",
  "NEURAL_ISC001_RepairNetworkInsur.xlsx",
  "NEURAL_ISC002_ExpertMgmtInsur.xlsx",
  "NEURAL_ISC003_FraudDetectSC.xlsx",
  "NEURAL_ISC004_Sapin2Compliance.xlsx",
];

export default function InsuranceSupplyChainPage() {
  const blockingGates = INSURANCE_SC_GATES.filter((gate) => gate.blocking).length;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07110f] text-white [&_*]:box-border">
      <section className="border-b border-white/[0.08] px-6 pb-14 pt-30 md:px-12 lg:pt-34">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <Link
            href="/secteurs/assurance"
            className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Secteur Assurance
          </Link>

          <div className="mt-10 grid w-full min-w-0 gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-end">
            <div className="min-w-0 max-w-[320px] sm:max-w-none">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                  Demo Excel-first
                </span>
                <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-white/62">
                  veille {INSURANCE_SC_SUMMARY.sourceDate}
                </span>
              </div>
              <h1 className="mt-6 max-w-5xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl md:text-7xl">
                <span className="block md:inline">Assurance</span>{" "}
                <span className="block md:inline">
                  <span className="text-white/35">/</span> Supply Chain
                </span>
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/68">
                Une verticale operationnelle pour securiser reparateurs, experts,
                fraude fournisseur et due diligence Sapin II. Le premier livrable
                est volontairement Excel : auditable, presentable et facile a
                expliquer a un recruteur.
              </p>
              <div className="mt-8 flex max-w-[320px] min-w-0 flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
                <a
                  href="#console"
                  className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#07110f] transition-colors hover:bg-cyan-50 sm:w-auto"
                >
                  Voir la console
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#workbooks"
                  className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-xl border border-white/[0.18] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] sm:w-auto"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  6 workbooks generes
                </a>
              </div>
            </div>

            <div className="grid max-w-[320px] min-w-0 gap-3 rounded-[28px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/25 sm:max-w-none">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "agents", value: INSURANCE_SC_SUMMARY.agents },
                  { label: "services reserves", value: INSURANCE_SC_SUMMARY.reservedServices },
                  { label: "gates MVP", value: INSURANCE_SC_SUMMARY.gates },
                  { label: "scenarios", value: INSURANCE_SC_SUMMARY.scenarios },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#0d1a16] p-4">
                    <p className="font-display text-4xl font-bold tracking-tight text-white">{stat.value}</p>
                    <p className="mt-1 break-words text-xs uppercase tracking-[0.16em] text-white/45">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4">
                <div className="flex items-center gap-2 text-amber-100">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="text-sm font-semibold">Guardrail central</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-amber-100/70">
                  Aucune sanction fournisseur, refus de sinistre ou decision sensible
                  ne sort sans revue humaine. Le scoring sert a orienter, pas a juger.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 grid max-w-[320px] gap-3 sm:max-w-none md:grid-cols-4">
            {[
              { label: "Gates bloquantes", value: blockingGates, Icon: ShieldCheck },
              { label: "Sources reglementaires", value: INSURANCE_SC_SOURCES.length, Icon: Database },
              { label: "Workbooks", value: WORKBOOKS.length, Icon: FileSpreadsheet },
              { label: "Services transverses", value: INSURANCE_SC_SERVICES.length, Icon: Network },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <item.Icon className="h-5 w-5 text-cyan-100" />
                <p className="mt-4 font-display text-3xl font-bold text-white">{item.value}</p>
                <p className="mt-1 text-sm text-white/55">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08] px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <SectionHeader
            eyebrow="Cadrage metier"
            title="4 problemes assurantiels, 4 agents controlables."
            lead="La page reprend le bloc initial mais ajoute les garde-fous reglementaires : libre choix du reparateur, mandat expert, RGPD decision automatisee, Sapin II et DORA."
          />
          <div className="mt-8 overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-[11px] uppercase tracking-[0.16em] text-white/48">
                <tr>
                  <th className="px-5 py-4 font-semibold">Problematique</th>
                  <th className="px-5 py-4 font-semibold">Solution NEURAL</th>
                  <th className="px-5 py-4 text-right font-semibold">Agent</th>
                </tr>
              </thead>
              <tbody>
                {PROBLEMS.map((row) => (
                  <tr key={row.agent} className="border-t border-white/[0.06] align-top">
                    <td className="px-5 py-5 font-semibold text-white/[0.88]">{row.problem}</td>
                    <td className="px-5 py-5 leading-relaxed text-white/62">{row.solution}</td>
                    <td className="px-5 py-5 text-right">
                      <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 font-mono text-xs text-cyan-100">
                        {row.agent}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="console" className="border-b border-white/[0.08] px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <SectionHeader
            eyebrow="Demo locale"
            title="Une console scenario-id, pas un champ libre."
            lead="Elle montre comment les workbooks seront convertis plus tard en surface produit : chaque scenario active des gates, produit un verdict et conserve une trace defendable."
          />
          <div className="mt-8">
            <InsuranceScConsole />
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08] px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <SectionHeader
            eyebrow="Agents"
            title="Le perimetre MVP reste volontairement net."
            lead="Chaque agent correspond a un workbook dedie. Les services ISC-A005 et ISC-A006 restent reserves pour la veille et la resolution des preuves."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {INSURANCE_SC_AGENTS.map((agent) => {
              const Icon = AGENT_ICON[agent.slug];
              return (
                <article key={agent.slug} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
                      <Icon className="h-5 w-5 text-cyan-100" />
                    </div>
                    <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-white/55">
                      {agent.id}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">{agent.name}</h3>
                  <p className="mt-2 min-h-[96px] text-sm leading-relaxed text-white/58">{agent.mission}</p>
                  <div className="mt-4 border-t border-white/[0.08] pt-4">
                    <p className="font-mono text-[11px] text-cyan-100/70">{agent.primaryGate}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {agent.kpis.map((kpi) => (
                        <span key={kpi} className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/55">
                          {kpi}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08] px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[0.9fr_1.1fr]" style={{ width: "calc(100vw - 72px)" }}>
          <div>
            <SectionHeader
              eyebrow="Gates"
              title="La couche de controle avant toute sortie."
              lead="Ces gates sont exactement le socle a transformer en API ou en workflow HITL lors d'une prochaine etape."
            />
            <div className="mt-6 space-y-2">
              {INSURANCE_SC_GATES.map((gate) => (
                <div key={gate.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] text-white/[0.42]">{gate.id}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{gate.label}</p>
                    </div>
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                        gate.blocking
                          ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
                          : "border-amber-300/30 bg-amber-300/10 text-amber-100",
                      ].join(" ")}
                    >
                      {gate.blocking ? "block" : "review"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white/45">
                    {gate.source} · {gate.owner}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader
              eyebrow="Sourcebook"
              title="Veille informationnelle integree au design."
              lead="La page garde les sources lisibles : c'est utile pour un recruteur, et indispensable pour eviter de vendre une automatisation opaque."
            />
            <div className="mt-6 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035]">
              {INSURANCE_SC_SOURCES.map((source) => (
                <div key={source.id} className="grid gap-3 border-t border-white/[0.08] p-4 first:border-t-0 md:grid-cols-[150px_1fr]">
                  <div>
                    <p className="font-mono text-[11px] text-white/[0.42]">{source.id}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100/75">
                      {source.authority} · {source.domain}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{source.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/52">{source.impact}</p>
                    <p className="mt-2 text-[11px] text-white/35">{source.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workbooks" className="px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <div className="grid gap-8 rounded-[28px] border border-white/10 bg-white/[0.045] p-6 md:p-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100/80">
                Livrable actuel
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
                6 fichiers Excel prets pour presentation.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/62">
                Les fichiers restent dans le dossier data dedie. Cette page est
                l'increment web : elle expose le narratif, le design et une
                premiere surface interactive sans pretendre a une integration
                production.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {INSURANCE_SC_SERVICES.map((service) => (
                  <div key={service.id} className="rounded-2xl border border-white/10 bg-[#0d1a16] p-4">
                    <p className="font-mono text-[11px] text-white/45">{service.id}</p>
                    <p className="mt-1 font-semibold text-white">{service.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/50">{service.mission}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              {WORKBOOKS.map((workbook) => (
                <div
                  key={workbook}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d1a16] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-cyan-100" />
                    <span className="truncate font-mono text-xs text-white/70">{workbook}</span>
                  </div>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/contact?subject=Assurance%20Supply%20Chain"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#07110f] transition-colors hover:bg-cyan-50"
            >
              Presenter ce chantier
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/solutions/supply-chain?sector=assurance"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.18] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              <FileWarning className="h-4 w-4" />
              Voir la branche Supply Chain
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100/75">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">{title}</h2>
      <p className="mt-4 text-sm leading-relaxed text-white/62 md:text-base">{lead}</p>
    </div>
  );
}
