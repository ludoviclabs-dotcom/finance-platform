"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import {
  Factory, Zap, Truck, TrendingDown, Upload, CheckCircle,
  AlertTriangle, FileText, ThumbsUp, ThumbsDown, Info,
  Database, Mail, BarChart2, X, ChevronRight, ArrowRight,
  Sparkles, RefreshCw,
} from "lucide-react";
import { SkeletonCard, SkeletonChart, SkeletonRow } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { KpiCard } from "@/components/ui/kpi-card";
import { KpiProvenanceDrawer } from "@/components/ui/kpi-provenance-drawer";
import { AuditModeBanner } from "@/components/ui/audit-mode-toggle";
import { ReviewStatusBadge } from "@/components/ui/review-status-badge";
import { useAuditMode } from "@/lib/hooks/use-audit-mode";
import { useReviewStatusBatch } from "@/lib/hooks/use-review-status";
import { ChartCard } from "@/components/ui/chart-card";
import { SectionTitle } from "@/components/ui/section-title";
import { monthlyEmissions, scopeDetails, recentActivity, aiSuggestions } from "@/lib/data";
import { staggerContainer, pageVariants } from "@/lib/animations";
import { useConsolidatedSnapshot } from "@/lib/hooks/use-consolidated-snapshot";
import { DashboardContextBar } from "@/components/dashboard/dashboard-context-bar";
import { ProactiveInsights } from "@/components/dashboard/proactive-insights";
import { RegulatoryAlertBanner } from "@/components/dashboard/regulatory-alert-banner";
import { ActionPlanSuggestions } from "@/components/dashboard/action-plan-suggestions";
import { DeadlinesWidget } from "@/components/dashboard/deadlines-widget";
import { DataSourcesWidget } from "@/components/dashboard/data-sources-widget";
import { AIDraftNotification } from "@/components/dashboard/ai-draft-notification";

/* ── helpers ── */
const scopeBreakdown = scopeDetails.map((s) => ({
  name: s.name,
  value: s.total,
  color: s.id === 1 ? "#059669" : s.id === 2 ? "#0891B2" : "#7C3AED",
}));
const totalEmissions = scopeDetails.reduce((acc, s) => acc + s.total, 0);
const TARGET_EMISSIONS = 5200;
const TARGET_LINE = 420;

const benchmarkData = [
  { subject: "Scope 1", vous: 22, secteur: 30 },
  { subject: "Scope 2", vous: 16, secteur: 25 },
  { subject: "Scope 3", vous: 62, secteur: 45 },
  { subject: "ESRS", vous: 62, secteur: 48 },
  { subject: "Énergie", vous: 74, secteur: 60 },
];

const connectors = [
  { id: "sap", label: "ERP / SAP", icon: "📊", status: "connected" },
  { id: "gsuite", label: "Google Workspace", icon: "📧", status: "idle" },
  { id: "accounting", label: "Comptabilité", icon: "💰", status: "idle" },
  { id: "fleet", label: "Fleet Manager", icon: "🚗", status: "idle" },
  { id: "cloud", label: "AWS / Azure / GCP", icon: "☁️", status: "idle" },
  { id: "csv", label: "Import CSV", icon: "📄", status: "idle" },
];

const proactiveInsights = [
  {
    id: 1,
    icon: "💡",
    text: "62% de votre Scope 3 vient des achats. Voulez-vous lancer un questionnaire fournisseurs ?",
    cta: "Lancer le questionnaire",
    color: "border-purple-500/30 bg-purple-500/5",
  },
  {
    id: 2,
    icon: "⚠️",
    text: "Vos émissions Scope 2 sont inférieures de 80% à la moyenne sectorielle. Vérifiez que toutes les sources sont connectées.",
    cta: "Vérifier les sources",
    color: "border-orange-500/30 bg-orange-500/5",
  },
  {
    id: 3,
    icon: "✍️",
    text: "J'ai pré-rédigé la section narrative ESRS E1 pour votre rapport Q2. Voulez-vous la réviser ?",
    cta: "Voir le brouillon",
    color: "border-blue-500/30 bg-blue-500/5",
  },
];

const ACTIVITY_FILTERS = ["Tout", "Données", "Alertes", "Rapports"] as const;
type ActivityFilter = typeof ACTIVITY_FILTERS[number];

const activityIcons: Record<string, React.ReactNode> = {
  upload: <Upload className="w-4 h-4" />,
  "check-circle": <CheckCircle className="w-4 h-4" />,
  "alert-triangle": <AlertTriangle className="w-4 h-4" />,
  "file-text": <FileText className="w-4 h-4" />,
};
const activityColors: Record<string, string> = {
  upload: "text-blue-400",
  validation: "text-[var(--color-success)]",
  alert: "text-[var(--color-warning)]",
  report: "text-purple-400",
};

/* ── Onboarding steps ── */
const ONBOARDING_STEPS = [
  { step: 1, title: "Bienvenue sur CarbonCo !", desc: "Configurons votre espace en quelques étapes.", icon: "👋" },
  { step: 2, title: "Connectez vos données", desc: "Importez vos premières sources (ERP, CSV, API).", icon: "🔌" },
  { step: 3, title: "Découvrez votre tableau de bord", desc: "Vos KPIs carbone et ESRS en temps réel.", icon: "📊" },
  { step: 4, title: "Votre copilote IA est prêt", desc: "Posez-lui votre première question ESG.", icon: "🤖" },
];

export function DashboardPage() {
  const { toast } = useToast();
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("Tout");
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());
  const [dismissedInsights, setDismissedInsights] = useState<Set<number>>(new Set());
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(1);
  const [showOnboarding] = useState(false);
  const [period, setPeriod] = useState<"Ce mois" | "Ce trimestre" | "Cette année" | "2025" | "2024">("Cette année");

  const consolidated = useConsolidatedSnapshot();

  // Loading: block render until consolidated snapshot is ready.
  const loading = consolidated.status === "loading";
  const carbonError = consolidated.status === "error" ? consolidated.error : null;

  // Helpers
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const pick = (live: number | null | undefined, fallback: number) =>
    typeof live === "number" && live > 0 ? live : fallback;

  // --- Carbon KPIs ---
  const liveCarbon = consolidated.status === "ready" ? consolidated.data.carbon : null;
  const liveCompanyName =
    consolidated.status === "ready" &&
    consolidated.data.company.name &&
    consolidated.data.company.name !== "Entreprise non renseignee"
      ? consolidated.data.company.name
      : null;

  const scope1Value = pick(liveCarbon?.scope1Tco2e, scopeDetails[0].total);
  const scope2Value = pick(liveCarbon?.scope2LbTco2e, scopeDetails[1].total);
  const scope3Value = pick(liveCarbon?.scope3Tco2e, scopeDetails[2].total);
  const totalValue = pick(
    liveCarbon?.totalS123Tco2e,
    scope1Value + scope2Value + scope3Value
  );
  const intensityRevenue = numOrNull(liveCarbon?.intensityRevenueTco2ePerMEur);
  const isLive =
    consolidated.status === "ready" &&
    liveCarbon !== null &&
    (liveCarbon.totalS123Tco2e ?? 0) > 0;

  // --- ESG score ---
  const liveEsg = consolidated.status === "ready" ? consolidated.data.esg : null;
  const esgScoreGlobal = numOrNull(liveEsg?.scoreGlobal);
  const esgMaterielsCount = liveEsg?.enjeuxMateriels ?? null;
  const esgScoreDisplay = esgScoreGlobal ?? 62;
  const esgScoreLive = esgScoreGlobal !== null;

  // --- Deltas T vs T-1 ---
  const deltas = consolidated.status === "ready" ? consolidated.data.deltas : null;
  const deltaTotalCo2 = deltas?.totalS123Tco2ePct ?? null;

  // --- Alerts ---
  const alertSummary = consolidated.status === "ready" ? consolidated.data.alerts : null;

  // --- Benchmark sector: static fallback (live data not yet available) ---

  const filteredActivity = recentActivity.filter((a) => {
    if (activityFilter === "Tout") return true;
    if (activityFilter === "Données") return a.type === "upload";
    if (activityFilter === "Alertes") return a.type === "alert";
    if (activityFilter === "Rapports") return a.type === "report";
    return true;
  });

  const visibleSuggestions = aiSuggestions.filter((s) => !dismissedSuggestions.has(s.id));
  const visibleInsights = proactiveInsights.filter((i) => !dismissedInsights.has(i.id));
  const progressToTarget = Math.min(100, ((TARGET_EMISSIONS - (TARGET_EMISSIONS - totalValue)) / TARGET_EMISSIONS) * 100);

  // Phase 2 — Drawer de provenance (état partagé entre tous les KPIs)
  const [provenance, setProvenance] = useState<{
    code: string;
    label: string;
    unit: string;
  } | null>(null);

  // Phase 3.A — Statuts de review batch pour les KPIs dashboard
  const { enabled: auditModeEnabled } = useAuditMode();
  const { byCode: reviewByCode } = useReviewStatusBatch([
    "CC.GES.TOTAL_S123",
    "CC.GES.SCOPE1",
    "CC.GES.SCOPE2_LB",
    "CC.GES.SCOPE3",
  ]);

  const handleSync = (id: string) => {
    setSyncingId(id);
    setTimeout(() => {
      setSyncingId(null);
      const connector = connectors.find((c) => c.id === id);
      toast(`✅ ${connector?.label ?? "Source"} synchronisée avec succès · données à jour`, "success");
    }, 2000);
  };

  const handleApplySuggestion = (id: number) => {
    setDismissedSuggestions((s) => new Set([...s, id]));
    toast("✅ Recommandation appliquée · votre plan d'action a été mis à jour", "success");
  };

  const handleRejectSuggestion = (id: number) => {
    setDismissedSuggestions((s) => new Set([...s, id]));
    toast("Suggestion écartée · le copilote en tiendra compte", "info");
  };

  // Skeleton screen
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

  return (
    <motion.div {...pageVariants} className="space-y-0">
      {/* ── Alerte réglementaire ── */}
      <div className="pt-4">
        <RegulatoryAlertBanner />
      </div>

      {/* ── Context bar : période + méthodologie + export ── */}
      <DashboardContextBar period={period} onPeriodChange={setPeriod} />

      {/* ── Insights proactifs ── */}
      <div className="px-6">
        <ProactiveInsights />
      </div>

      {/* ── Notification IA brouillon (flottant) ── */}
      <AIDraftNotification />

      <div className="px-6 pb-6 space-y-6">

      {/* ── Onboarding overlay ── */}
      <AnimatePresence>
        {showOnboarding && onboardingStep !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", damping: 25 }}
              className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-1">
                  {ONBOARDING_STEPS.map((s) => (
                    <div key={s.step}
                      className={`h-1.5 rounded-full transition-all ${s.step <= onboardingStep ? "bg-carbon-emerald w-8" : "bg-[var(--color-border)] w-4"}`} />
                  ))}
                </div>
                <button onClick={() => setOnboardingStep(null)} className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {ONBOARDING_STEPS.filter((s) => s.step === onboardingStep).map((s) => (
                <div key={s.step}>
                  <div className="text-5xl mb-4">{s.icon}</div>
                  <h3 className="text-xl font-bold text-[var(--color-foreground)] mb-2">{s.title}</h3>
                  <p className="text-[var(--color-foreground-muted)] mb-8">{s.desc}</p>
                  <div className="flex gap-3">
                    {onboardingStep > 1 && (
                      <button onClick={() => setOnboardingStep(onboardingStep - 1)}
                        className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer">
                        Précédent
                      </button>
                    )}
                    <button
                      onClick={() => onboardingStep < ONBOARDING_STEPS.length ? setOnboardingStep(onboardingStep + 1) : setOnboardingStep(null)}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-esg text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer hover:opacity-90 transition-opacity">
                      {onboardingStep < ONBOARDING_STEPS.length ? "Suivant" : "Commencer"}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Audit mode banner (Phase 2) ── */}
      <AuditModeBanner />

      {/* ── Titre ── */}
      <SectionTitle
        title={`Tableau de bord ESG — ${liveCompanyName ?? "Acme Corp."}`}
        subtitle={`Vue d'ensemble · ${period} · Données au ${new Date().toLocaleDateString("fr-FR")}${isLive ? " · Source : classeurs Excel" : ""}${alertSummary && alertSummary.totalActive > 0 ? ` · ${alertSummary.totalActive} règle${alertSummary.totalActive > 1 ? "s" : ""} d'alerte active${alertSummary.totalActive > 1 ? "s" : ""}` : ""}`}
      />

      {/* ── Bandeau erreur API Carbon ── */}
      {carbonError && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
          <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0" />
          <p className="text-xs text-[var(--color-foreground-muted)]">
            Impossible de charger le snapshot Carbon en direct — affichage de
            données d&apos;exemple. <span className="opacity-60">({carbonError})</span>
          </p>
        </div>
      )}

      {/* ── Bandeau données de démonstration (aucun snapshot réel importé) ── */}
      {!isLive && !carbonError && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700 flex-1">
            <strong>Données de démonstration</strong> — les chiffres affichés sont fictifs.
            Pour voir vos données réelles, importez votre classeur Excel via{" "}
            <a href="/upload" className="underline font-semibold hover:text-blue-900">Import de données</a>.
          </p>
        </div>
      )}

      {/* ── IA Proactive insights ── */}
      {visibleInsights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-[var(--color-foreground)]">Copilote IA — Insights proactifs</span>
            <span className="text-[10px] bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full font-medium">
              {visibleInsights.length} nouveau{visibleInsights.length > 1 ? "x" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {visibleInsights.map((insight) => (
              <div key={insight.id}
                className={`flex items-start gap-3 p-3 rounded-xl border ${insight.color} transition-colors`}>
                <span className="text-lg flex-shrink-0">{insight.icon}</span>
                <p className="flex-1 text-sm text-[var(--color-foreground-muted)]">{insight.text}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button className="text-xs font-semibold text-carbon-emerald-light hover:underline cursor-pointer whitespace-nowrap flex items-center gap-1">
                    {insight.cta} <ChevronRight className="w-3 h-3" />
                  </button>
                  <button onClick={() => setDismissedInsights((s) => new Set([...s, insight.id]))}
                    className="text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground)] cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── KPI Grid ── */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total — mis en avant */}
        <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-carbon-emerald/5 p-4 shadow-sm"
          style={{ borderLeft: "3px solid #059669" }}>
          <KpiCard label="Émissions totales" value={totalValue} unit="tCO₂e"
            change={deltaTotalCo2 ?? -5.8}
            icon={<Factory className="w-5 h-5" />} />
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[var(--color-foreground-subtle)] mb-1">
              <span>Objectif 2025 : {TARGET_EMISSIONS.toLocaleString("fr-FR")} t</span>
              <span className="text-[var(--color-success)]">−{(totalValue - TARGET_EMISSIONS).toLocaleString("fr-FR")} t restants</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-background)] overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${progressToTarget}%` }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                className="h-full rounded-full bg-gradient-to-r from-[#059669] to-[#0891b2]" />
            </div>
          </div>
          <ReviewBadgeInline code="CC.GES.TOTAL_S123" reviewByCode={reviewByCode} show={auditModeEnabled} />
          <ProvenanceButton
            onOpen={() => setProvenance({ code: "CC.GES.TOTAL_S123", label: "Émissions totales (S1+S2+S3)", unit: "tCO₂e" })}
            factCode="CC.GES.TOTAL_S123"
          />
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" style={{ borderLeft: "3px solid #059669" }}>
          <KpiCard label="Scope 1 — Direct" value={scope1Value} unit="tCO₂e"
            change={scopeDetails[0].trend} icon={<Factory className="w-5 h-5" />} />
          <p className="text-[10px] text-[var(--color-foreground-subtle)] mt-2">vs objectif SBTi : <span className="text-[var(--color-success)]">−8% 🟢</span></p>
          <ReviewBadgeInline code="CC.GES.SCOPE1" reviewByCode={reviewByCode} show={auditModeEnabled} />
          <ProvenanceButton
            onOpen={() => setProvenance({ code: "CC.GES.SCOPE1", label: "Scope 1 — Direct", unit: "tCO₂e" })}
            factCode="CC.GES.SCOPE1"
          />
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" style={{ borderLeft: "3px solid #0891B2" }}>
          <KpiCard label="Scope 2 — Énergie" value={scope2Value} unit="tCO₂e"
            change={scopeDetails[1].trend} icon={<Zap className="w-5 h-5" />} />
          <p className="text-[10px] text-[var(--color-foreground-subtle)] mt-2">vs objectif SBTi : <span className="text-orange-400">−2% 🟠</span></p>
          <ReviewBadgeInline code="CC.GES.SCOPE2_LB" reviewByCode={reviewByCode} show={auditModeEnabled} />
          <ProvenanceButton
            onOpen={() => setProvenance({ code: "CC.GES.SCOPE2_LB", label: "Scope 2 — Énergie (location-based)", unit: "tCO₂e" })}
            factCode="CC.GES.SCOPE2_LB"
          />
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" style={{ borderLeft: "3px solid #7C3AED" }}>
          <KpiCard label="Scope 3 — Chaîne" value={scope3Value} unit="tCO₂e"
            change={scopeDetails[2].trend} icon={<Truck className="w-5 h-5" />} />
          <p className="text-[10px] text-[var(--color-foreground-subtle)] mt-2">vs objectif SBTi : <span className="text-red-400">+4% 🔴</span></p>
          <ReviewBadgeInline code="CC.GES.SCOPE3" reviewByCode={reviewByCode} show={auditModeEnabled} />
          <ProvenanceButton
            onOpen={() => setProvenance({ code: "CC.GES.SCOPE3", label: "Scope 3 — Chaîne de valeur", unit: "tCO₂e" })}
            factCode="CC.GES.SCOPE3"
          />
        </div>
      </motion.div>

      {/* ── Score ESRS ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-foreground)]">
              Score de conformité ESRS
              {esgScoreLive && (
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-carbon-emerald-light">Live</span>
              )}
            </p>
            <p className="text-xs text-[var(--color-foreground-muted)]">
              {esgMaterielsCount != null
                ? `${esgMaterielsCount} enjeux matériels · mise à jour automatique`
                : "12 standards · mise à jour automatique"}
            </p>
          </div>
          <span className="text-2xl font-extrabold text-carbon-emerald-light">
            {Math.round(esgScoreDisplay)}{" "}
            <span className="text-base font-medium text-[var(--color-foreground-muted)]">/ 100</span>
          </span>
        </div>
        <div className="relative h-3 rounded-full bg-[var(--color-background)] overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, esgScoreDisplay))}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
            className="h-full rounded-full bg-gradient-to-r from-[#059669] to-[#0891b2]" />
        </div>
        <div className="flex justify-between text-[10px] text-[var(--color-foreground-subtle)] mt-1.5">
          <span>8 conformes · 3 en cours · 1 non démarré</span>
          <span className="text-carbon-emerald-light">
            Objectif : 80 · {Math.max(0, 80 - Math.round(esgScoreDisplay))} pts nécessaires
          </span>
        </div>
      </motion.div>

      {/* ── Graphiques ── */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate"
        className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Évolution mensuelle des émissions"
          subtitle="Scope 1 + 2 + 3 · 12 derniers mois · — objectif annuel"
          className="lg:col-span-2"
          tooltip={{
            source: "Import ERP SAP + factures fournisseurs",
            updated: `${new Date().toLocaleDateString("fr-FR")} à 08h12`,
            method: "GHG Protocol Scope 1-2-3 · Facteurs ADEME 2024",
          }}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyEmissions}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-foreground-muted)" fontSize={11} />
                <YAxis stroke="var(--color-foreground-muted)" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-foreground)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={TARGET_LINE} stroke="#f97316" strokeDasharray="6 3"
                  label={{ value: "Objectif", fill: "#f97316", fontSize: 10 }} />
                <Bar dataKey="scope1" name="Scope 1" fill="#059669" radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="scope2" name="Scope 2" fill="#0891B2" radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="scope3" name="Scope 3" fill="#7C3AED" radius={[2, 2, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Répartition par scope" subtitle="Part de chaque périmètre (%)"
          tooltip={{ source: "Données agrégées ERP + manuelles", updated: `${new Date().toLocaleDateString("fr-FR")}`, method: "GHG Protocol — location-based" }}>
          <div className="h-72 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie data={scopeBreakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={82}
                  paddingAngle={3} dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {scopeBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="var(--color-surface)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-foreground)", fontSize: 12 }}
                  formatter={(v: number) => [`${v} tCO₂e`, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 text-xs text-[var(--color-foreground-muted)]">
              {scopeBreakdown.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </motion.div>

      {/* ── Benchmark sectoriel ── */}
      <ChartCard title="Benchmark sectoriel"
        subtitle={
          intensityRevenue != null
            ? `Votre performance vs. médiane industrie · Intensité carbone : ${intensityRevenue.toFixed(1)} tCO₂e/M€`
            : "Votre performance vs. médiane industrie · Intensité carbone : 42 tCO₂e/M€ (secteur : 58)"
        }
        tooltip={{ source: "Base de données CDP 2024 · secteur industrie manufacturière", updated: "Mars 2025", method: "Comparaison par intensité carbone normalisée au CA" }}>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={benchmarkData}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--color-foreground-muted)", fontSize: 11 }} />
                <Radar name="Vous" dataKey="vous" stroke="#059669" fill="#059669" fillOpacity={0.2} />
                <Radar name="Secteur" dataKey="secteur" stroke="#0891b2" fill="#0891b2" fillOpacity={0.1} strokeDasharray="4 2" />
                <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-foreground)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            {[
              { label: "Intensité carbone", vous: "42 tCO₂e/M€", secteur: "58 tCO₂e/M€", status: "top", color: "text-[var(--color-success)]", positionLabel: "Top 25%" },
              { label: "Part Scope 3", vous: "62%", secteur: "45%", status: "attention", color: "text-orange-400", positionLabel: "À améliorer" },
              { label: "Conformité ESRS", vous: "62/100", secteur: "48/100", status: "top", color: "text-[var(--color-success)]", positionLabel: "Top 25%" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-4 p-3 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)]">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-[var(--color-foreground)]">{row.label}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-sm font-bold ${row.color}`}>{row.vous}</span>
                    <span className="text-xs text-[var(--color-foreground-subtle)]">vs secteur : {row.secteur}</span>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  row.status === "top" ? "bg-[var(--color-success)]/15 text-[var(--color-success)]" : "bg-orange-500/15 text-orange-400"
                }`}>
                  {row.positionLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>

      {/* ── Connecteurs + Email récap ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Import auto */}
        <ChartCard title="Connecter vos données" subtitle="Sources actives et disponibles">
          <div className="grid grid-cols-2 gap-2">
            {connectors.map((c) => (
              <button key={c.id} onClick={() => handleSync(c.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${
                  c.status === "connected"
                    ? "border-carbon-emerald/30 bg-carbon-emerald/5 hover:bg-carbon-emerald/10"
                    : "border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-border-strong)]"
                }`}>
                <span className="text-xl">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--color-foreground)] truncate">{c.label}</p>
                  <p className={`text-[10px] ${c.status === "connected" ? "text-[var(--color-success)]" : "text-[var(--color-foreground-subtle)]"}`}>
                    {c.status === "connected" ? "Connecté" : "Connecter"}
                  </p>
                </div>
                {syncingId === c.id
                  ? <RefreshCw className="w-3.5 h-3.5 text-carbon-emerald animate-spin flex-shrink-0" />
                  : c.status === "connected"
                    ? <Database className="w-3.5 h-3.5 text-carbon-emerald flex-shrink-0" />
                    : <ArrowRight className="w-3.5 h-3.5 text-[var(--color-foreground-subtle)] flex-shrink-0" />
                }
              </button>
            ))}
          </div>
        </ChartCard>

        {/* Email récap */}
        <ChartCard title="Rapport email automatique" subtitle="Récapitulatif hebdomadaire pour votre équipe">
          <AnimatePresence mode="wait">
            {emailPreview ? (
              <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--color-foreground)]">📧 Récapitulatif ESG — semaine 24</span>
                  <button onClick={() => setEmailPreview(false)} className="text-[var(--color-foreground-muted)] cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5 text-[var(--color-foreground-muted)]">
                  <p>📊 <strong className="text-[var(--color-foreground)]">Émissions totales :</strong> 5 955 tCO₂e · −5.8%</p>
                  <p>⚠️ <strong className="text-[var(--color-foreground)]">2 alertes non traitées</strong> · Scope 3 Transport</p>
                  <p>📋 <strong className="text-[var(--color-foreground)]">ESRS :</strong> 62/100 · +2 pts cette semaine</p>
                  <p>🤖 <strong className="text-[var(--color-foreground)]">Top action IA :</strong> Contrat énergie verte — −40% Scope 2</p>
                </div>
                <button className="w-full py-2 rounded-lg bg-carbon-emerald/15 text-carbon-emerald-light font-semibold hover:bg-carbon-emerald/25 transition-colors cursor-pointer">
                  Activer les rapports par email
                </button>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-3">
                {[
                  { icon: BarChart2, text: "Résumé des émissions hebdomadaires" },
                  { icon: AlertTriangle, text: "Alertes non traitées" },
                  { icon: CheckCircle, text: "Progression ESRS" },
                  { icon: Sparkles, text: "Top 3 actions recommandées par l'IA" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-[var(--color-foreground-muted)]">
                    <Icon className="w-4 h-4 text-carbon-emerald flex-shrink-0" />
                    {text}
                  </div>
                ))}
                <button onClick={() => setEmailPreview(true)}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground)] hover:border-carbon-emerald/40 hover:bg-carbon-emerald/5 transition-all cursor-pointer">
                  <Mail className="w-4 h-4" />
                  Voir le preview du rapport email
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </ChartCard>
      </div>

      {/* ── Activité + Suggestions ── */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Activité récente */}
        <ChartCard title="Activité récente" subtitle="Dernières actions sur la plateforme">
          <div className="flex items-center gap-1 mb-4 bg-[var(--color-background)] rounded-lg p-0.5 border border-[var(--color-border)] w-fit">
            {ACTIVITY_FILTERS.map((f) => (
              <button key={f} onClick={() => setActivityFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activityFilter === f ? "bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-sm" : "text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
                }`}>{f}</button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredActivity.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--color-foreground-muted)]">Aucune activité dans cette catégorie</p>
              </div>
            )}
            {filteredActivity.map((activity) => (
              <div key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors">
                <div className="w-7 h-7 rounded-full bg-[var(--color-surface-raised)] flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[var(--color-foreground-muted)]">ML</div>
                <div className={`mt-0.5 flex-shrink-0 ${activityColors[activity.type]}`}>{activityIcons[activity.icon]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">{activity.title}</p>
                  <p className="text-xs text-[var(--color-foreground-muted)] truncate">{activity.description}</p>
                </div>
                <span className="text-xs text-[var(--color-foreground-subtle)] whitespace-nowrap">{activity.time}</span>
              </div>
            ))}
          </div>
          <button className="mt-3 w-full text-xs text-carbon-emerald-light hover:underline cursor-pointer text-center">
            Voir tout l&apos;historique →
          </button>
        </ChartCard>

        {/* Suggestions IA */}
        <ChartCard title="Suggestions IA" subtitle="Recommandations du Copilote CarbonCo">
          <div className="flex items-center gap-2 mb-4 px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs text-purple-300 font-medium">Généré par IA — à valider par votre équipe RSE</span>
          </div>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {visibleSuggestions.length === 0 && (
                <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8">
                  <CheckCircle className="w-10 h-10 text-[var(--color-success)] mx-auto mb-2" />
                  <p className="text-sm font-medium text-[var(--color-foreground)]">Toutes les suggestions ont été traitées</p>
                  <p className="text-xs text-[var(--color-foreground-muted)] mt-1">Votre copilote analysera de nouvelles opportunités.</p>
                </motion.div>
              )}
              {visibleSuggestions.map((suggestion, idx) => (
                <motion.div key={suggestion.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 60, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: idx * 0.06 }}
                  className="p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] hover:border-carbon-emerald/30 transition-colors"
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    <TrendingDown className="w-4 h-4 text-carbon-emerald mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[var(--color-foreground)]">{suggestion.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          suggestion.impact === "high" ? "bg-[var(--color-success)]/15 text-[var(--color-success)]" : "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
                        }`}>
                          {suggestion.impact === "high" ? "Impact fort" : "Impact moyen"}
                        </span>
                        <span className="text-xs font-bold text-carbon-emerald ml-auto">
                          −{suggestion.impact === "high" ? "154" : "62"} tCO₂e
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-foreground-muted)] mb-3 ml-6">{suggestion.description}</p>
                  <div className="flex items-center gap-2 ml-6">
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => handleApplySuggestion(suggestion.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-carbon-emerald/15 text-carbon-emerald-light text-xs font-medium hover:bg-carbon-emerald/25 transition-colors cursor-pointer">
                      <ThumbsUp className="w-3 h-3" /> Appliquer
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => handleRejectSuggestion(suggestion.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-surface-raised)] text-[var(--color-foreground-muted)] text-xs font-medium hover:text-red-400 transition-colors cursor-pointer">
                      <ThumbsDown className="w-3 h-3" /> Rejeter
                    </motion.button>
                    <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[var(--color-foreground-subtle)] text-xs hover:text-[var(--color-foreground)] transition-colors cursor-pointer ml-auto">
                      <Info className="w-3 h-3" /> En savoir plus
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ChartCard>
      </motion.div>

      {/* ── Plan d'action IA ── */}
      <ActionPlanSuggestions />

      {/* ── Widgets : Échéances + Sources ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeadlinesWidget />
        <DataSourcesWidget />
      </div>

      </div>{/* end px-6 pb-6 */}

      {/* ── Drawer provenance (Phase 2) ── */}
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

/** Badge statut review inline — affiché uniquement en mode audit pour éviter l'encombrement. */
function ReviewBadgeInline({
  code,
  reviewByCode,
  show,
}: {
  code: string;
  reviewByCode: Record<string, import("@/lib/api").ReviewItem | null>;
  show: boolean;
}) {
  if (!show) return null;
  const review = reviewByCode[code];
  if (!review) return null;
  return (
    <div className="mt-2">
      <ReviewStatusBadge status={review.status} />
    </div>
  );
}

/** Bouton discret "Voir la provenance" pour les cartes KPI du dashboard. */
function ProvenanceButton({
  onOpen,
  factCode,
}: {
  onOpen: () => void;
  factCode: string;
}) {
  return (
    <button
      onClick={onOpen}
      className="mt-2 inline-flex items-center gap-1 text-[10px] text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground)] transition-colors group/prov"
      aria-label={`Voir la provenance de ${factCode}`}
      data-testid={`provenance-trigger-${factCode}`}
    >
      <Info className="w-3 h-3 opacity-60 group-hover/prov:opacity-100 transition-opacity" aria-hidden />
      <span className="underline underline-offset-2 decoration-dotted">Voir la provenance</span>
    </button>
  );
}
