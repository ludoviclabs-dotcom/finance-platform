"use client";

/**
 * ChainBadge — badge de confiance « Chaîne d'intégrité » (T2.5).
 * Lit /chain/status (dernière vérification planifiée, sinon contrôle live).
 * Rouge si la chaîne est rompue. Thème sombre + point pulsant.
 *
 * Champs RÉELS uniquement : `ok`, `broken_at`, `checked`, `verified_at`
 * (horodatage affiché seulement s'il existe — jamais inventé).
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
        className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500 dark:text-red-400"
        data-testid="chain-badge"
        role="status"
      >
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Chaîne d&apos;intégrité ROMPUE (event #{status.broken_at})
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
      data-testid="chain-badge"
      role="status"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Chaîne d&apos;intégrité vérifiée
      <span className="font-normal text-[var(--color-foreground-muted)]">
        · {status.checked} events{when ? ` · ${when}` : ""}
      </span>
    </div>
  );
}
