"use client";

/* ════════════════════════════════════════════════════════════════════════════
   Scopes 1-2-3 — Cockpit CarbonCo (refonte)
   Hero empreinte + composition · sélecteur scope (4 tuiles, pilote toutes les vues) ·
   Treemap par catégorie + détail · Tendance mensuelle empilée + trajectoire SBTi ·
   Priorités de réduction (top 5 postes cross-scope). Live via useCarbonSnapshot.

   Règle (rapport QA 16/09/2026) : un chiffre affiché comme réel vient de l'API.
   Sans import, le jeu de démonstration est affiché ET signalé comme tel ; avec
   un import, les vues qui exigent un détail absent du snapshot (postes,
   historique mensuel, cibles SBTi par scope) affichent un emplacement neutre —
   jamais des valeurs de la maquette mêlées aux totaux réels.
   ════════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Info, Layers } from "lucide-react";

import { monthlyEmissions, scopeDetails } from "@/lib/data";
import { useCarbonSnapshot } from "@/lib/hooks/use-carbon-snapshot";
import { EnergyScope2Panel } from "@/components/energy/energy-scope2-panel";
import { Scope2EnginePanel } from "@/components/energy/scope2-engine-panel";

import {
  ScopesHero, ScopeTiles, AnalysisSection, TrendSection, ReductionPriorities,
  type ScopeData, type ScopeMetaMap, type ScopeSelected, type MonthlyPoint, type ScopeId,
} from "@/components/cockpit/scopes-sections";

/* ─── Métadonnées scope ───────────────────────────────────────────────────── */
/* Cibles et teintes du jeu de DÉMONSTRATION (maquette). */
const SCOPE_META: ScopeMetaMap = {
  1: { target: 1230, shades: ["#059669", "#10B981", "#34D399", "#6EE7B7"] },
  2: { target: 915,  shades: ["#0891B2", "#06B6D4", "#22D3EE", "#67E8F9"] },
  3: { target: 3540, shades: ["#6D28D9", "#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE"] },
};

const SCOPE_DISPLAY: Record<ScopeId, {
  label: string;
  color: string;
  icon: "factory" | "zap" | "truck";
  demoShare: number;
  demoSbti: ScopeData["sbti"];
  demoSpark: number[];
}> = {
  1: {
    label: "Émissions directes",
    color: "#34D399",
    icon: "factory",
    demoShare: 22,
    demoSbti: { status: "ok", text: "−8 % vs SBTi" },
    demoSpark: [148, 142, 150, 132, 126, 120, 116, 118, 128, 132, 138, 145],
  },
  2: {
    label: "Énergie achetée",
    color: "#22D3EE",
    icon: "zap",
    demoShare: 16,
    demoSbti: { status: "warn", text: "−2 % vs SBTi" },
    demoSpark: [92, 88, 96, 82, 78, 74, 72, 70, 78, 82, 86, 90],
  },
  3: {
    label: "Chaîne de valeur",
    color: "#A78BFA",
    icon: "truck",
    demoShare: 62,
    demoSbti: { status: "alert", text: "+4 % vs SBTi" },
    demoSpark: [358, 348, 372, 332, 318, 300, 290, 285, 312, 322, 338, 358],
  },
};

const DEMO_REVENUE_MEUR = 142; // CA fictif du jeu de démonstration (cf. maquette)
const DEMO_DELTA_PCT = -5.8;

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/* ─── Composant principal ───────────────────────────────────────────────── */

export function ScopesPage() {
  const [selected, setSelected] = useState<ScopeSelected>("all");
  const [hovered, setHovered] = useState<string | null>(null);
  const snapshot = useCarbonSnapshot();

  const live = snapshot.status === "ready" ? snapshot.data : null;
  const isLive = live !== null && (live.carbon.totalS123Tco2e ?? 0) > 0;
  const noImport = snapshot.status === "error" && snapshot.empty;
  const loadFailed = snapshot.status === "error" && !snapshot.empty;

  // ── Données : totaux réels OU jeu de démonstration, jamais un mélange ────
  const scopes: ScopeData[] = useMemo(() => {
    const liveTotals: Record<ScopeId, number> = {
      1: live?.carbon.scope1Tco2e ?? 0,
      2: live?.carbon.scope2LbTco2e ?? 0,
      3: live?.carbon.scope3Tco2e ?? 0,
    };
    const liveSum = liveTotals[1] + liveTotals[2] + liveTotals[3];
    return ([1, 2, 3] as const).map<ScopeData>((id) => {
      const demo = scopeDetails[id - 1];
      const display = SCOPE_DISPLAY[id];
      if (isLive) {
        const total = liveTotals[id];
        return {
          id,
          name: `Scope ${id}`,
          label: display.label,
          total,
          trend: 0,
          share: liveSum > 0 ? Math.round((total / liveSum) * 100) : 0,
          color: display.color,
          icon: display.icon,
          sbti: { status: "none", text: "Trajectoire non renseignée" },
          spark: [],
          categories: total > 0 ? [{ name: `Total ${display.label.toLowerCase()}`, value: total }] : [],
        };
      }
      return {
        id,
        name: `Scope ${id}`,
        label: display.label,
        total: demo.total,
        trend: demo.trend,
        share: display.demoShare,
        color: display.color,
        icon: display.icon,
        sbti: display.demoSbti,
        spark: display.demoSpark,
        categories: demo.categories.map((c) => ({ name: c.name, value: c.value })),
      };
    });
  }, [live, isLive]);

  const total = useMemo(() => scopes.reduce((a, s) => a + s.total, 0), [scopes]);
  const postesCount = useMemo(
    () => scopes.reduce((a, s) => a + s.categories.length, 0),
    [scopes],
  );

  const monthly: MonthlyPoint[] = useMemo(
    () => monthlyEmissions.map((m) => ({ m: m.month, s1: m.scope1, s2: m.scope2, s3: m.scope3 })),
    [],
  );

  const revenueMeur = isLive
    ? (positive(live?.company.revenueNetEur) ?? 0) / 1_000_000 || null
    : DEMO_REVENUE_MEUR;

  return (
    <div className="cc-app">
      <div className="px-6 pt-4 pb-6 space-y-4">
        {/* Top bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl leading-tight">Scopes 1-2-3</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--cc-subtle)] mt-1">
              {isLive && <span className="cc-live-dot" />}
              <span>
                {isLive
                  ? `Bilan importé${live?.company.reportingYear ? ` · exercice ${live.company.reportingYear}` : ""} · GHG Protocol`
                  : `Démonstration · ${postesCount} postes · ${scopes.length} périmètres`}
              </span>
            </div>
          </div>
        </div>

        {/* Bandeaux */}
        {loadFailed && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0" />
            <p className="text-xs text-[var(--color-foreground-muted)]">
              {snapshot.error} Les chiffres ci-dessous sont des données de démonstration.
            </p>
          </div>
        )}
        {!isLive && !loadFailed && snapshot.status !== "loading" && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
            <Info className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs flex-1">
              <strong>Données de démonstration</strong> — les chiffres affichés sont fictifs.{" "}
              {noImport ? "Votre organisation n'a pas encore importé de bilan. " : ""}
              Importez votre classeur Excel via{" "}
              <Link href="/upload" className="underline font-semibold hover:text-blue-900">
                Import de données
              </Link>{" "}
              pour voir vos émissions réelles.
            </p>
          </div>
        )}

        {/* Hero empreinte */}
        <ScopesHero
          scopes={scopes}
          total={total}
          revenue={revenueMeur}
          intensity={isLive ? live?.carbon.intensityRevenueTco2ePerMEur ?? null : undefined}
          deltaPct={isLive ? undefined : DEMO_DELTA_PCT}
          postesCount={isLive ? undefined : postesCount}
        />

        {/* Sélecteur de scope (4 tuiles) */}
        <ScopeTiles scopes={scopes} selected={selected} setSelected={setSelected} />

        {isLive ? (
          <section className="cc-card p-5 flex items-start gap-3">
            <Layers className="w-5 h-5 text-[var(--cc-subtle)] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[var(--cc-muted)] space-y-1">
              <p className="font-semibold text-[var(--cc-text,inherit)]">
                Détail par poste, tendance mensuelle et trajectoire SBTi
              </p>
              <p>
                Le bilan importé fournit les totaux par scope (Scope 2 en « location-based » dans
                le total, conformément à la méthode BEGES). Le détail par poste s&apos;affiche avec
                l&apos;analyse Scope 3 par catégorie, et la trajectoire dès que vos objectifs de
                réduction sont renseignés : aucune valeur d&apos;exemple n&apos;est mêlée à vos
                chiffres.
              </p>
            </div>
          </section>
        ) : (
          <>
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
          </>
        )}

        {/* Énergie & Scope 2 dual — fondation PR-06A (BETA) */}
        <EnergyScope2Panel />

        {/* Moteur de calcul Scope 2 dual — totaux LB/MB + trace PR-06B (BETA) */}
        <Scope2EnginePanel />

        <div className="text-center text-[11px] text-[var(--cc-subtle)] font-mono py-2">
          {isLive
            ? `GHG Protocol · Scope 2 location-based dans le total${revenueMeur ? ` · CA ${revenueMeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€` : ""}`
            : "Jeu de démonstration — chiffres fictifs"}
        </div>
      </div>
    </div>
  );
}
