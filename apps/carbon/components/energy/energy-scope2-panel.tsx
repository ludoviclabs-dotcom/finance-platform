"use client";

/* ════════════════════════════════════════════════════════════════════════════
   Énergie & Scope 2 dual — fondation (PR-06A, BETA)
   Vue location-based (LB) ET market-based (MB) côte à côte, jamais l'une masquant
   l'autre. Présente la FONDATION de données (compteurs, activités, instruments,
   allocations) — PAS de total d'émissions Scope 2 (le moteur de calcul dual
   LB/MB est la tranche suivante, PR-06B). Toutes les quantités affichées sont des
   MWh d'énergie (consommation / couverture contractuelle), jamais des tCO2e.
   ════════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flag,
  Gauge,
  Zap,
} from "lucide-react";

import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import {
  fetchActivities,
  fetchInstruments,
  fetchMeters,
  type ContractualInstrument,
  type EnergyActivity,
  type EnergyMeter,
  type EnergyReviewStatus,
} from "@/lib/api/energy";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | {
      status: "ready";
      meters: EnergyMeter[];
      activities: EnergyActivity[];
      instruments: ContractualInstrument[];
    };

const CARRIER_LABEL: Record<string, string> = {
  electricity: "Électricité",
  gas: "Gaz",
  heat: "Chaleur",
  steam: "Vapeur",
  cooling: "Froid",
  other: "Autre",
};

const INSTRUMENT_LABEL: Record<string, string> = {
  rec: "REC",
  go: "Garantie d'origine",
  ppa: "PPA",
  green_tariff: "Tarif vert",
};

function fmt(n: number, digits = 1): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function EnergyReviewBadge({ status }: { status: EnergyReviewStatus }) {
  const cfg: Record<EnergyReviewStatus, { label: string; cls: string; Icon: React.ElementType }> = {
    pending: { label: "À revoir", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: Clock },
    accepted: { label: "Acceptée", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
    flagged: { label: "Signalée", cls: "bg-rose-50 text-rose-700 border-rose-200", Icon: Flag },
  };
  const { label, cls, Icon } = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {label}
    </span>
  );
}

export function EnergyScope2Panel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      fetchMeters({ limit: 200 }, ac.signal),
      fetchActivities({ limit: 200 }, ac.signal),
      fetchInstruments({ limit: 200 }, ac.signal),
    ])
      .then(([m, a, i]) =>
        setState({ status: "ready", meters: m.items, activities: a.items, instruments: i.items }),
      )
      .catch((err) => {
        if (ac.signal.aborted) return;
        setState({ status: "error", error: err instanceof Error ? err.message : "Erreur inconnue" });
      });
    return () => ac.abort();
  }, []);

  const derived = useMemo(() => {
    if (state.status !== "ready") return null;
    const consumptionMwh = state.activities.reduce((sum, a) => sum + (a.quantity || 0), 0);
    const instrumentVolume = state.instruments.reduce((sum, i) => sum + (i.volume_mwh || 0), 0);
    const allocated = state.instruments.reduce((sum, i) => sum + (i.allocated_mwh || 0), 0);
    const expiredCount = state.instruments.filter((i) => i.is_expired).length;
    const pendingCount = state.activities.filter((a) => a.review_status === "pending").length;
    return { consumptionMwh, instrumentVolume, allocated, expiredCount, pendingCount };
  }, [state]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white/60 p-5 dark:border-neutral-800 dark:bg-neutral-900/40">
      {/* En-tête */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-cyan-600">
            <Zap className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold leading-tight">
              Énergie &amp; Scope 2 dual
              <FeatureStatusBadge status="beta" size="sm" />
            </h2>
            <p className="text-xs text-neutral-500">
              Location-based et market-based côte à côte — fondation de données (compteurs, activités, instruments).
            </p>
          </div>
        </div>
      </div>

      {state.status === "loading" && (
        <div className="animate-pulse space-y-3">
          <div className="h-24 rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          <div className="h-32 rounded-xl bg-neutral-100 dark:bg-neutral-800" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <p className="text-xs">
            <strong>Fondation énergie indisponible</strong> — l&apos;API énergie requiert une session
            authentifiée et une base de données active. Les totaux d&apos;émissions Scope 2 (LB/MB)
            seront calculés dans une tranche ultérieure (PR-06B).
            <span className="block opacity-60">({state.error})</span>
          </p>
        </div>
      )}

      {state.status === "ready" && derived && (
        <div className="space-y-5">
          {/* Bandeau méthodologique : aucun total masqué, aucun calcul ici */}
          <div className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
            <Gauge className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500" aria-hidden />
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              Le Scope 2 se comptabilise dans <strong>deux bases parallèles</strong>. Cette vue présente
              leur fondation ; les <strong>totaux d&apos;émissions</strong> (tCO2e) location-based et
              market-based sont produits par le moteur de calcul dual à venir. Une moyenne pays-average
              n&apos;est <strong>jamais</strong> market-based.
            </p>
          </div>

          {/* Vue duale LB | MB */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Location-based */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Location-based (LB)</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  Facteur moyen de réseau
                </span>
              </div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-neutral-500">Compteurs</dt>
                  <dd className="font-semibold tabular-nums">{state.meters.length}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-neutral-500">Activités de consommation</dt>
                  <dd className="font-semibold tabular-nums">{state.activities.length}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-neutral-500">Consommation cumulée</dt>
                  <dd className="font-semibold tabular-nums">{fmt(derived.consumptionMwh)} MWh</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-neutral-400">
                Base : consommation mesurée × facteur moyen du réseau national/régional.
              </p>
            </div>

            {/* Market-based */}
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4 dark:border-cyan-900/40 dark:bg-cyan-950/20">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-cyan-800 dark:text-cyan-300">Market-based (MB)</h3>
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-medium text-cyan-700">
                  Instruments contractuels
                </span>
              </div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-neutral-500">Instruments</dt>
                  <dd className="font-semibold tabular-nums">{state.instruments.length}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-neutral-500">Volume contractuel</dt>
                  <dd className="font-semibold tabular-nums">{fmt(derived.instrumentVolume)} MWh</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-neutral-500">Couverture allouée</dt>
                  <dd className="font-semibold tabular-nums">{fmt(derived.allocated)} MWh</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-neutral-400">
                Base : instruments (REC/GO/PPA/tarif vert), facteur fournisseur, mix résiduel.
              </p>
            </div>
          </div>

          {/* Alertes de couverture / expiry */}
          {(derived.expiredCount > 0 || derived.pendingCount > 0) && (
            <div className="flex flex-wrap gap-2">
              {derived.expiredCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-700">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  {derived.expiredCount} instrument(s) expiré(s)
                </span>
              )}
              {derived.pendingCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {derived.pendingCount} activité(s) à revoir
                </span>
              )}
            </div>
          )}

          {/* Activités énergie */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Activités de consommation</h3>
            {state.activities.length === 0 ? (
              <EmptyRow label="Aucune activité énergie importée. Importez un CSV (compteur, vecteur, quantité, période)." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-400 dark:bg-neutral-900/60">
                    <tr>
                      <th className="px-3 py-2 font-medium">Période</th>
                      <th className="px-3 py-2 font-medium">Vecteur</th>
                      <th className="px-3 py-2 text-right font-medium">Quantité</th>
                      <th className="px-3 py-2 font-medium">Revue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.activities.slice(0, 12).map((a) => (
                      <tr key={a.id} className="border-t border-neutral-100 dark:border-neutral-800">
                        <td className="px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-300">
                          {a.period_start} → {a.period_end}
                        </td>
                        <td className="px-3 py-2">{CARRIER_LABEL[a.carrier] ?? a.carrier}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmt(a.quantity)} {a.unit}
                        </td>
                        <td className="px-3 py-2">
                          <EnergyReviewBadge status={a.review_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Instruments & couverture */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Instruments contractuels &amp; allocations</h3>
            {state.instruments.length === 0 ? (
              <EmptyRow label="Aucun instrument contractuel enregistré (REC/GO/PPA/tarif vert)." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {state.instruments.slice(0, 6).map((inst) => {
                  const pct = inst.volume_mwh > 0 ? Math.min(100, (inst.allocated_mwh / inst.volume_mwh) * 100) : 0;
                  return (
                    <div
                      key={inst.id}
                      className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <Award className="h-3.5 w-3.5 text-cyan-600" aria-hidden />
                          {INSTRUMENT_LABEL[inst.instrument_type] ?? inst.instrument_type}
                          {inst.reference ? <span className="text-neutral-400">· {inst.reference}</span> : null}
                        </span>
                        {inst.is_expired && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                            <CalendarClock className="h-2.5 w-2.5" aria-hidden />
                            Expiré
                          </span>
                        )}
                      </div>
                      <div className="mb-1 text-[11px] text-neutral-400">
                        {inst.valid_from} → {inst.valid_to} · {CARRIER_LABEL[inst.carrier] ?? inst.carrier}
                        {inst.geography_code ? ` · ${inst.geography_code}` : ""}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <div
                          className={`h-full rounded-full ${inst.is_expired ? "bg-rose-400" : "bg-cyan-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-right text-[11px] tabular-nums text-neutral-500">
                        {fmt(inst.allocated_mwh)} / {fmt(inst.volume_mwh)} MWh alloués
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-3 py-4 text-center text-xs text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900/40">
      {label}
    </div>
  );
}
