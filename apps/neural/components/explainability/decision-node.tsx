"use client";

/**
 * NEURAL — DecisionNode (Sprint 4)
 *
 * Custom React Flow node for a single AgentDecision step.
 * Renders: kind badge, duration, truncated input/output, sources list.
 *
 * Source icons (Lucide React):
 *   excel      → FileSpreadsheet
 *   bofip      → Landmark
 *   ifrs       → BookMarked
 *   url        → Globe
 *   regulation → Scale
 */

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import {
  FileSpreadsheet,
  Landmark,
  BookMarked,
  Globe,
  Scale,
  Clock,
} from "lucide-react";

import { DECISION_KIND_META, type Source, type SourceKind } from "@/lib/trace/types";
import type { DecisionNodeData } from "@/lib/trace/to-flow";

// ── Source icon ───────────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<SourceKind, React.ElementType> = {
  excel:      FileSpreadsheet,
  bofip:      Landmark,
  ifrs:       BookMarked,
  url:        Globe,
  regulation: Scale,
};

function SourceTag({ source }: { source: Source }) {
  const Icon = SOURCE_ICONS[source.kind];
  return (
    <span
      title={source.label}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 max-w-[160px] truncate"
    >
      <Icon className="shrink-0 h-2.5 w-2.5" />
      {source.ref}
    </span>
  );
}

// ── JSON summary ──────────────────────────────────────────────────────────────

function JsonSummary({ data, maxChars = 120 }: { data: Record<string, unknown>; maxChars?: number }) {
  const str = JSON.stringify(data, null, 0);
  const truncated = str.length > maxChars ? str.slice(0, maxChars) + "…" : str;
  return (
    <pre className="text-[10px] font-mono text-slate-500 whitespace-pre-wrap break-all leading-tight">
      {truncated}
    </pre>
  );
}

// ── Duration badge ────────────────────────────────────────────────────────────

function DurationBadge({ ms }: { ms: number }) {
  const label = ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
      <Clock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

// ── Main node ─────────────────────────────────────────────────────────────────

function DecisionNodeInner({ data }: NodeProps<DecisionNodeData>) {
  const meta = DECISION_KIND_META[data.kind];

  return (
    <>
      {/* Left handle — hidden on first node */}
      {!data.isFirst && (
        <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2 !h-2" />
      )}

      {/* Card */}
      <div
        className="rounded-xl border-2 bg-white shadow-md overflow-hidden"
        style={{ borderColor: meta.color, minWidth: 280, maxWidth: 300 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ backgroundColor: meta.bgColor }}
        >
          <span
            className="text-xs font-semibold rounded-full px-2 py-0.5"
            style={{ color: meta.textColor, backgroundColor: `${meta.color}22` }}
          >
            {meta.label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono">
              #{data.orderIndex + 1}/{data.totalSteps}
            </span>
            <DurationBadge ms={data.durationMs} />
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2 space-y-2">
          {/* Input */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
              Entrée
            </p>
            <JsonSummary data={data.input} />
          </div>

          {/* Output */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
              Sortie
            </p>
            <JsonSummary data={data.output} />
          </div>

          {/* Sources */}
          {data.sources.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Sources ({data.sources.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {data.sources.slice(0, 4).map((s, i) => (
                  <SourceTag key={i} source={s} />
                ))}
                {data.sources.length > 4 && (
                  <span className="text-[10px] text-slate-400">
                    +{data.sources.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right handle — hidden on last node */}
      {!data.isLast && (
        <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2 !h-2" />
      )}
    </>
  );
}

export const DecisionNode = memo(DecisionNodeInner);
DecisionNode.displayName = "DecisionNode";
