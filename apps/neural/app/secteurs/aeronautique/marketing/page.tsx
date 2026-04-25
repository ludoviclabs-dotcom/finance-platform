import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  Leaf,
  Layers,
  Network,
  Plane,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import {
  AERO_MKT_AGENTS,
  AERO_MKT_PROBLEMS,
  AERO_MKT_SCENARIOS,
  AERO_MKT_SERVICES,
  AERO_MKT_SOURCES,
  AERO_MKT_SUMMARY,
  AERO_MKT_WORKBOOKS,
  type AeroMktAgentSlug,
} from "@/lib/data/aero-marketing-catalog";

export const metadata: Metadata = {
  title:
    "Aéronautique / Marketing — 4 agents NEURAL : ITAR/EAR, salons, greenwashing | NEURAL",
  description:
    "Branche Aéronautique / Marketing : 4 agents portfolio, 5 workbooks Excel générés. Audit qualité contenus B2B technique, conformité ITAR/EAR/sanctions, packs salons 2026, anti-greenwashing SAF/H2/eVTOL.",
  openGraph: {
    title: "NEURAL — Aéronautique / Marketing",
    description:
      "AeroTechContent, DefenseCommsGuard, AeroEventAI, AeroSustainabilityComms. Workbooks Excel auditables et scenarios OK / WARN / KO.",
  },
};

const AGENT_ICON = {
  "aero-tech-content": Plane,
  "defense-comms-guard": ShieldAlert,
  "aero-event-ai": Sparkles,
  "aero-sustainability-comms": Leaf,
} as const satisfies Record<AeroMktAgentSlug, typeof Plane>;

const VERDICT_STYLES: Record<
  "OK" | "WARN" | "KO",
  { border: string; bg: string; text: string }
> = {
  OK: {
    border: "border-emerald-300/30",
    bg: "bg-emerald-300/10",
    text: "text-emerald-100",
  },
  WARN: {
    border: "border-amber-300/30",
    bg: "bg-amber-300/10",
    text: "text-amber-100",
  },
  KO: {
    border: "border-rose-300/30",
    bg: "bg-rose-300/10",
    text: "text-rose-100",
  },
};

export default function AeroMarketingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0e0824] text-white [&_*]:box-border">
      <section className="border-b border-white/[0.08] px-6 pb-14 pt-30 md:px-12 lg:pt-34">
        <div
          className="mx-auto max-w-[1320px]"
          style={{ width: "calc(100vw - 72px)" }}
        >
          <Link
            href="/secteurs/aeronautique"
            className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour Aéronautique
          </Link>

          <div className="mt-10 grid w-full min-w-0 gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-end">
            <div className="min-w-0 max-w-[320px] sm:max-w-none">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-100">
                  Démo Excel-first
                </span>
                <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-white/62">
                  veille {AERO_MKT_SUMMARY.sourceDate}
                </span>
              </div>
              <h1 className="mt-6 max-w-5xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl md:text-7xl">
                <span className="block md:inline">Aéronautique</span>{" "}
                <span className="block md:inline">
                  <span className="text-white/35">/</span> Marketing
                </span>
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/68">
                4 agents pour sécuriser la chaîne marketing aéro :
                auditer les contenus B2B techniques (white papers, RFP),
                garder les communications conformes ITAR/EAR/sanctions,
                générer les packs des 4 salons 2026 (Farnborough, ILA Berlin,
                Eurosatory, MEBAA), et bloquer le greenwashing SAF / H2 /
                eVTOL avant diffusion. Premier livrable : 5 Excel défendables.
              </p>
              <div className="mt-8 flex max-w-[320px] min-w-0 flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
                <a
                  href="#agents"
                  className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0e0824] transition-colors hover:bg-violet-50 sm:w-auto"
                >
                  Les 4 agents
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#workbooks"
                  className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-xl border border-white/[0.18] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] sm:w-auto"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {AERO_MKT_WORKBOOKS.length} workbooks générés
                </a>
              </div>
            </div>

            <div className="grid max-w-[320px] min-w-0 gap-3 rounded-[28px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/25 sm:max-w-none">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "agents", value: AERO_MKT_SUMMARY.agents },
                  { label: "workbooks", value: AERO_MKT_SUMMARY.workbooks },
                  { label: "règles encodées", value: AERO_MKT_SUMMARY.rules },
                  { label: "scénarios", value: AERO_MKT_SUMMARY.scenarios },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-[#160c30] p-4"
                  >
                    <p className="font-display text-4xl font-bold tracking-tight text-white">
                      {stat.value}
                    </p>
                    <p className="mt-1 break-words text-xs uppercase tracking-[0.16em] text-white/45">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4">
                <div className="flex items-center gap-2 text-amber-100">
                  <ShieldAlert className="h-4 w-4" />
                  <p className="text-sm font-semibold">Guardrail central</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-amber-100/70">
                  Aucune diffusion sans verdict défendable. L&apos;agent
                  oriente — la décision finale reste au compliance officer
                  export-control, au DirCom ou au signataire CSRD.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 grid max-w-[320px] gap-3 sm:max-w-none md:grid-cols-4">
            {[
              {
                label: "Sources réglementaires",
                value: AERO_MKT_SOURCES.length,
                Icon: Database,
              },
              {
                label: "Workbooks Excel",
                value: AERO_MKT_WORKBOOKS.length,
                Icon: FileSpreadsheet,
              },
              {
                label: "Scénarios démontrés",
                value: AERO_MKT_SCENARIOS.length,
                Icon: Layers,
              },
              {
                label: "Services transverses",
                value: AERO_MKT_SERVICES.length,
                Icon: Network,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
              >
                <item.Icon className="h-5 w-5 text-violet-200" />
                <p className="mt-4 font-display text-3xl font-bold text-white">
                  {item.value}
                </p>
                <p className="mt-1 text-sm text-white/55">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08] px-6 py-14 md:px-12">
        <div
          className="mx-auto max-w-[1320px]"
          style={{ width: "calc(100vw - 72px)" }}
        >
          <SectionHeader
            eyebrow="Cadrage métier"
            title="4 problèmes marketing aéro, 4 agents contrôlables."
            lead="Chaque agent traite un risque opérationnel concret : qualité contenus B2B, export-control, salons multi-fuseau, greenwashing aéro. Le périmètre est volontairement net."
          />
          <div className="mt-8 overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-[11px] uppercase tracking-[0.16em] text-white/48">
                <tr>
                  <th className="px-5 py-4 font-semibold">Problématique</th>
                  <th className="px-5 py-4 font-semibold">Solution NEURAL</th>
                  <th className="px-5 py-4 text-right font-semibold">Agent</th>
                </tr>
              </thead>
              <tbody>
                {AERO_MKT_PROBLEMS.map((row) => (
                  <tr
                    key={row.agent}
                    className="border-t border-white/[0.06] align-top"
                  >
                    <td className="px-5 py-5 font-semibold text-white/[0.88]">
                      {row.problem}
                    </td>
                    <td className="px-5 py-5 leading-relaxed text-white/62">
                      {row.solution}
                    </td>
                    <td className="px-5 py-5 text-right">
                      <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1 font-mono text-xs text-violet-100">
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

      <section
        id="agents"
        className="border-b border-white/[0.08] px-6 py-14 md:px-12"
      >
        <div
          className="mx-auto max-w-[1320px]"
          style={{ width: "calc(100vw - 72px)" }}
        >
          <SectionHeader
            eyebrow="Les 4 agents"
            title="Un workbook Excel par agent."
            lead="Chaque agent dispose d'un fichier Excel auditable de 7 onglets : README, référentiel, cas d'entrée, matrice verdicts, redlines, AI Act disclosure, limites. Disponible avant tout déploiement."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {AERO_MKT_AGENTS.map((agent) => {
              const Icon = AGENT_ICON[agent.slug];
              return (
                <article
                  key={agent.slug}
                  className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/10">
                      <Icon className="h-5 w-5 text-violet-200" />
                    </div>
                    <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-white/55">
                      {agent.id}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">
                    {agent.name}
                  </h3>
                  <p className="mt-2 min-h-[120px] text-sm leading-relaxed text-white/58">
                    {agent.mission}
                  </p>
                  <div className="mt-4 border-t border-white/[0.08] pt-4">
                    <p className="font-mono text-[11px] text-violet-200/80">
                      {agent.primaryRule}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {agent.kpis.map((kpi) => (
                        <span
                          key={kpi}
                          className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/55"
                        >
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
        <div
          className="mx-auto max-w-[1320px]"
          style={{ width: "calc(100vw - 72px)" }}
        >
          <SectionHeader
            eyebrow="Scénarios démontrés"
            title="4 cas concrets, 4 verdicts."
            lead="Un scénario par agent — input réel, verdict OK / WARN / KO, métriques avant/après. Issus directement des onglets « cas » des workbooks Excel."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {AERO_MKT_SCENARIOS.map((scenario) => {
              const verdictStyle = VERDICT_STYLES[scenario.verdict];
              return (
                <article
                  key={scenario.id}
                  className="rounded-[22px] border border-white/10 bg-white/[0.04] p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] text-white/[0.42]">
                        {scenario.id}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-white">
                        {scenario.label}
                      </h3>
                    </div>
                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em]",
                        verdictStyle.border,
                        verdictStyle.bg,
                        verdictStyle.text,
                      ].join(" ")}
                    >
                      {scenario.verdict}
                    </span>
                  </div>
                  <blockquote className="mt-4 rounded-xl border border-white/[0.08] bg-[#160c30] p-4 text-sm italic leading-relaxed text-white/65">
                    {scenario.inputLine}
                  </blockquote>
                  <p className="mt-4 text-sm leading-relaxed text-white/62">
                    {scenario.summary}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {scenario.metrics.map((m) => (
                      <div
                        key={m.label}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
                      >
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                          {m.label}
                        </p>
                        <p className="mt-1 font-mono text-xs text-white/55">
                          <span className="text-rose-200/80">{m.before}</span>
                          <span className="px-1 text-white/30">→</span>
                          <span className="text-emerald-200">{m.after}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08] px-6 py-14 md:px-12">
        <div
          className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[1fr_1fr]"
          style={{ width: "calc(100vw - 72px)" }}
        >
          <div>
            <SectionHeader
              eyebrow="Sourcebook"
              title={`${AERO_MKT_SOURCES.length} sources réglementaires actives.`}
              lead="Aucune sortie agent n'est validée sans mapping vers une de ces sources : ITAR, EAR, EU dual-use, FR Code défense, OFAC, EU sanctions, AI Act, Green Claims, ReFuelEU, CSRD, ASD, NIS2/DORA, EDIP."
            />
            <div className="mt-6 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035]">
              {AERO_MKT_SOURCES.map((source) => (
                <div
                  key={source.id}
                  className="grid gap-3 border-t border-white/[0.08] p-4 first:border-t-0 md:grid-cols-[150px_1fr]"
                >
                  <div>
                    <p className="font-mono text-[11px] text-white/[0.42]">
                      {source.id}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-violet-200/80">
                      {source.authority} · {source.domain}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {source.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/52">
                      {source.impact}
                    </p>
                    <p className="mt-2 text-[11px] text-white/35">
                      {source.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader
              eyebrow="Services transverses"
              title="Veille + traçabilité = défendabilité."
              lead="Deux services transverses encadrent les 4 agents : RegWatch alimente le référentiel des règles, EvidenceGuard conserve les preuves de chaque décision."
            />
            <div className="mt-6 grid gap-3">
              {AERO_MKT_SERVICES.map((service) => (
                <div
                  key={service.id}
                  className="rounded-2xl border border-white/10 bg-[#160c30] p-5"
                >
                  <p className="font-mono text-[11px] text-white/45">
                    {service.id}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {service.name}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {service.mission}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workbooks" className="px-6 py-14 md:px-12">
        <div
          className="mx-auto max-w-[1320px]"
          style={{ width: "calc(100vw - 72px)" }}
        >
          <div className="grid gap-8 rounded-[28px] border border-white/10 bg-white/[0.045] p-6 md:p-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200/80">
                Livrable actuel
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
                {AERO_MKT_WORKBOOKS.length} fichiers Excel prêts pour
                présentation.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/62">
                4 workbooks (un par agent) + 1 overview cross-agents (synthèse,
                pipeline, KPIs, roadmap, pricing). Chaque fichier suit le même
                gabarit visuel : 7 onglets, 0 erreur de formule, sources
                réglementaires explicites. Présentable à un compliance officer
                export-control, à un DirCom ou à un comité d&apos;investissement.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/contact?subject=Aero%20Marketing%20-%20pilote"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0e0824] transition-colors hover:bg-violet-50"
                >
                  Cadrer un pilote
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/secteurs/aeronautique"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.18] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
                >
                  <FileText className="h-4 w-4" />
                  Hub Aéronautique
                </Link>
              </div>
            </div>
            <div className="grid gap-2">
              {AERO_MKT_WORKBOOKS.map((workbook) => (
                <div
                  key={workbook}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#160c30] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-violet-200" />
                    <span className="truncate font-mono text-xs text-white/70">
                      {workbook}
                    </span>
                  </div>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
                </div>
              ))}
            </div>
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
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200/80">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-white/62 md:text-base">
        {lead}
      </p>
    </div>
  );
}
