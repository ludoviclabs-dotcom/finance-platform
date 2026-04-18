"use client";

/**
 * NEURAL — ApprovalCard (Sprint 5)
 *
 * Reviewer UI for a single pending HITL approval.
 * Displays run context, confidence, expiry countdown and approve/reject actions.
 *
 * Usage:
 *   <ApprovalCard approval={pendingApproval} reviewerId={session.user.id} />
 */

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, ShieldAlert, User, ChevronDown, ChevronUp } from "lucide-react";
import type { PendingApproval } from "@/lib/hitl";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCountdown(expiresAt: Date): string {
  const diff = expiresAt.getTime() - Date.now();
  if (diff <= 0) return "Expiré";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null)
    return <span className="text-xs text-slate-400 italic">Score absent</span>;
  const pct = Math.round(confidence * 100);
  const cls =
    pct >= 70 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {pct} % confiance
    </span>
  );
}

function TierBadge({ tier }: { tier: "USER" | "SUPERVISOR" }) {
  return tier === "SUPERVISOR" ? (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-red-50 text-red-700">
      <ShieldAlert className="h-3 w-3" />
      Superviseur
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700">
      <User className="h-3 w-3" />
      Utilisateur
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  approval: PendingApproval;
  reviewerId: string;
  onReviewed?: (id: string, action: "approved" | "rejected") => void;
};

type ActionState = "idle" | "loading" | "done" | "error";

export function ApprovalCard({ approval, reviewerId, onReviewed }: Props) {
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(approval.expiresAt),
  );
  const [showQuestion, setShowQuestion] = useState(false);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [state, setState] = useState<ActionState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Live countdown
  useEffect(() => {
    const interval = setInterval(
      () => setCountdown(formatCountdown(approval.expiresAt)),
      30_000,
    );
    return () => clearInterval(interval);
  }, [approval.expiresAt]);

  const submit = useCallback(
    async (action: "approve" | "reject") => {
      if (action === "reject" && !reason.trim()) {
        setErrorMsg("Un motif de refus est requis.");
        return;
      }
      setState("loading");
      setErrorMsg("");

      try {
        const res = await fetch(`/api/approvals/${approval.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-reviewer-id": reviewerId,
          },
          body: JSON.stringify({ action, reason: reason.trim() || undefined }),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error: string };
          throw new Error(data.error);
        }

        setState("done");
        onReviewed?.(approval.id, action === "approve" ? "approved" : "rejected");
      } catch (err) {
        setState("error");
        setErrorMsg(err instanceof Error ? err.message : "Erreur inconnue.");
      }
    },
    [approval.id, reason, reviewerId, onReviewed],
  );

  if (state === "done") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Action enregistrée.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <TierBadge tier={approval.tier} />
          <span className="text-xs font-mono text-slate-400">{approval.run.agentId}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          {countdown}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Question */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-slate-700 font-medium line-clamp-2">
              {approval.run.question}
            </p>
            <button
              onClick={() => setShowQuestion((v) => !v)}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label="Afficher la question complète"
            >
              {showQuestion ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          {showQuestion && (
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">
              {approval.run.question}
            </p>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceBadge confidence={approval.run.confidence} />
          {approval.run.user && (
            <span className="text-xs text-slate-400">
              par {approval.run.user.name ?? approval.run.user.email}
            </span>
          )}
        </div>

        {/* Reject reason */}
        {showReject && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Motif du refus *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              placeholder="Expliquez pourquoi cette réponse ne peut pas être validée…"
            />
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <p className="text-xs text-red-600">{errorMsg}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            disabled={state === "loading"}
            onClick={() => submit("approve")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approuver
          </button>

          {!showReject ? (
            <button
              disabled={state === "loading"}
              onClick={() => setShowReject(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 hover:bg-red-50 text-red-600 text-sm font-medium py-2 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Rejeter
            </button>
          ) : (
            <button
              disabled={state === "loading" || !reason.trim()}
              onClick={() => submit("reject")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Confirmer le refus
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
