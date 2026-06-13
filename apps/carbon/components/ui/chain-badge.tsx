"use client";

/**
 * ChainBadge — badge de confiance « Chaîne d'intégrité vérifiée » (T2.5).
 * Lit /chain/status (dernière vérification planifiée, sinon contrôle live).
 * Rouge si la chaîne est rompue.
 */

import { useEffect, useState } from "react";

import { fetchChainStatus, type ChainStatus } from "@/lib/api";

export function ChainBadge() {
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchChainStatus(ctrl.signal)
      .then(setStatus)
      .catch(() => setFailed(true));
    return () => ctrl.abort();
  }, []);

  if (failed || !status) return null;

  const when = status.verified_at
    ? new Date(status.verified_at).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  if (!status.ok) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-red-50 border-red-200 text-red-700 text-xs font-semibold"
        data-testid="chain-badge"
        role="status"
      >
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Chaîne d&apos;intégrité ROMPUE (event #{status.broken_at})
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700 text-xs font-semibold"
      data-testid="chain-badge"
      role="status"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      Chaîne d&apos;intégrité vérifiée
      {when ? ` le ${when}` : ""} — {status.checked} events
    </div>
  );
}
