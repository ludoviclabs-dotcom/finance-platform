"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  GitBranch,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";

type AgentProofStatus =
  | "excel_created"
  | "runtime_parsed"
  | "public_demo"
  | "export_audit"
  | "client_ready";

type SimulationScenario = {
  id: string;
  sector: string;
  branch: string;
  title: string;
  summary: string;
  agentIds: string[];
  proofStatus: AgentProofStatus;
  steps: string[];
  gates: string[];
  evidence: string[];
  limitations: string[];
  ctaHref: string;
  ctaLabel: string;
};

type SimulationCounts = {
  liveAgentsWithExcel: number;
  runtimeWorkbooks: number;
  liveCells: number;
  frameworkCells: number;
  frameworkTargetAgents: number;
  clientReady: number;
};

const STATUS_LABELS: Record<AgentProofStatus, string> = {
  excel_created: "Excel créé",
  runtime_parsed: "Runtime parsé",
  public_demo: "Démo publique",
  export_audit: "Export / audit",
  client_ready: "Produit prêt client",
};

const STATUS_CLASSES: Record<AgentProofStatus, string> = {
  excel_created: "border-slate-400/25 bg-slate-400/[0.08] text-slate-200",
  runtime_parsed: "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200",
  public_demo: "border-violet-400/25 bg-violet-400/[0.10] text-violet-200",
  export_audit: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
  client_ready: "border-emerald-400/25 bg-emerald-400/[0.10] text-emerald-200",
};

const SCENARIOS: SimulationScenario[] = [
  {
    id: "luxe-communication",
    sector: "Luxe",
    branch: "Communication",
    title: "Luxe Communication",
    summary:
      "Simuler un brief maison avec contrôle brand voice, claims RSE, héritage et angle presse avant validation humaine.",
    agentIds: [
      "maison-voice-guard",
      "green-claim-checker",
      "heritage-comms",
      "luxe-press-agent",
    ],
    proofStatus: "public_demo",
    steps: [
      "Brief campagne, communiqué ou prise de parole sensible",
      "Contrôle tonalité maison et cohérence éditoriale",
      "Vérification green claim, héritage et références",
      "Sortie proposée avec limites et supervision humaine",
    ],
    gates: [
      "Brand voice hard-fails",
      "Green claim checker",
      "Sources patrimoniales",
      "Relecture humaine avant diffusion",
    ],
    evidence: [
      "Agents Luxe Communication exposés publiquement dans le catalogue",
      "Démos sandbox disponibles sans login pour les agents phares",
      "Workbooks runtime et model cards rattachés à la Proof Console",
      "Limites affichées agent par agent avant tout pilot",
    ],
    limitations: [
      "Aucune connexion DAM, PIM, CMS ou outil RP client en v1",
      "Pas de tenant client isolé pour cette simulation publique",
      "Pas d'autopublication ni de validation juridique automatisée",
      "Le ROI reste une méthode d'estimation, pas une garantie",
    ],
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir Luxe Communication",
  },
  {
    id: "banque-communication",
    sector: "Banque",
    branch: "Communication",
    title: "Banque Communication",
    summary:
      "Qualifier une communication régulée, une réponse de crise, une notice client ou un message ESG avec preuves d'audit.",
    agentIds: [
      "reg-bank-comms",
      "bank-crisis-comms",
      "esg-bank-comms",
      "client-bank-comms",
      "bank-evidence-guard",
    ],
    proofStatus: "export_audit",
    steps: [
      "Sélection d'un scénario de communication bancaire",
      "Passage dans les gates réglementaires et éditoriaux",
      "Résolution evidence avec justification exploitable",
      "Export Markdown ou JSON quand la page agent le permet",
    ],
    gates: [
      "MAR, MiFID, SFDR selon le scénario",
      "Escalade crise si seuil rouge",
      "Evidence guard pour audit",
      "Validation humaine obligatoire",
    ],
    evidence: [
      "Pages agents Banque Communication branchées sur /api/demo/*",
      "Exports disponibles sur plusieurs agents communication bancaire",
      "Dashboard et inbox banque déjà présents dans le site",
      "BankEvidenceGuard documente les preuves et les limites",
    ],
    limitations: [
      "Pas de connexion SI bancaire réelle ni workflow conformité client",
      "Pas de validation ACPR ou juridique externe intégrée",
      "Les scénarios publics restent des données de démonstration",
      "Le mode production exige SSO, logs, DPA et gouvernance client",
    ],
    ctaHref: "/secteurs/banque/communication",
    ctaLabel: "Voir Banque Communication",
  },
  {
    id: "assurance-supply-chain",
    sector: "Assurance",
    branch: "Supply Chain",
    title: "Assurance Supply Chain",
    summary:
      "Suivre un cas réparateur, expert, fraude fournisseur ou Sapin II dans un parcours métier explicable.",
    agentIds: [
      "repairer-risk-router",
      "expert-evidence-check",
      "supplier-fraud-guard",
      "sapin-ii-supply-check",
    ],
    proofStatus: "runtime_parsed",
    steps: [
      "Signal dossier sinistre, fournisseur ou réparateur",
      "Qualification du risque opérationnel et conformité",
      "Priorisation des alertes et blocages à traiter",
      "Préparation d'un pilot avec données client contrôlées",
    ],
    gates: [
      "Risque fournisseur",
      "Fraude ou anomalie dossier",
      "Sapin II et conflit d'intérêts",
      "Human-in-the-loop avant action",
    ],
    evidence: [
      "Page Assurance Supply Chain publique avec statut explicite",
      "Cellule couverte dans le catalogue de preuves",
      "Workbook runtime disponible côté NEURAL",
      "Limites et prochain niveau de preuve affichables",
    ],
    limitations: [
      "Parcours moins démontré que Luxe et Banque aujourd'hui",
      "Pas de connexion gestion sinistres, ERP ou référentiel fournisseurs",
      "Pas encore d'export audit au même niveau que Banque Communication",
      "Aucun agent client-ready tant que les critères stricts ne sont pas remplis",
    ],
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Voir Assurance Supply Chain",
  },
];

export function SimulationStudio({ counts }: { counts: SimulationCounts }) {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const activeScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === activeId) ?? SCENARIOS[0],
    [activeId],
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-3 lg:grid-cols-3">
        {SCENARIOS.map((scenario) => {
          const isActive = scenario.id === activeScenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setActiveId(scenario.id)}
              className={`rounded-[22px] border p-5 text-left transition-all ${
                isActive
                  ? "border-violet-300/45 bg-violet-400/[0.14] shadow-2xl shadow-violet-950/25"
                  : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                <SlidersHorizontal className="h-3 w-3" />
                {scenario.sector} / {scenario.branch}
              </span>
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-white">
                {scenario.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{scenario.summary}</p>
              <span
                className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                  STATUS_CLASSES[scenario.proofStatus]
                }`}
              >
                {STATUS_LABELS[scenario.proofStatus]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <PlayCircle className="h-3.5 w-3.5" />
              Parcours simulé
            </span>
            <h2 className="mt-4 break-words font-display text-3xl font-bold tracking-tight md:text-4xl">
              {activeScenario.title}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/64">
              {activeScenario.summary}
            </p>
          </div>
          <Link
            href={activeScenario.ctaHref}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
          >
            {activeScenario.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="min-w-0 rounded-[24px] border border-white/10 bg-black/10 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <GitBranch className="h-4 w-4 text-violet-200" />
              Flux métier
            </div>
            <div className="mt-5 grid gap-3">
              {activeScenario.steps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-400/[0.14] text-xs font-bold text-violet-100">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-white/68">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0 rounded-[24px] border border-white/10 bg-black/10 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
              Gates simulés
            </div>
            <div className="mt-5 grid gap-3">
              {activeScenario.gates.map((gate) => (
                <div key={gate} className="flex items-start gap-3 rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.05] p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                  <p className="text-sm leading-relaxed text-emerald-50/72">{gate}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <EvidencePanel title="Ce que cette simulation prouve" items={activeScenario.evidence} />
          <LimitPanel title="Ce que cette simulation ne prouve pas" items={activeScenario.limitations} />
        </div>

        <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Agents associés
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeScenario.agentIds.map((agentId) => (
                  <span
                    key={agentId}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/68"
                  >
                    {agentId}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-2 text-left text-xs text-white/55 sm:grid-cols-3 lg:min-w-[420px]">
              <CompactMetric label="Agents Excel" value={counts.liveAgentsWithExcel} />
              <CompactMetric label="Workbooks runtime" value={counts.runtimeWorkbooks} />
              <CompactMetric label="Client-ready" value={counts.clientReady} />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[22px] border border-amber-300/18 bg-amber-300/[0.06] p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-100" />
            <p className="text-sm leading-relaxed text-amber-50/78">
              Le nombre {counts.frameworkTargetAgents} désigne la capacité cible du framework.
              Le périmètre public actuel reste {counts.liveAgentsWithExcel} agents avec données
              Excel, {counts.runtimeWorkbooks} workbooks runtime, {counts.liveCells}/
              {counts.frameworkCells} cellules alimentées et {counts.clientReady} agent
              client-ready selon les critères stricts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidencePanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="min-w-0 rounded-[24px] border border-cyan-300/14 bg-cyan-300/[0.05] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-cyan-50">
        <FileText className="h-4 w-4 text-cyan-200" />
        {title}
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <p key={item} className="rounded-2xl border border-cyan-300/12 bg-black/10 p-3 text-sm leading-relaxed text-cyan-50/72">
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}

function LimitPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="min-w-0 rounded-[24px] border border-amber-300/14 bg-amber-300/[0.05] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-50">
        <LockKeyhole className="h-4 w-4 text-amber-100" />
        {title}
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <p key={item} className="rounded-2xl border border-amber-300/12 bg-black/10 p-3 text-sm leading-relaxed text-amber-50/72">
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}

function CompactMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
      <p className="font-display text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
        {label}
      </p>
    </div>
  );
}
