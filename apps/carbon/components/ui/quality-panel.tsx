"use client";

/**
 * QualityPanel — preuve & qualité (T2.6). Lit /quality/indicators : score audit,
 * couverture de pièces, distribution qualité, fraîcheur des facteurs.
 *
 * Refonte visuelle (thème sombre du cockpit) : jauge de score audit colorée par
 * bande, chiffres-clés animés, barres de méthode colorées par palier de qualité
 * (mesure primaire → extrapolation). Tout est branché sur les champs RÉELS de
 * `QualityIndicators` — aucune tendance ni delta (aucune série n'existe).
 *
 * Repli démonstration : si le backend est injoignable (vitrine sans base Neon),
 * jeu FICTIF clairement étiqueté plutôt que de disparaître.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { RadialGauge } from "@/components/resources/viz/radial-gauge";
import { StatTile } from "@/components/resources/viz/stat-tile";
import { BAND_HEX } from "@/lib/resources-viz";
import { fetchQualityIndicators, type QualityIndicators } from "@/lib/api";

const QUALITY_LABELS: Record<string, string> = {
  "1": "Mesure primaire",
  "2": "Facture / justificatif",
  "3": "Donnée estimée",
  "4": "Ratio monétaire",
  "5": "Extrapolation",
};

/** Palier de qualité 1 (meilleur) → 5 (extrapolation) : grade vert → rouge.
 * Couleur SUPPLÉMENTAIRE au libellé + à la longueur de barre (jamais seule). */
const QUALITY_COLOR: Record<string, string> = {
  "1": "#34D399",
  "2": "#A3E635",
  "3": "#FBBF24",
  "4": "#FB923C",
  "5": "#F87171",
};

/** Jeu fictif cohérent (Σ distribution = total = 127). */
const DEMO_QUALITY: QualityIndicators = {
  total_datapoints: 127,
  with_evidence: 57,
  evidence_coverage: 0.45,
  quality_distribution: { "1": 12, "2": 45, "3": 38, "4": 24, "5": 8 },
  avg_quality: 2.6,
  fe_versions: ["v2025"],
  chain_ok: true,
  open_anomalies: 0,
  audit_score: 72,
};

/** Bande du score audit (plus haut = mieux) — inverse du risque. Toujours affichée
 * avec son libellé à côté de la jauge. */
function auditBand(score: number): { color: string; label: string } {
  if (score >= 80) return { color: BAND_HEX.low, label: "Socle solide" };
  if (score >= 60) return { color: BAND_HEX.moderate, label: "À renforcer" };
  return { color: BAND_HEX.severe, label: "Socle fragile" };
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

  const display = ind ?? (failed ? DEMO_QUALITY : null);
  if (!display) return null;
  const isDemo = !ind && failed;

  const coveragePct = Math.round(display.evidence_coverage * 100);
  const band = auditBand(display.audit_score);
  const maxCount = Math.max(1, ...Object.values(display.quality_distribution));

  return (
    <div
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      data-testid="quality-panel"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Preuve &amp; qualité
          </h3>
          {isDemo && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
              Démo — données fictives
            </span>
          )}
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <RadialGauge
            value={display.audit_score}
            size={92}
            stroke={9}
            color={band.color}
            bandLabel={band.label}
            ariaTitle="Score audit"
            testId="quality-audit-gauge"
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Score audit
            </p>
            <p className="text-sm font-semibold" style={{ color: band.color }}>
              {band.label}
            </p>
            <a
              href="/methodologie"
              className="text-[11px] text-[var(--color-muted-foreground)] underline hover:text-[var(--color-foreground)]"
            >
              formule du score
            </a>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2">
          <StatTile
            testId="quality-kpi-coverage"
            label="Avec pièce"
            value={coveragePct}
            suffix=" %"
          />
          <StatTile
            testId="quality-kpi-avg"
            label="Qualité moy."
            value={display.avg_quality}
            decimals={1}
            context="sur 5"
          />
          <StatTile
            testId="quality-kpi-total"
            label="Datapoints"
            value={display.total_datapoints}
          />
        </div>
      </div>

      <div className="space-y-1.5" data-testid="quality-method-bars">
        {Object.entries(display.quality_distribution).map(([level, count]) => {
          const pct = (count / maxCount) * 100;
          return (
            <div
              key={level}
              className="flex items-center gap-2 text-xs"
              aria-label={`${QUALITY_LABELS[level]} : ${count} datapoints`}
            >
              <span className="w-36 shrink-0 text-[var(--color-muted-foreground)]">
                {QUALITY_LABELS[level]}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-raised)]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: QUALITY_COLOR[level] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
              <span className="w-6 text-right tabular-nums text-[var(--color-foreground-muted)]">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] text-[var(--color-foreground-subtle)]">
        Facteurs : {display.fe_versions.length ? display.fe_versions.join(", ") : "—"} · Chaîne :{" "}
        {display.chain_ok ? "intègre" : "rompue"}
      </p>
    </div>
  );
}
