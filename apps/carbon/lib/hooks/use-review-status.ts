/**
 * useReviewStatus — hook pour récupérer le statut de review d'un ou plusieurs fact_codes.
 *
 * Pour un seul code : useReviewStatus("CC.GES.SCOPE1") → { status, loading }
 * Pour plusieurs codes : useReviewStatusBatch(["CC.GES.SCOPE1", ...]) → { byCode, loading }
 *
 * Stratégie : fetch en parallèle (Promise.all), tolérant aux 404/erreurs (pas de review = undefined).
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { fetchLatestReview, type ReviewItem, type ReviewStatus } from "@/lib/api";

interface UseReviewStatusResult {
  review: ReviewItem | null;
  status: ReviewStatus | null;
  loading: boolean;
}

export function useReviewStatus(factCode: string | null): UseReviewStatusResult {
  const [review, setReview] = useState<ReviewItem | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!factCode) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    fetchLatestReview(factCode, controller.signal)
      .then((r) => setReview(r))
      .catch(() => setReview(null))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [factCode]);

  return { review, status: review?.status ?? null, loading };
}

export function useReviewStatusBatch(factCodes: string[]): {
  byCode: Record<string, ReviewItem | null>;
  loading: boolean;
} {
  const [byCode, setByCode] = useState<Record<string, ReviewItem | null>>({});
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const codesKey = factCodes.join("|");

  useEffect(() => {
    if (factCodes.length === 0) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    Promise.all(
      factCodes.map((code) =>
        fetchLatestReview(code, controller.signal)
          .then((r) => [code, r] as const)
          .catch(() => [code, null] as const),
      ),
    )
      .then((results) => {
        const next: Record<string, ReviewItem | null> = {};
        for (const [code, r] of results) next[code] = r;
        setByCode(next);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codesKey]);

  return { byCode, loading };
}
