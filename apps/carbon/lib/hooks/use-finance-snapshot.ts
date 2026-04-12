"use client";

import { fetchFinanceSnapshot, type FinanceSnapshot } from "@/lib/api";
import { useApiSnapshot, type SnapshotState } from "./use-api-snapshot";

export function useFinanceSnapshot(): SnapshotState<FinanceSnapshot> {
  return useApiSnapshot(fetchFinanceSnapshot);
}
