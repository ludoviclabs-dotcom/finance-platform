"use client";

/**
 * Cockpit Ressources — assessments (Module 2, PR-M2C, BETA).
 *
 * Liste les runs immuables d'exposition ressources. `risk_score` et `confidence`
 * dans deux colonnes distinctes ; un risque non calculable s'affiche « Non
 * calculé », jamais « 0 ». Bascule `current_only` pour inclure l'historique
 * (`superseded`).
 */

import { useCallback, useEffect, useState } from "react";
import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import { ResourceNav } from "@/components/resources/resource-nav";
import { AssessmentSummaryTable } from "@/components/resources/assessment-summary-table";
import { MethodologyDisclaimer } from "@/components/resources/methodology-disclaimer";
import {
  SchemaNotReadyError,
  fetchResourceAssessments,
  type ResourceAssessmentSummary,
} from "@/lib/api/resources";

type PageState = "loading" | "schema_not_ready" | "error" | "ready";

export default function ResourceAssessmentsPage() {
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<ResourceAssessmentSummary[]>([]);
  const [currentOnly, setCurrentOnly] = useState(true);

  const load = useCallback(async (current: boolean, signal?: AbortSignal) => {
    setState("loading");
    setError(null);
    try {
      const res = await fetchResourceAssessments({ current_only: current }, signal);
      setRuns(res.items);
      setState("ready");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (e instanceof SchemaNotReadyError) {
        setState("schema_not_ready");
        return;
      }
      setError((e as Error).message);
      setState("error");
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(currentOnly, ctrl.signal);
    return () => ctrl.abort();
  }, [load, currentOnly]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Assessments ressources</h1>
          <FeatureStatusBadge status="beta" />
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Runs immuables du CarbonCo Resource Exposure Score. Risque et confiance côte à côte,
          jamais fusionnés.
        </p>
      </header>

      <ResourceNav active="assessments" />

      {state === "loading" && (
        <p data-testid="assessments-loading" className="text-sm text-[var(--color-muted-foreground)]">
          Chargement des assessments…
        </p>
      )}

      {state === "schema_not_ready" && (
        <div
          data-testid="assessments-schema-not-ready"
          className="rounded border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <p className="font-semibold">Initialisation du schéma en cours</p>
          <p>Les migrations du module Ressources (042/043) ne sont pas encore appliquées.</p>
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="assessments-error"
          className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400"
        >
          <p className="font-semibold">Assessments indisponibles</p>
          <p>{error}</p>
        </div>
      )}

      {state === "ready" && (
        <div data-testid="assessments-content">
          <label className="mb-4 flex items-center gap-2 text-sm text-[var(--color-foreground)]">
            <input
              type="checkbox"
              data-testid="assessments-current-only"
              checked={currentOnly}
              onChange={(e) => setCurrentOnly(e.target.checked)}
            />
            Runs courants uniquement (masquer l&apos;historique remplacé)
          </label>

          <AssessmentSummaryTable runs={runs} />

          <MethodologyDisclaimer className="mt-6" />
        </div>
      )}
    </div>
  );
}
