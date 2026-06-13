"use client";

/**
 * QualityPanel — widgets de preuve & qualité (T2.6). Lit /quality/indicators :
 * score audit, couverture de pièces, distribution qualité, fraîcheur des facteurs.
 */

import { useEffect, useState } from "react";

import { fetchQualityIndicators, type QualityIndicators } from "@/lib/api";

const QUALITY_LABELS: Record<string, string> = {
  "1": "Mesure primaire",
  "2": "Facture / justificatif",
  "3": "Donnée estimée",
  "4": "Ratio monétaire",
  "5": "Extrapolation",
};

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

export function QualityPanel() {
  const [ind, setInd] = useState<QualityIndicators | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchQualityIndicators(ctrl.signal)
      .then(setInd)
      .catch(() => setFailed(true));
    return () => ctrl.abort();
  }, []);

  if (failed || !ind) return null;

  const coveragePct = Math.round(ind.evidence_coverage * 100);

  return (
    <div className="rounded-2xl border border-neutral-200 p-5" data-testid="quality-panel">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
          Preuve &amp; qualité
        </h3>
        <div className="text-right">
          <span className={`text-3xl font-extrabold tabular-nums ${scoreTone(ind.audit_score)}`}>
            {ind.audit_score}
          </span>
          <span className="text-sm text-neutral-400">/100</span>
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Score audit</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <div className="rounded-xl bg-neutral-50 py-3">
          <p className="text-xl font-bold tabular-nums">{coveragePct}%</p>
          <p className="text-[10px] text-neutral-500">datapoints avec pièce</p>
        </div>
        <div className="rounded-xl bg-neutral-50 py-3">
          <p className="text-xl font-bold tabular-nums">
            {ind.avg_quality === null ? "—" : ind.avg_quality.toFixed(1)}
          </p>
          <p className="text-[10px] text-neutral-500">qualité moyenne (1-5)</p>
        </div>
        <div className="rounded-xl bg-neutral-50 py-3">
          <p className="text-xl font-bold tabular-nums">{ind.total_datapoints}</p>
          <p className="text-[10px] text-neutral-500">datapoints</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {Object.entries(ind.quality_distribution).map(([level, count]) => {
          const pct = ind.total_datapoints ? (count / ind.total_datapoints) * 100 : 0;
          return (
            <div key={level} className="flex items-center gap-2 text-xs">
              <span className="w-32 shrink-0 text-neutral-500">{QUALITY_LABELS[level]}</span>
              <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div className="h-full bg-neutral-700" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-6 text-right tabular-nums text-neutral-600">{count}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] text-neutral-400">
        Facteurs : {ind.fe_versions.length ? ind.fe_versions.join(", ") : "—"} ·
        Chaîne : {ind.chain_ok ? "intègre" : "rompue"} ·{" "}
        <a href="/methodologie" className="underline hover:text-neutral-600">
          formule du score
        </a>
      </p>
    </div>
  );
}
