import Link from "next/link";
import {
  FileText,
  ChevronRight,
  ShieldAlert,
  Globe,
  BarChart3,
  AlertTriangle,
  GitMerge,
  Layers,
  Shield,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ─────────────────────────────────────────────────────────── Types & data ── */

type ModuleStatus = "Terminé" | "En cours" | "En attente";
type AlertSeverity = "danger" | "warning" | "info";

interface ModuleEntry {
  id: string;
  icon: LucideIcon;
  title: string;
  status: ModuleStatus;
  lastAnalysis: string | null;
  indicatorLabel: string;
  indicatorValue: string;
  indicatorSentiment: "pos" | "neg" | "null";
}

interface Alert {
  title: string;
  detail: string;
  severity: AlertSeverity;
  tag: string;
}

interface ActivityEvent {
  date: string;
  module: string;
  title: string;
  detail: string;
}

/* -- Lookup tables: full class strings present for Tailwind scanner --------- */

const statusDotClass: Record<ModuleStatus, string> = {
  "Terminé":    "bg-success",
  "En cours":   "bg-warning",
  "En attente": "bg-foreground-subtle",
};

const statusBadgeClass: Record<ModuleStatus, string> = {
  "Terminé":    "badge badge-success",
  "En cours":   "badge badge-warning",
  "En attente": "badge badge-neutral",
};

const alertAccentClass: Record<AlertSeverity, string> = {
  danger:  "bg-danger",
  warning: "bg-warning",
  info:    "bg-info",
};

const alertTagClass: Record<AlertSeverity, string> = {
  danger:  "badge badge-danger",
  warning: "badge badge-warning",
  info:    "badge badge-info",
};

const sentimentClass: Record<"pos" | "neg" | "null", string> = {
  pos:  "val-pos",
  neg:  "val-neg",
  null: "val-null",
};

const activityDotClass = [
  "bg-danger",
  "bg-warning",
  "bg-success",
  "bg-info",
  "bg-success",
];

/* -- Module data -------------------------------------------------------------- */

const modules: ModuleEntry[] = [
  {
    id: "cyber",
    icon: ShieldAlert,
    title: "Cyber Risque",
    status: "Terminé",
    lastAnalysis: "15 mars 2026",
    indicatorLabel: "ALE annualisée",
    indicatorValue: "2,40 M€",
    indicatorSentiment: "neg",
  },
  {
    id: "pilier2",
    icon: Globe,
    title: "Pilier 2 GloBE",
    status: "En cours",
    lastAnalysis: "18 mars 2026",
    indicatorLabel: "ETR consolidé",
    indicatorValue: "12,3 %",
    indicatorSentiment: "neg",
  },
  {
    id: "analyse",
    icon: BarChart3,
    title: "Analyse d'Entreprise",
    status: "Terminé",
    lastAnalysis: "10 mars 2026",
    indicatorLabel: "Score santé",
    indicatorValue: "7,2 / 10",
    indicatorSentiment: "pos",
  },
  {
    id: "credit",
    icon: AlertTriangle,
    title: "Crédit Risque",
    status: "En attente",
    lastAnalysis: null,
    indicatorLabel: "PD moyenne",
    indicatorValue: "—",
    indicatorSentiment: "null",
  },
  {
    id: "ma",
    icon: GitMerge,
    title: "M&A",
    status: "En cours",
    lastAnalysis: "19 mars 2026",
    indicatorLabel: "Valorisation DCF",
    indicatorValue: "45,2 M€",
    indicatorSentiment: "pos",
  },
  {
    id: "ifrs",
    icon: Layers,
    title: "Consolidation IFRS",
    status: "En attente",
    lastAnalysis: null,
    indicatorLabel: "Écart d'élimination",
    indicatorValue: "—",
    indicatorSentiment: "null",
  },
  {
    id: "defense",
    icon: Shield,
    title: "Défense",
    status: "Terminé",
    lastAnalysis: "12 mars 2026",
    indicatorLabel: "OPEX / CAPEX",
    indicatorValue: "68 / 32",
    indicatorSentiment: "null",
  },
  {
    id: "patrimoine",
    icon: Wallet,
    title: "Patrimoine PL",
    status: "En cours",
    lastAnalysis: "19 mars 2026",
    indicatorLabel: "Patrimoine net",
    indicatorValue: "3,24 M€",
    indicatorSentiment: "pos",
  },
];

/* -- Alert data --------------------------------------------------------------- */

const alerts: Alert[] = [
  {
    title: "ETR Irlande à 10,46 % — inférieur au seuil GloBE de 15 %",
    detail:
      "Un complément d'impôt IIR doit être calculé et déclaré avant la clôture de l'exercice.",
    severity: "danger",
    tag: "Pilier 2 GloBE",
  },
  {
    title: "ALE cyber non assurée à 840 K€ — couverture insuffisante",
    detail:
      "Le plafond de la police en vigueur (200 K€) couvre 24 % de la perte annualisée estimée.",
    severity: "danger",
    tag: "Cyber Risque",
  },
  {
    title: "PD Contrepartie A en hausse : 4,2 % > seuil d'alerte 3,5 %",
    detail:
      "Révision du classement interne recommandée. Exposition au bilan : 6,8 M€.",
    severity: "warning",
    tag: "Crédit Risque",
  },
  {
    title: "IFRS 18 : migration du compte de résultat non initiée",
    detail:
      "Application obligatoire en janvier 2027. La retraite des exercices comparatifs requiert 12 à 18 mois.",
    severity: "warning",
    tag: "Consolidation IFRS",
  },
  {
    title: "Optimisation PER non exploitée — plafond disponible 12 K€",
    detail:
      "La déduction fiscale additionnelle représente une économie d'impôt estimée à 5,4 K€ sur l'exercice.",
    severity: "info",
    tag: "Patrimoine PL",
  },
];

/* -- Activity data ------------------------------------------------------------ */

const activity: ActivityEvent[] = [
  {
    date: "19 mars 2026, 14 h 32",
    module: "M&A",
    title: "Valorisation DCF mise à jour",
    detail: "Nouvelle projection 5 ans intégrée — DCF : 45,2 M€, multiples : 42,8 M€.",
  },
  {
    date: "18 mars 2026, 10 h 15",
    module: "Pilier 2 GloBE",
    title: "Données Irlande importées",
    detail: "TEMI recalculé à 12,3 % — alerte ETR générée automatiquement.",
  },
  {
    date: "15 mars 2026, 09 h 00",
    module: "Cyber Risque",
    title: "Rapport PDF exporté",
    detail: "Rapport d'analyse FAIR finalisé, 24 pages. ALE consolidée : 2,40 M€.",
  },
  {
    date: "12 mars 2026, 16 h 48",
    module: "Défense",
    title: "Analyse LPM 2025-2030 finalisée",
    detail: "OPEX/CAPEX 68/32, budget consolidé sur 5 exercices.",
  },
  {
    date: "10 mars 2026, 11 h 27",
    module: "Analyse d'Entreprise",
    title: "Diagnostic financier terminé",
    detail: "Score santé global : 7,2/10. Rapport exécutif généré.",
  },
];

/* ──────────────────────────────────────────────────────── Sub-components ── */

function ModuleCard({ entry }: { entry: ModuleEntry }) {
  const Icon = entry.icon;
  const isReady = entry.status === "Terminé";
  const actionLabel = isReady ? "Voir le rapport" : entry.status === "En cours" ? "Reprendre" : "Lancer l'analyse";

  return (
    <div className="card p-5 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full shrink-0 ${statusDotClass[entry.status]}`} />
          <span className="text-sm font-semibold text-foreground leading-snug">
            {entry.title}
          </span>
        </div>
        <Icon className="h-4 w-4 shrink-0 text-foreground-subtle mt-0.5" strokeWidth={1.75} />
      </div>

      {/* Indicator */}
      <div className="flex flex-col gap-0.5">
        <span className="data-label">{entry.indicatorLabel}</span>
        <span className={`tabnum text-xl font-bold leading-none ${sentimentClass[entry.indicatorSentiment]}`}>
          {entry.indicatorValue}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className={statusBadgeClass[entry.status]}>{entry.status}</span>
          {entry.lastAnalysis ? (
            <span className="text-xs text-foreground-subtle tabnum">
              {entry.lastAnalysis}
            </span>
          ) : (
            <span className="text-xs text-foreground-subtle">Aucune analyse</span>
          )}
        </div>

        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors shrink-0"
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AlertItem({ alert }: { alert: Alert }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden flex">
      {/* Left accent bar */}
      <div className={`w-1 shrink-0 ${alertAccentClass[alert.severity]}`} />

      {/* Content */}
      <div className="flex-1 px-4 py-3.5 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">
            {alert.title}
          </p>
          <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
            {alert.detail}
          </p>
        </div>
        <span className={`shrink-0 mt-0.5 ${alertTagClass[alert.severity]}`}>
          {alert.tag}
        </span>
      </div>
    </div>
  );
}

function ActivityItem({
  event,
  dotClass,
  isLast,
}: {
  event: ActivityEvent;
  dotClass: string;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      {/* Left column: dot + connector line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`h-3.5 w-3.5 rounded-full shrink-0 mt-0.5 ${dotClass}`} />
        {!isLast && <div className="flex-1 w-px bg-border mt-2" />}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? "pb-0" : ""}`}>
        <p className="text-xs text-foreground-subtle tabnum mb-0.5">{event.date}</p>
        <p className="text-sm font-semibold text-foreground leading-snug">{event.title}</p>
        <p className="text-xs text-foreground-muted mt-1 leading-relaxed">{event.detail}</p>
        <span className="badge badge-neutral mt-2">{event.module}</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── Page ── */

export default function Dashboard() {
  const today = new Date();
  const formattedDate = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dateLabel = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const terminé = modules.filter((m) => m.status === "Terminé").length;
  const enCours = modules.filter((m) => m.status === "En cours").length;
  const enAttente = modules.filter((m) => m.status === "En attente").length;

  return (
    <div className="flex flex-col min-h-svh">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight"
            >
              <span className="text-accent">Finance</span>
              <span className="text-foreground">Platform</span>
            </Link>
            <span className="text-border-strong select-none">·</span>
            <span className="text-sm text-foreground-muted">Dashboard</span>
          </div>
          <span className="text-xs text-foreground-subtle tabnum">{dateLabel}</span>
        </div>
      </header>

      <main className="flex-1 bg-background py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12">

          {/* ── Page header ─────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <h1 className="text-foreground mb-1">
                Vue d&apos;ensemble des diagnostics
              </h1>
              <p className="text-foreground-muted" style={{ fontSize: "var(--text-base)" }}>
                {dateLabel}
              </p>

              {/* Module counters */}
              <div className="flex flex-wrap gap-3 mt-4">
                <span className="badge badge-success">{terminé} terminé{terminé > 1 ? "s" : ""}</span>
                <span className="badge badge-warning">{enCours} en cours</span>
                <span className="badge badge-neutral">{enAttente} en attente</span>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-sm font-medium text-foreground-muted rounded-md hover:text-foreground hover:border-border-strong transition-colors self-start sm:self-auto shrink-0"
            >
              <FileText className="h-4 w-4" />
              Générer un rapport global
            </button>
          </div>

          {/* ── Module status grid ──────────────────────────────────────── */}
          <section>
            <p className="data-label mb-5">Statut des modules</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {modules.map((entry) => (
                <ModuleCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>

          {/* ── Alerts + Activity ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Alertes prioritaires */}
            <section className="lg:col-span-2 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <p className="data-label">Alertes prioritaires</p>
                <span className="badge badge-danger">{alerts.length} actives</span>
              </div>
              <div className="flex flex-col gap-3">
                {alerts.map((alert, i) => (
                  <AlertItem key={i} alert={alert} />
                ))}
              </div>
            </section>

            {/* Activité récente */}
            <section className="flex flex-col gap-5">
              <p className="data-label">Activité récente</p>
              <div>
                {activity.map((event, i) => (
                  <ActivityItem
                    key={i}
                    event={event}
                    dotClass={activityDotClass[i]}
                    isLast={i === activity.length - 1}
                  />
                ))}
              </div>
            </section>

          </div>

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-surface border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-foreground-subtle">
            © {new Date().getFullYear()} Finance Platform — Données simulées à des fins de démonstration.
          </p>
          <div className="flex gap-4">
            {["Mentions légales", "RGPD", "Contact"].map((label) => (
              <a
                key={label}
                href="#"
                className="text-xs text-foreground-subtle hover:text-foreground-muted transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
