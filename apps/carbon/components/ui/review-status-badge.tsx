"use client";

/**
 * ReviewStatusBadge — pastille visuelle du statut de review d'un datapoint.
 *
 * 5 statuts :
 *   proposed   — gris, "Proposé"
 *   in_review  — bleu, "En revue"
 *   validated  — vert, "Validé"
 *   frozen     — violet, "Figé"
 *   rejected   — rouge, "Rejeté"
 */

import {
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  XCircle,
} from "lucide-react";

import type { ReviewStatus } from "@/lib/api";

interface ReviewStatusBadgeProps {
  status: ReviewStatus;
  size?: "xs" | "sm";
  showIcon?: boolean;
}

const STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; cls: string; Icon: React.ElementType }
> = {
  proposed: {
    label: "Proposé",
    cls: "bg-[var(--color-surface-muted)] text-[var(--color-foreground-muted)] border-[var(--color-border)]",
    Icon: FileText,
  },
  in_review: {
    label: "En revue",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    Icon: Clock,
  },
  validated: {
    label: "Validé",
    cls: "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]/30",
    Icon: CheckCircle2,
  },
  frozen: {
    label: "Figé",
    cls: "bg-violet-50 text-violet-700 border-violet-200",
    Icon: Lock,
  },
  rejected: {
    label: "Rejeté",
    cls: "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger)]/30",
    Icon: XCircle,
  },
};

export function ReviewStatusBadge({
  status,
  size = "xs",
  showIcon = true,
}: ReviewStatusBadgeProps) {
  const { label, cls, Icon } = STATUS_CONFIG[status];
  const sizeCls =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : "text-xs px-2 py-0.5 gap-1.5";
  const iconSize = size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeCls} ${cls}`}
      data-testid={`review-status-badge-${status}`}
      aria-label={`Statut : ${label}`}
    >
      {showIcon && <Icon className={iconSize} aria-hidden />}
      {label}
    </span>
  );
}
