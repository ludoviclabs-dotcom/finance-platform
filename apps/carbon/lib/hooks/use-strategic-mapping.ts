"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchStrategicMapping,
  type MappingHorizon,
  type MappingPersona,
  type MappingSegment,
  type StrategicMappingResponse,
} from "@/lib/api";

export interface StrategicMappingState {
  data: StrategicMappingResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface StrategicMappingFilters {
  segment?: MappingSegment;
  persona?: MappingPersona;
  horizon?: MappingHorizon;
}

/**
 * Fetches the strategic mapping ESG content from /strategic-mapping/adhesion-volontaire.
 * Re-fetches automatically when filters change.
 * Enriched with groundedKpis if a ConsolidatedSnapshot is available server-side.
 */
export function useStrategicMapping(
  filters: StrategicMappingFilters = {}
): StrategicMappingState {
  const [data, setData] = useState<StrategicMappingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetchStrategicMapping(filters, controller.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setLoading(false);
      });
  }, [filters.segment, filters.persona, filters.horizon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { data, loading, error, refetch: load };
}
