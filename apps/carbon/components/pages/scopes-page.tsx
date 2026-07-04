"use client";

/* ════════════════════════════════════════════════════════════════════════════
   Scopes 1-2-3 — Cockpit CarbonCo (refonte)
   Hero empreinte + composition · sélecteur scope (4 tuiles, pilote toutes les vues) ·
   Treemap par catégorie + détail · Tendance mensuelle empilée + trajectoire SBTi ·
   Priorités de réduction (top 5 postes cross-scope). Live via useCarbonSnapshot.
   ════════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

import { monthlyEmissions, scopeDetails } from "@/lib/data";
import { useCarbonSnapshot } from "@/lib/hooks/use-carbon-snapshot";

import {
  ScopesHero, ScopeTiles, AnalysisSection, TrendSection, ReductionPriorities,
  type ScopeData, type ScopeMetaMap, type ScopeSelected, type MonthlyPoint, type ScopeId,
} from "@/components/cockpit/scopes-sections";

/* ─── Métadonnées scope ───────────────────────────────────────────────────── */
const SCOPE_META: ScopeMetaMap = {
  1: { target: 1230, shades: ["#059669", "#10B981", "#34D399", "#6EE7B7"] },
  2: { target: 915,  shades: ["#0891B2", "#06B6D4", "#22D3EE", "#67E8F9"] },
  3: { target: 3540, shades: ["#6D28D9", "#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE"] },
};

const SCOPE_DISPLAY: Record<ScopeId, {
  label: string;
  color: string;
  icon: "factory" | "zap" | "truck";
  share: number;
  sbti: ScopeData["sbti"];
  spark: number[];
}> = {
  1: {
    label: "Émissions directes",
    color: "#34D399",
    icon: "factory",
    share: 22,
    sbti: { status: "ok", text: "−8 % vs SBTi" },
    spark: [148, 142, 150, 132, 126, 120, 116, 118, 128, 132, 138, 145],
  },
  2: {
    label: "Énergie achetée",
    color: "#22D3EE",
    icon: "zap",
    share: 16,
    sbti: { status: "warn", text: "−2 % vs SBTi" },
    spark: [92, 88, 96, 82, 78, 74, 72, 70, 78, 82, 86, 90],
  },
  3: {
    label: "Chaîne de valeur",
    color: "#A78BFA",
    icon: "truck",
    share: 62,
    sbti: { status: "alert", text: "+4 % vs SBTi" },
    spark: [358, 348, 372, 332, 318, 300, 290, 285, 312, 322, 338, 358],
  },
};

const REVENUE_MEUR = 142; // CA en M€ pour l'intensité carbone (cf. design)

/* ─── Composant principal ───────────────────────────────────────────────── */

export function ScopesPage() {
  const [selected, setSelected] = useState<ScopeSelected>("all");
  const [hovered, setHovered] = useState<string | null>(null);
  const snapshot = useCarbonSnapshot();

  const pick = (live: number | null | undefined, fallback: number) =>
    typeof live === "number" && live > 0 ? live : fallback;

  const liveCarbon = snapshot.status === "ready" ? snapshot.data.carbon : null;
  const isLive =
    snapshot.status === "ready" &&
    liveCarbon !== null &&
    (liveCarbon.totalS123Tco2e ?? 0) > 0;

  // ── Scopes data (live override sur le total ; categories démo) ─────────
  const scopes: ScopeData[] = useMemo(() => {
    return ([1, 2, 3] as const).map<ScopeData>((id) => {
      const fallback = scopeDetails[id - 1];
      const display = SCOPE_DISPLAY[id];
      const liveTotal =
        id === 1 ? liveCarbon?.scope1Tco2e
        : id === 2 ? liveCarbon?.scope2LbTco2e
        : liveCarbon?.scope3Tco2e;
      const total = pick(liveTotal, fallback.total);
      return {
        id,
        name: `Scope ${id}`,
        label: display.label,
        total,
        trend: fallback.trend,
        share: display.share,
        color: display.color,
        icon: display.icon,
        sbti: display.sbti,
        spark: display.spark,
        categories: fallback.categories.map((c) => ({ name: c.name, value: c.value })),
      };
    });
  }, [liveCarbon]);

  const total = useMemo(() => scopes.reduce((a, s) => a + s.total, 0), [scopes]);
  const postesCount = useMemo(
    () => scopes.reduce((a, s) => a + s.categories.length, 0),
    [scopes],
  );

  const monthly: MonthlyPoint[] = useMemo(
    () => monthlyEmissions.map((m) => ({ m: m.month, s1: m.scope1, s2: m.scope2, s3: m.scope3 })),
    [],
  );

  return (
    <div className="cc-app">
      <div className="px-6 pt-4 pb-6 space-y-4">
        {/* Top bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl leading-tight">Scopes 1-2-3</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--cc-subtle)] mt-1">
              <span className="cc-live-dot" />
              <span>
                Analyse GHG Protocol · {postesCount} postes · {scopes.length} périmètres
              </span>
            </div>
          </div>
        </div>

        {/* Bandeaux */}
        {snapshot.status === "error" && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0" />
            <p className="text-xs text-[var(--color-foreground-muted)]">
              Impossible de charger le snapshot Carbon en direct — affichage de données d&apos;exemple.{" "}
              <span className="opacity-60">({snapshot.error})</span>
            </p>
          </div>
        )}
        {!isLive && snapshot.status !== "loading" && snapshot.status !== "error" && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
            <Info className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs flex-1">
              <strong>Données de démonstration</strong> — les chiffres affichés sont fictifs.
              Importez votre classeur Excel via{" "}
              <a href="/upload" className="underline font-semibold hover:text-blue-900">
                Import de données
              </a>{" "}
              pour voir vos émissions réelles.
            </p>
          </div>
        )}

        {/* Hero empreinte */}
        <ScopesHero
          scopes={scopes}
          total={total}
          revenue={REVENUE_MEUR}
          postesCount={postesCount}
        />

        {/* Sélecteur de scope (4 tuiles) */}
        <ScopeTiles scopes={scopes} selected={selected} setSelected={setSelected} />

        {/* Treemap + détail par catégorie */}
        <AnalysisSection
          scopes={scopes}
          meta={SCOPE_META}
          selected={selected}
          hovered={hovered}
          setHovered={setHovered}
        />

        {/* Tendance mensuelle + trajectoire SBTi */}
        <TrendSection
          scopes={scopes}
          monthly={monthly}
          selected={selected}
          meta={SCOPE_META}
        />

        {/* Priorités de réduction cross-scope */}
        <ReductionPriorities scopes={scopes} meta={SCOPE_META} total={total} />

        <div className="text-center text-[11px] text-[var(--cc-subtle)] font-mono py-2">
          GHG Protocol Scope 1-2-3 · Facteurs ADEME 2024 · CA {REVENUE_MEUR} M€
        </div>
      </div>
    </div>
  );
}
