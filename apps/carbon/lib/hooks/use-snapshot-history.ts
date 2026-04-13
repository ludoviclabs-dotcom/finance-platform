"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchSnapshotHistory,
  fetchSnapshotVersion,
  type SnapshotHistoryEntry,
  type SnapshotVersionDetail,
} from "@/lib/api";

export type Domain = "carbon" | "vsme" | "esg" | "finance";

export type HistoryState =
  | { status: "loading"; entries: []; available: boolean }
  | { status: "ready"; entries: SnapshotHistoryEntry[]; available: boolean }
  | { status: "error"; entries: []; available: boolean; error: string };

export function useSnapshotHistory(domain: Domain, limit = 10): HistoryState & { refresh: () => void } {
  const [state, setState] = useState<HistoryState>({
    status: "loading",
    entries: [],
    available: false,
  });

  const load = useCallback(() => {
    setState({ status: "loading", entries: [], available: false });
    fetchSnapshotHistory(domain, limit)
      .then((res) => {
        setState({
          status: "ready",
          entries: res.entries,
          available: res.available,
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setState({ status: "error", entries: [], available: false, error: msg });
      });
  }, [domain, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}

export function useSnapshotVersion(
  domain: Domain,
  entryId: number | null
): { status: "idle" | "loading" | "ready" | "error"; detail: SnapshotVersionDetail | null; error: string | null } {
  const [state, setState] = useState<{
    status: "idle" | "loading" | "ready" | "error";
    detail: SnapshotVersionDetail | null;
    error: string | null;
  }>({ status: "idle", detail: null, error: null });

  useEffect(() => {
    if (entryId === null) {
      setState({ status: "idle", detail: null, error: null });
      return;
    }
    setState({ status: "loading", detail: null, error: null });
    const controller = new AbortController();
    fetchSnapshotVersion(domain, entryId, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) {
          setState({ status: "ready", detail, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          const msg = err instanceof Error ? err.message : String(err);
          setState({ status: "error", detail: null, error: msg });
        }
      });
    return () => controller.abort();
  }, [domain, entryId]);

  return state;
}
