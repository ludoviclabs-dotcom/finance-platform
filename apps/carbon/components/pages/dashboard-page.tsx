"use client";

/* ════════════════════════════════════════════════════════════════════════════
   Tableau de bord ESG — Cockpit CarbonCo (refonte)
   Hero trajectoire + score conformité · scopes expandables · NEURAL unifié ·
   répartition + benchmark · ESRS heat + activité + sources · drawer copilote.

   Deux modes, décidés sur le CONTENU du snapshot consolidé (un total S1+S2+S3
   nul est une organisation sans données, pas une donnée réelle) :
   - démonstration : jeu fictif de la maquette, étiqueté comme tel, sans
     aucune revendication d'intégrité ou de vérification ;
   - réel : chiffres de l'API ; toute visualisation sans source réelle
     (série mensuelle, bridge, benchmark…) cède la place à un encart explicatif.
   Dans les deux modes, le score ESRS, les échéances et l'activité viennent de
   l'API (ou affichent un état vide), et la veille réglementaire est sourcée.
   ════════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, FlaskConical, Info } from "lucide-react";

import { SkeletonCard, SkeletonChart, SkeletonRow } from "@/components/ui/skeleton";
import { KpiProvenanceDrawer } from "@/components/ui/kpi-provenance-drawer";
import { AuditModeBanner } from "@/components/ui/audit-mode-toggle";
import { ReviewStatusBadge } from "@/components/ui/review-status-badge";
import { useAuditMode } from "@/lib/hooks/use-audit-mode";
import { useReviewStatusBatch } from "@/lib/hooks/use-review-status";
import { useConsolidatedSnapshot } from "@/lib/hooks/use-consolidated-snapshot";
import { useAudit } from "@/lib/hooks/use-audit";
import { useBegesDeadline } from "@/lib/hooks/use-beges-deadline";
import { ResourcesAccessCard } from "@/components/dashboard/resources-access-card";
import { ChainBadge } from "@/components/ui/chain-badge";
import { QualityPanel } from "@/components/ui/quality-panel";
import { Scope3Panel } from "@/components/ui/scope3-panel";

import { monthlyEmissions, scopeDetails, recentActivity } from "@/lib/data";
import { pageVariants } from "@/lib/animations";

import {
  Hero, ScopeStrip, NeuralPanel, AnalyticsRow, BridgeRow, SourcesRow, CopilotDrawer, RegBanner,
  type ScopeRow, type NeuralItem, type Suggestion, type Benchmark,
  type ActivityRow, type Connector, type Deadline, type HeroTrajectory,
} from "@/components/cockpit/cockpit-sections";
import type { ScopesOn, WaterfallStep } from "@/components/cockpit/cockpit-charts";
import {
  REGULATORY_NOTES,
  auditEventsToActivity,
  buildEsrsCockpitState,
  hasLiveCarbon,
  scopeShares,
} from "@/components/cockpit/dashboard-model";

/* ─── Jeu de démonstration (rejoue celui de la maquette, entreprise fictive) ── */
/* Objectif SBTi 2030 : −42 % vs la base 2023 du bridge (11 200 tCO₂e). */
const DEMO_TARGET_EMISSIONS = 6500;
const DEMO_DELTA_PCT = -5.8;
const DEMO_COMPANY = "Exemplia Industrie (entreprise fictive)";

const SCOPE_META: Record<1 | 2 | 3, {
  desc: string;
  color: string;
  icon: ScopeRow["icon"];
  label: string;
}> = {
  1: {
    desc: "Combustion fixe, flotte véhicules, réfrigérants, procédés",
    color: "#34D399",
    icon: "factory",
    label: "Émissions directes",
  },
  2: {
    desc: "Électricité, chauffage urbain, vapeur",
    color: "#22D3EE",
    icon: "zap",
    label: "Énergie achetée",
  },
  3: {
    desc: "Achats, transport amont/aval, déplacements, déchets, usage produits",
    color: "#A78BFA",
    icon: "truck",
    label: "Chaîne de valeur",
  },
};

/** Éléments de maquette propres à la démonstration (aucune source réelle). */
const DEMO_SCOPE_EXTRAS: Record<1 | 2 | 3, { sbti: NonNullable<ScopeRow["sbti"]>; spark: number[] }> = {
  1: {
    sbti: { status: "ok", text: "SBTi ✓ on-track" },
    spark: [112, 107, 121, 102, 97, 93, 88, 91, 100, 104, 110, 115],
  },
  2: {
    sbti: { status: "warn", text: "SBTi ⚠ à surveiller" },
    spark: [81, 78, 86, 74, 71, 69, 67, 65, 71, 72, 76, 80],
  },
  3: {
    sbti: { status: "alert", text: "SBTi ✗ hors-piste" },
    spark: [685, 654, 725, 624, 594, 564, 544, 534, 584, 604, 634, 674],
  },
};

/* Bridge 2023 → 2025 (maquette) : 11 200 − 1 250 − 680 − 520 − 100 + 900 = 9 550. */
const DEMO_WATERFALL: WaterfallStep[] = [
  { label: "Base 2023",       value: 11200, kind: "base"  },
  { label: "Énergie verte",   value: -1250, kind: "delta" },
  { label: "Efficacité",      value:  -680, kind: "delta" },
  { label: "Fret optimisé",   value:  -520, kind: "delta" },
  { label: "Mix produit",     value:  -100, kind: "delta" },
  { label: "Croissance",      value:   900, kind: "delta" },
  { label: "Total 2025",      value:     0, kind: "total" },
];

const DEMO_BENCHMARK: Benchmark = {
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

const DEMO_NEURAL_ITEMS: NeuralItem[] = [
  {
    id: "opp-1", type: "opportunité",
    // 7 420 / 9 550 = 78 % (part du Scope 3 dans le total) ; 2 680 / 7 420 = 36 %
    // (part des achats dans le Scope 3) — deux chiffres distincts, cf. revue.
    title: "Le Scope 3 pèse 78 % de vos émissions",
    desc: "Les achats en sont le premier poste (36 % du Scope 3). Lancer un questionnaire fournisseurs ciblé sur les 5 postes majeurs.",
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

const DEMO_SUGGESTIONS: Suggestion[] = [
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

/** Pistes génériques pour une organisation réelle : aucun gain chiffré inventé. */
const LIVE_SUGGESTIONS: Suggestion[] = [
  {
    id: 1, title: "Flotte de véhicules", scope: "Scope 1",
    desc: "Étudier le remplacement progressif des véhicules thermiques par des motorisations bas-carbone.",
  },
  {
    id: 2, title: "Électricité renouvelable", scope: "Scope 2",
    desc: "Évaluer un contrat de fourniture d'électricité d'origine renouvelable pour vos sites.",
  },
  {
    id: 3, title: "Déplacements domicile-travail", scope: "Scope 3",
    desc: "Mesurer l'effet d'une politique de télétravail ou de mobilité douce.",
  },
];

/* Catalogue de connecteurs : aucun n'est présenté comme « connecté » tant
   qu'aucune intégration réelle n'existe pour l'organisation. */
const CONNECTORS: Connector[] = [
  { id: "sap",        label: "ERP / SAP",         status: "idle", glyph: "SAP" },
  { id: "gsuite",     label: "Google Workspace",  status: "idle", glyph: "GW"  },
  { id: "accounting", label: "Comptabilité",      status: "idle", glyph: "€"   },
  { id: "fleet",      label: "Fleet Manager",     status: "idle", glyph: "FM"  },
  { id: "cloud",      label: "AWS / Azure / GCP", status: "idle", glyph: "☁"   },
  { id: "csv",        label: "Import CSV",        status: "idle", glyph: "CSV" },
];

/** Insight calculé sur les émissions réelles (aucune valeur supposée). */
function liveInsights(scope3Share: number): NeuralItem[] {
  if (scope3Share < 50) return [];
  return [
    {
      id: "live-scope3",
      type: "opportunité",
      title: `Le Scope 3 pèse ${scope3Share} % de vos émissions`,
      desc: "La chaîne de valeur est votre premier levier : un questionnaire fournisseurs permet de fiabiliser ses principaux postes.",
      metric: `${scope3Share} %`,
      metricLabel: "des émissions totales",
      cta: "Lancer le questionnaire",
      time: "",
    },
  ];
}

/* ─── Composant principal ───────────────────────────────────────────────── */
export function DashboardPage() {
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [scopesOn, setScopesOn] = useState<ScopesOn>({ s1: true, s2: true, s3: true });

  const consolidated = useConsolidatedSnapshot();
  const audit = useAudit({ limit: 20 });
  const begesDeadline = useBegesDeadline();
  const loading = consolidated.status === "loading";
  // Snapshot absent (`empty`) : pas une panne — mode démonstration étiqueté.
  const carbonError =
    consolidated.status === "error" && !consolidated.empty ? consolidated.error : null;

  const snapshot = consolidated.status === "ready" ? consolidated.data : null;
  const isLive = hasLiveCarbon(snapshot);
  const liveCarbon = isLive && snapshot ? snapshot.carbon : null;

  const liveCompanyName =
    snapshot?.company.name && snapshot.company.name !== "Entreprise non renseignee"
      ? snapshot.company.name
      : null;

  // Totaux : réels (un poste absent vaut 0) ou jeu de démonstration.
  const scopeTotals: [number, number, number] = liveCarbon
    ? [
        liveCarbon.scope1Tco2e ?? 0,
        liveCarbon.scope2LbTco2e ?? 0,
        liveCarbon.scope3Tco2e ?? 0,
      ]
    : [scopeDetails[0].total, scopeDetails[1].total, scopeDetails[2].total];
  const totalValue = liveCarbon?.totalS123Tco2e ?? scopeTotals[0] + scopeTotals[1] + scopeTotals[2];
  const shares = scopeShares(scopeTotals);

  // ESRS : matrice de matérialité réelle ou « — » (jamais de score codé en dur).
  const esrsState = useMemo(() => buildEsrsCockpitState(snapshot?.rawEsg ?? null), [snapshot]);

  // Variation vs N-1 : réelle, ou valeur de démonstration hors données réelles.
  const liveDelta = snapshot?.deltas?.totalS123Tco2ePct;
  const deltaPct = isLive
    ? typeof liveDelta === "number" && Number.isFinite(liveDelta) ? liveDelta : null
    : DEMO_DELTA_PCT;

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
  const trajectory: HeroTrajectory | null = isLive
    ? null
    : {
        monthly: monthlyEmissions.map((m) => ({ m: m.month, s1: m.scope1, s2: m.scope2, s3: m.scope3 })),
        target: DEMO_TARGET_EMISSIONS,
        targetLabel: (
          <>Objectif SBTi 2030 · <strong className="cc-mono cc-em-txt">−42 %</strong> vs 2023</>
        ),
      };

  const scopes: ScopeRow[] = ([1, 2, 3] as const).map((id, index) => ({
    id,
    name: `Scope ${id}`,
    total: scopeTotals[index],
    share: shares[index],
    ...SCOPE_META[id],
    // Tendance, position SBTi, série et ventilation : démonstration seulement.
    trend: isLive ? null : scopeDetails[index].trend,
    sbti: isLive ? null : DEMO_SCOPE_EXTRAS[id].sbti,
    spark: isLive ? null : DEMO_SCOPE_EXTRAS[id].spark,
    categories: isLive
      ? null
      : scopeDetails[index].categories.map((c) => ({ name: c.name, value: c.value })),
  }));

  // Activité : journal d'audit réel ; en démonstration, jeu fictif sans
  // aucune mention de validation ou de vérification.
  const activity: ActivityRow[] = isLive
    ? audit.status === "ready" ? auditEventsToActivity(audit.events) : []
    : recentActivity
        .filter((a) => a.type !== "validation")
        .map((a) => ({ id: a.id, type: a.type, title: a.title, desc: a.description, time: a.time }));
  const activityNotice = !isLive
    ? undefined
    : audit.status === "loading"
      ? "Chargement du journal d'audit…"
      : audit.status === "error"
        ? "Journal d'audit indisponible pour le moment."
        : undefined;

  const deadlines: Deadline[] = begesDeadline
    ? [{
        label: "Renouvellement BEGES",
        days: begesDeadline.days,
        level: begesDeadline.level,
        href: "/beges",
      }]
    : [];

  const companyLabel = isLive ? liveCompanyName ?? "Votre organisation" : DEMO_COMPANY;

  return (
    <motion.div {...pageVariants} className="cc-app space-y-0">
      <div className="px-6 pt-4 pb-6 space-y-4">

        {/* Chaîne d'intégrité — uniquement sur données réelles : jamais de
            revendication de vérification à côté de chiffres fictifs. */}
        {isLive ? (
          <ChainBadge />
        ) : (
          <div
            className="inline-flex items-center gap-2 rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-muted)]"
            data-testid="demo-state-badge"
            role="status"
          >
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            Démonstration · aucune vérification d&apos;intégrité sur ces chiffres
          </div>
        )}

        {/* Veille réglementaire (faits datés et sourcés) */}
        <RegBanner notes={REGULATORY_NOTES} />

        {/* Bandeau erreur API Carbon (message présentable, jamais technique) */}
        {carbonError && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0" />
            <p className="text-xs text-[var(--color-foreground-muted)]">
              Impossible de charger vos données en direct — affichage de données de démonstration
              (chiffres fictifs). <span className="opacity-60">{carbonError}</span>
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
              <Link href="/upload" className="font-semibold underline text-[var(--cc-em)]">Import de données</Link>.
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
          trajectory={trajectory}
          esrs={esrsState}
          scopesOn={scopesOn}
          setScopesOn={setScopesOn}
          deltaPct={deltaPct}
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
        <AnalyticsRow scopes={scopes} benchmark={isLive ? null : DEMO_BENCHMARK} />

        {/* Preuve & qualité (score audit, couverture de pièces, méthodes) */}
        <QualityPanel />

        {/* Bridge des leviers 2023 → 2025 + heatmap ESRS (cf. maquette) */}
        <BridgeRow
          esrs={esrsState}
          waterfall={isLive ? null : { title: "Variation des émissions 2023 → 2025", steps: DEMO_WATERFALL }}
        />

        {/* Scope 3 par catégorie (15 postes, filtrable) */}
        <Scope3Panel />

        {/* NEURAL unifié — clôt la séquence de la maquette */}
        <NeuralPanel
          key={isLive ? "live" : "demo"}
          items={isLive ? liveInsights(shares[2]) : DEMO_NEURAL_ITEMS}
          suggestions={isLive ? LIVE_SUGGESTIONS : DEMO_SUGGESTIONS}
          subtitle={isLive ? "calculé à partir de vos émissions importées" : undefined}
          onOpenCopilot={() => setCopilotOpen(true)}
        />

        {/* Hors maquette, conservés : activité, connecteurs/échéances, accès
            au module Ressources stratégiques. */}
        <SourcesRow
          activity={activity}
          activityNotice={activityNotice}
          connectors={CONNECTORS}
          deadlines={deadlines}
        />

        <ResourcesAccessCard />

        <div className="text-center text-[11px] text-[var(--color-foreground-subtle)] font-mono py-2">
          {companyLabel} ·{" "}
          {isLive ? "données issues de vos imports" : "données de démonstration, chiffres fictifs"}
        </div>
      </div>

      {/* Drawer copilote (slide-in droit) — salutation neutre, sans persona */}
      <CopilotDrawer
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        scope3SharePct={shares[2]}
      />

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
