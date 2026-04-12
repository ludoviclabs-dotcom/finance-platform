"use client";

import { useEffect, useState } from "react";

export type SnapshotState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

/**
 * Generic fetch-on-mount hook for API snapshots.
 * Pages should fall back to mocks or placeholders when status === "error".
 */
export function useApiSnapshot<T>(
  fetcher: (signal?: AbortSignal) => Promise<T>
): SnapshotState<T> {
  const [state, setState] = useState<SnapshotState<T>>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetcher(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", data, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: "error", data: null, error: message });
      });
    return () => controller.abort();
  }, [fetcher]);

  return state;
}
