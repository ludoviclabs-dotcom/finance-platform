"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  Shield,
  BarChart3,
  Globe,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { pageVariants, staggerContainer, staggerItem } from "@/lib/animations";
import { useCarbonSnapshot } from "@/lib/hooks/use-carbon-snapshot";
import { useVsmeSnapshot } from "@/lib/hooks/use-vsme-snapshot";
import { useEsgSnapshot } from "@/lib/hooks/use-esg-snapshot";
import { exportEsgSynthesisPdf } from "@/lib/pdf-export";

const reports = [
  {
    id: 1,
    title: "Rapport CSRD Annuel 2025",
    type: "CSRD",
    status: "ready" as const,
    date: "15 mars 2026",
    pages: 124,
    icon: FileText,
    description: "Rapport de durabilité complet — 12 ESRS, double matérialité, KPIs vérifiés",
  },
  {
    id: 2,
    title: "Bilan Carbone T4 2025",
    type: "GHG",
    status: "ready" as const,
    date: "10 jan 2026",
    pages: 48,
    icon: BarChart3,
    description: "Scope 1, 2, 3 — Méthode Bilan Carbone® ADEME",
  },
  {
    id: 3,
    title: "Déclaration CBAM Q1 2026",
    type: "CBAM",
    status: "draft" as const,
    date: "En cours",
    pages: 16,
    icon: Globe,
    description: "Importations acier & aluminium — déclaration trimestrielle",
  },
  {
    id: 4,
    title: "Rapport Taxonomie 2025",
    type: "Taxonomie",
    status: "ready" as const,
    date: "28 fév 2026",
    pages: 36,
    icon: Shield,
    description: "Éligibilité et alignement — 6 objectifs environnementaux",
  },
  {
    id: 5,
    title: "Plan de Transition SBTi",
    type: "SBTi",
    status: "draft" as const,
    date: "En cours",
    pages: 28,
    icon: BarChart3,
    description: "Trajectoire 1,5°C — objectifs near-term et net-zero",
  },
];

const statusConfig = {
  ready: { label: "Prêt", color: "text-[var(--color-success)]", bg: "bg-[var(--color-success-bg)]", Icon: CheckCircle },
  draft: { label: "Brouillon", color: "text-[var(--color-warning)]", bg: "bg-[var(--color-warning-bg)]", Icon: Clock },
};

export function ReportsPage() {
  const carbonSnap = useCarbonSnapshot();
  const vsmeSnap = useVsmeSnapshot();
  const esgSnap = useEsgSnapshot();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const anyLoading =
    carbonSnap.status === "loading" ||
    vsmeSnap.status === "loading" ||
    esgSnap.status === "loading";
  const anyReady =
    carbonSnap.status === "ready" ||
    vsmeSnap.status === "ready" ||
    esgSnap.status === "ready";

  const handleExport = () => {
    setExportError(null);
    setExporting(true);
    try {
      exportEsgSynthesisPdf({
        carbon: carbonSnap.status === "ready" ? carbonSnap.data : null,
        vsme: vsmeSnap.status === "ready" ? vsmeSnap.data : null,
        esg: esgSnap.status === "ready" ? esgSnap.data : null,
      });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div {...pageVariants} className="p-6 space-y-6">
      <SectionTitle
        title="Rapports & Exports"
        subtitle="Générez et exportez vos rapports réglementaires ESG"
      />

      {/* ── Hero export ── */}
      <div className="rounded-2xl border border-carbon-emerald/30 bg-gradient-to-br from-carbon-emerald/10 to-cyan-500/5 p-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-carbon-emerald/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-carbon-emerald" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-bold text-[var(--color-foreground)] mb-1">
            Export synthèse ESG — PDF
          </h2>
          <p className="text-sm text-[var(--color-foreground-muted)] mb-3">
            Génère un rapport PDF multi-pages : indicateurs carbone, VSME, double matérialité
            et avertissements, à partir des dernières données synchronisées.
          </p>
          {exportError && (
            <div className="mb-3 flex items-center gap-2 p-2 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{exportError}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || anyLoading || !anyReady}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {exporting || anyLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {anyLoading ? "Chargement des données…" : "Génération…"}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Télécharger la synthèse PDF
              </>
            )}
          </button>
          {!anyReady && !anyLoading && (
            <p className="mt-2 text-xs text-[var(--color-foreground-muted)]">
              Aucun snapshot disponible — vérifiez la connexion à l&apos;API.
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          { label: "Rapports générés", value: "12", sub: "cette année" },
          { label: "Pages produites", value: "486", sub: "total cumulé" },
          { label: "Conformité audit", value: "98%", sub: "taux de validation" },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={staggerItem}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center"
          >
            <p className="text-3xl font-display font-bold text-[var(--color-foreground)]">
              {stat.value}
            </p>
            <p className="text-sm text-[var(--color-foreground-muted)]">{stat.label}</p>
            <p className="text-xs text-[var(--color-foreground-subtle)]">{stat.sub}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Reports list */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-3"
      >
        {reports.map((report) => {
          const { label, color, bg, Icon: StatusIcon } = statusConfig[report.status];
          const ReportIcon = report.icon;

          return (
            <motion.div
              key={report.id}
              variants={staggerItem}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex items-center gap-4 hover:border-[var(--color-border-strong)] transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-carbon-emerald/10 flex items-center justify-center text-carbon-emerald flex-shrink-0">
                <ReportIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-[var(--color-foreground)]">{report.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-foreground-muted)]">
                    {report.type}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-foreground-muted)]">{report.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-foreground-subtle)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {report.date}
                  </span>
                  <span>{report.pages} pages</span>
                  <span className={`flex items-center gap-1 ${color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {label}
                  </span>
                </div>
              </div>
              {report.status === "ready" && (
                <button className="px-4 py-2 rounded-lg bg-carbon-emerald text-white text-sm font-medium hover:bg-carbon-emerald/90 transition-colors flex items-center gap-2 cursor-pointer">
                  <Download className="w-4 h-4" />
                  PDF
                </button>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
