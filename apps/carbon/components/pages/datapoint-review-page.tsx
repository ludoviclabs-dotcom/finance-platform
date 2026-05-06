"use client";

/**
 * DatapointReviewPage — interface de review datapoint-par-datapoint (Chantier D).
 *
 * Affiche tous les datapoints ESRS extraits en attente de validation, avec :
 *   - Barre de confiance IA (0-100 %)
 *   - Valeur extraite + unité
 *   - Statut (extracted → validated / rejected)
 *   - Bouton "Sources" → ouvre SourceSidePanel avec les citations
 *   - Actions : Accepter / Surcharger / Rejeter
 *   - Filtre par standard ESRS et par statut
 *
 * Rôles autorisés à review : analyst, admin, auditor, daf.
 * En lecture seule pour les autres rôles.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileSearch,
  Filter,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { SourceSidePanel } from "@/components/review/source-side-panel";
import { getAuthToken } from "@/lib/api";
import type {
  EsrsDatapointDef,
  ExtractedDatapoint,
  SourceCitation,
  Standard,
} from "@/lib/esrs/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusFilter = "extracted" | "validated" | "rejected" | "ALL";
type StandardFilter = Standard | "ALL";

type ListResponse = {
  version: string;
  definitions: EsrsDatapointDef[];
  state: {
    cid: string;
    updatedAt: string;
    datapoints: Record<string, ExtractedDatapoint>;
  };
};

type ReviewAction = "accept" | "override" | "reject";

interface OverrideModal {
  datapointId: string;
  label: string;
  currentValue: ExtractedDatapoint["value"];
  unit?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_META = {
  empty: {
    label: "Vide",
    Icon: Circle,
    color: "text-[var(--color-foreground-subtle)]",
    bg: "bg-[var(--color-foreground-subtle)]/10",
  },
  extracted: {
    label: "Extrait",
    Icon: FileSearch,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  validated: {
    label: "Validé",
    Icon: CheckCircle2,
    color: "text-[var(--color-success)]",
    bg: "bg-[var(--color-success)]/10",
  },
  rejected: {
    label: "Rejeté",
    Icon: XCircle,
    color: "text-[var(--color-danger)]",
    bg: "bg-[var(--color-danger)]/10",
  },
} as const;

const STANDARD_OPTIONS: Array<{ key: StandardFilter; label: string }> = [
  { key: "ALL", label: "Tous" },
  { key: "E1", label: "E1 Climat" },
  { key: "E2", label: "E2 Pollution" },
  { key: "E3", label: "E3 Eau" },
  { key: "E4", label: "E4 Biodiversité" },
  { key: "E5", label: "E5 Ressources" },
  { key: "S1", label: "S1 Effectifs" },
  { key: "S2", label: "S2 Chaîne valeur" },
  { key: "S3", label: "S3 Communautés" },
  { key: "S4", label: "S4 Consommateurs" },
  { key: "G1", label: "G1 Gouvernance" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

function formatValue(
  extraction: ExtractedDatapoint | undefined,
  def: EsrsDatapointDef,
): string {
  if (!extraction || extraction.value === null || extraction.value === undefined)
    return "—";
  if (typeof extraction.value === "number") {
    return `${extraction.value.toLocaleString("fr-FR")}${
      extraction.unit ?? def.unit ? ` ${extraction.unit ?? def.unit}` : ""
    }`;
  }
  if (typeof extraction.value === "boolean") {
    return extraction.value ? "Oui" : "Non";
  }
  const s = String(extraction.value);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

function confidenceColor(conf: number): string {
  if (conf >= 0.8) return "bg-[var(--color-success)]";
  if (conf >= 0.5) return "bg-amber-500";
  return "bg-[var(--color-danger)]";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DatapointReviewPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [standardFilter, setStandardFilter] = useState<StandardFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("extracted");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [openSources, setOpenSources] = useState<{
    datapointId: string;
    label: string;
    standard: string;
    sources: SourceCitation[];
  } | null>(null);
  const [overrideModal, setOverrideModal] = useState<OverrideModal | null>(null);
  const [overrideInputValue, setOverrideInputValue] = useState("");
  const [overrideJustification, setOverrideJustification] = useState("");
  const [rejectJustification, setRejectJustification] = useState<{
    datapointId: string;
    label: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/datapoints/list", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Chargement échoué (${res.status})`);
      setData((await res.json()) as ListResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = useMemo<EsrsDatapointDef[]>(() => {
    if (!data) return [];
    return data.definitions.filter((def) => {
      if (standardFilter !== "ALL" && def.standard !== standardFilter) return false;
      const extraction = data.state.datapoints[def.id];
      const status = extraction?.status ?? "empty";
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      // Ne montrer que les datapoints qui ont été extraits ou au-delà
      if (statusFilter === "ALL" && status === "empty") return false;
      return true;
    });
  }, [data, standardFilter, statusFilter]);

  const stats = useMemo(() => {
    if (!data) return { extracted: 0, validated: 0, rejected: 0 };
    let extracted = 0, validated = 0, rejected = 0;
    for (const def of data.definitions) {
      const s = data.state.datapoints[def.id]?.status;
      if (s === "extracted") extracted++;
      else if (s === "validated") validated++;
      else if (s === "rejected") rejected++;
    }
    return { extracted, validated, rejected };
  }, [data]);

  // ── Review actions ────────────────────────────────────────────────────────

  const doReview = useCallback(
    async (
      datapointId: string,
      action: ReviewAction,
      overrideValue?: ExtractedDatapoint["value"],
      justification?: string,
    ) => {
      setBusyIds((prev) => new Set(prev).add(datapointId));
      try {
        const res = await fetch("/api/datapoints/review", {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            datapointId,
            action,
            ...(overrideValue !== undefined && { overrideValue }),
            ...(justification && { justification }),
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Erreur ${res.status}`);
        }
        // Refresh local state
        await load();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erreur lors de la revue");
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(datapointId);
          return next;
        });
      }
    },
    [load],
  );

  const handleAccept = (datapointId: string) => {
    void doReview(datapointId, "accept");
  };

  const handleOpenOverride = (def: EsrsDatapointDef, extraction: ExtractedDatapoint) => {
    setOverrideInputValue(
      extraction.value !== null && extraction.value !== undefined
        ? String(extraction.value)
        : "",
    );
    setOverrideJustification("");
    setOverrideModal({
      datapointId: def.id,
      label: def.label_fr,
      currentValue: extraction.value,
      unit: extraction.unit ?? def.unit,
    });
  };

  const handleConfirmOverride = () => {
    if (!overrideModal) return;
    const raw = overrideInputValue.trim();
    const numericAttempt = parseFloat(raw);
    const overrideValue = !isNaN(numericAttempt) ? numericAttempt : raw;
    void doReview(overrideModal.datapointId, "override", overrideValue, overrideJustification);
    setOverrideModal(null);
  };

  const handleOpenReject = (def: EsrsDatapointDef) => {
    setRejectReason("");
    setRejectJustification({ datapointId: def.id, label: def.label_fr });
  };

  const handleConfirmReject = () => {
    if (!rejectJustification) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 3) {
      alert("Le motif de rejet doit faire au moins 3 caractères.");
      return;
    }
    void doReview(rejectJustification.datapointId, "reject", undefined, rejectReason.trim());
    setRejectJustification(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-carbon-emerald" aria-hidden />
          Review des datapoints ESRS
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Validez, surchargez ou rejetez les valeurs extraites par le copilote IA avant export iXBRL.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="En attente" count={stats.extracted} color="text-blue-600" />
        <StatCard label="Validés" count={stats.validated} color="text-[var(--color-success)]" />
        <StatCard label="Rejetés" count={stats.rejected} color="text-[var(--color-danger)]" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Standard filter */}
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-foreground-muted)] pointer-events-none" />
          <select
            value={standardFilter}
            onChange={(e) => setStandardFilter(e.target.value as StandardFilter)}
            className="pl-7 pr-6 py-1.5 text-xs border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] text-[var(--color-foreground)] appearance-none cursor-pointer"
            aria-label="Filtrer par standard ESRS"
          >
            {STANDARD_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-foreground-muted)] pointer-events-none" />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5">
          {(
            [
              { key: "extracted", label: "À valider" },
              { key: "validated", label: "Validés" },
              { key: "rejected", label: "Rejetés" },
              { key: "ALL", label: "Tous" },
            ] as Array<{ key: StatusFilter; label: string }>
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                statusFilter === key
                  ? "bg-carbon-emerald text-white"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Rafraîchir
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {loading && !data && (
          <div className="p-10 text-center text-sm text-[var(--color-foreground-muted)]">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Chargement…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-10 text-center" data-testid="review-empty">
            <CheckCircle2 className="w-10 h-10 mx-auto text-[var(--color-foreground-subtle)] mb-3" />
            <p className="text-sm text-[var(--color-foreground-muted)]">
              Aucun datapoint pour ce filtre.
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                  <th className="px-3 py-2 text-left font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide text-[10px] w-16">
                    Standard
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide text-[10px]">
                    Datapoint
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide text-[10px] w-28">
                    Confiance
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide text-[10px] w-32">
                    Valeur extraite
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide text-[10px] w-24">
                    Statut
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide text-[10px] w-48">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((def) => {
                  const extraction = data?.state.datapoints[def.id];
                  return (
                    <DatapointRow
                      key={def.id}
                      def={def}
                      extraction={extraction}
                      busy={busyIds.has(def.id)}
                      onAccept={() => handleAccept(def.id)}
                      onOverride={() =>
                        extraction && handleOpenOverride(def, extraction)
                      }
                      onReject={() => handleOpenReject(def)}
                      onShowSources={() => {
                        if (!extraction) return;
                        setOpenSources({
                          datapointId: def.id,
                          label: def.label_fr,
                          standard: def.standard,
                          sources: extraction.sources,
                        });
                      }}
                      formatValue={() => formatValue(extraction, def)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Source side panel */}
      {openSources && (
        <SourceSidePanel
          datapointId={openSources.datapointId}
          label={openSources.label}
          standard={openSources.standard}
          sources={openSources.sources}
          onClose={() => setOpenSources(null)}
        />
      )}

      {/* Override modal */}
      {overrideModal && (
        <OverrideDialog
          modal={overrideModal}
          inputValue={overrideInputValue}
          justification={overrideJustification}
          onInputChange={setOverrideInputValue}
          onJustificationChange={setOverrideJustification}
          onConfirm={handleConfirmOverride}
          onCancel={() => setOverrideModal(null)}
        />
      )}

      {/* Reject modal */}
      {rejectJustification && (
        <RejectDialog
          label={rejectJustification.label}
          reason={rejectReason}
          onReasonChange={setRejectReason}
          onConfirm={handleConfirmReject}
          onCancel={() => setRejectJustification(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)] mb-1">
        {label}
      </p>
      <p className={`font-display text-2xl font-extrabold ${color}`}>{count}</p>
    </div>
  );
}

function DatapointRow({
  def,
  extraction,
  busy,
  onAccept,
  onOverride,
  onReject,
  onShowSources,
  formatValue: fmtVal,
}: {
  def: EsrsDatapointDef;
  extraction?: ExtractedDatapoint;
  busy: boolean;
  onAccept: () => void;
  onOverride: () => void;
  onReject: () => void;
  onShowSources: () => void;
  formatValue: () => string;
}) {
  const status = extraction?.status ?? "empty";
  const statusMeta = STATUS_META[status];
  const StatusIcon = statusMeta.Icon;
  const conf = extraction?.confidence ?? 0;
  const confPct = Math.round(conf * 100);
  const hasActions = status === "extracted";
  const hasSources = (extraction?.sources.length ?? 0) > 0;

  return (
    <tr
      className="hover:bg-[var(--color-surface-muted)]/50 transition-colors"
      data-testid={`review-row-${def.id}`}
    >
      {/* Standard */}
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-[var(--color-surface-muted)] text-[var(--color-foreground-muted)] border border-[var(--color-border)]">
          {def.standard}
        </span>
      </td>

      {/* Label + id */}
      <td className="px-3 py-2.5 max-w-xs">
        <p className="font-medium text-[var(--color-foreground)] leading-snug">
          {def.label_fr}
        </p>
        <p className="font-mono text-[10px] text-[var(--color-foreground-muted)] mt-0.5">
          {def.id}
        </p>
        {extraction?.reasoning && (
          <p className="text-[10px] text-[var(--color-foreground-muted)] mt-1 italic line-clamp-1">
            {extraction.reasoning}
          </p>
        )}
      </td>

      {/* Confidence bar */}
      <td className="px-3 py-2.5">
        {extraction ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--color-foreground-muted)]">
                {confPct} %
              </span>
            </div>
            <div className="h-1.5 w-20 rounded-full bg-[var(--color-border)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${confidenceColor(conf)}`}
                style={{ width: `${confPct}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-[var(--color-foreground-subtle)]">—</span>
        )}
      </td>

      {/* Value */}
      <td className="px-3 py-2.5 font-mono text-[var(--color-foreground)]">
        {fmtVal()}
      </td>

      {/* Status badge */}
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMeta.bg} ${statusMeta.color}`}
        >
          <StatusIcon className="w-2.5 h-2.5" aria-hidden />
          {statusMeta.label}
        </span>
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          {hasSources && (
            <button
              onClick={onShowSources}
              className="px-2 py-1 rounded-md text-[10px] font-medium border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
              title="Voir les sources"
              data-testid={`sources-${def.id}`}
            >
              Sources ({extraction?.sources.length})
            </button>
          )}

          {hasActions && (
            <>
              <button
                onClick={onAccept}
                disabled={busy}
                className="px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--color-success)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                title="Accepter la valeur extraite"
                data-testid={`accept-${def.id}`}
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Accepter"}
              </button>
              <button
                onClick={onOverride}
                disabled={busy}
                className="px-2 py-1 rounded-md text-[10px] font-medium border border-amber-400 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
                title="Surcharger avec une nouvelle valeur"
                data-testid={`override-${def.id}`}
              >
                Surcharger
              </button>
              <button
                onClick={onReject}
                disabled={busy}
                className="px-2 py-1 rounded-md text-[10px] font-medium border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50 transition-colors"
                title="Rejeter ce datapoint"
                data-testid={`reject-${def.id}`}
              >
                Rejeter
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function OverrideDialog({
  modal,
  inputValue,
  justification,
  onInputChange,
  onJustificationChange,
  onConfirm,
  onCancel,
}: {
  modal: OverrideModal;
  inputValue: string;
  justification: string;
  onInputChange: (v: string) => void;
  onJustificationChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-2xl w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="font-display font-bold text-base text-[var(--color-foreground)]">
            Surcharger la valeur
          </h3>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-1 leading-relaxed">
            <span className="font-medium">{modal.label}</span>
            {modal.unit && (
              <span className="ml-1 text-[var(--color-foreground-subtle)]">
                (unité : {modal.unit})
              </span>
            )}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
              Nouvelle valeur
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={modal.currentValue !== null ? String(modal.currentValue) : "Saisissez la valeur corrigée"}
              className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-subtle)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald/40"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
              Justification{" "}
              <span className="font-normal text-[var(--color-foreground-subtle)]">(optionnel)</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => onJustificationChange(e.target.value)}
              rows={3}
              placeholder="Expliquez pourquoi vous corrigez cette valeur…"
              className="w-full px-3 py-2 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-subtle)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald/40 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)]"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={!inputValue.trim()}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Confirmer la surcharge
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectDialog({
  label,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
}: {
  label: string;
  reason: string;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-2xl w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="font-display font-bold text-base text-[var(--color-foreground)]">
            Rejeter ce datapoint
          </h3>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
            <span className="font-medium">{label}</span>
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
            Motif de rejet{" "}
            <span className="text-[var(--color-danger)]">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
            placeholder="Expliquez pourquoi ce datapoint est rejeté (ex. : valeur incohérente avec le bilan, source non fiable…)"
            className="w-full px-3 py-2 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]/40 resize-none"
            autoFocus
          />
          {reason.length > 0 && reason.length < 3 && (
            <p className="text-[10px] text-[var(--color-danger)] mt-1">
              Minimum 3 caractères requis
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)]"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={reason.trim().length < 3}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--color-danger)] text-white hover:opacity-90 disabled:opacity-50"
          >
            Confirmer le rejet
          </button>
        </div>
      </div>
    </div>
  );
}
