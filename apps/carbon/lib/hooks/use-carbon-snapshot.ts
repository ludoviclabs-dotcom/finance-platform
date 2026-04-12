"use client";

import { useEffect, useState } from "react";
import { fetchCarbonSnapshot, type CarbonSnapshot } from "@/lib/api";

export type SnapshotState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: CarbonSnapshot; error: null }
  | { status: "error"; data: null; error: string };

/**
 * Fetches the Carbon snapshot from the backend on mount.
 * Pages should fall back to mocks from lib/data.ts when status === "error".
 */
export function useCarbonSnapshot(): SnapshotState {
  const [state, setState] = useState<SnapshotState>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchCarbonSnapshot(controller.signal)
      .then((data) => setState({ status: "ready", data, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: "error", data: null, error: message });
      });
    return () => controller.abort();
  }, []);

  return state;
}
