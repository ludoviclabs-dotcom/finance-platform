"use client";

import { fetchVsmeSnapshot, type VsmeSnapshot } from "@/lib/api";
import { useApiSnapshot, type SnapshotState } from "./use-api-snapshot";

export function useVsmeSnapshot(): SnapshotState<VsmeSnapshot> {
  return useApiSnapshot(fetchVsmeSnapshot);
}
