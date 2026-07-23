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
  Hero, ScopeStrip, NeuralPanel, AnalyticsRow, FooterRow, CopilotDrawer, RegBanner,
  type ScopeRow, type NeuralItem, type Suggestion, type Benchmark,
  type EsrsState, type ActivityRow, type Connector, type Deadline,
} from "@/components/cockpit/cockpit-sections";
import type { ScopesOn, MonthPoint } from "@/components/cockpit/cockpit-charts";

/* ─── Données statiques pour le cockpit (rejouent celles de la maquette) ── */
const TARGET_EMISSIONS = 5200;

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
    share: 22,
    sbti: { status: "ok", text: "−8 % vs trajectoire SBTi" },
    spark: [148, 142, 150, 132, 126, 120, 116, 118, 128, 132, 138, 145],
  },
  2: {
    desc: "Électricité, chauffage urbain, vapeur",
    color: "#22D3EE",
    icon: "zap",
    label: "Énergie achetée",
    share: 16,
    sbti: { status: "warn", text: "−2 % vs trajectoire SBTi" },
    spark: [92, 88, 96, 82, 78, 74, 72, 70, 78, 82, 86, 90],
  },
  3: {
    desc: "Achats, transport amont/aval, déplacements, déchets, usage produits",
    color: "#A78BFA",
    icon: "truck",
    label: "Chaîne de valeur",
    share: 62,
    sbti: { status: "alert", text: "+4 % vs trajectoire SBTi" },
    spark: [358, 348, 372, 332, 318, 300, 290, 285, 312, 322, 338, 358],
  },
};

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
    { k: "E4", label: "Biodiversité",  v: 45 },
    { k: "E5", label: "Circulaire",    v: 55 },
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
    { axis: "Scope 1", you: 22, sector: 30 },
    { axis: "Scope 2", you: 16, sector: 25 },
    { axis: "Scope 3", you: 62, sector: 45 },
    { axis: "ESRS",    you: 62, sector: 48 },
    { axis: "Énergie", you: 74, sector: 60 },
  ],
  rows: [
    { label: "Intensité carbone", you: "42 tCO₂e/M€", sector: "58 tCO₂e/M€", status: "top",  tag: "Top 25 %" },
    { label: "Part Scope 3",      you: "62 %",        sector: "45 %",        status: "warn", tag: "À améliorer" },
    { label: "Conformité ESRS",   you: "62/100",      sector: "48/100",      status: "top",  tag: "Top 25 %" },
  ],
};

const NEURAL_ITEMS: NeuralItem[] = [
  {
    id: "anom-1", type: "anomalie",
    title: "Pic d'émissions Scope 2 détecté",
    desc: "Électricité +34 % en mars vs février — corrélé avec la mise en route de la ligne 4.",
    metric: "+34 %", metricLabel: "Scope 2", cta: "Analyser", time: "8 min",
  },
  {
    id: "opp-1", type: "opportunité",
    title: "Optimisation Scope 1 — Flotte véhicules",
    desc: "3 véhicules éligibles à l'électrification. ROI estimé 18 mois, soit 124 tCO₂e évitées par an.",
    metric: "−124", metricLabel: "tCO₂e/an", cta: "Plan d'action", time: "32 min",
  },
  {
    id: "comp-1", type: "compliance",
    title: "ESRS E1-6 — Données manquantes",
    desc: "Divulgation Scope 3 cat. 11 (utilisation des produits vendus) non complétée.",
    metric: "1", metricLabel: "point à compléter", cta: "Compléter", time: "1 h",
  },
  {
    id: "draft-1", type: "draft",
    title: "Rapport ESRS E1 pré-rédigé",
    desc: "NEURAL a pré-rédigé la section narrative complète. Prêt à être relu et validé.",
    metric: "87 %", metricLabel: "complété", cta: "Consulter", time: "2 h",
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

        {!isLive && !carbonError && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
            <Info className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs flex-1">
              <strong>Données de démonstration</strong> — les chiffres affichés sont fictifs.
              Pour voir vos données réelles, importez votre classeur Excel via{" "}
              <a href="/upload" className="underline font-semibold hover:text-blue-900">Import de données</a>.
            </p>
          </div>
        )}

        {/* Bandeau audit-mode */}
        <AuditModeBanner />

        {/* Titre cockpit */}
        <div className="flex items-end justify-between gap-3 pt-2">
          <div>
            <h2 className="font-display font-bold text-2xl leading-tight">
              Tableau de bord ESG — {companyName}
            </h2>
            <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
              Vue d&apos;ensemble · Données au {new Date().toLocaleDateString("fr-FR")}
              {isLive ? " · Source : classeurs Excel" : ""}
            </p>
          </div>
        </div>

        {/* Hero : trajectoire + score conformité */}
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

        {/* ESRS heat + activity + sources */}
        <FooterRow
          esrs={esrsState}
          activity={activity}
          connectors={CONNECTORS}
          deadlines={DEADLINES}
        />

        {/* Scope 3 par catégorie (15 postes, filtrable) */}
        <Scope3Panel />

        {/* Accès au module Ressources stratégiques (Module 2, données réelles) */}
        <ResourcesAccessCard />

        {/* NEURAL unifié — clôt le cockpit (cf. maquette) */}
        <NeuralPanel
          items={NEURAL_ITEMS}
          suggestions={SUGGESTIONS}
          onOpenCopilot={() => setCopilotOpen(true)}
        />

        <div className="text-center text-[11px] text-[var(--color-foreground-subtle)] font-mono py-2">
          Données de démonstration · chiffres fictifs fidèles à l&apos;app CarbonCo
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
