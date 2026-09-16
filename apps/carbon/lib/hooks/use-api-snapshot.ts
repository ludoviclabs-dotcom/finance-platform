"use client";

import { useEffect, useState } from "react";

import { friendlyApiErrorMessage, isNoSnapshotError, NO_SNAPSHOT_MESSAGE } from "@/lib/api";

/**
 * `status: "error"` couvre aussi le cas « snapshot absent » (API 404
 * `no_snapshot` : l'organisation n'a encore rien importé), signalé par
 * `empty: true`. Ce n'est pas une panne : l'appelant doit afficher un état
 * vide, jamais des données de démonstration. Le union reste à trois statuts
 * pour ne pas casser la réduction de type des pages existantes.
 *
 * `error` est toujours un message français présentable (jamais « API 404 on … »).
 */
export type SnapshotState<T> =
  | { status: "loading"; data: null; error: null; empty: false }
  | { status: "ready"; data: T; error: null; empty: false }
  | { status: "error"; data: null; error: string; empty: boolean };

/**
 * Generic fetch-on-mount hook for API snapshots.
 * Pages should show an empty state when `empty` is true, and fall back to
 * clearly labelled placeholders on other errors.
 */
export function useApiSnapshot<T>(
  fetcher: (signal?: AbortSignal) => Promise<T>
): SnapshotState<T> {
  const [state, setState] = useState<SnapshotState<T>>({
    status: "loading",
    data: null,
    error: null,
    empty: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetcher(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", data, error: null, empty: false });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const empty = isNoSnapshotError(err);
        setState({
          status: "error",
          data: null,
          error: empty ? NO_SNAPSHOT_MESSAGE : friendlyApiErrorMessage(err),
          empty,
        });
      });
    return () => controller.abort();
  }, [fetcher]);

  return state;
}
