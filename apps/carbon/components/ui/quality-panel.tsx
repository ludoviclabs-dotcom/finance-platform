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
 * Repli démonstration : si le backend est injoignable OU s'il répond pour un
 * tenant VIDE (0 datapoint — cas de la vitrine, où aucun classeur n'a été
 * importé), jeu FICTIF clairement étiqueté plutôt qu'un panneau à zéro. Sans ce
 * repli, le cockpit affichait « 0 % / — / 0 » à côté de sections nourries par les
 * données de démonstration : incohérence visible vs la maquette.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

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

/** Jeu fictif calé sur la maquette « Refonte CarbonCo » (Σ distribution = total). */
const DEMO_QUALITY: QualityIndicators = {
  total_datapoints: 12840,
  with_evidence: 5650,
  evidence_coverage: 0.44,
  quality_distribution: { "1": 2820, "2": 4180, "3": 3260, "4": 1980, "5": 600 },
  avg_quality: 2.4,
  fe_versions: ["ADEME v2025", "DEFRA v2025"],
  chain_ok: true,
  open_anomalies: 0,
  audit_score: 52,
};

/** Un tenant sans aucun datapoint ne « vaut » pas 0 % de couverture : il n'a
 * simplement rien à mesurer. On bascule alors sur le jeu de démonstration. */
function isEmpty(ind: QualityIndicators): boolean {
  return ind.total_datapoints === 0;
}

/** Bande du score audit (plus haut = mieux) — inverse du risque. Toujours affichée
 * avec son libellé à côté de la jauge. */
function auditBand(score: number): { color: string; label: string } {
  if (score >= 80) return { color: BAND_HEX.low, label: "Socle solide" };
  // Seuil médian à 50 (et non 60) : la maquette qualifie un score de 52
  // « À renforcer », pas « Socle fragile ».
  if (score >= 50) return { color: BAND_HEX.moderate, label: "À renforcer" };
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

  const live = ind && !isEmpty(ind) ? ind : null;
  const display = live ?? (ind || failed ? DEMO_QUALITY : null);
  if (!display) return null;
  const isDemo = live === null;

  const coveragePct = Math.round(display.evidence_coverage * 100);
  const band = auditBand(display.audit_score);
  const maxCount = Math.max(1, ...Object.values(display.quality_distribution));

  return (
    <div className="cc-card px-[22px] py-5" data-testid="quality-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="cc-eyebrow">
          <ShieldCheck className="h-3.5 w-3.5" /> Preuve &amp; qualité
        </h3>
        {isDemo && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
            Démo — données fictives
          </span>
        )}
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

        <div className="grid flex-1 grid-cols-3 gap-3">
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
            context="/ 5"
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
              <span className="w-12 text-right font-mono text-[11px] tabular-nums text-[var(--color-foreground-muted)]">
                {new Intl.NumberFormat("fr-FR").format(count)}
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
