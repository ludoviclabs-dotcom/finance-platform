"use client";

/**
 * ProvenanceIntegrityCard — affiche le résultat de /facts/verify avec CTA.
 *
 * Montre :
 *   - Badge global : chaîne saine / chaîne cassée / indisponible
 *   - Nombre d'events vérifiés
 *   - Bouton "Revérifier maintenant"
 *   - Si chaîne cassée : id du premier event suspect + lien vers le trail
 */

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { verifyFactsChain, type ChainVerification } from "@/lib/api";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: ChainVerification; durationMs: number }
  | { status: "error"; message: string };

export function ProvenanceIntegrityCard() {
  const [state, setState] = useState<State>({ status: "idle" });

  const run = useCallback(async () => {
    setState({ status: "loading" });
    const t0 = performance.now();
    try {
      const result = await verifyFactsChain();
      setState({
        status: "ready",
        result,
        durationMs: performance.now() - t0,
      });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Erreur inconnue",
      });
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      data-testid="provenance-integrity-card"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-[var(--color-foreground)] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-carbon-emerald" aria-hidden />
            Intégrité chaîne de provenance
          </h3>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
            Vérification SHA-256 chaînée sur l&apos;historique des KPIs de votre
            entreprise.
          </p>
        </div>
        <button
          onClick={run}
          disabled={state.status === "loading"}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] transition-colors disabled:opacity-50"
          aria-label="Revérifier la chaîne"
          data-testid="verify-chain-button"
        >
          {state.status === "loading" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" aria-hidden />
          )}
          <span>Revérifier</span>
        </button>
      </div>

      {state.status === "loading" && (
        <div className="text-sm text-[var(--color-foreground-muted)] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Vérification en cours…
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5 p-3 text-sm text-[var(--color-warning)]">
          Vérification indisponible — {state.message}
        </div>
      )}

      {state.status === "ready" && state.result.ok && (
        <div
          className="rounded-lg border border-[var(--color-success)]/40 bg-[var(--color-success)]/5 p-3"
          data-testid="chain-ok"
        >
          <div className="flex items-center gap-2 text-sm text-[var(--color-success)] font-medium">
            <CheckCircle2 className="w-4 h-4" aria-hidden />
            Chaîne intègre — {state.result.checked} event
            {state.result.checked > 1 ? "s" : ""} vérifié
            {state.result.checked > 1 ? "s" : ""}
          </div>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
            Aucune altération détectée. Vérification en {state.durationMs.toFixed(0)}ms.
          </p>
        </div>
      )}

      {state.status === "ready" && !state.result.ok && (
        <div
          className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3"
          data-testid="chain-broken"
        >
          <div className="flex items-center gap-2 text-sm text-[var(--color-danger)] font-semibold">
            <AlertTriangle className="w-4 h-4" aria-hidden />
            Chaîne cassée
          </div>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
            Event suspect détecté à l&apos;id <code>{state.result.broken_at}</code>{" "}
            après {state.result.checked} events valides.
          </p>
          <p className="text-xs text-[var(--color-danger)] mt-2">
            → Action : contacter le support pour analyse (une altération manuelle de
            facts_events a été détectée).
          </p>
        </div>
      )}
    </div>
  );
}
