/**
 * NEURAL — Bank Comms runs persistence (Tier 2 #3).
 *
 * Best-effort wrapper qui historise chaque run des 4 agents banque dans la
 * table `AgentRun` (schema existant `prisma/schema.prisma`).
 *
 * Contrat :
 *  - Jamais throw : toute erreur DB est logguée puis avalée (le run applicatif
 *    doit continuer à répondre même si la base est indispo).
 *  - No-op si `env.database.ready` est faux (env local sans DATABASE_URL).
 *  - Même traceId côté header HTTP + côté DB pour corrélation trivial.
 *
 * Stockage :
 *  - AgentRun.id = traceId (UUID généré par check*)
 *  - AgentRun.agentId = slug (reg-bank-comms, bank-crisis-comms, ...)
 *  - AgentRun.question = scenarioId
 *  - AgentRun.answer = decision (PASS / PASS_WITH_REVIEW / BLOCK)
 *  - AgentRun.status = DONE / WAITING_APPROVAL / FAILED selon decision
 *  - AgentRun.model = "gateway/claude-sonnet-4.6" ou "fallback"
 *  - AgentRun.trace = { verdict complet, blockers, warnings, gates, meta }
 *  - AgentRun.startedAt / completedAt
 */

import { db } from "@/lib/db";
import { env } from "@/lib/env";

type PersistableDecision = "PASS" | "PASS_WITH_REVIEW" | "BLOCK";

/** Mapping decision → RunStatus de Prisma. */
function statusFrom(decision: PersistableDecision): "DONE" | "WAITING_APPROVAL" | "FAILED" {
  if (decision === "PASS") return "DONE";
  if (decision === "PASS_WITH_REVIEW") return "WAITING_APPROVAL";
  return "FAILED";
}

export type BankCommsRunRecord = {
  traceId: string;
  agentSlug: "reg-bank-comms" | "bank-crisis-comms" | "esg-bank-comms" | "client-bank-comms";
  scenarioId: string;
  decision: PersistableDecision;
  mode: "gateway" | "fallback";
  model?: string;
  latencyMs: number;
  startedAtMs: number;
  /** Payload JSON complet du verdict (gates, blockers, warnings, sla, metrics, …). */
  trace: unknown;
};

/**
 * Persiste un run de l'un des 4 agents banque.
 *
 * Sans erreur si :
 *  - la DB n'est pas configurée (env.database.ready=false) → no-op
 *  - la DB est configurée mais indispo → warn + no-op
 *
 * La fonction retourne booléen pour permettre des tests / debug côté appelant.
 */
export async function persistBankCommsRun(record: BankCommsRunRecord): Promise<boolean> {
  if (!env.database.ready) return false;
  try {
    const model = record.mode === "fallback" ? "fallback" : (record.model ?? "gateway");
    await db.agentRun.create({
      data: {
        id: record.traceId,
        agentId: record.agentSlug,
        question: record.scenarioId,
        answer: record.decision,
        status: statusFrom(record.decision),
        model,
        startedAt: new Date(record.startedAtMs),
        completedAt: new Date(record.startedAtMs + record.latencyMs),
        trace: record.trace as never,
      },
    });
    return true;
  } catch (err) {
    // Best-effort : on logge mais on n'échoue jamais le run applicatif.
     
    console.warn(
      `[bank-comms-persistence] persist ${record.agentSlug}/${record.scenarioId} failed:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/** Récupère les N derniers runs d'un agent banque (ou tous si omis). */
export async function getRecentBankCommsRuns(params: {
  agentSlug?: BankCommsRunRecord["agentSlug"];
  limit?: number;
}): Promise<
  Array<{
    id: string;
    agentId: string;
    scenarioId: string;
    decision: string | null;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    model: string | null;
  }>
> {
  if (!env.database.ready) return [];
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  try {
    const rows = await db.agentRun.findMany({
      where: params.agentSlug
        ? { agentId: params.agentSlug }
        : {
            agentId: {
              in: [
                "reg-bank-comms",
                "bank-crisis-comms",
                "esg-bank-comms",
                "client-bank-comms",
              ],
            },
          },
      orderBy: { startedAt: "desc" },
      take: limit,
      select: {
        id: true,
        agentId: true,
        question: true,
        answer: true,
        status: true,
        startedAt: true,
        completedAt: true,
        model: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      scenarioId: r.question,
      decision: r.answer,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      model: r.model,
    }));
  } catch (err) {
     
    console.warn("[bank-comms-persistence] getRecentBankCommsRuns failed:", err);
    return [];
  }
}
