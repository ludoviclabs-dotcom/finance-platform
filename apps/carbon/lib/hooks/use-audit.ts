"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAuditEvents, logAuditEvent, type AuditEvent, type AuditEventType, type LogEventRequest } from "@/lib/api";

export type AuditState =
  | { status: "loading"; events: null; error: null }
  | { status: "ready"; events: AuditEvent[]; error: null }
  | { status: "error"; events: null; error: string };

export function useAudit(opts?: { limit?: number; type?: AuditEventType }) {
  const [state, setState] = useState<AuditState>({
    status: "loading",
    events: null,
    error: null,
  });

  const load = useCallback((signal?: AbortSignal) => {
    setState({ status: "loading", events: null, error: null });
    fetchAuditEvents(opts, signal)
      .then((res) => {
        if (signal?.aborted) return;
        setState({ status: "ready", events: res.events, error: null });
      })
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        setState({ status: "error", events: null, error: err instanceof Error ? err.message : String(err) });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  const log = useCallback(async (body: LogEventRequest) => {
    try {
      await logAuditEvent(body);
      refresh();
    } catch {
      // silently fail — audit logging should not break the UI
    }
  }, [refresh]);

  return { ...state, refresh, log };
}
