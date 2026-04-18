"use client";

/**
 * NEURAL — TraceView (Sprint 4)
 *
 * React Flow canvas that renders the explainability trace of an AgentRun.
 * Receives pre-fetched `TraceRun` data from a parent Server Component.
 *
 * Usage (Server Component):
 *
 *   import { getTrace } from "@/lib/trace/builder";
 *   import { TraceView } from "@/components/explainability/trace-view";
 *
 *   const trace = await getTrace(runId);
 *   if (!trace) notFound();
 *   return <TraceView run={trace} />;
 *
 * States:
 *   • Empty   — run has no decisions yet (streaming / in-progress)
 *   • Partial — some decisions present, run not complete
 *   • Full    — all decisions present, run DONE or FAILED
 */

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";

import { useMemo } from "react";
import { CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";

import type { TraceRun } from "@/lib/trace/types";
import { decisionsToFlow, traceCanvasWidth, type DecisionNodeData } from "@/lib/trace/to-flow";
import { DecisionNode } from "./decision-node";

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_TYPES = { decisionNode: DecisionNode };

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = {
    DONE:             { Icon: CheckCircle2, label: "Terminé",    cls: "text-emerald-600 bg-emerald-50" },
    FAILED:           { Icon: AlertCircle,  label: "Échec",      cls: "text-red-600 bg-red-50" },
    RUNNING:          { Icon: Loader2,      label: "En cours…",  cls: "text-blue-600 bg-blue-50 animate-spin" },
    WAITING_APPROVAL: { Icon: Clock,        label: "En attente", cls: "text-amber-600 bg-amber-50" },
    REJECTED:         { Icon: AlertCircle,  label: "Rejeté",     cls: "text-red-600 bg-red-50" },
  }[status] ?? { Icon: Clock, label: status, cls: "text-slate-600 bg-slate-50" };

  const { Icon, label, cls } = config;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyTrace({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      <p className="text-sm">
        {status === "RUNNING"
          ? "L'agent est en cours d'exécution — les étapes apparaîtront ici."
          : "Aucune étape de décision enregistrée pour cette exécution."}
      </p>
    </div>
  );
}

// ── Inner canvas (needs ReactFlowProvider context) ────────────────────────────

function TraceCanvas({
  initialNodes,
  initialEdges,
}: {
  initialNodes: Node<DecisionNodeData>[];
  initialEdges: Edge[];
}) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={1.5}
      attributionPosition="bottom-right"
    >
      <Background color="#e2e8f0" gap={20} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(n) => {
          const kind = (n.data as DecisionNodeData)?.kind;
          const colors: Record<string, string> = {
            RETRIEVE: "#3b82f6",
            COMPUTE:  "#f59e0b",
            REASON:   "#8b5cf6",
            VALIDATE: "#10b981",
          };
          return colors[kind] ?? "#94a3b8";
        }}
        maskColor="rgba(248,250,252,0.7)"
        className="!bottom-12 !right-2"
      />
    </ReactFlow>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function TraceView({ run }: { run: TraceRun }) {
  const { nodes, edges } = useMemo(
    () => decisionsToFlow(run.decisions),
    [run.decisions],
  );

  const canvasWidth = traceCanvasWidth(run.decisions.length);
  const latencyMs = run.completedAt
    ? run.completedAt.getTime() - run.startedAt.getTime()
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Run metadata */}
      <div className="flex flex-wrap items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 mb-1">Question</p>
          <p className="text-sm font-medium text-slate-800 line-clamp-2">{run.question}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={run.status} />
          <div className="flex gap-3 text-xs text-slate-400">
            {run.model && <span className="font-mono">{run.model}</span>}
            {latencyMs !== null && <span>{(latencyMs / 1000).toFixed(1)} s</span>}
            {run.confidence !== null && (
              <span>
                Confiance : {Math.round((run.confidence ?? 0) * 100)} %
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trace canvas */}
      {run.decisions.length === 0 ? (
        <EmptyTrace status={run.status} />
      ) : (
        <div
          className="rounded-xl border border-slate-200 overflow-hidden bg-white"
          style={{ height: 420, minWidth: Math.min(canvasWidth, 800) }}
        >
          <ReactFlowProvider>
            <TraceCanvas initialNodes={nodes} initialEdges={edges} />
          </ReactFlowProvider>
        </div>
      )}

      {/* Final answer */}
      {run.answer && (
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <p className="text-xs text-slate-400 mb-1.5">Réponse finale</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{run.answer}</p>
        </div>
      )}
    </div>
  );
}
