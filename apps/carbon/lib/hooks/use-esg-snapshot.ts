"use client";

import { fetchEsgSnapshot, type EsgSnapshot } from "@/lib/api";
import { useApiSnapshot, type SnapshotState } from "./use-api-snapshot";

export function useEsgSnapshot(): SnapshotState<EsgSnapshot> {
  return useApiSnapshot(fetchEsgSnapshot);
}
