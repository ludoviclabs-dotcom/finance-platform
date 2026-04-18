/**
 * NEURAL — Memory value schemas (Sprint 3)
 *
 * All values stored in the `Memory` table are validated through one of these
 * Zod schemas before being persisted. The discriminated union on `type` makes
 * it easy to add new memory kinds without breaking existing reads.
 *
 * Usage:
 *   import { MemoryValueSchema, type MemoryValue } from "@/lib/memory/schemas";
 *   const parsed = MemoryValueSchema.safeParse(raw.value);
 */

import { z } from "zod";

// ── Shared base ───────────────────────────────────────────────────────────────

const BaseMemory = z.object({
  /** Schema version — increment when shape changes to allow migrations. */
  version: z.number().int().min(1).default(1),
  /** Agent or user ID that wrote this memory entry. */
  createdBy: z.string().optional(),
});

// ── Financial configuration ───────────────────────────────────────────────────

export const ChartOfAccountsMemory = BaseMemory.extend({
  type: z.literal("chart-of-accounts"),
  accounts: z.array(
    z.object({
      code: z.string().min(1),
      label: z.string().min(1),
      /** PCG class: "1" Capitaux, "6" Charges, etc. */
      category: z.string().min(1),
    }),
  ),
  fiscalYear: z.string().optional(), // e.g. "2025"
  currency: z.string().length(3).default("EUR"),
  framework: z.enum(["IFRS", "PCG", "OHADA", "US-GAAP"]).default("IFRS"),
});

export const FiscalConfigMemory = BaseMemory.extend({
  type: z.literal("fiscal-config"),
  fiscalYearStart: z.string().optional(), // "MM-DD" e.g. "01-01"
  currency: z.string().length(3).default("EUR"),
  vatRate: z.number().min(0).max(1).optional(), // 0.20 = 20%
  consolidationMethod: z.enum(["full", "proportional", "equity"]).optional(),
});

// ── Agent parameters ──────────────────────────────────────────────────────────

export const AgentPreferencesMemory = BaseMemory.extend({
  type: z.literal("agent-preferences"),
  outputFormat: z.enum(["json", "markdown", "table", "excel"]).default("markdown"),
  language: z.enum(["fr", "en"]).default("fr"),
  /** Decimal precision for financial figures. */
  precision: z.number().int().min(0).max(6).default(2),
  /** Whether to include IFRS/BOFiP source references in answers. */
  includeSourceRefs: z.boolean().default(true),
  /** Preferred IFRS9 PD model when multiple are available. */
  ifrs9PdModel: z.string().optional(),
});

export const LastQueryMemory = BaseMemory.extend({
  type: z.literal("last-query"),
  agentId: z.string().min(1),
  /** Truncated question for context (max 500 chars). */
  question: z.string().max(500),
  answeredAt: z.string().datetime(),
  confidence: z.number().min(0).max(1).optional(),
  /** RunStatus of the AgentRun that answered this query. */
  runStatus: z.enum(["DONE", "WAITING_APPROVAL", "FAILED"]).optional(),
});

// ── Generic escape hatch ──────────────────────────────────────────────────────

export const GenericMemory = BaseMemory.extend({
  type: z.literal("generic"),
  data: z.record(z.string(), z.unknown()),
  label: z.string().optional(),
});

// ── Union ─────────────────────────────────────────────────────────────────────

export const MemoryValueSchema = z.discriminatedUnion("type", [
  ChartOfAccountsMemory,
  FiscalConfigMemory,
  AgentPreferencesMemory,
  LastQueryMemory,
  GenericMemory,
]);

export type MemoryValue = z.infer<typeof MemoryValueSchema>;
export type MemoryType = MemoryValue["type"];
