/**
 * NEURAL — Explainability trace types (Sprint 4)
 *
 * Shared type definitions for the agent decision graph.
 * These mirror the Prisma models (AgentRun, AgentDecision) but are
 * plain TypeScript so they can be used in both server and client code.
 *
 * Source → the atomic citation unit. Each AgentDecision carries a Source[]
 * that links its reasoning to verifiable external documents:
 *   - excel      : workbook cell range  (e.g. "Consolidation.xlsx B12:C15")
 *   - bofip      : BOFiP paragraph      (e.g. "BOFiP IS §200-10")
 *   - ifrs       : IFRS standard ref    (e.g. "IFRS 9 §5.5.3")
 *   - url        : external web page
 *   - regulation : EU / FR regulation   (e.g. "CRR Art. 178")
 */

// ── Source citation ───────────────────────────────────────────────────────────

export type SourceKind = "excel" | "bofip" | "ifrs" | "url" | "regulation";

export type Source = {
  kind: SourceKind;
  /** Machine-readable reference: cell range, §, article, URL… */
  ref: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Excel sheet name when kind = "excel". */
  sheet?: string;
  /** Page number for PDF-based sources. */
  page?: number;
  /** Full URL for kind = "url" | "regulation". */
  url?: string;
};

// ── Decision kinds ────────────────────────────────────────────────────────────

export type DecisionKind = "RETRIEVE" | "COMPUTE" | "REASON" | "VALIDATE";

export type DecisionKindMeta = {
  label: string;
  description: string;
  color: string;     // hex — border + badge
  bgColor: string;   // hex — node background
  textColor: string; // hex — text on badge
};

export const DECISION_KIND_META: Record<DecisionKind, DecisionKindMeta> = {
  RETRIEVE: {
    label: "Récupération",
    description: "Extraction de données depuis un workbook ou une base réglementaire.",
    color: "#3b82f6",
    bgColor: "#eff6ff",
    textColor: "#1d4ed8",
  },
  COMPUTE: {
    label: "Calcul",
    description: "Opération mathématique ou financière sur les données récupérées.",
    color: "#f59e0b",
    bgColor: "#fffbeb",
    textColor: "#b45309",
  },
  REASON: {
    label: "Raisonnement",
    description: "Interprétation, inférence ou analyse qualitative.",
    color: "#8b5cf6",
    bgColor: "#f5f3ff",
    textColor: "#6d28d9",
  },
  VALIDATE: {
    label: "Validation",
    description: "Vérification de cohérence, seuils réglementaires ou règles métier.",
    color: "#10b981",
    bgColor: "#ecfdf5",
    textColor: "#065f46",
  },
};

// ── Trace entities ────────────────────────────────────────────────────────────

export type TraceDecision = {
  id: string;
  runId: string;
  orderIndex: number;
  kind: DecisionKind;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  sources: Source[];
  durationMs: number;
  createdAt: Date;
};

export type TraceRun = {
  id: string;
  agentId: string;
  question: string;
  answer: string | null;
  confidence: number | null;
  status: string;
  model: string | null;
  startedAt: Date;
  completedAt: Date | null;
  decisions: TraceDecision[];
};
