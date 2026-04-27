/**
 * AgentCard — card individuelle d'un agent dans le catalogue /agents.
 * Premium polish : hover lift, badges status + risk + branch, lien direct.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { PublicEntry } from "@/lib/public-catalog";

const STATUS_CLASSES: Record<string, string> = {
  live: "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300",
  demo: "border-violet-400/30 bg-violet-400/[0.10] text-violet-200",
  planned: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
};

const RISK_CLASSES: Record<string, string> = {
  interdit: "border-red-500/30 bg-red-500/[0.10] text-red-300",
  "haut-risque": "border-orange-500/30 bg-orange-500/[0.10] text-orange-300",
  limite: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
  minimal: "border-emerald-400/25 bg-emerald-400/[0.10] text-emerald-300",
};

const BRANCH_LABELS: Record<string, string> = {
  finance: "Finance",
  rh: "RH",
  marketing: "Marketing",
  communication: "Communication",
  comptabilite: "Comptabilité",
  "supply-chain": "Supply Chain",
  si: "SI",
};

const STATUS_LABELS: Record<string, string> = {
  live: "Live",
  demo: "Demo",
  planned: "Planifié",
};

const RISK_LABELS: Record<string, string> = {
  interdit: "Interdit",
  "haut-risque": "Haut-risque",
  limite: "Limité",
  minimal: "Minimal",
};

export interface AgentMeta {
  branch: string;
  sectors: string[];
  aiActRisk: "interdit" | "haut-risque" | "limite" | "minimal";
  deployTime: string;
  roiEstimate: string;
}

export interface EnrichedAgent extends PublicEntry {
  meta: AgentMeta;
}

export function AgentCard({ agent }: { agent: EnrichedAgent }) {
  const statusCls = STATUS_CLASSES[agent.status];
  const riskCls = RISK_CLASSES[agent.meta.aiActRisk];

  return (
    <Link
      href={agent.href}
      className="group relative flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06] hover:shadow-2xl hover:shadow-black/30 no-underline"
    >
      {/* Status + Risk row */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusCls}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {STATUS_LABELS[agent.status]}
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${riskCls}`}
          title={`Classification AI Act : ${RISK_LABELS[agent.meta.aiActRisk]}`}
        >
          {RISK_LABELS[agent.meta.aiActRisk]}
        </span>
      </div>

      {/* Title */}
      <div>
        <h3 className="font-display text-lg font-bold leading-snug tracking-tight text-white">
          {agent.label}
        </h3>
        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-violet-200/80">
          {BRANCH_LABELS[agent.meta.branch] || agent.meta.branch}
          {agent.meta.sectors.length > 0
            ? ` · ${agent.meta.sectors.length} secteur${
                agent.meta.sectors.length > 1 ? "s" : ""
              }`
            : ""}
        </p>
      </div>

      {/* Tagline */}
      <p className="text-sm leading-relaxed text-white/65 line-clamp-3">{agent.tagline}</p>

      {/* Meta footer */}
      <div className="mt-auto space-y-2 border-t border-white/8 pt-3">
        <div className="flex items-baseline justify-between gap-2 text-[11px] uppercase tracking-[0.16em]">
          <span className="text-white/40">Déploiement</span>
          <span className="text-white/70">{agent.meta.deployTime}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-[11px] uppercase tracking-[0.16em]">
          <span className="text-white/40">Impact typique</span>
          <span className="text-emerald-300/90 text-right">{agent.meta.roiEstimate}</span>
        </div>
      </div>

      {/* Hover indicator */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-200 opacity-70 group-hover:opacity-100">
        <span>Voir l&apos;agent</span>
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
