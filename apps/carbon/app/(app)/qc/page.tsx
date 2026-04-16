"use client";

import { useMemo, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  HelpCircle,
  Loader2,
  Leaf,
  Banknote,
} from "lucide-react";
import { useEsgSnapshot } from "@/lib/hooks/use-esg-snapshot";
import { useFinanceSnapshot } from "@/lib/hooks/use-finance-snapshot";
import type { EsgQcControl, FinanceQcControl } from "@/lib/api";
import { ProvenanceIntegrityCard } from "@/components/ui/provenance-integrity-card";
import { AuditModeBanner } from "@/components/ui/audit-mode-toggle";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusKey = "OK" | "WARNING" | "ERROR" | "INFO" | "UNKNOWN";
type DomainKey = "ALL" | "ESG" | "FINANCE";
type StatusFilter = "ALL" | StatusKey;

interface UnifiedControl {
  id: string;
  domain: "ESG" | "FINANCE";
  label: string;
  statut: StatusKey;
  statutRaw: string;
  criticite: string;
  action: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeStatus(raw: unknown): StatusKey {
  if (typeof raw !== "string") return "UNKNOWN";
  const upper = raw.trim().toUpperCase();
  if (upper === "OK" || upper === "PASS" || upper === "SUCCESS") return "OK";
  if (upper === "WARNING" || upper === "WARN" || upper.includes("AVERT")) return "WARNING";
  if (upper === "ERROR" || upper === "FAIL" || upper === "KO" || upper.includes("BLOQ")) return "ERROR";
  if (upper === "INFO") return "INFO";
  return "UNKNOWN";
}

function unify(
  controls: (EsgQcControl | FinanceQcControl)[] | undefined,
  domain: "ESG" | "FINANCE",
): UnifiedControl[] {
  if (!controls) return [];
  return controls.map((c) => ({
    id: `${domain}:${c.id}`,
    domain,
    label: c.label,
    statut: normalizeStatus(c.statut),
    statutRaw: typeof c.statut === "string" ? c.statut : "—",
    criticite: typeof c.criticite === "string" ? c.criticite : "—",
    action: c.action,
  }));
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ statut }: { statut: StatusKey }) {
  const map: Record<StatusKey, { label: string; cls: string; Icon: React.ElementType }> = {
    OK: {
      label: "OK",
      cls: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
      Icon: CheckCircle2,
    },
    WARNING: {
      label: "Avert.",
      cls: "bg-amber-50 text-amber-600",
      Icon: AlertTriangle,
    },
    ERROR: {
      label: "Bloquant",
      cls: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
      Icon: XCircle,
    },
    INFO: {
      label: "Info",
      cls: "bg-blue-50 text-blue-600",
      Icon: Info,
    },
    UNKNOWN: {
      label: "—",
      cls: "bg-[var(--color-border)] text-[var(--color-foreground-muted)]",
      Icon: HelpCircle,
    },
  };
  const { label, cls, Icon } = map[statut];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  color,
  Icon,
}: {
  label: string;
  value: number;
  color: string;
  Icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">
          {label}
        </span>
      </div>
      <div className={`font-display text-3xl font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function QcPage() {
  const esgSnap = useEsgSnapshot();
  const financeSnap = useFinanceSnapshot();

  const [domainFilter, setDomainFilter] = useState<DomainKey>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const esgControls = useMemo(
    () => (esgSnap.status === "ready" ? unify(esgSnap.data.qcControls, "ESG") : []),
    [esgSnap],
  );

  const financeControls = useMemo(
    () => (financeSnap.status === "ready" ? unify(financeSnap.data.qcControls, "FINANCE") : []),
    [financeSnap],
  );

  const allControls = useMemo(
    () => [...esgControls, ...financeControls],
    [esgControls, financeControls],
  );

  const counts = useMemo(() => {
    const base = { OK: 0, WARNING: 0, ERROR: 0, INFO: 0, UNKNOWN: 0 };
    for (const c of allControls) base[c.statut] += 1;
    return base;
  }, [allControls]);

  const filtered = useMemo(
    () =>
      allControls.filter((c) => {
        if (domainFilter !== "ALL" && c.domain !== domainFilter) return false;
        if (statusFilter !== "ALL" && c.statut !== statusFilter) return false;
        return true;
      }),
    [allControls, domainFilter, statusFilter],
  );

  const warnings: string[] = [
    ...(esgSnap.status === "ready" ? esgSnap.data.warnings : []),
    ...(financeSnap.status === "ready" ? financeSnap.data.warnings : []),
  ];

  const loading = esgSnap.status === "loading" || financeSnap.status === "loading";
  const errors: string[] = [
    esgSnap.status === "error" ? `ESG : ${esgSnap.error}` : null,
    financeSnap.status === "error" ? `Finance : ${financeSnap.error}` : null,
  ].filter((x): x is string => x !== null);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[var(--color-foreground-muted)]">
          <Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" />
          <span className="text-sm">Chargement du centre de contrôles qualité…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Audit mode banner */}
      <AuditModeBanner />

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-carbon-emerald" />
          Centre de contrôles qualité
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Agrégation des contrôles ESG et Finance avec drill-down, avertissements et actions correctives.
        </p>
      </div>

      {/* Provenance integrity (Phase 2) */}
      <ProvenanceIntegrityCard />

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-4 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--color-danger)]" />
            <span className="text-xs font-semibold uppercase text-[var(--color-danger)]">
              Erreurs de chargement
            </span>
          </div>
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-[var(--color-danger)] pl-6">
              {e}
            </p>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="OK" value={counts.OK} color="text-[var(--color-success)]" Icon={CheckCircle2} />
        <KpiCard label="Avertissements" value={counts.WARNING} color="text-amber-600" Icon={AlertTriangle} />
        <KpiCard label="Bloquants" value={counts.ERROR} color="text-[var(--color-danger)]" Icon={XCircle} />
        <KpiCard label="Info" value={counts.INFO} color="text-blue-600" Icon={Info} />
        <KpiCard
          label="Inconnus"
          value={counts.UNKNOWN}
          color="text-[var(--color-foreground-muted)]"
          Icon={HelpCircle}
        />
      </div>

      {/* Warnings aggregated */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              {warnings.length} avertissement{warnings.length > 1 ? "s" : ""} snapshot
            </span>
          </div>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 pl-6">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-foreground-muted)] font-semibold uppercase tracking-wide">
            Domaine :
          </span>
          {(["ALL", "ESG", "FINANCE"] as DomainKey[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDomainFilter(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                domainFilter === d
                  ? "bg-carbon-emerald text-white shadow-sm"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {d === "ALL" ? "Tous" : d === "ESG" ? "ESG" : "Finance"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-foreground-muted)] font-semibold uppercase tracking-wide">
            Statut :
          </span>
          {(["ALL", "OK", "WARNING", "ERROR", "INFO", "UNKNOWN"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? "bg-carbon-emerald text-white shadow-sm"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {s === "ALL"
                ? "Tous"
                : s === "OK"
                  ? "OK"
                  : s === "WARNING"
                    ? "Avert."
                    : s === "ERROR"
                      ? "Bloquant"
                      : s === "INFO"
                        ? "Info"
                        : "Inconnu"}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-[var(--color-foreground-muted)]">
          {filtered.length} contrôle{filtered.length > 1 ? "s" : ""} affiché
          {filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Controls list */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--color-foreground-muted)]">
            Aucun contrôle pour ce filtre.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filtered
              .slice()
              .sort((a, b) => {
                const order: Record<StatusKey, number> = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3, OK: 4 };
                return order[a.statut] - order[b.statut];
              })
              .map((c) => {
                const DomainIcon = c.domain === "ESG" ? Leaf : Banknote;
                const domainCls =
                  c.domain === "ESG" ? "text-emerald-500" : "text-violet-500";
                return (
                  <div key={c.id} className="p-4 flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <DomainIcon className={`w-4 h-4 ${domainCls}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[11px] text-[var(--color-foreground-muted)]">
                          {c.id.replace(/^(ESG|FINANCE):/, "")}
                        </span>
                        <StatusPill statut={c.statut} />
                        {c.criticite !== "—" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-foreground-muted)] font-semibold">
                            {c.criticite}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-foreground)] leading-snug">
                        {c.label}
                      </p>
                      {c.action && (
                        <p className="text-xs text-[var(--color-foreground-muted)] mt-1 leading-relaxed">
                          → {c.action}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
