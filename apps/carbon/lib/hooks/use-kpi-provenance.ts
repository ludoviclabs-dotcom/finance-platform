/**
 * useKpiProvenance — hook pour récupérer l'historique d'un KPI via /facts/{code}/trail.
 *
 * Utilisation typique :
 *   const { trail, loading, error, refetch } = useKpiProvenance("CC.GES.SCOPE1", { limit: 20 });
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchFactTrail,
  type FactTrailResponse,
} from "@/lib/api";

interface UseKpiProvenanceOptions {
  limit?: number;
  offset?: number;
  /** Si true, ne lance pas le fetch automatiquement (utile pour ouverture drawer à la demande). */
  enabled?: boolean;
}

interface UseKpiProvenanceResult {
  trail: FactTrailResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  durationMs: number | null;
}

export function useKpiProvenance(
  code: string | null,
  options: UseKpiProvenanceOptions = {},
): UseKpiProvenanceResult {
  const { limit = 20, offset = 0, enabled = true } = options;
  const [trail, setTrail] = useState<FactTrailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(async () => {
    if (!code) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const res = await fetchFactTrail(code, {
        limit,
        offset,
        signal: controller.signal,
      });
      setTrail(res);
      setDurationMs(performance.now() - t0);
    } catch (e) {
      if ((e as Error & { name?: string })?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setTrail(null);
    } finally {
      setLoading(false);
    }
  }, [code, limit, offset]);

  useEffect(() => {
    if (!enabled || !code) return;
    void doFetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, code, doFetch]);

  return { trail, loading, error, refetch: doFetch, durationMs };
}
