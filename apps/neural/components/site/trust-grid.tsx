/**
 * TrustGrid — composant réutilisable pour afficher les badges de crédibilité
 * (hosting, conformité, partenariat, etc.).
 *
 * 3 variantes : grid (cards 3-4 col), strip (ligne horizontale compacte),
 * single (badge unique inline).
 *
 * Honnêteté : les badges utilisent le statut "by-design" / "in-progress" /
 * "roadmap" pour rester cohérents avec PUBLIC_CLAIMS (qui ne masque pas les
 * limites). Aucun badge ne ment sur le niveau d'engagement réel.
 */

import {
  ShieldCheck,
  Cloud,
  Sparkles,
  FileCheck2,
  TrendingUp,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

export type TrustBadgeStatus = "active" | "in-progress" | "roadmap" | "by-design";

export interface TrustBadge {
  id: string;
  label: string;
  icon: LucideIcon;
  status: TrustBadgeStatus;
  tooltip: string;
  href?: string;
}

const STATUS_LABELS: Record<TrustBadgeStatus, string> = {
  active: "Actif",
  "in-progress": "En cours",
  roadmap: "Roadmap",
  "by-design": "Par design",
};

const STATUS_CLASSES: Record<TrustBadgeStatus, string> = {
  active: "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300",
  "in-progress": "border-violet-400/30 bg-violet-400/[0.10] text-violet-200",
  roadmap: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
  "by-design": "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200",
};

/**
 * Badges par défaut — honnêtes vis-à-vis de PUBLIC_CLAIMS.
 * Pas d'engagement non vérifiable.
 */
export const DEFAULT_TRUST_BADGES: TrustBadge[] = [
  {
    id: "hosting-eu",
    label: "Hosting EU",
    icon: Cloud,
    status: "by-design",
    tooltip:
      "Vercel (Frankfurt/CDG) + Neon Postgres (eu-central) + Anthropic API. Architecture régionale documentée.",
    href: "/trust",
  },
  {
    id: "rgpd",
    label: "RGPD by design",
    icon: ShieldCheck,
    status: "by-design",
    tooltip:
      "Sous-processeurs publics, DPA disponible, minimisation des données dans le runtime public.",
    href: "/trust",
  },
  {
    id: "ai-act",
    label: "AI Act Ready",
    icon: FileCheck2,
    status: "by-design",
    tooltip:
      "Classification des agents par niveau de risque, supervision humaine par défaut, audit trail.",
    href: "/conformite/ai-act",
  },
  {
    id: "audit-trail",
    label: "Audit Trail",
    icon: ScrollText,
    status: "in-progress",
    tooltip:
      "Operator Gateway : journalisation signée des décisions agent. Démo publique en construction.",
    href: "/roadmap",
  },
  {
    id: "anthropic",
    label: "Routage Claude",
    icon: Sparkles,
    status: "active",
    tooltip:
      "Chat public routé via Vercel AI Gateway. Claude Sonnet 4.6 principal, GPT préparé en fallback.",
    href: "/trust",
  },
  {
    id: "roi-contract",
    label: "ROI cadré",
    icon: TrendingUp,
    status: "by-design",
    tooltip:
      "Méthodologie de cadrage outcome-first avant développement. Pas une garantie juridique.",
    href: "/forfaits",
  },
];

interface TrustGridProps {
  variant?: "grid" | "strip" | "single";
  badges?: TrustBadge[];
  className?: string;
  showStatusLabel?: boolean;
}

export function TrustGrid({
  variant = "grid",
  badges = DEFAULT_TRUST_BADGES,
  className = "",
  showStatusLabel = true,
}: TrustGridProps) {
  if (variant === "single") {
    const badge = badges[0];
    if (!badge) return null;
    return <TrustBadgeChip badge={badge} className={className} showStatusLabel={showStatusLabel} />;
  }

  if (variant === "strip") {
    return (
      <div
        className={`flex flex-wrap items-center justify-center gap-2 md:gap-3 ${className}`}
      >
        {badges.map((badge) => (
          <TrustBadgeChip
            key={badge.id}
            badge={badge}
            showStatusLabel={false}
            compact
          />
        ))}
      </div>
    );
  }

  // grid variant
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {badges.map((badge) => (
        <TrustBadgeCard key={badge.id} badge={badge} />
      ))}
    </div>
  );
}

function TrustBadgeChip({
  badge,
  className = "",
  showStatusLabel = true,
  compact = false,
}: {
  badge: TrustBadge;
  className?: string;
  showStatusLabel?: boolean;
  compact?: boolean;
}) {
  const Icon = badge.icon;
  const inner = (
    <span
      className={`group relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
        compact ? "text-[11px]" : "text-xs"
      } font-semibold tracking-wide ${STATUS_CLASSES[badge.status]} ${className}`}
      title={badge.tooltip}
    >
      <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      <span>{badge.label}</span>
      {showStatusLabel ? (
        <span className="text-[10px] uppercase tracking-[0.16em] opacity-70">
          {STATUS_LABELS[badge.status]}
        </span>
      ) : null}
    </span>
  );

  return badge.href ? (
    <a href={badge.href} className="no-underline">
      {inner}
    </a>
  ) : (
    inner
  );
}

function TrustBadgeCard({ badge }: { badge: TrustBadge }) {
  const Icon = badge.icon;
  const inner = (
    <div
      className={`group relative flex flex-col gap-3 rounded-[20px] border bg-white/[0.04] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06] ${
        STATUS_CLASSES[badge.status].replace("text-", "border-").split(" ")[0]
      }/40`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${STATUS_CLASSES[badge.status]}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${STATUS_CLASSES[badge.status]}`}
        >
          {STATUS_LABELS[badge.status]}
        </span>
      </div>
      <div>
        <p className="font-display text-base font-bold tracking-tight text-white">
          {badge.label}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">
          {badge.tooltip}
        </p>
      </div>
    </div>
  );

  return badge.href ? (
    <a href={badge.href} className="no-underline">
      {inner}
    </a>
  ) : (
    inner
  );
}
