"use client";

/**
 * AuditModeToggle — switch pour activer/désactiver le mode audit.
 * À placer dans le header de layout (à côté du nom d'utilisateur) ou en sidebar.
 */

import { Eye, EyeOff } from "lucide-react";

import { useAuditMode } from "@/lib/hooks/use-audit-mode";

export function AuditModeToggle() {
  const { enabled, toggle } = useAuditMode();

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border transition-colors ${
        enabled
          ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]"
          : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:border-[var(--color-foreground-muted)]"
      }`}
      aria-pressed={enabled}
      aria-label={
        enabled
          ? "Désactiver le mode audit"
          : "Activer le mode audit (affiche hashs + badges statut)"
      }
      data-testid="audit-mode-toggle"
    >
      {enabled ? (
        <Eye className="w-3.5 h-3.5" aria-hidden />
      ) : (
        <EyeOff className="w-3.5 h-3.5" aria-hidden />
      )}
      <span className="font-medium">{enabled ? "Audit" : "Standard"}</span>
    </button>
  );
}

/**
 * AuditModeBanner — bandeau visible uniquement quand le mode audit est activé.
 * À placer en haut du contenu principal.
 */
export function AuditModeBanner() {
  const { enabled, set } = useAuditMode();
  if (!enabled) return null;

  return (
    <div
      className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-4 py-2.5 mb-4 flex items-center justify-between gap-3"
      role="status"
      data-testid="audit-mode-banner"
    >
      <div className="flex items-center gap-2 text-sm text-[var(--color-accent)]">
        <Eye className="w-4 h-4" aria-hidden />
        <span>
          <strong>Mode audit activé</strong> — hashs, badges de statut et
          horodatages visibles sur chaque KPI.
        </span>
      </div>
      <button
        onClick={() => set(false)}
        className="text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] underline"
      >
        Désactiver
      </button>
    </div>
  );
}
