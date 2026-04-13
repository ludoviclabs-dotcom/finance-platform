"use client";

import { fetchConsolidatedSnapshot, type ConsolidatedSnapshot } from "@/lib/api";
import { useApiSnapshot, type SnapshotState as Generic } from "./use-api-snapshot";

export type ConsolidatedState = Generic<ConsolidatedSnapshot>;

/**
 * Fetches the consolidated multi-domain snapshot from /dashboard/consolidated.
 * Replaces the triple (useCarbonSnapshot + useEsgSnapshot + useFinanceSnapshot)
 * pattern with a single, pre-aggregated call.
 */
export function useConsolidatedSnapshot(): ConsolidatedState {
  return useApiSnapshot(fetchConsolidatedSnapshot);
}
