"use client";

import { fetchCarbonSnapshot, type CarbonSnapshot } from "@/lib/api";
import { useApiSnapshot, type SnapshotState as Generic } from "./use-api-snapshot";

export type SnapshotState = Generic<CarbonSnapshot>;

/**
 * Fetches the Carbon snapshot from the backend on mount.
 * `status === "error" && empty` : aucune donnée importée (API 404
 * `no_snapshot`) — afficher un état vide, pas les mocks de lib/data.ts.
 */
export function useCarbonSnapshot(): SnapshotState {
  return useApiSnapshot(fetchCarbonSnapshot);
}
