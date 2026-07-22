"use client";

/**
 * Carte d'accès « Ressources stratégiques » sur le cockpit — raccourci léger de
 * découvrabilité vers /resources (Module 2, BETA).
 *
 * Réutilise STRICTEMENT les endpoints existants (`/resources/catalog`,
 * `/resources/alerts`, `/resources/assessments`) — aucun calcul dupliqué ici :
 * on n'affiche que des agrégats déjà servis (total, nombre de signaux) et la
 * moyenne des confiances déjà calculées par le moteur (jamais un score inventé,
 * jamais une fusion risque×confiance). Les chiffres n'apparaissent que si des
 * données existent ; sinon la carte reste un simple point d'entrée.
 *
 * Résilient : un catalogue indisponible (schéma non prêt, accès refusé) dégrade
 * vers la carte + CTA seuls, jamais une erreur bruyante sur le tableau de bord.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, ArrowRight } from "lucide-react";

import {
  fetchResourceAlerts,
  fetchResourceAssessments,
  fetchResourceCatalog,
} from "@/lib/api/resources";

export type ResourcesAccessStats = {
  resourceCount: number;
  alertCount: number;
  /** Moyenne des confiances documentaires (0-100), ou `null` si aucune n'est calculable. */
  avgConfidence: number | null;
};

type CardStatus = "loading" | "ready" | "unavailable";

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div data-testid={testId}>
      <div className="font-display text-lg font-bold text-[var(--color-foreground)]">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-foreground-muted)]">{label}</div>
    </div>
  );
}

export function ResourcesAccessCardView({
  status,
  stats,
}: {
  status: CardStatus;
  stats?: ResourcesAccessStats;
}) {
  const hasData = status === "ready" && stats !== undefined && stats.resourceCount > 0;

  return (
    <div className="cc-card p-5" data-testid="dashboard-resources-card">
      <div className="cc-card-head">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-carbon-emerald/15 text-carbon-emerald-light">
            <Boxes className="h-5 w-5" />
          </span>
          <div>
            <div className="cc-card-title flex items-center gap-2">
              Ressources stratégiques
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                BETA
              </span>
            </div>
            <div className="cc-card-sub">
              Cartographiez les matières, gaz et combustibles dont dépend votre activité.
            </div>
          </div>
        </div>
      </div>

      {hasData && (
        <div className="mb-4 flex flex-wrap gap-6" data-testid="dashboard-resources-stats">
          <Stat label="Ressources" value={String(stats.resourceCount)} testId="dashboard-resources-count" />
          <Stat label="Alertes" value={String(stats.alertCount)} testId="dashboard-resources-alerts" />
          {stats.avgConfidence !== null && (
            <Stat
              label="Confiance moy."
              value={`${Math.round(stats.avgConfidence)} %`}
              testId="dashboard-resources-confidence"
            />
          )}
        </div>
      )}

      <Link
        href="/resources"
        data-testid="dashboard-resources-cta"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-carbon-emerald-light transition-opacity hover:opacity-80"
      >
        Ouvrir le cockpit
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function ResourcesAccessCard() {
  const [status, setStatus] = useState<CardStatus>("loading");
  const [stats, setStats] = useState<ResourcesAccessStats | undefined>(undefined);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      const [catalogRes, alertsRes, assessmentsRes] = await Promise.allSettled([
        fetchResourceCatalog({}, ctrl.signal),
        fetchResourceAlerts(ctrl.signal),
        fetchResourceAssessments({ current_only: true }, ctrl.signal),
      ]);
      if (cancelled) return;

      // Le catalogue est la source de vérité du « des données existent-elles ? ».
      // S'il échoue (schema_not_ready, accès refusé), on n'affiche pas de stats.
      if (catalogRes.status !== "fulfilled") {
        setStatus("unavailable");
        return;
      }

      const alertCount = alertsRes.status === "fulfilled" ? alertsRes.value.items.length : 0;
      const confidences =
        assessmentsRes.status === "fulfilled"
          ? assessmentsRes.value.items
              .map((a) => a.confidence)
              .filter((c): c is number => typeof c === "number")
          : [];
      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
          : null;

      setStats({ resourceCount: catalogRes.value.total, alertCount, avgConfidence });
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  return <ResourcesAccessCardView status={status} stats={stats} />;
}
