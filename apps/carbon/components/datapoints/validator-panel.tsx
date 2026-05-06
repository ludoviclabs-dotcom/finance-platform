"use client";

/**
 * ValidatorPanel — affiche le score audit ESRS Set 2 et les findings de validation.
 *
 * Au mount : POST /api/datapoints/validate → récupère le rapport complet.
 * Affiche :
 *   - Score audit 0-100 (gauge SVG circulaire vert/orange/rouge)
 *   - Compteurs : erreurs · warnings · % complétude obligatoire
 *   - Accordéons : Erreurs (rouge), Warnings (orange), Infos (cyan)
 *   - Pour chaque finding : icône, message, badge standard, lien "Voir dans review"
 *
 * Mode compact (`compact={true}`) : juste le cartouche score + count, sans accordéons.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { getAuthToken } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = "error" | "warning" | "info";
type RuleScope = "datapoint" | "standard" | "global";

interface ValidationFinding {
  ruleId: string;
  severity: Severity;
  scope: RuleScope;
  datapointIds: string[];
  message: string;
  suggestion?: string;
  computed?: {
    expected?: number | string | boolean | null;
    actual?: number | string | boolean | null;
    deltaPct?: number;
  };
}

interface ValidationReport {
  cid: string;
  generatedAt: string;
  totalDatapoints: number;
  filledDatapoints: number;
  mandatoryFilledPct: number;
  auditScore: number;
  findings: ValidationFinding[];
  counts: { error: number; warning: number; info: number };
}

interface ValidatorPanelProps {
  /** Mode compact : juste score + counts, sans accordéons. */
  compact?: boolean;
  /** Filtre par standard ESRS (ex: "E1"). */
  standardFilter?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

function scoreColor(score: number): { stroke: string; text: string; bg: string } {
  if (score >= 80) return { stroke: "#10b981", text: "text-[var(--color-success)]", bg: "bg-[var(--color-success)]/10" };
  if (score >= 50) return { stroke: "#f59e0b", text: "text-amber-600", bg: "bg-amber-50" };
  return { stroke: "#ef4444", text: "text-[var(--color-danger)]", bg: "bg-[var(--color-danger)]/10" };
}

function severityStyles(severity: Severity) {
  switch (severity) {
    case "error":
      return {
        Icon: XCircle,
        color: "text-[var(--color-danger)]",
        bg: "bg-[var(--color-danger)]/5",
        border: "border-[var(--color-danger)]/30",
        label: "Erreurs",
      };
    case "warning":
      return {
        Icon: AlertTriangle,
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        label: "Warnings",
      };
    case "info":
      return {
        Icon: Info,
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        label: "Infos",
      };
  }
}

function standardFromDpId(id: string): string {
  const m = id.match(/^([A-Z]\d+)/);
  return m?.[1] ?? "?";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ValidatorPanel({ compact = false, standardFilter }: ValidatorPanelProps) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<Severity, boolean>>({
    error: true,
    warning: false,
    info: false,
  });

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/datapoints/validate", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(standardFilter ? { standards: [standardFilter] } : {}),
      });
      if (!res.ok) throw new Error(`Validation échouée (${res.status})`);
      const json = (await res.json()) as { report: ValidationReport };
      setReport(json.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [standardFilter]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const toggleSection = (sev: Severity) => {
    setOpenSections((prev) => ({ ...prev, [sev]: !prev[sev] }));
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading && !report) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-foreground-muted)]" />
        <span className="text-sm text-[var(--color-foreground-muted)]">Validation en cours…</span>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (error && !report) {
    return (
      <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-[var(--color-danger)] mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-danger)]">Validation indisponible</p>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{error}</p>
          <button
            onClick={fetchReport}
            className="text-xs text-[var(--color-danger)] underline mt-1"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const score = report.auditScore;
  const colors = scoreColor(score);
  const completedPct = Math.round(report.mandatoryFilledPct);
  const errorsByStandard = groupBySeverity(report.findings);

  // ── Compact mode ──────────────────────────────────────────────────────────

  if (compact) {
    return (
      <div className={`rounded-xl border ${colors.bg} px-3 py-2 flex items-center gap-3`}>
        <ScoreGauge score={score} size={32} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase font-semibold text-[var(--color-foreground-muted)]">
            Score audit
          </p>
          <p className={`text-sm font-extrabold ${colors.text}`}>
            {score}/100
            <span className="ml-2 font-normal text-[10px] text-[var(--color-foreground-muted)]">
              {report.counts.error} err · {report.counts.warning} warn
            </span>
          </p>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] disabled:opacity-50"
          title="Re-vérifier"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }

  // ── Full mode ─────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-[var(--color-border)] flex items-start gap-4">
        <ScoreGauge score={score} size={88} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-base font-bold text-[var(--color-foreground)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-carbon-emerald" />
              Validation audit-grade
            </h2>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
              30+ règles
            </span>
          </div>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">
            Cohérence inter-datapoints, bornes valeurs, complétude obligatoire ESRS Set 2.
          </p>

          <div className="grid grid-cols-3 gap-3 mt-3">
            <Stat label="Erreurs" value={report.counts.error} tone="danger" />
            <Stat label="Warnings" value={report.counts.warning} tone="warning" />
            <Stat label="Complétude" value={`${completedPct}%`} tone="info" />
          </div>
        </div>

        <button
          onClick={fetchReport}
          disabled={loading}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
          title="Re-vérifier"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Re-vérifier
        </button>
      </div>

      {/* Findings sections */}
      {(["error", "warning", "info"] as Severity[]).map((sev) => {
        const findings = errorsByStandard[sev];
        if (findings.length === 0) return null;
        const styles = severityStyles(sev);
        const StyleIcon = styles.Icon;
        const isOpen = openSections[sev];

        return (
          <div key={sev} className="border-b border-[var(--color-border)] last:border-b-0">
            <button
              type="button"
              onClick={() => toggleSection(sev)}
              className={`w-full px-5 py-3 flex items-center gap-3 hover:bg-[var(--color-surface-muted)]/50 transition-colors`}
            >
              <StyleIcon className={`w-4 h-4 ${styles.color} flex-shrink-0`} />
              <span className={`text-sm font-semibold ${styles.color}`}>
                {styles.label}
              </span>
              <span className={`text-[10px] font-bold ${styles.color} ${styles.bg} px-2 py-0.5 rounded-full`}>
                {findings.length}
              </span>
              <span className="ml-auto text-[var(--color-foreground-muted)]">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
            </button>

            {isOpen && (
              <ul className="divide-y divide-[var(--color-border)]">
                {findings.map((f, i) => (
                  <FindingItem key={`${f.ruleId}-${i}`} finding={f} />
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {report.counts.error === 0 && report.counts.warning === 0 && report.counts.info === 0 && (
        <div className="p-8 text-center" data-testid="validator-no-findings">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[var(--color-success)] mb-3" />
          <p className="text-sm font-semibold text-[var(--color-foreground)]">
            Aucun écart détecté
          </p>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
            Toutes les règles déclaratives passent. Vérifié à{" "}
            {new Date(report.generatedAt).toLocaleTimeString("fr-FR")}.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreGauge({ score, size }: { score: number; size: number }) {
  const colors = scoreColor(score);
  const circumference = 2 * Math.PI * (size / 2 - 4);
  const dashOffset = circumference - (score / 100) * circumference;
  return (
    <svg width={size} height={size} className="-rotate-90 flex-shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - 4}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={size > 60 ? 6 : 4}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - 4}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={size > 60 ? 6 : 4}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className={`font-display font-extrabold ${colors.text}`}
        style={{ fontSize: size > 60 ? 18 : 11, transform: "rotate(90deg)", transformOrigin: "center" }}
      >
        {score}
      </text>
    </svg>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "danger" | "warning" | "info";
}) {
  const cls =
    tone === "danger"
      ? "text-[var(--color-danger)]"
      : tone === "warning"
        ? "text-amber-600"
        : "text-blue-600";
  return (
    <div className="rounded-lg bg-[var(--color-surface-muted)] px-2.5 py-1.5">
      <p className="text-[10px] uppercase font-semibold text-[var(--color-foreground-muted)] truncate">
        {label}
      </p>
      <p className={`font-display text-base font-extrabold ${cls}`}>{value}</p>
    </div>
  );
}

function FindingItem({ finding }: { finding: ValidationFinding }) {
  const styles = severityStyles(finding.severity);
  const standard = finding.datapointIds.length > 0 ? standardFromDpId(finding.datapointIds[0]) : null;
  const reviewLink = finding.datapointIds.length > 0 ? `/review` : null;

  return (
    <li className="px-5 py-3 hover:bg-[var(--color-surface-muted)]/30 transition-colors">
      <div className="flex items-start gap-3">
        <span className={`flex-shrink-0 mt-0.5 ${styles.color}`}>
          <styles.Icon className="w-3.5 h-3.5" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--color-foreground)] leading-relaxed">
            {finding.message}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {standard && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${styles.bg} ${styles.color} border ${styles.border}`}>
                {standard}
              </span>
            )}
            <code className="text-[10px] font-mono text-[var(--color-foreground-muted)]">
              {finding.ruleId}
            </code>
            {finding.datapointIds.slice(0, 3).map((dpId) => (
              <code key={dpId} className="text-[10px] font-mono text-[var(--color-foreground-subtle)]">
                {dpId}
              </code>
            ))}
            {finding.datapointIds.length > 3 && (
              <span className="text-[10px] text-[var(--color-foreground-subtle)]">
                +{finding.datapointIds.length - 3}
              </span>
            )}
          </div>
          {finding.suggestion && (
            <p className="text-[10px] text-[var(--color-foreground-muted)] italic mt-1">
              💡 {finding.suggestion}
            </p>
          )}
        </div>
        {reviewLink && (
          <Link
            href={reviewLink}
            className="flex-shrink-0 text-[10px] font-semibold text-carbon-emerald hover:text-carbon-emerald-light flex items-center gap-0.5"
          >
            Review →
          </Link>
        )}
      </div>
    </li>
  );
}

function groupBySeverity(findings: ValidationFinding[]): Record<Severity, ValidationFinding[]> {
  const groups: Record<Severity, ValidationFinding[]> = { error: [], warning: [], info: [] };
  for (const f of findings) groups[f.severity].push(f);
  return groups;
}
