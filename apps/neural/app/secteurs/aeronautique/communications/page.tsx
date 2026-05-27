import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Database,
  Layers,
  Leaf,
  Megaphone,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { StatusBadge } from "@/components/site/status-badge";
import {
  AERO_COMMS_AGENTS,
  AERO_COMMS_PROBLEMS,
  AERO_COMMS_SCENARIOS,
  AERO_COMMS_SOURCES,
  AERO_COMMS_SUMMARY,
  type AeroCommsAgentSlug,
} from "@/lib/data/aero-comms-catalog";

export const metadata: Metadata = {
  title:
    "Aéronautique / Communications & Affaires publiques — corporate, gov relations, ESG | NEURAL",
  description:
    "Branche Aéronautique / Communications corporate : 4 agents — AeroDefenseCommsGuard, ProgramCommsAero, GovRelationsAero, GreenAeroComms. 22 règles, 10 sources réglementaires (ITAR/EAR, Registre Transparence UE, HATVP, ASD Charter, CSRD ESRS E1, SBTi).",
  openGraph: {
    title: "NEURAL — Aéronautique / Communications & Affaires publiques",
    description:
      "Corporate defense, communications programme, gov relations, ESG corporate. Auditabilité Sapin II + Transparence UE + AI Act art. 50.",
  },
};

const AGENT_ICON = {
  "aero-defense-comms-guard": ShieldAlert,
  "program-comms-aero": Megaphone,
  "gov-relations-aero": Briefcase,
  "green-aero-comms": Leaf,
} as const satisfies Record<AeroCommsAgentSlug, typeof Briefcase>;

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

export default function AeroCommsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0a1f24] text-white">
      <section className="border-b border-white/[0.08] px-6 pb-14 pt-30 md:px-12 lg:pt-34">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <Link
            href="/secteurs/aeronautique"
            className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour Aéronautique
          </Link>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status="demo" proofLevel="ui_demo" />
                <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-white/62">
                  veille {AERO_COMMS_SUMMARY.veilleDate}
                </span>
              </div>

              <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
                Aéronautique <span className="text-white/35">/</span>{" "}
                <span className="block md:inline">Communications</span>{" "}
                <span className="block text-cyan-200 md:inline">& Affaires publiques</span>
              </h1>

              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/68">
                Comms corporate aéro/défense, communications programme, relations
                institutionnelles, ESG corporate. {AERO_COMMS_SUMMARY.agents} agents
                pour sécuriser la chaîne corporate : ITAR/EAR sur les annonces dirigeants,
                cohérence comms programme ↔ IFRS, conformité Registre Transparence UE +
                HATVP, anti-greenwashing au niveau rapport intégré + SBTi.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#agents"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0a1f24] transition-colors hover:bg-cyan-50"
                >
                  Les 4 agents
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#sources"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.18] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
                >
                  <Database className="h-4 w-4" />
                  {AERO_COMMS_SOURCES.length} sources réglementaires
                </a>
              </div>
            </div>

            <div className="grid gap-3 rounded-[28px] border border-cyan-300/15 bg-white/[0.045] p-4 shadow-2xl shadow-black/25">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "agents", value: AERO_COMMS_SUMMARY.agents },
                  { label: "sources", value: AERO_COMMS_SUMMARY.sources },
                  { label: "règles encodées", value: AERO_COMMS_SUMMARY.rules },
                  { label: "scénarios", value: AERO_COMMS_SUMMARY.scenarios },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-cyan-300/15 bg-[#06141b] p-4"
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
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] p-4">
                <div className="flex items-center gap-2 text-cyan-100">
                  <Sparkles className="h-4 w-4" />
                  <p className="text-sm font-semibold">Statut démo UI</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-cyan-100/70">
                  Catalogue éditorial publié — pipeline runtime (xlsx → JSON →
                  API démo) à venir Q3 2026, sur le modèle de la branche Marketing
                  aéro (statut Live).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08] px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <SectionHeader
            eyebrow="Cadrage métier"
            title="4 problèmes corporate aéro, 4 agents."
            lead="Chaque agent traite un risque corporate concret : capacités techniques exposées, dérapage comms vs IFRS, lobbying non déclaré, greenwashing investisseur. Périmètre volontairement distinct du marketing produit (branche Marketing aéro)."
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
                {AERO_COMMS_PROBLEMS.map((row) => (
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

      <section
        id="agents"
        className="border-b border-white/[0.08] px-6 py-14 md:px-12"
      >
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <SectionHeader
            eyebrow="Les 4 agents corporate"
            title="Audit avant publication corporate."
            lead="Chaque agent vérifie une catégorie de communication corporate avant sa diffusion publique ou institutionnelle. Documentation TS du catalogue exposé ici — workbooks Excel et démo runtime à venir Q3 2026."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {AERO_COMMS_AGENTS.map((agent) => {
              const Icon = AGENT_ICON[agent.slug];
              return (
                <article
                  key={agent.slug}
                  className="rounded-[22px] border border-cyan-300/15 bg-white/[0.04] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
                      <Icon className="h-5 w-5 text-cyan-200" />
                    </div>
                    <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-white/55">
                      {agent.id}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">
                    {agent.name}
                  </h3>
                  <p className="mt-2 min-h-[140px] text-sm leading-relaxed text-white/58">
                    {agent.mission}
                  </p>
                  <div className="mt-4 border-t border-white/[0.08] pt-4">
                    <p className="font-mono text-[11px] text-cyan-200/80">
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
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <SectionHeader
            eyebrow="Scénarios démontrés"
            title="4 cas concrets, 4 verdicts."
            lead="Brief CEO AUKUS, dérapage calendrier programme, consultation EASA, présentation investisseur Net Zero — entrées synthétiques mais réalistes, verdicts OK / WARN / KO documentés dans le catalogue TS."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {AERO_COMMS_SCENARIOS.map((scenario) => {
              const verdictStyle = VERDICT_STYLES[scenario.verdict];
              return (
                <article
                  key={scenario.id}
                  className="rounded-[22px] border border-cyan-300/15 bg-white/[0.04] p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] text-white/[0.42]">{scenario.id}</p>
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
                  <blockquote className="mt-4 rounded-xl border border-white/[0.08] bg-[#06141b] p-4 text-sm italic leading-relaxed text-white/65">
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

      <section id="sources" className="border-b border-white/[0.08] px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <SectionHeader
            eyebrow="Sourcebook"
            title={`${AERO_COMMS_SOURCES.length} sources réglementaires corporate.`}
            lead="Aucune sortie agent corporate n'est validée sans mapping vers une de ces sources : ITAR programmes, Registre Transparence UE, HATVP France, ASD Charter, AI Act art. 50, CSRD ESRS E1, Green Claims Directive (corporate scope), SBTi Aviation."
          />
          <div className="mt-6 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035]">
            {AERO_COMMS_SOURCES.map((source) => (
              <div
                key={source.id}
                className="grid gap-3 border-t border-white/[0.08] p-4 first:border-t-0 md:grid-cols-[150px_1fr]"
              >
                <div>
                  <p className="font-mono text-[11px] text-white/[0.42]">{source.id}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200/80">
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
      </section>

      <section className="px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <div className="grid gap-8 rounded-[28px] border border-cyan-300/15 bg-white/[0.045] p-6 md:p-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">
                Roadmap branche
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
                Prochain jalon : pipeline runtime corporate.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/62">
                La branche Communications corporate sortira de UI démo dès la mise en
                place du pipeline workbook → JSON → API démo (modèle Marketing aéro,
                déjà Live), couplée à un Live Scorer corporate scénario-id only.
                Sprint cible : Q3 2026.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/contact?subject=Aero%20Comms%20-%20pilote%20corporate"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0a1f24] transition-colors hover:bg-cyan-50"
                >
                  Cadrer un pilote corporate
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/secteurs/aeronautique/marketing"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.18] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
                >
                  <Layers className="h-4 w-4" />
                  Voir Marketing aéro (Live)
                </Link>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">
                Limites volontaires (à ce stade)
              </p>
              <ul className="mt-5 space-y-3">
                {[
                  "Pas de workbook .xlsx synchronisé (vs Marketing aéro : 5 workbooks runtime)",
                  "Pas d'API démo scénario-id only (vs /api/demo/aero-export-check)",
                  "Pas de RegWatch corporate-specific (HATVP digest, etc.)",
                  "Pas d'export pack signé SHA-256 par décision",
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-[#06141b] p-3 text-sm leading-relaxed text-white/65"
                  >
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300/60" />
                    {line}
                  </li>
                ))}
              </ul>
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
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-white/62 md:text-base">{lead}</p>
    </div>
  );
}
