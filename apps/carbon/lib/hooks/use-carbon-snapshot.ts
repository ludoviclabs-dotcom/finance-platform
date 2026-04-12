"use client";

import { fetchCarbonSnapshot, type CarbonSnapshot } from "@/lib/api";
import { useApiSnapshot, type SnapshotState as Generic } from "./use-api-snapshot";

export type SnapshotState = Generic<CarbonSnapshot>;

/**
 * Fetches the Carbon snapshot from the backend on mount.
 * Pages should fall back to mocks from lib/data.ts when status === "error".
 */
export function useCarbonSnapshot(): SnapshotState {
  return useApiSnapshot(fetchCarbonSnapshot);
}
