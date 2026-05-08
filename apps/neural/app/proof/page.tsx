import Link from "next/link";
import { ArrowRight, Database, FileSpreadsheet, Layers3, ShieldCheck } from "lucide-react";

import {
  PROOF_SCORE_LABELS,
  PROOF_STATUS_LABELS,
  getProofCatalog,
  type AgentProofStatus,
} from "@/lib/proof-catalog";

export const metadata = {
  title: "Proof Console — NEURAL",
  description:
    "Etat réel du catalogue NEURAL : workbooks Excel, agents avec données, runtime public, démos et limites connues.",
};

const STATUS_CLASSES: Record<AgentProofStatus, string> = {
  excel_created: "border-slate-400/25 bg-slate-400/[0.08] text-slate-200",
  runtime_parsed: "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200",
  public_demo: "border-violet-400/25 bg-violet-400/[0.10] text-violet-200",
  client_ready: "border-emerald-400/25 bg-emerald-400/[0.10] text-emerald-200",
};

export default function ProofPage() {
  const catalog = getProofCatalog();
  const metricCards = [
    {
      label: "Agents avec données Excel",
      value: catalog.counts.liveAgentsWithExcel,
      detail: "Source: agents-registry",
      icon: Layers3,
    },
    {
      label: "Workbooks runtime",
      value: catalog.counts.runtimeWorkbooks,
      detail: "Embarqués dans apps/neural/data",
      icon: Database,
    },
    {
      label: "Workbooks NEURAL audités",
      value: catalog.counts.desktopNeuralWorkbooks,
      detail: "Desktop, hors Carbon and Co",
      icon: FileSpreadsheet,
    },
    {
      label: "Cellules alimentées",
      value: `${catalog.counts.liveCells}/${catalog.counts.frameworkCells}`,
      detail: "Secteur x branche",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-5 pb-12 pt-28 sm:px-8 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px] min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Proof Console
          </span>
          <h1 className="mt-6 max-w-5xl break-words font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Ce que NEURAL peut prouver maintenant
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Cette console distingue les actifs Excel, les données parsées, les démos publiques et
            les briques vendables. Les 168 agents restent une capacité cible, pas le périmètre live.
          </p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/35">
            Derniere verification : {catalog.lastVerifiedAt}
          </p>

          <div className="mt-10 grid min-w-0 gap-4 md:grid-cols-4">
            {metricCards.map((card) => (
              <div key={card.label} className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
                  <card.icon className="h-5 w-5 text-violet-200" />
                </div>
                <p className="mt-5 font-display text-4xl font-bold tracking-tight">{card.value}</p>
                <p className="mt-2 break-words text-sm font-semibold text-white">{card.label}</p>
                <p className="mt-1 break-words text-xs leading-relaxed text-white/45">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-[1320px] min-w-0">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                Maturité
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                4 statuts, 5 scores
              </h2>
            </div>
            <Link href="/api/proof-catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
              API JSON <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid min-w-0 gap-4 md:grid-cols-5">
            {catalog.maturityLevels.map((level) => (
              <div key={`${level.score}-${level.label}`} className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
                <p className="font-display text-4xl font-bold text-violet-200">{level.score}</p>
                <p className="mt-3 text-sm font-semibold text-white">{level.label}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/35">
                  {PROOF_STATUS_LABELS[level.status]}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-white/55">{level.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-[1320px] min-w-0">
          <div>
            <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Model cards
            </span>
            <h2 className="mt-3 max-w-3xl break-words font-display text-3xl font-bold tracking-tight">
              5 agents flagship documentés comme preuves produit
            </h2>
          </div>
          <div className="mt-8 grid min-w-0 gap-4 lg:grid-cols-2">
            {catalog.priorityModelCards.map((card) => (
              <Link
                key={card.id}
                href={card.href}
                className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-display text-xl font-bold text-white">
                      {card.name}
                    </p>
                    <p className="mt-1 break-words text-xs text-white/45">
                      Source: {card.workbookSource}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border border-violet-400/25 bg-violet-400/[0.10] px-3 py-1 text-xs font-bold text-violet-200">
                      Score {card.proofScore}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[card.proofStatus]}`}>
                      {PROOF_STATUS_LABELS[card.proofStatus]}
                    </span>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ModelCardField label="Input exemple" value={card.exampleInput} />
                  <ModelCardField label="Output exemple" value={card.exampleOutput} />
                  <ModelCardField label="Supervision" value={card.humanSupervision} />
                  <ModelCardField label="Export" value={card.exportAvailable} />
                </div>
                <p className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-xs leading-relaxed text-amber-100/80">
                  Limite: {card.limitation}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-[1320px] min-w-0">
          <div>
            <span className="inline-flex items-center rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              Agents publics
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
              Fiches agents classees par niveau de preuve
            </h2>
          </div>
          <div className="mt-8 min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03]">
            <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_1.4fr] gap-4 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35 max-lg:hidden">
              <span>Agent</span>
              <span>Score</span>
              <span>Statut</span>
              <span>Source / limite</span>
            </div>
            {catalog.agentProofs.map((agent) => (
              <Link
                key={agent.id}
                href={agent.href}
                className="grid min-w-0 gap-4 border-b border-white/8 px-5 py-4 transition-colors hover:bg-white/[0.04] lg:grid-cols-[1.3fr_0.8fr_0.8fr_1.4fr]"
              >
                <div className="min-w-0">
                  <p className="break-words font-display text-base font-bold text-white">{agent.name}</p>
                  <p className="mt-1 break-all text-xs text-white/40">{agent.publicPage}</p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-violet-200">
                    {agent.proofScore}
                  </p>
                  <p className="text-xs text-white/45">{PROOF_SCORE_LABELS[agent.proofScore]}</p>
                </div>
                <div className="min-w-0">
                  <span className={`inline-flex max-w-full rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[agent.proofStatus]}`}>
                    {PROOF_STATUS_LABELS[agent.proofStatus]}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 break-words text-xs leading-relaxed text-white/58">{agent.workbookSource}</p>
                  <p className="mt-1 break-words text-xs text-white/35">
                    {agent.proofLimitations[0] ?? "Limites documentées dans la fiche."}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-auto grid max-w-[1320px] min-w-0 gap-6 lg:grid-cols-2">
          <WorkbookPanel
            title="Workbooks runtime"
            subtitle="Ce qui est embarqué dans le repo et peut alimenter le site."
            groups={catalog.workbookGroups.runtimeRepo}
          />
          <WorkbookPanel
            title="Workbooks Desktop audités"
            subtitle="Actifs NEURAL existants hors Carbon and Co, a rapatrier ou parser."
            groups={catalog.workbookGroups.desktopExternal}
          />
        </div>
      </section>
    </div>
  );
}

function ModelCardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>
      <p className="mt-2 break-words text-xs leading-relaxed text-white/62">{value}</p>
    </div>
  );
}

function WorkbookPanel({
  title,
  subtitle,
  groups,
}: {
  title: string;
  subtitle: string;
  groups: ReturnType<typeof getProofCatalog>["workbookGroups"]["runtimeRepo"];
}) {
  return (
    <div className="min-w-0 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/58">{subtitle}</p>
      <div className="mt-6 space-y-3">
        {groups.map((group) => (
          <div key={group.id} className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-semibold text-white">{group.label}</p>
                <p className="mt-1 break-words text-xs text-white/45">{group.note}</p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="font-display text-2xl font-bold text-violet-200">{group.count}</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">xlsx</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
