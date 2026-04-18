/**
 * NEURAL — Trace → React Flow converter (Sprint 4)
 *
 * Converts an AgentDecision[] (linear sequence) into React Flow nodes + edges.
 * Layout: horizontal left-to-right, one node per decision.
 *
 * The returned nodes use the custom type "decisionNode" which must be registered
 * in the ReactFlow instance via nodeTypes={{ decisionNode: DecisionNode }}.
 */

import type { Node, Edge } from "reactflow";
import { MarkerType } from "reactflow";
import type { TraceDecision } from "./types";

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_WIDTH = 300;
const NODE_SPACING = 360; // px between node left edges
const NODE_Y = 0;

// ── Converter ─────────────────────────────────────────────────────────────────

export type DecisionNodeData = TraceDecision & {
  isFirst: boolean;
  isLast: boolean;
  totalSteps: number;
};

export function decisionsToFlow(decisions: TraceDecision[]): {
  nodes: Node<DecisionNodeData>[];
  edges: Edge[];
} {
  const total = decisions.length;

  const nodes: Node<DecisionNodeData>[] = decisions.map((d, i) => ({
    id: d.id,
    type: "decisionNode",
    position: { x: i * NODE_SPACING, y: NODE_Y },
    data: {
      ...d,
      isFirst: i === 0,
      isLast: i === total - 1,
      totalSteps: total,
    },
    // Fixed size prevents React Flow from auto-sizing
    style: { width: NODE_WIDTH },
  }));

  const edges: Edge[] = decisions.slice(0, -1).map((d, i) => ({
    id: `e-${d.id}-${decisions[i + 1].id}`,
    source: d.id,
    target: decisions[i + 1].id,
    type: "smoothstep",
    animated: false,
    style: { stroke: "#94a3b8", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
  }));

  return { nodes, edges };
}

/** Pixel width of the entire trace canvas. Used to set ReactFlow's initial viewport. */
export function traceCanvasWidth(decisionCount: number): number {
  return decisionCount * NODE_SPACING + NODE_WIDTH;
}
