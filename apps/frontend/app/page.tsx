import Link from "next/link";
import {
  ShieldAlert,
  Globe,
  BarChart3,
  AlertTriangle,
  GitMerge,
  Layers,
  Shield,
  Wallet,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ─────────────────────────────────────────────────────────── Types & data ── */

type CriticalityTag = "danger" | "warning" | "success";

interface Module {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  critical: string;
  tag: CriticalityTag;
  tagLabel: string;
  span: 1 | 2 | 3;
}

/* Full class strings — must appear literally for Tailwind scanner */
const spanClass: Record<1 | 2 | 3, string> = {
  1: "",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
};

const tagClass: Record<CriticalityTag, string> = {
  danger:  "badge badge-danger",
  warning: "badge badge-warning",
  success: "badge badge-success",
};

const iconColorClass: Record<CriticalityTag, string> = {
  danger:  "text-danger",
  warning: "text-warning",
  success: "text-success",
};

const stats = [
  {
    value: "4,44 M$",
    label: "Coût moyen d'une cyberattaque",
    source: "IBM Cost of a Data Breach 2025",
  },
  {
    value: "140",
    label: "Juridictions couvertes par le Pilier 2 GloBE",
    source: "OCDE / Cadre inclusif BEPS",
  },
  {
    value: "15 %",
    label: "Taux minimum mondial d'imposition",
    source: "Accord GloBE, applicable dès 2025",
  },
  {
    value: "38",
    label: "Onglets de consolidation IFRS pris en charge",
    source: "IAS 27 / IFRS 10 / IFRS 16",
  },
];

const modules: Module[] = [
  {
    id: "cyber",
    icon: ShieldAlert,
    title: "Cyber Risque",
    description:
      "Quantification financière FAIR des expositions cyber. Coût annualisé de la perte (ALE), probabilité d'incident, ROI des contrôles de sécurité.",
    critical:
      "En 2025, 60 % des PME touchées ferment dans les 6 mois. La quantification monétaire précède toute décision d'assurance ou d'investissement sécurité.",
    tag: "danger",
    tagLabel: "Critique",
    span: 2,
  },
  {
    id: "pilier2",
    icon: Globe,
    title: "Pilier 2 GloBE",
    description:
      "Calcul du TEMI consolidé par juridiction. Complément d'impôt IIR/UTPR, SBIE, QRTC, et taux effectif par entité constitutive.",
    critical:
      "L'IIR est obligatoire depuis janvier 2025 pour les UPE dans les 140 juridictions signataires. La non-conformité expose à des pénalités immédiates.",
    tag: "warning",
    tagLabel: "Réglementaire",
    span: 1,
  },
  {
    id: "analyse",
    icon: BarChart3,
    title: "Analyse d'Entreprise",
    description:
      "Diagnostic financier complet : ratios de liquidité, solvabilité, rentabilité opérationnelle, flux de trésorerie normalisés sur 5 ans.",
    critical:
      "Base indispensable à tout processus d'investissement, de crédit ou d'acquisition. Produit un rapport exécutif de niveau cabinet en un clic.",
    tag: "success",
    tagLabel: "Stratégique",
    span: 1,
  },
  {
    id: "credit",
    icon: AlertTriangle,
    title: "Crédit Risque",
    description:
      "Scoring interne et notation crédit. Calcul de la PD, LGD, EAD et expected loss selon la méthodologie Bâle III/IV IRB avancée.",
    critical:
      "Bâle IV s'applique intégralement dès 2025. Un modèle interne non validé expose l'établissement à des surcharges en capital non anticipées.",
    tag: "warning",
    tagLabel: "Prudentiel",
    span: 1,
  },
  {
    id: "ma",
    icon: GitMerge,
    title: "M&A",
    description:
      "Valorisation multi-méthodes : DCF, comparables transactionnels et boursiers, primes de contrôle, analyse d'accrétion/dilution EPS.",
    critical:
      "Sans modèle structuré, les synergies surestimées génèrent des goodwills mal calibrés et des dépréciations différées coûteuses post-acquisition.",
    tag: "danger",
    tagLabel: "Critique",
    span: 1,
  },
  {
    id: "ifrs",
    icon: Layers,
    title: "Consolidation IFRS",
    description:
      "Éliminations intragroupes, traitement IFRS 10/16, tableaux de flux consolidés, gestion des OCI et des variations de périmètre.",
    critical:
      "IFRS 18 applicable dès janvier 2027 introduit un nouveau format de compte de résultat obligatoire. La migration des modèles doit démarrer maintenant.",
    tag: "warning",
    tagLabel: "Réglementaire",
    span: 2,
  },
  {
    id: "defense",
    icon: Shield,
    title: "Défense & Sécurité Nationale",
    description:
      "Analyse budgétaire capacitaire : OPEX/CAPEX, maintien en condition opérationnelle, programmes d'équipement pluriannuels LPM.",
    critical:
      "Les objectifs OTAN à 2 % du PIB et le réarmement européen imposent une planification pluriannuelle rigoureuse des dépenses de défense.",
    tag: "danger",
    tagLabel: "Critique",
    span: 1,
  },
  {
    id: "patrimoine",
    icon: Wallet,
    title: "Patrimoine & Conseil en Gestion",
    description:
      "Bilan patrimonial consolidé, allocation d'actifs stratégique, optimisation fiscale multi-enveloppes (PER, AV, immobilier), stratégie successorale.",
    critical:
      "La réforme de l'imposition des plus-values 2025 et les nouvelles règles de transmission imposent une révision immédiate des stratégies patrimoniales existantes.",
    tag: "success",
    tagLabel: "Stratégique",
    span: 3,
  },
];

type TimelineVariant = "danger" | "warning" | "info";

interface TimelineEvent {
  date: string;
  title: string;
  detail: string;
  variant: TimelineVariant;
}

const timelineDotClass: Record<TimelineVariant, string> = {
  danger:  "bg-danger",
  warning: "bg-warning",
  info:    "bg-info",
};

const timelineDateClass: Record<TimelineVariant, string> = {
  danger:  "text-danger",
  warning: "text-warning",
  info:    "text-info",
};

const timelineEvents: TimelineEvent[] = [
  {
    date: "Jan. 2025",
    title: "DORA applicable",
    detail: "Résilience numérique obligatoire pour toutes les entités financières UE",
    variant: "danger",
  },
  {
    date: "Jan. 2025",
    title: "Pilier 2 GloBE — IIR",
    detail: "IIR obligatoire pour les UPE dans les 140 juridictions signataires OCDE",
    variant: "danger",
  },
  {
    date: "Mars 2026",
    title: "Omnibus I adopté",
    detail: "CSRD simplifié — seuils relevés, périmètre réduit, reporting allégé",
    variant: "warning",
  },
  {
    date: "Mi-2026",
    title: "NIS2 — Loi Résilience",
    detail: "Transposition française NIS2 attendue, obligations opérateurs essentiels",
    variant: "warning",
  },
  {
    date: "Mi-2026",
    title: "ESRS simplifiés",
    detail: "61 data points retenus, révision des exigences sectorielles EFRAG",
    variant: "warning",
  },
  {
    date: "Jan. 2027",
    title: "IFRS 18 applicable",
    detail: "Nouveau format du compte de résultat — remplace IAS 1 définitivement",
    variant: "info",
  },
];

const complianceBadges: { label: string; cls: string }[] = [
  { label: "IFRS Compliant", cls: "badge badge-info" },
  { label: "PCG 2025",       cls: "badge badge-success" },
  { label: "DORA Ready",     cls: "badge badge-warning" },
  { label: "CSRD Aligned",   cls: "badge badge-success" },
];

/* ──────────────────────────────────────────────────────── Sub-components ── */

function StatCard({
  value,
  label,
  source,
}: {
  value: string;
  label: string;
  source: string;
}) {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <span className="data-label">{label}</span>
      <span className="kpi-value tabnum">{value}</span>
      <span className="text-foreground-subtle text-xs leading-relaxed">{source}</span>
    </div>
  );
}

function ModuleCard({ module }: { module: Module }) {
  const Icon = module.icon;
  return (
    <div className={`card p-6 flex flex-col gap-4 ${spanClass[module.span]}`}>
      <div className="flex items-start justify-between gap-4">
        <Icon
          className={`h-5 w-5 shrink-0 mt-0.5 ${iconColorClass[module.tag]}`}
          strokeWidth={1.75}
        />
        <span className={tagClass[module.tag]}>{module.tagLabel}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-foreground leading-snug">
          {module.title}
        </h3>
        <p className="text-sm text-foreground-muted leading-relaxed">
          {module.description}
        </p>
      </div>

      <div className="mt-auto pt-4 border-t border-border">
        <p className="text-xs text-foreground-subtle leading-relaxed">
          <span className="font-medium text-foreground-muted">
            Pourquoi c&apos;est critique —{" "}
          </span>
          {module.critical}
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── Page ── */

export default function Home() {
  return (
    <div className="flex flex-col min-h-svh">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">
            <span className="text-accent">Finance</span>
            <span className="text-foreground">Platform</span>
          </span>
          <Link
            href="/dashboard"
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            Dashboard →
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="min-h-[84vh] flex items-center bg-background border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-24">
            <div className="max-w-3xl">

              <div className="mb-6">
                <span className="badge badge-info">
                  Plateforme v1.0 — 8 modules actifs
                </span>
              </div>

              <h1 className="font-bold text-foreground mb-6">
                La finance professionnelle,{" "}
                <span className="text-accent">enfin lisible.</span>
              </h1>

              <p className="text-foreground-muted leading-relaxed mb-10 max-w-2xl"
                style={{ fontSize: "var(--text-xl)" }}>
                8 modules d&apos;analyse, des diagnostics automatiques, des rapports
                PDF niveau cabinet de conseil — en quelques clics.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-medium text-sm rounded-md hover:bg-accent-hover transition-colors"
                >
                  Démarrer une analyse
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <a
                  href="#modules"
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-foreground-muted text-sm font-medium rounded-md hover:text-foreground hover:border-border-strong transition-colors"
                >
                  Découvrir les modules
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>

            </div>
          </div>
        </section>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <section className="bg-surface border-b border-border py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="data-label mb-8">Chiffres clés du contexte réglementaire 2025</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Modules bento ─────────────────────────────────────────────── */}
        <section id="modules" className="bg-background border-b border-border py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="mb-12">
              <h2 className="text-foreground mb-3">Les 8 modules</h2>
              <p className="text-foreground-muted max-w-2xl"
                style={{ fontSize: "var(--text-lg)" }}>
                De la quantification du risque cyber à la gestion patrimoniale,
                chaque module produit un diagnostic structuré et un rapport exportable.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((mod) => (
                <ModuleCard key={mod.id} module={mod} />
              ))}
            </div>

          </div>
        </section>

        {/* ── Timeline réglementaire ─────────────────────────────────────── */}
        <section className="bg-surface border-b border-border py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="mb-12">
              <h2 className="text-foreground mb-3">Timeline réglementaire</h2>
              <p className="text-foreground-muted" style={{ fontSize: "var(--text-lg)" }}>
                Les échéances critiques à anticiper.
              </p>
            </div>

            {/* Horizontal scroll on small screens */}
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <div className="min-w-[680px]">

                <div className="relative">
                  {/* Connecting line — top-3 aligns with center of h-6 dots */}
                  <div className="absolute top-3 left-0 right-0 h-px bg-border-strong pointer-events-none" />

                  <div className="grid grid-cols-6 gap-3">
                    {timelineEvents.map((event, i) => (
                      <div key={i} className="flex flex-col">

                        {/* Dot row */}
                        <div className="h-6 flex items-center mb-5 relative z-10">
                          <div
                            className={`h-6 w-6 rounded-full border-2 border-surface shrink-0 ${timelineDotClass[event.variant]}`}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex flex-col gap-1 pr-1">
                          <span
                            className={`tabnum text-xs font-semibold ${timelineDateClass[event.variant]}`}
                          >
                            {event.date}
                          </span>
                          <span className="text-sm font-semibold text-foreground leading-snug">
                            {event.title}
                          </span>
                          <span className="text-xs text-foreground-subtle leading-relaxed">
                            {event.detail}
                          </span>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </section>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-surface border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <nav className="flex flex-wrap gap-5">
              {["Mentions légales", "RGPD", "Contact"].map((label) => (
                <a
                  key={label}
                  href="#"
                  className="text-sm text-foreground-muted hover:text-foreground transition-colors"
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="flex flex-wrap gap-2">
              {complianceBadges.map(({ label, cls }) => (
                <span key={label} className={cls}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-foreground-subtle">
              © {new Date().getFullYear()} Finance Platform. Tous droits réservés.
            </p>
            <p className="text-xs text-foreground-subtle">
              Données à des fins d&apos;illustration uniquement. Consultez un professionnel agréé.
            </p>
          </div>

        </div>
      </footer>

    </div>
  );
}
