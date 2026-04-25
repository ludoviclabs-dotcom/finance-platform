import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Landmark,
  Network,
  Scale,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { BankMarketingConsole } from "@/components/bank-marketing/BankMarketingConsole";
import {
  BANK_MKT_AGENTS,
  BANK_MKT_GATES,
  BANK_MKT_PROBLEMS,
  BANK_MKT_SERVICES,
  BANK_MKT_SOURCES,
  BANK_MKT_SUMMARY,
  BANK_MKT_WORKBOOKS,
  type BankMktAgentSlug,
} from "@/lib/data/bank-marketing-catalog";

export const metadata: Metadata = {
  title: "Banque / Marketing - AMF, ACPR, MiFID, MiCA et segmentation | NEURAL",
  description:
    "Branche Banque / Marketing : 4 agents portfolio, 2 services reserves, 10 gates deterministes et 6 workbooks Excel generes. Demo scenario-id only, donnees synthetiques et validation humaine.",
  openGraph: {
    title: "NEURAL - Banque / Marketing",
    description:
      "BankMarketingComplianceGuard, FinLiteracyContent, SegmentedBankMarketing, MiFIDProductMarketingGuard. Workbooks Excel et scenarios PASS / REVIEW / BLOCK.",
  },
};

const AGENT_ICON = {
  "bank-marketing-compliance-guard": ShieldCheck,
  "fin-literacy-content": BookOpen,
  "segmented-bank-marketing": UsersRound,
  "mifid-product-marketing-guard": Scale,
} as const satisfies Record<BankMktAgentSlug, typeof ShieldCheck>;

export default function BankMarketingPage() {
  const blockingGates = BANK_MKT_GATES.filter((gate) => gate.blocking).length;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07111c] text-white [&_*]:box-border">
      <section className="border-b border-white/[0.08] px-6 pb-14 pt-30 md:px-12 lg:pt-34">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <Link
            href="/secteurs/banque"
            className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Secteur Banque
          </Link>

          <div className="mt-10 grid w-full min-w-0 gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-end">
            <div className="min-w-0 max-w-[320px] sm:max-w-none">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                  Demo Excel-first
                </span>
                <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-white/62">
                  veille {BANK_MKT_SUMMARY.sourceDate}
                </span>
              </div>
              <h1 className="mt-6 max-w-5xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl md:text-7xl">
                <span className="block md:inline">Banque</span>{" "}
                <span className="block md:inline">
                  <span className="text-white/35">/</span> Marketing
                </span>
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/68">
                Une branche dediee aux campagnes bancaires : publicites AMF/ACPR,
                education financiere, segmentation CRM, MiFID/PRIIPs et MiCA. La
                demo reste volontairement scenario-id only pour eviter tout conseil
                personnalise ou hallucination.
              </p>
              <div className="mt-8 flex max-w-[320px] min-w-0 flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
                <a
                  href="#console"
                  className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#07111c] transition-colors hover:bg-cyan-50 sm:w-auto"
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
                  { label: "agents", value: BANK_MKT_SUMMARY.agents },
                  { label: "services reserves", value: BANK_MKT_SUMMARY.reservedServices },
                  { label: "gates MVP", value: BANK_MKT_SUMMARY.gates },
                  { label: "scenarios", value: BANK_MKT_SUMMARY.scenarios },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#0d1c2b] p-4">
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
                  Aucun contenu ne devient conseil financier personnalise. Les
                  gates du workbook priment, et la validation humaine reste obligatoire.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 grid max-w-[320px] gap-3 sm:max-w-none md:grid-cols-4">
            {[
              { label: "Gates bloquantes", value: blockingGates, Icon: ShieldCheck },
              { label: "Sources reglementaires", value: BANK_MKT_SOURCES.length, Icon: Database },
              { label: "Workbooks", value: BANK_MKT_WORKBOOKS.length, Icon: FileSpreadsheet },
              { label: "Services transverses", value: BANK_MKT_SERVICES.length, Icon: Network },
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
            title="4 problemes marketing bancaires, 4 agents controlables."
            lead="La branche separe clairement communication corporate et marketing client. Elle garde les contraintes AMF/ACPR, RGPD, AI Act, MiFID, PRIIPs et MiCA visibles des le workbook."
          />
          <div className="mt-8 overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-[11px] uppercase tracking-[0.16em] text-white/48">
                <tr>
                  <th className="px-5 py-4 font-semibold">Problematique</th>
                  <th className="px-5 py-4 font-semibold">Solution NEURAL</th>
                  <th className="px-5 py-4 text-right font-semibold">Agent</th>
                </tr>
              </thead>
              <tbody>
                {BANK_MKT_PROBLEMS.map((row) => (
                  <tr key={row.agent} className="border-t border-white/[0.06] align-top">
                    <td className="px-5 py-5 font-semibold text-white/[0.88]">{row.problem}</td>
                    <td className="px-5 py-5 leading-relaxed text-white/62">{row.solution}</td>
                    <td className="px-5 py-5 text-right">
                      <span className="whitespace-nowrap rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 font-mono text-xs text-cyan-100">
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
            title="Une console scenario-id, pas un generateur libre."
            lead="Chaque scenario vient du pack Excel audite. Le verdict est previsible, explicable et defendable : l'interface montre le produit sans inventer de conseil financier."
          />
          <div className="mt-8">
            <BankMarketingConsole />
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08] px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1320px]" style={{ width: "calc(100vw - 72px)" }}>
          <SectionHeader
            eyebrow="Agents"
            title="Un workbook, une responsabilite, un owner."
            lead="Les quatre agents sont des surfaces portfolio : donnees synthetiques, gates explicites et revue humaine. Les services AG-BM005 et AG-BM006 restent reserves."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {BANK_MKT_AGENTS.map((agent) => {
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
                  <p className="mt-2 min-h-[120px] text-sm leading-relaxed text-white/58">{agent.mission}</p>
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
              title="La couche anti-hallucination avant toute sortie."
              lead="La page expose les memes gates que les workbooks : si une source, un chiffre, un consentement ou un target market manque, le verdict bloque."
            />
            <div className="mt-6 space-y-2">
              {BANK_MKT_GATES.map((gate) => (
                <div key={gate.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="break-words font-mono text-[11px] text-white/[0.42]">{gate.id}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{gate.label}</p>
                    </div>
                    <span className="rounded-full border border-rose-300/30 bg-rose-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-100">
                      block
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white/45">
                    {gate.source} / {gate.owner}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader
              eyebrow="Sourcebook"
              title="Veille informationnelle integree au design."
              lead="Les sources restent visibles et datees pour rendre le produit defendable. Elles cadrent une demo, pas un avis juridique."
            />
            <div className="mt-6 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035]">
              {BANK_MKT_SOURCES.map((source) => (
                <div key={source.id} className="grid gap-3 border-t border-white/[0.08] p-4 first:border-t-0 md:grid-cols-[150px_1fr]">
                  <div>
                    <p className="font-mono text-[11px] text-white/[0.42]">{source.id}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100/75">
                      {source.authority} / {source.domain}
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
                l'increment web : elle expose le narratif, les gates et une surface
                interactive sans pretendre a une integration production.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {BANK_MKT_SERVICES.map((service) => (
                  <div key={service.id} className="rounded-2xl border border-white/10 bg-[#0d1c2b] p-4">
                    <p className="font-mono text-[11px] text-white/45">{service.id}</p>
                    <p className="mt-1 font-semibold text-white">{service.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/50">{service.mission}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              {BANK_MKT_WORKBOOKS.map((workbook) => (
                <div key={workbook} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d1c2b] px-4 py-3">
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
              href="/contact?subject=Banque%20Marketing"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#07111c] transition-colors hover:bg-cyan-50"
            >
              Presenter ce chantier
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/secteurs/banque/communication"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.18] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              <Landmark className="h-4 w-4" />
              Branche Communication
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
