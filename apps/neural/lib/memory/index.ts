/**
 * NEURAL — Memory façade (Sprint 3)
 *
 * Single import for all memory operations. Re-exports everything an agent or
 * API route needs without having to know the internal module structure.
 *
 * Usage:
 *   import { remember, recall, search, forget, recallOrg } from "@/lib/memory";
 *   import type { MemoryValue } from "@/lib/memory";
 *
 * Example — persist a chart of accounts for an organisation:
 *
 *   await remember({
 *     scope:          "ORG",
 *     scopeId:        org.id,
 *     key:            "chart-of-accounts",
 *     organizationId: org.id,
 *     value: {
 *       type:      "chart-of-accounts",
 *       currency:  "EUR",
 *       framework: "IFRS",
 *       accounts:  [...],
 *     },
 *     mem0Summary: "Plan comptable IFRS de l'organisation Luxe Finance SA",
 *     mem0Ctx:    { orgId: org.id },
 *   });
 *
 * Example — recall agent preferences:
 *
 *   const prefs = await recallAgent("ifrs9-ecl", "preferences");
 *   if (prefs?.value.type === "agent-preferences") {
 *     const { precision, language } = prefs.value;
 *   }
 */

// Core CRUD
export {
  remember,
  recall,
  list,
  forget,
  search,
  recallOrg,
  recallUser,
  recallAgent,
} from "./client";

// Types
export type {
  MemoryEntry,
  MemoryScopeType,
  RememberOptions,
  RecallOptions,
  ForgetOptions,
  SearchOptions,
} from "./client";

// Value schemas & types
export {
  MemoryValueSchema,
  ChartOfAccountsMemory,
  FiscalConfigMemory,
  AgentPreferencesMemory,
  LastQueryMemory,
  GenericMemory,
} from "./schemas";

export type { MemoryValue, MemoryType } from "./schemas";

// Mem0 availability flag (useful for conditional UI or agent logic)
export { isMem0Ready } from "./mem0";
