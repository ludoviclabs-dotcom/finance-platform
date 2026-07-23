"use client";

/* ════════════════════════════════════════════════════════════════════════════
   Tableau de bord ESG — Cockpit CarbonCo (refonte)
   Hero trajectoire + score conformité · scopes expandables · NEURAL unifié ·
   répartition + benchmark · ESRS heat + activité + sources · drawer copilote.
   ════════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Info } from "lucide-react";

import { SkeletonCard, SkeletonChart, SkeletonRow } from "@/components/ui/skeleton";
import { KpiProvenanceDrawer } from "@/components/ui/kpi-provenance-drawer";
import { AuditModeBanner } from "@/components/ui/audit-mode-toggle";
import { ReviewStatusBadge } from "@/components/ui/review-status-badge";
import { useAuditMode } from "@/lib/hooks/use-audit-mode";
import { useReviewStatusBatch } from "@/lib/hooks/use-review-status";
import { useConsolidatedSnapshot } from "@/lib/hooks/use-consolidated-snapshot";
import { ResourcesAccessCard } from "@/components/dashboard/resources-access-card";
import { ChainBadge } from "@/components/ui/chain-badge";
import { QualityPanel } from "@/components/ui/quality-panel";
import { Scope3Panel } from "@/components/ui/scope3-panel";

import { monthlyEmissions, scopeDetails, recentActivity } from "@/lib/data";
import { pageVariants } from "@/lib/animations";

import {
  Hero, ScopeStrip, NeuralPanel, AnalyticsRow, BridgeRow, SourcesRow, CopilotDrawer, RegBanner,
  type ScopeRow, type NeuralItem, type Suggestion, type Benchmark,
  type EsrsState, type ActivityRow, type Connector, type Deadline,
} from "@/components/cockpit/cockpit-sections";
import type { ScopesOn, MonthPoint, WaterfallStep } from "@/components/cockpit/cockpit-charts";

/* ─── Données statiques pour le cockpit (rejouent celles de la maquette) ── */
/* Objectif SBTi 2030 : −42 % vs la base 2023 du bridge (11 200 tCO₂e). */
const TARGET_EMISSIONS = 6500;

const SCOPE_META: Record<1 | 2 | 3, {
  desc: string;
  color: string;
  icon: ScopeRow["icon"];
  label: string;
  share: number;
  sbti: ScopeRow["sbti"];
  spark: number[];
}> = {
  1: {
    desc: "Combustion fixe, flotte véhicules, réfrigérants, procédés",
    color: "#34D399",
    icon: "factory",
    label: "Émissions directes",
    share: 13,
    sbti: { status: "ok", text: "SBTi ✓ on-track" },
    spark: [112, 107, 121, 102, 97, 93, 88, 91, 100, 104, 110, 115],
  },
  2: {
    desc: "Électricité, chauffage urbain, vapeur",
    color: "#22D3EE",
    icon: "zap",
    label: "Énergie achetée",
    share: 9,
    sbti: { status: "warn", text: "SBTi ⚠ à surveiller" },
    spark: [81, 78, 86, 74, 71, 69, 67, 65, 71, 72, 76, 80],
  },
  3: {
    desc: "Achats, transport amont/aval, déplacements, déchets, usage produits",
    color: "#A78BFA",
    icon: "truck",
    label: "Chaîne de valeur",
    share: 78,
    sbti: { status: "alert", text: "SBTi ✗ hors-piste" },
    spark: [685, 654, 725, 624, 594, 564, 544, 534, 584, 604, 634, 674],
  },
};

/* Bridge 2023 → 2025 (maquette) : 11 200 − 1 250 − 680 − 520 − 100 + 900 = 9 550. */
const WATERFALL: WaterfallStep[] = [
  { label: "Base 2023",       value: 11200, kind: "base"  },
  { label: "Énergie verte",   value: -1250, kind: "delta" },
  { label: "Efficacité",      value:  -680, kind: "delta" },
  { label: "Fret optimisé",   value:  -520, kind: "delta" },
  { label: "Mix produit",     value:  -100, kind: "delta" },
  { label: "Croissance",      value:   900, kind: "delta" },
  { label: "Total 2025",      value:     0, kind: "total" },
];

const ESRS_DATA: EsrsState = {
  score: 62,
  target: 80,
  compliant: 8,
  inProgress: 3,
  notStarted: 1,
  radial: [
    { k: "E1", label: "Climat",        v: 85 },
    { k: "E2", label: "Pollution",     v: 72 },
    { k: "E3", label: "Eau",           v: 60 },
    { k: "E4", label: "Biodiv.",       v: 45 },
    { k: "E5", label: "Écon. circ.",   v: 55 },
    { k: "S1", label: "Effectifs",     v: 90 },
    { k: "S2", label: "Chaîne val.",   v: 40 },
    { k: "S3", label: "Communautés",   v: 30 },
    { k: "S4", label: "Consomm.",      v: 35 },
    { k: "G1", label: "Gouvernance",   v: 78 },
  ],
};

const BENCHMARK_DATA: Benchmark = {
  intensity: { you: 42, sector: 58 },
  radar: [
    { axis: "Scope 1", you: 13, sector: 30 },
    { axis: "Scope 2", you:  9, sector: 25 },
    { axis: "Scope 3", you: 78, sector: 45 },
    { axis: "ESRS",    you: 62, sector: 48 },
    { axis: "Énergie", you: 74, sector: 60 },
  ],
  rows: [
    { label: "Intensité carbone", you: "42",   sector: "58",   status: "top",  tag: "Top 25 %" },
    { label: "Part Scope 3",      you: "78 %", sector: "45 %", status: "warn", tag: "À améliorer" },
  ],
};

const NEURAL_ITEMS: NeuralItem[] = [
  {
    id: "opp-1", type: "opportunité",
    title: "78 % du Scope 3 vient des achats",
    desc: "Lancer un questionnaire fournisseurs ciblé sur les 5 postes majeurs.",
    metric: "−1 240", metricLabel: "tCO₂e potentiel",
    cta: "Lancer le questionnaire", time: "il y a 2 h",
  },
  {
    id: "act-1", type: "action",
    title: "Contrat d'électricité verte",
    desc: "Basculer 3 sites sur un PPA renouvelable réduirait le Scope 2 de 40 %.",
    metric: "−356", metricLabel: "tCO₂e / an",
    cta: "Voir le plan d'action", time: "il y a 5 h",
  },
  {
    id: "comp-1", type: "compliance",
    title: "ESRS E1-6 — Données manquantes",
    desc: "Divulgation Scope 3 cat. 11 (utilisation des produits vendus) non complétée.",
    metric: "1", metricLabel: "point à compléter", cta: "Compléter", time: "il y a 1 j",
  },
];

const SUGGESTIONS: Suggestion[] = [
  {
    id: 1, title: "Optimiser la flotte véhicules", impact: "high",
    saving: "−114 tCO₂e/an", scope: "Scope 1",
    desc: "Remplacer 30 % de la flotte diesel par des véhicules électriques.",
  },
  {
    id: 2, title: "Contrat énergie verte", impact: "high",
    saving: "−40 % Scope 2", scope: "Scope 2",
    desc: "Passer à un fournisseur 100 % renouvelable sur 5 sites principaux.",
  },
  {
    id: 3, title: "Politique télétravail", impact: "medium",
    saving: "−85 tCO₂e/an", scope: "Scope 3",
    desc: "2 jours/semaine de télétravail réduiraient les déplacements domicile-travail.",
  },
];

const CONNECTORS: Connector[] = [
  { id: "sap",        label: "ERP / SAP",         status: "connected", glyph: "SAP" },
  { id: "gsuite",     label: "Google Workspace",  status: "idle",      glyph: "GW"  },
  { id: "accounting", label: "Comptabilité",      status: "idle",      glyph: "€"   },
  { id: "fleet",      label: "Fleet Manager",     status: "idle",      glyph: "FM"  },
  { id: "cloud",      label: "AWS / Azure / GCP", status: "idle",      glyph: "☁"   },
  { id: "csv",        label: "Import CSV",        status: "idle",      glyph: "CSV" },
];

const DEADLINES: Deadline[] = [
  { label: "Rapport ESRS E1",   days: 15, level: "warn"  },
  { label: "Dépôt CSRD (iXBRL)", days: 45, level: "alert" },
  { label: "Revue auditeur Q2",  days: 68, level: "info"  },
];

/* ─── Composant principal ───────────────────────────────────────────────── */
export function DashboardPage() {
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [scopesOn, setScopesOn] = useState<ScopesOn>({ s1: true, s2: true, s3: true });

  const consolidated = useConsolidatedSnapshot();
  const loading = consolidated.status === "loading";
  const carbonError = consolidated.status === "error" ? consolidated.error : null;

  // Live data avec fallback démo
  const liveCarbon = consolidated.status === "ready" ? consolidated.data.carbon : null;
  const liveCompanyName =
    consolidated.status === "ready" &&
    consolidated.data.company.name &&
    consolidated.data.company.name !== "Entreprise non renseignee"
      ? consolidated.data.company.name
      : null;

  const pick = (live: number | null | undefined, fallback: number) =>
    typeof live === "number" && live > 0 ? live : fallback;

  const scope1Value = pick(liveCarbon?.scope1Tco2e,   scopeDetails[0].total);
  const scope2Value = pick(liveCarbon?.scope2LbTco2e, scopeDetails[1].total);
  const scope3Value = pick(liveCarbon?.scope3Tco2e,   scopeDetails[2].total);
  const totalValue = pick(
    liveCarbon?.totalS123Tco2e,
    scope1Value + scope2Value + scope3Value,
  );

  const isLive =
    consolidated.status === "ready" &&
    liveCarbon !== null &&
    (liveCarbon.totalS123Tco2e ?? 0) > 0;

  // ESG score (live ou démo)
  const liveEsg = consolidated.status === "ready" ? consolidated.data.esg : null;
  const esrsState: EsrsState = {
    ...ESRS_DATA,
    score: typeof liveEsg?.scoreGlobal === "number" && Number.isFinite(liveEsg.scoreGlobal)
      ? Math.round(liveEsg.scoreGlobal)
      : ESRS_DATA.score,
  };

  // Trend total
  const deltaTotalCo2 = consolidated.status === "ready" ? consolidated.data.deltas?.totalS123Tco2ePct ?? null : null;

  // Provenance & audit
  const { enabled: auditModeEnabled } = useAuditMode();
  const { byCode: reviewByCode } = useReviewStatusBatch([
    "CC.GES.TOTAL_S123",
    "CC.GES.SCOPE1",
    "CC.GES.SCOPE2_LB",
    "CC.GES.SCOPE3",
  ]);
  const [provenance, setProvenance] = useState<{ code: string; label: string; unit: string } | null>(null);

  // Skeleton
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-7 w-72 bg-[var(--color-surface-raised)] rounded-lg animate-pulse mb-1" />
        <div className="h-3 w-48 bg-[var(--color-surface-raised)] rounded-full animate-pulse opacity-60" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonChart height={280} />
          <SkeletonChart height={280} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 animate-pulse space-y-2">
            <div className="h-3 w-32 bg-[var(--color-surface-raised)] rounded-full mb-4" />
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 animate-pulse space-y-3">
            <div className="h-3 w-32 bg-[var(--color-surface-raised)] rounded-full mb-4" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-[var(--color-surface-raised)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Données dérivées pour les composants cockpit ─────────────────────
  const monthly: MonthPoint[] = monthlyEmissions.map((m) => ({
    m: m.month, s1: m.scope1, s2: m.scope2, s3: m.scope3,
  }));

  const scopes: ScopeRow[] = [
    {
      id: 1, name: "Scope 1", total: scope1Value,
      trend: scopeDetails[0].trend,
      categories: scopeDetails[0].categories.map((c) => ({ name: c.name, value: c.value })),
      ...SCOPE_META[1],
    },
    {
      id: 2, name: "Scope 2", total: scope2Value,
      trend: scopeDetails[1].trend,
      categories: scopeDetails[1].categories.map((c) => ({ name: c.name, value: c.value })),
      ...SCOPE_META[2],
    },
    {
      id: 3, name: "Scope 3", total: scope3Value,
      trend: scopeDetails[2].trend,
      categories: scopeDetails[2].categories.map((c) => ({ name: c.name, value: c.value })),
      ...SCOPE_META[3],
    },
  ];

  const activity: ActivityRow[] = recentActivity.map((a) => ({
    id: a.id, type: a.type, title: a.title, desc: a.description, time: a.time,
  }));

  const companyName = liveCompanyName ?? "Exemplia Industrie";

  return (
    <motion.div {...pageVariants} className="cc-app space-y-0">
      <div className="px-6 pt-4 pb-6 space-y-4">

        {/* Chaîne d'intégrité (ouvre le cockpit, comme la maquette) */}
        <ChainBadge />

        {/* Bandeau réglementaire EFRAG */}
        <RegBanner
          note={{ src: "EFRAG", date: "15/03/26", text: "Nouvelles guidelines ESRS E1-6 · Scope 3 cat. 15 précisé." }}
        />

        {/* Bandeau erreur API Carbon (préserve les diagnostics existants) */}
        {carbonError && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0" />
            <p className="text-xs text-[var(--color-foreground-muted)]">
              Impossible de charger le snapshot Carbon en direct — affichage de données d&apos;exemple.{" "}
              <span className="opacity-60">({carbonError})</span>
            </p>
          </div>
        )}

        {/* Démo : bandeau discret au thème du cockpit (la maquette n'a pas de
            bandeau clair ici ; la mention reste, elle, obligatoire). */}
        {!isLive && !carbonError && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-2)] px-3.5 py-2.5">
            <Info className="h-4 w-4 flex-shrink-0 text-[var(--cc-blue)]" />
            <p className="flex-1 text-xs text-[var(--cc-muted)]">
              <strong className="text-[var(--cc-fg)]">Données de démonstration</strong> — chiffres
              fictifs. Pour vos données réelles, importez votre classeur via{" "}
              <a href="/upload" className="font-semibold underline text-[var(--cc-em)]">Import de données</a>.
            </p>
          </div>
        )}

        {/* Bandeau audit-mode */}
        <AuditModeBanner />

        {/* Hero : trajectoire + score conformité
            (pas de titre in-content : la barre supérieure porte déjà
            « Tableau de bord · Vue d'ensemble ESG », comme dans la maquette) */}
        <Hero
          totalEmissions={totalValue}
          target2025={TARGET_EMISSIONS}
          monthly={monthly}
          esrs={esrsState}
          scopesOn={scopesOn}
          setScopesOn={setScopesOn}
          deltaPct={deltaTotalCo2 ?? -5.8}
        />

        {/* Strip scopes */}
        <ScopeStrip scopes={scopes} />

        {/* Badges review en mode audit (préserve la fonctionnalité existante) */}
        {auditModeEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { code: "CC.GES.TOTAL_S123", label: "Total S1+S2+S3" },
              { code: "CC.GES.SCOPE1",     label: "Scope 1" },
              { code: "CC.GES.SCOPE2_LB",  label: "Scope 2 (LB)" },
              { code: "CC.GES.SCOPE3",     label: "Scope 3" },
            ].map(({ code, label }) => {
              const review = reviewByCode[code];
              return (
                <div key={code} className="cc-card px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--color-foreground-muted)]">{label}</span>
                    <button
                      onClick={() => setProvenance({ code, label, unit: "tCO₂e" })}
                      className="text-[11px] inline-flex items-center gap-1 text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground)]"
                    >
                      <Info className="w-3 h-3" />
                      <span className="underline underline-offset-2 decoration-dotted">Voir la provenance</span>
                    </button>
                  </div>
                  {review && <ReviewStatusBadge status={review.status} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Donut + radar benchmark */}
        <AnalyticsRow scopes={scopes} benchmark={BENCHMARK_DATA} />

        {/* Preuve & qualité (score audit, couverture de pièces, méthodes) */}
        <QualityPanel />

        {/* Bridge des leviers 2023 → 2025 + heatmap ESRS (cf. maquette) */}
        <BridgeRow esrs={esrsState} waterfall={WATERFALL} />

        {/* Scope 3 par catégorie (15 postes, filtrable) */}
        <Scope3Panel />

        {/* NEURAL unifié — clôt la séquence de la maquette */}
        <NeuralPanel
          items={NEURAL_ITEMS}
          suggestions={SUGGESTIONS}
          onOpenCopilot={() => setCopilotOpen(true)}
        />

        {/* Hors maquette, conservés : activité, connecteurs/échéances, accès
            au module Ressources stratégiques. */}
        <SourcesRow activity={activity} connectors={CONNECTORS} deadlines={DEADLINES} />

        <ResourcesAccessCard />

        <div className="text-center text-[11px] text-[var(--color-foreground-subtle)] font-mono py-2">
          {companyName} · données de démonstration, chiffres fictifs
        </div>
      </div>

      {/* Drawer copilote (slide-in droit) */}
      <CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} />

      {/* Drawer provenance (préservé) */}
      <KpiProvenanceDrawer
        open={provenance !== null}
        onClose={() => setProvenance(null)}
        code={provenance?.code ?? ""}
        label={provenance?.label ?? ""}
        unit={provenance?.unit}
      />
    </motion.div>
  );
}
