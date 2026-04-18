/**
 * NEURAL — Trace builder (Sprint 4)
 *
 * Server-side helpers for creating and reading the explainability trace.
 * Called by agent handlers as they execute reasoning steps.
 *
 * Usage inside an agent run:
 *
 *   const run = await createRun({ agentId: "ifrs9-ecl", question, userId, orgId });
 *
 *   const step = buildStep(run.id);
 *   await step.retrieve("workbook-ecl", input, output, sources, 45);
 *   await step.compute("pd-lgd-ead",    input, output, sources, 120);
 *   await step.reason("interpretation", input, output, sources, 200);
 *   await step.validate("seuils-npl",   input, output, sources, 30);
 *
 *   await completeRun(run.id, { answer, confidence });
 */

import { DecisionKind as PrismaDecisionKind, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Source, DecisionKind, TraceRun } from "./types";

// ── Run lifecycle ─────────────────────────────────────────────────────────────

export type CreateRunOptions = {
  agentId: string;
  question: string;
  userId?: string;
  organizationId?: string;
  model?: string;
};

/** Create a new AgentRun row and return its id. */
export async function createRun({
  agentId,
  question,
  userId,
  organizationId,
  model,
}: CreateRunOptions) {
  return db.agentRun.create({
    data: {
      agentId,
      question,
      userId: userId ?? null,
      organizationId: organizationId ?? null,
      model: model ?? null,
      status: "RUNNING",
    },
    select: { id: true },
  });
}

export type CompleteRunOptions = {
  answer: string;
  confidence?: number;
  costUsd?: number;
};

/** Mark a run as DONE and set the final answer. */
export async function completeRun(runId: string, opts: CompleteRunOptions) {
  return db.agentRun.update({
    where: { id: runId },
    data: {
      status: "DONE",
      answer: opts.answer,
      confidence: opts.confidence ?? null,
      costUsd: opts.costUsd ?? null,
      completedAt: new Date(),
    },
  });
}

/** Mark a run as FAILED with an optional error message. */
export async function failRun(runId: string, errorMessage?: string) {
  return db.agentRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      answer: errorMessage ?? null,
      completedAt: new Date(),
    },
  });
}

// ── Decision appending ────────────────────────────────────────────────────────

export type AppendDecisionOptions = {
  runId: string;
  orderIndex: number;
  kind: DecisionKind;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  sources: Source[];
  durationMs: number;
};

/** Append a single AgentDecision step to an existing run. */
export async function appendDecision(opts: AppendDecisionOptions) {
  return db.agentDecision.create({
    data: {
      runId: opts.runId,
      orderIndex: opts.orderIndex,
      kind: opts.kind as PrismaDecisionKind,
      input: opts.input as unknown as Prisma.InputJsonValue,
      output: opts.output as unknown as Prisma.InputJsonValue,
      sources: opts.sources as object[],
      durationMs: opts.durationMs,
    },
  });
}

// ── Step builder ──────────────────────────────────────────────────────────────

/**
 * Returns a step builder bound to a run. Maintains an auto-incrementing index
 * so callers don't have to track orderIndex manually.
 *
 * Example:
 *   const step = buildStep(run.id);
 *   await step.retrieve("ecl-data", input, output, sources, 45);
 *   await step.compute("pd-model",  input, output, sources, 120);
 */
export function buildStep(runId: string) {
  let index = 0;

  async function append(
    kind: DecisionKind,
    _label: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    sources: Source[],
    durationMs: number,
  ) {
    const decision = await appendDecision({
      runId,
      orderIndex: index++,
      kind,
      input,
      output,
      sources,
      durationMs,
    });
    return decision;
  }

  return {
    retrieve: (label: string, input: Record<string, unknown>, output: Record<string, unknown>, sources: Source[], durationMs: number) =>
      append("RETRIEVE", label, input, output, sources, durationMs),
    compute: (label: string, input: Record<string, unknown>, output: Record<string, unknown>, sources: Source[], durationMs: number) =>
      append("COMPUTE", label, input, output, sources, durationMs),
    reason: (label: string, input: Record<string, unknown>, output: Record<string, unknown>, sources: Source[], durationMs: number) =>
      append("REASON", label, input, output, sources, durationMs),
    validate: (label: string, input: Record<string, unknown>, output: Record<string, unknown>, sources: Source[], durationMs: number) =>
      append("VALIDATE", label, input, output, sources, durationMs),
  };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Fetch a full run with its ordered decisions. */
export async function getTrace(runId: string): Promise<TraceRun | null> {
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    include: {
      decisions: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!run) return null;

  return {
    id: run.id,
    agentId: run.agentId,
    question: run.question,
    answer: run.answer,
    confidence: run.confidence,
    status: run.status,
    model: run.model,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    decisions: run.decisions.map((d) => ({
      id: d.id,
      runId: d.runId,
      orderIndex: d.orderIndex,
      kind: d.kind as DecisionKind,
      input: d.input as Record<string, unknown>,
      output: d.output as Record<string, unknown>,
      sources: (d.sources as unknown[]) as import("./types").Source[],
      durationMs: d.durationMs,
      createdAt: d.createdAt,
    })),
  };
}

/** List recent runs for a given agent, newest first. */
export async function listRuns(agentId: string, limit = 20) {
  return db.agentRun.findMany({
    where: { agentId },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      agentId: true,
      question: true,
      status: true,
      confidence: true,
      startedAt: true,
      completedAt: true,
      _count: { select: { decisions: true } },
    },
  });
}
