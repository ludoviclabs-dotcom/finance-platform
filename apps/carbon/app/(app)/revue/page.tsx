"use client";

/**
 * /revue — Inbox de validation des datapoints.
 *
 * Affiche les reviews actives (proposed/in_review/validated) pour la company courante.
 * Actions :
 *   - PROPOSED ou IN_REVIEW : Valider (analyst) ou Rejeter
 *   - VALIDATED : Geler (admin)
 *
 * Rôles :
 *   - analyst : peut proposer, valider, rejeter
 *   - admin   : peut en plus geler
 */

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Inbox as InboxIcon,
  Loader2,
  Lock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ReviewStatusBadge } from "@/components/ui/review-status-badge";
import {
  approveReview,
  fetchReviewInbox,
  fetchReviewStats,
  freezeReview,
  rejectReview,
  type InboxResponse,
  type ReviewItem,
  type ReviewStatus,
  type ReviewStats,
} from "@/lib/api";

type FilterStatus = ReviewStatus | "all_active";

export default function RevuePage() {
  const [inbox, setInbox] = useState<InboxResponse | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all_active");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statuses =
        filter === "all_active"
          ? (["proposed", "in_review", "validated"] as ReviewStatus[])
          : [filter];
      const [inboxRes, statsRes] = await Promise.all([
        fetchReviewInbox({ statuses, limit: 100 }),
        fetchReviewStats(),
      ]);
      setInbox(inboxRes);
      setStats(statsRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (id: number) => {
    setBusyId(id);
    try {
      await approveReview(id, null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur lors de la validation");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt("Motif de rejet (obligatoire, min 3 caractères) :");
    if (!reason || reason.trim().length < 3) return;
    setBusyId(id);
    try {
      await rejectReview(id, reason.trim());
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur lors du rejet");
    } finally {
      setBusyId(null);
    }
  };

  const handleFreeze = async (id: number) => {
    if (!window.confirm("Confirmer le gel ? Cette action est irréversible.")) return;
    setBusyId(id);
    try {
      await freezeReview(id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur lors du gel");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
          <InboxIcon className="w-6 h-6 text-carbon-emerald" />
          Inbox de validation
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Revoir et valider les datapoints proposés avant gel dans les rapports.
        </p>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            label="Proposés"
            count={stats.counts.proposed ?? 0}
            Icon={FileText}
            color="text-[var(--color-foreground-muted)]"
          />
          <StatCard
            label="En revue"
            count={stats.counts.in_review ?? 0}
            Icon={Clock}
            color="text-blue-600"
          />
          <StatCard
            label="Validés"
            count={stats.counts.validated ?? 0}
            Icon={CheckCircle2}
            color="text-[var(--color-success)]"
          />
          <StatCard
            label="Figés"
            count={stats.counts.frozen ?? 0}
            Icon={Lock}
            color="text-violet-600"
          />
          <StatCard
            label="Rejetés"
            count={stats.counts.rejected ?? 0}
            Icon={XCircle}
            color="text-[var(--color-danger)]"
          />
        </div>
      )}

      {/* Filters + refresh */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-foreground-muted)] font-semibold uppercase">
            Filtre :
          </span>
          {(
            ["all_active", "proposed", "in_review", "validated", "frozen", "rejected"] as FilterStatus[]
          ).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === s
                  ? "bg-carbon-emerald text-white shadow-sm"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
              }`}
              data-testid={`filter-${s}`}
            >
              {s === "all_active"
                ? "Actifs"
                : s === "proposed"
                  ? "Proposés"
                  : s === "in_review"
                    ? "En revue"
                    : s === "validated"
                      ? "Validés"
                      : s === "frozen"
                        ? "Figés"
                        : "Rejetés"}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
          data-testid="refresh-inbox"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>Rafraîchir</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[var(--color-danger)]">
              Impossible de charger l&apos;inbox
            </p>
            <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* List */}
      <div
        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
        data-testid="reviews-list"
      >
        {loading && !inbox && (
          <div className="p-10 text-center text-sm text-[var(--color-foreground-muted)]">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Chargement…
          </div>
        )}
        {inbox && inbox.items.length === 0 && (
          <div className="p-10 text-center" data-testid="reviews-empty">
            <InboxIcon className="w-10 h-10 mx-auto text-[var(--color-foreground-subtle)] mb-3" />
            <p className="text-sm text-[var(--color-foreground-muted)]">
              Aucune review pour ce filtre.
            </p>
          </div>
        )}
        {inbox && inbox.items.length > 0 && (
          <div className="divide-y divide-[var(--color-border)]">
            {inbox.items.map((r) => (
              <ReviewRow
                key={r.id}
                review={r}
                busy={busyId === r.id}
                onApprove={() => handleApprove(r.id)}
                onReject={() => handleReject(r.id)}
                onFreeze={() => handleFreeze(r.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  count,
  Icon,
  color,
}: {
  label: string;
  count: number;
  Icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} aria-hidden />
        <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">
          {label}
        </span>
      </div>
      <div className={`font-display text-2xl font-extrabold ${color}`}>{count}</div>
    </div>
  );
}

function ReviewRow({
  review,
  busy,
  onApprove,
  onReject,
  onFreeze,
}: {
  review: ReviewItem;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onFreeze: () => void;
}) {
  const { status, fact_code, proposed_at, reviewed_at, frozen_at, comment, reject_reason } =
    review;

  return (
    <div
      className="p-4 flex items-start gap-4"
      data-testid={`review-row-${review.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-mono text-xs text-[var(--color-foreground)] font-semibold">
            {fact_code}
          </span>
          <ReviewStatusBadge status={status} />
        </div>
        <p className="text-xs text-[var(--color-foreground-muted)]">
          Proposé le {formatDate(proposed_at)}
          {reviewed_at && ` · Revu le ${formatDate(reviewed_at)}`}
          {frozen_at && ` · Gelé le ${formatDate(frozen_at)}`}
        </p>
        {comment && (
          <p className="text-xs text-[var(--color-foreground-muted)] mt-2 italic">
            « {comment} »
          </p>
        )}
        {reject_reason && (
          <p className="text-xs text-[var(--color-danger)] mt-2">
            Motif de rejet : {reject_reason}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {(status === "proposed" || status === "in_review") && (
          <>
            <button
              onClick={onApprove}
              disabled={busy}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-success)] text-white hover:opacity-90 disabled:opacity-50"
              data-testid={`approve-${review.id}`}
            >
              Valider
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
              data-testid={`reject-${review.id}`}
            >
              Rejeter
            </button>
          </>
        )}
        {status === "validated" && (
          <button
            onClick={onFreeze}
            disabled={busy}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-violet-600 text-white hover:opacity-90 disabled:opacity-50"
            data-testid={`freeze-${review.id}`}
            title="Geler ce datapoint (irréversible — réservé admin)"
          >
            <Lock className="w-3 h-3 inline-block mr-1" aria-hidden />
            Geler
          </button>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
