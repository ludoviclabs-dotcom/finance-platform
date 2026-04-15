"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import {
  CheckCircle,
  Clock,
  Circle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { ChartCard } from "@/components/ui/chart-card";
import { esrsStandards, esrsRadialData } from "@/lib/data";
import { pageVariants, staggerContainer, staggerItem } from "@/lib/animations";
import { useEsgSnapshot } from "@/lib/hooks/use-esg-snapshot";
import type { MaterialiteIssue } from "@/lib/api";

type StatusKey = "compliant" | "in_progress" | "not_started";

const statusConfig = {
  compliant: { label: "Conforme", icon: CheckCircle, color: "text-[var(--color-success)]", bg: "bg-[var(--color-success)]/15" },
  in_progress: { label: "En cours", icon: Clock, color: "text-[var(--color-warning)]", bg: "bg-[var(--color-warning)]/15" },
  not_started: { label: "Non démarré", icon: Circle, color: "text-[var(--color-foreground-subtle)]", bg: "bg-[var(--color-foreground-subtle)]/15" },
};

type CategoryKey = "ALL" | "E" | "S" | "G";
const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "ALL", label: "Tous" },
  { key: "E", label: "Environnement" },
  { key: "S", label: "Social" },
  { key: "G", label: "Gouvernance" },
];

interface LiveStandard {
  id: string;
  name: string;
  fullName: string;
  progress: number;
  status: StatusKey;
  description: string;
  dataPoints: number;
  completedPoints: number;
  categorie: "E" | "S" | "G" | "GEN";
  materialIssues: MaterialiteIssue[];
}

const STANDARD_META: Record<string, { name: string; fullName: string; description: string; categorie: "E" | "S" | "G" | "GEN" }> = {
  "ESRS E1": { name: "Changement climatique", fullName: "ESRS E1 — Changement climatique", description: "Atténuation, adaptation, énergie", categorie: "E" },
  "ESRS E2": { name: "Pollution", fullName: "ESRS E2 — Pollution", description: "Air, eau, sol, substances préoccupantes", categorie: "E" },
  "ESRS E3": { name: "Eau & ressources marines", fullName: "ESRS E3 — Eau et ressources marines", description: "Consommation, rejets, écosystèmes marins", categorie: "E" },
  "ESRS E4": { name: "Biodiversité", fullName: "ESRS E4 — Biodiversité et écosystèmes", description: "Impacts, dépendances, zones sensibles", categorie: "E" },
  "ESRS E5": { name: "Économie circulaire", fullName: "ESRS E5 — Utilisation des ressources et économie circulaire", description: "Flux de ressources, déchets, recyclage", categorie: "E" },
  "ESRS S1": { name: "Effectifs propres", fullName: "ESRS S1 — Effectifs de l'entreprise", description: "Conditions de travail, égalité, santé-sécurité", categorie: "S" },
  "ESRS S2": { name: "Travailleurs chaîne", fullName: "ESRS S2 — Travailleurs de la chaîne de valeur", description: "Conditions, droits, travail forcé", categorie: "S" },
  "ESRS S3": { name: "Communautés", fullName: "ESRS S3 — Communautés affectées", description: "Droits des communautés, impact territorial", categorie: "S" },
  "ESRS S4": { name: "Consommateurs", fullName: "ESRS S4 — Consommateurs et utilisateurs finaux", description: "Sécurité, vie privée, inclusion", categorie: "S" },
  "ESRS G1": { name: "Gouvernance", fullName: "ESRS G1 — Conduite des affaires", description: "Éthique, corruption, lobbying, paiements", categorie: "G" },
  "ESRS 1": { name: "Exigences générales", fullName: "ESRS 1 — Exigences générales", description: "Principes, périmètre, double matérialité", categorie: "GEN" },
  "ESRS 2": { name: "Infos générales", fullName: "ESRS 2 — Informations générales", description: "Stratégie, gouvernance, gestion des impacts", categorie: "GEN" },
};

function normalizeNorme(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  // Accept "E1", "ESRS E1", "ESRS-E1" etc.
  const match = trimmed.match(/(E1|E2|E3|E4|E5|S1|S2|S3|S4|G1)/);
  if (match) return `ESRS ${match[1]}`;
  if (trimmed.includes("ESRS 1") || trimmed === "ESRS1") return "ESRS 1";
  if (trimmed.includes("ESRS 2") || trimmed === "ESRS2") return "ESRS 2";
  return null;
}

function classifyStatus(progress: number): StatusKey {
  if (progress >= 80) return "compliant";
  if (progress >= 40) return "in_progress";
  return "not_started";
}

export function ESRSPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>("ALL");

  const esgSnap = useEsgSnapshot();
  const isLive = esgSnap.status === "ready";
  const esgError = esgSnap.status === "error" ? esgSnap.error : null;

  // Derive per-norm standards from materialite.issues when live data is available
  const liveStandards: LiveStandard[] | null = useMemo(() => {
    if (esgSnap.status !== "ready") return null;
    const issues = esgSnap.data.materialite.issues ?? [];

    // Bucket issues by norm
    const buckets = new Map<string, MaterialiteIssue[]>();
    for (const issue of issues) {
      const normId = normalizeNorme(issue.normeEsrs);
      if (!normId) continue;
      const existing = buckets.get(normId);
      if (existing) existing.push(issue);
      else buckets.set(normId, [issue]);
    }

    return Object.entries(STANDARD_META).map(([id, meta]) => {
      const bucketIssues = buckets.get(id) ?? [];
      const total = bucketIssues.length;
      const materiels = bucketIssues.filter((i) => i.materiel === true).length;
      const evaluated = bucketIssues.filter((i) => i.scoreImpact != null).length;

      // Progress basé sur le scoreImpactTotal moyen normalisé sur 0-5 → 0-100%
      // Si scoreImpactTotal absent, on utilise scoreImpact seul
      // Fallback final : ratio matériels/total
      let progress = 0;
      const scoredIssues = bucketIssues.filter(
        (i) => typeof i.scoreImpactTotal === "number" || typeof i.scoreImpact === "number"
      );
      if (scoredIssues.length > 0) {
        const avgScore =
          scoredIssues.reduce((sum, i) => {
            const s = typeof i.scoreImpactTotal === "number"
              ? i.scoreImpactTotal
              : (i.scoreImpact as number);
            return sum + s;
          }, 0) / scoredIssues.length;
        // Échelle 0-5 → 0-100%
        progress = Math.min(100, Math.round((avgScore / 5) * 100));
      } else if (total > 0) {
        progress = Math.round((materiels / total) * 100);
      }

      return {
        id,
        name: meta.name,
        fullName: meta.fullName,
        progress,
        status: classifyStatus(progress),
        description: meta.description,
        dataPoints: evaluated || total,
        completedPoints: materiels,
        categorie: meta.categorie,
        materialIssues: bucketIssues.filter((i) => i.materiel === true),
      };
    });
  }, [esgSnap]);

  // Use live standards when available, otherwise fall back to mocks
  const standards = liveStandards ?? esrsStandards.map((s) => ({
    id: s.id,
    name: s.name,
    fullName: s.fullName,
    progress: s.progress,
    status: s.status as StatusKey,
    description: s.description,
    dataPoints: s.dataPoints,
    completedPoints: s.completedPoints,
    categorie: (STANDARD_META[s.id]?.categorie ?? "GEN") as "E" | "S" | "G" | "GEN",
    materialIssues: [] as MaterialiteIssue[],
  }));

  const filteredStandards = standards.filter((s) => {
    if (categoryFilter === "ALL") return true;
    return s.categorie === categoryFilter;
  });

  const radarData = liveStandards
    ? liveStandards
        .filter((s) => s.categorie !== "GEN")
        .map((s) => ({
          subject: `${s.id.replace("ESRS ", "")} ${s.name.split(" ")[0]}`.slice(0, 14),
          value: s.progress,
          fullMark: 100,
        }))
    : esrsRadialData;

  const avgProgress = liveStandards
    ? Math.round(
        liveStandards.reduce((acc, s) => acc + s.progress, 0) /
          Math.max(liveStandards.length, 1)
      )
    : Math.round(
        esrsStandards.reduce((acc, s) => acc + s.progress, 0) / esrsStandards.length
      );

  return (
    <motion.div {...pageVariants} className="p-6 space-y-6">
      <SectionTitle
        title="Normes ESRS / CSRD"
        subtitle="Suivi de conformité aux 12 normes European Sustainability Reporting Standards"
      />

      {/* Live badge / error banner / demo banner */}
      {isLive && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-foreground-muted)]">
          <span className="inline-flex w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
          <span>Données live — dérivées de la matrice de matérialité ESG</span>
        </div>
      )}
      {esgError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700">
            <span className="font-semibold">Snapshot ESG indisponible.</span>{" "}
            Affichage des données de démonstration. <span className="opacity-70">({esgError})</span>
          </div>
        </div>
      )}
      {!isLive && !esgError && esgSnap.status !== "loading" && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700 flex-1">
            <strong>Données de démonstration</strong> — les taux de progression affichés sont fictifs.
            Complétez votre{" "}
            <a href="/materialite" className="underline font-semibold hover:text-blue-900">matrice de matérialité</a>{" "}
            pour voir votre conformité ESRS réelle.
          </p>
        </div>
      )}

      {/* Overview cards */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <motion.div
          variants={staggerItem}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center"
        >
          <p className="text-sm text-[var(--color-foreground-muted)] mb-1">Conformité globale</p>
          <p className="text-3xl font-display font-bold text-carbon-emerald">{avgProgress}%</p>
        </motion.div>
        {(["compliant", "in_progress", "not_started"] as const).map((status) => {
          const count = standards.filter((s) => s.status === status).length;
          const cfg = statusConfig[status];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={status}
              variants={staggerItem}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex items-center gap-3"
            >
              <Icon className={`w-5 h-5 ${cfg.color}`} />
              <div>
                <p className="text-2xl font-display font-bold text-[var(--color-foreground)]">{count}</p>
                <p className="text-xs text-[var(--color-foreground-muted)]">{cfg.label}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-[var(--color-foreground-muted)]" />
        <span className="text-xs text-[var(--color-foreground-muted)] mr-2">Filtrer par pilier</span>
        {CATEGORIES.map((cat) => {
          const active = categoryFilter === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategoryFilter(cat.key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                active
                  ? "bg-carbon-emerald text-white"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:border-carbon-emerald"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Radar + List */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Radar chart */}
        <ChartCard title="Couverture ESRS" subtitle="Score par norme" className="lg:col-span-2">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "var(--color-foreground-muted)", fontSize: 11 }}
                />
                <Radar
                  name="Progression"
                  dataKey="value"
                  stroke="#059669"
                  fill="#059669"
                  fillOpacity={0.2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* ESRS list */}
        <div className="lg:col-span-3 space-y-2">
          {filteredStandards.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-foreground-muted)]">
              Aucune norme ne correspond à ce filtre.
            </div>
          )}
          {filteredStandards.map((standard) => {
            const isOpen = expanded === standard.id;
            const cfg = statusConfig[standard.status];
            const Icon = cfg.icon;

            return (
              <motion.div
                key={standard.id}
                variants={staggerItem}
                initial="initial"
                animate="animate"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : standard.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-carbon-emerald">{standard.id}</span>
                      <span className="text-sm font-medium text-[var(--color-foreground)]">
                        {standard.name}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${standard.progress}%`,
                            backgroundColor:
                              standard.progress >= 80
                                ? "var(--color-success)"
                                : standard.progress >= 50
                                ? "var(--color-warning)"
                                : "var(--color-foreground-subtle)",
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-[var(--color-foreground-muted)] w-10 text-right">
                        {standard.progress}%
                      </span>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[var(--color-foreground-muted)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--color-foreground-muted)]" />
                  )}
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-[var(--color-border)]">
                        <p className="text-sm text-[var(--color-foreground-muted)] mb-3">
                          {standard.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs mb-3">
                          <span className="text-[var(--color-foreground-subtle)]">
                            {isLive ? "Enjeux matériels" : "Data points"} :{" "}
                            {standard.completedPoints} / {standard.dataPoints}
                          </span>
                          <span className={cfg.color}>{cfg.label}</span>
                        </div>
                        {isLive && standard.materialIssues.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-[var(--color-border)]">
                            <p className="text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide mb-2">
                              Enjeux matériels identifiés
                            </p>
                            {standard.materialIssues.slice(0, 5).map((issue) => (
                              <div
                                key={issue.code}
                                className="flex items-center justify-between text-xs gap-3"
                              >
                                <span className="text-[var(--color-foreground)] truncate">
                                  <span className="font-mono text-carbon-emerald mr-2">
                                    {issue.code}
                                  </span>
                                  {issue.label}
                                </span>
                                {typeof issue.scoreImpactTotal === "number" && (
                                  <span className="font-mono text-[var(--color-foreground-muted)] flex-shrink-0">
                                    {(issue.scoreImpactTotal as number).toFixed(1)}
                                  </span>
                                )}
                              </div>
                            ))}
                            {standard.materialIssues.length > 5 && (
                              <p className="text-xs text-[var(--color-foreground-subtle)] pt-1">
                                + {standard.materialIssues.length - 5} autres…
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
