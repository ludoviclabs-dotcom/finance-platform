/**
 * FeatureStatusBadge — pastille de statut produit, rendue EXCLUSIVEMENT à partir
 * du registre (lib/feature-registry). Aucun composant ne doit coder un statut en
 * dur : passez un `status` issu du registre, ou un `featureId` que le badge
 * résout lui-même.
 *
 * Statuts : live (vert) · beta (ambre) · planifie (gris) · roadmap (gris-bleu).
 */

import { CheckCircle2, CircleDashed, FlaskConical, Map } from "lucide-react";

import {
  getFeature,
  STATUS_LABEL,
  type IntegrationStatus,
} from "@/lib/feature-registry";

interface FeatureStatusBadgeProps {
  /** Statut explicite (issu du registre). Ignoré si `featureId` est fourni. */
  status?: IntegrationStatus;
  /** Id de feature : le badge lit son statut dans le registre. */
  featureId?: string;
  size?: "xs" | "sm";
  showIcon?: boolean;
}

const STATUS_CONFIG: Record<
  IntegrationStatus,
  { cls: string; Icon: React.ElementType }
> = {
  live: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: CheckCircle2,
  },
  beta: {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: FlaskConical,
  },
  planifie: {
    cls: "bg-neutral-50 text-neutral-500 border-neutral-200",
    Icon: CircleDashed,
  },
  roadmap: {
    cls: "bg-slate-50 text-slate-500 border-slate-200",
    Icon: Map,
  },
};

export function FeatureStatusBadge({
  status,
  featureId,
  size = "xs",
  showIcon = true,
}: FeatureStatusBadgeProps) {
  const resolved: IntegrationStatus = featureId
    ? getFeature(featureId).statut
    : (status ?? "planifie");
  const { cls, Icon } = STATUS_CONFIG[resolved];
  const label = STATUS_LABEL[resolved];
  const sizeCls =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : "text-xs px-2 py-0.5 gap-1.5";
  const iconSize = size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${sizeCls} ${cls}`}
      data-testid={`feature-status-badge-${resolved}`}
      aria-label={`Statut : ${label}`}
    >
      {showIcon && <Icon className={iconSize} aria-hidden />}
      {label}
    </span>
  );
}
