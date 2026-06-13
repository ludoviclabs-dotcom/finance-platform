"use client";

/**
 * ExportIxbrlButton — bouton client pour générer et télécharger un document
 * iXBRL ESEF conforme EFRAG taxonomie 2024-12-04.
 *
 * Workflow :
 *   1. Mount → GET /api/datapoints/export-ixbrl pour récupérer le nombre de
 *      datapoints exportables (validated + draft).
 *   2. Clic → ouvre une modal avec : nom entité, identifier (LEI/SIREN),
 *      période start/end, checkbox "Inclure brouillons".
 *   3. Confirmer → POST /api/datapoints/export-ixbrl, lit le blob xhtml,
 *      crée un object URL, déclenche le download navigateur, ferme la modal.
 *
 * Rôles : analyst, admin, auditor, daf (côté API).
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Download,
  FileCode2,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { getAuthToken } from "@/lib/api";

interface ExportIxbrlButtonProps {
  /** Variante visuelle. */
  variant?: "primary" | "secondary";
  /** Taille. */
  size?: "sm" | "md";
  /** Préfille le nom d'entité (ex. : nom company depuis /me). */
  defaultEntityName?: string;
  /** Préfille l'identifiant LEI/SIREN. */
  defaultIdentifier?: string;
}

interface ExportableState {
  exportable_validated: number;
  exportable_draft: number;
  can_export: boolean;
  can_export_draft: boolean;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

function endOfYearIso(): string {
  return `${new Date().getFullYear() - 1}-12-31`;
}

export function ExportIxbrlButton({
  variant = "primary",
  size = "md",
  defaultEntityName = "",
  defaultIdentifier = "",
}: ExportIxbrlButtonProps) {
  const [state, setState] = useState<ExportableState | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fields
  const [entityName, setEntityName] = useState(defaultEntityName);
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [startDate, setStartDate] = useState(() => {
    const lastYear = new Date().getFullYear() - 1;
    return `${lastYear}-01-01`;
  });
  const [endDate, setEndDate] = useState(endOfYearIso);
  const [allowDraft, setAllowDraft] = useState(false);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    fetch("/api/datapoints/export-ixbrl", { headers: authHeaders() })
      .then((res) => res.json())
      .then((json: ExportableState) => {
        if (!cancelled) setState(json);
      })
      .catch(() => {
        if (!cancelled) setState({ exportable_validated: 0, exportable_draft: 0, can_export: false, can_export_draft: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch("/api/datapoints/export-ixbrl", { headers: authHeaders() });
      if (res.ok) {
        const json = (await res.json()) as ExportableState;
        setState(json);
      }
    } catch {
      // best-effort
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/datapoints/export-ixbrl", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          entity: {
            name: entityName.trim(),
            identifier: identifier.trim(),
          },
          period: { startDate, endDate },
          allowDraft,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(body.message ?? body.error ?? `Export échoué (${res.status})`);
      }

      // Déclenche le téléchargement
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `rapport-csrd-${endDate}.xhtml`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      // Refresh state pour reflter qu'on a exporté (optionnel)
      await refreshState();

      // Fermer la modal
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'export");
    } finally {
      setSubmitting(false);
    }
  }, [entityName, identifier, startDate, endDate, allowDraft, refreshState]);

  const validatedCount = state?.exportable_validated ?? 0;
  const draftCount = state?.exportable_draft ?? 0;
  const canExport = state?.can_export ?? false;
  const canExportDraft = state?.can_export_draft ?? false;
  const formValid = entityName.trim().length > 0 && identifier.trim().length > 0;
  const totalFacts = allowDraft ? draftCount : validatedCount;

  // Style classes
  const sizeCls = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";
  const variantCls =
    variant === "primary"
      ? "bg-carbon-emerald text-white hover:bg-carbon-emerald-light disabled:opacity-50"
      : "border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canExport && !canExportDraft}
        title={
          canExport || canExportDraft
            ? `Exporter le rapport CSRD au format iXBRL ESEF`
            : "Validez au moins un datapoint avant l'export"
        }
        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors ${sizeCls} ${variantCls}`}
        data-testid="export-ixbrl-button"
      >
        <FileCode2 className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
        Exporter iXBRL
        {validatedCount > 0 && (
          <span
            className={`ml-1 px-1.5 rounded-full text-[10px] ${
              variant === "primary" ? "bg-white/20" : "bg-carbon-emerald/15 text-carbon-emerald-light"
            }`}
          >
            {validatedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-[var(--color-border)]">
              <div>
                <h3 className="font-display font-bold text-base text-[var(--color-foreground)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-carbon-emerald" />
                  Exporter iXBRL ESEF
                </h3>
                <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                  Document XHTML conforme EFRAG taxonomie 2024-12-04, prêt pour soumission auditeur ou ESEF.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="flex-shrink-0 p-1 rounded-md hover:bg-[var(--color-surface-muted)] text-[var(--color-foreground-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-[var(--color-success)]">
                    Validés (officiel)
                  </p>
                  <p className="text-xl font-extrabold text-[var(--color-success)]">{validatedCount}</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-amber-700">
                    +Brouillons
                  </p>
                  <p className="text-xl font-extrabold text-amber-700">{draftCount - validatedCount}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
                  Nom de l&apos;entité <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="Ex. : Exemplia Industrie"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald/40"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
                  Identifiant LEI ou SIREN <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="LEI 20 caractères ou SIREN 9 chiffres"
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald/40"
                  disabled={submitting}
                />
                <p className="text-[10px] text-[var(--color-foreground-subtle)] mt-1">
                  Si LEI : scheme automatique http://standards.iso.org/iso/17442
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
                    Début exercice
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald/40"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
                    Fin exercice
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald/40"
                    disabled={submitting}
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={allowDraft}
                  onChange={(e) => setAllowDraft(e.target.checked)}
                  disabled={submitting}
                  className="mt-0.5"
                />
                <span className="text-[var(--color-foreground-muted)]">
                  Inclure les datapoints <strong>extraits non validés</strong> (le fichier sera nommé{" "}
                  <code className="px-1 bg-amber-50 text-amber-700 rounded">DRAFT</code>)
                </span>
              </label>

              {error && (
                <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--color-danger)]">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/50">
              <p className="text-[10px] text-[var(--color-foreground-muted)]">
                {totalFacts} fait{totalFacts !== 1 ? "s" : ""} sera{totalFacts !== 1 ? "ont" : ""} taggé
                {totalFacts !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface)]"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !formValid || totalFacts === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-carbon-emerald text-white hover:bg-carbon-emerald-light disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {submitting ? "Génération…" : "Télécharger iXBRL"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
