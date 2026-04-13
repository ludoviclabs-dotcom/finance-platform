"use client";

import { useState } from "react";
import {
  ClipboardList,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Upload,
  Database,
  Trash2,
  LogIn,
  FileText,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { useAudit } from "@/lib/hooks/use-audit";
import type { AuditEvent, AuditEventType } from "@/lib/api";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EVENT_TYPES: { key: AuditEventType | "all"; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "ingest", label: "Sync" },
  { key: "upload", label: "Upload" },
  { key: "cache_clear", label: "Cache" },
  { key: "login", label: "Connexion" },
  { key: "export", label: "Export" },
  { key: "validation", label: "Validation" },
  { key: "error", label: "Erreurs" },
];

const TYPE_CONFIG: Record<AuditEventType, { Icon: React.ElementType; color: string; bg: string }> = {
  ingest:      { Icon: Database,     color: "text-cyan-500",     bg: "bg-cyan-50" },
  upload:      { Icon: Upload,       color: "text-emerald-500",  bg: "bg-emerald-50" },
  cache_clear: { Icon: Trash2,       color: "text-amber-500",    bg: "bg-amber-50" },
  login:       { Icon: LogIn,        color: "text-violet-500",   bg: "bg-violet-50" },
  export:      { Icon: FileText,     color: "text-blue-500",     bg: "bg-blue-50" },
  validation:  { Icon: ShieldCheck,  color: "text-indigo-500",   bg: "bg-indigo-50" },
  error:       { Icon: XCircle,      color: "text-red-500",      bg: "bg-red-50" },
};

const STATUS_CONFIG = {
  ok:      { label: "OK",         cls: "bg-[var(--color-success-bg)] text-[var(--color-success)]",  Icon: CheckCircle2 },
  warning: { label: "Avert.",     cls: "bg-amber-50 text-amber-600",                                Icon: AlertTriangle },
  error:   { label: "Erreur",     cls: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",    Icon: XCircle },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `Il y a ${diff}s`;
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    return `Il y a ${Math.floor(diff / 86400)}j`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Event row
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  const typeCfg = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.error;
  const statusCfg = STATUS_CONFIG[event.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.ok;
  const { Icon } = typeCfg;
  const StatusIcon = statusCfg.Icon;
  const hasMeta = event.meta && Object.keys(event.meta).length > 0;

  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
      >
        {/* Type icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeCfg.bg}`}>
          <Icon className={`w-4 h-4 ${typeCfg.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-[var(--color-foreground)] truncate">
              {event.title}
            </span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${statusCfg.cls}`}>
              <StatusIcon className="w-2.5 h-2.5" />
              {statusCfg.label}
            </span>
          </div>
          {event.detail && (
            <p className="text-xs text-[var(--color-foreground-muted)] truncate">{event.detail}</p>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-[var(--color-foreground-muted)]">{relativeTime(event.timestamp)}</p>
          <p className="text-[10px] text-[var(--color-foreground-subtle)]">{formatDate(event.timestamp)}</p>
        </div>
      </button>

      {/* Meta expandable */}
      {expanded && hasMeta && (
        <div className="px-4 pb-3 pl-15">
          <pre className="text-[10px] text-[var(--color-foreground-muted)] bg-[var(--color-background)] rounded-lg p-3 overflow-x-auto border border-[var(--color-border)]">
            {JSON.stringify(event.meta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditPage() {
  const [typeFilter, setTypeFilter] = useState<AuditEventType | "all">("all");
  const audit = useAudit({ limit: 100 });

  const filteredEvents = audit.status === "ready"
    ? (typeFilter === "all"
      ? audit.events
      : audit.events.filter((e) => e.type === typeFilter))
    : [];

  const counts = audit.status === "ready"
    ? audit.events.reduce(
        (acc, e) => ({ ...acc, [e.type]: (acc[e.type] ?? 0) + 1 }),
        {} as Record<string, number>
      )
    : {};

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-carbon-emerald" />
          Journal d&apos;audit
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Historique des opérations : imports, synchronisations, exports, connexions.
        </p>
      </div>

      {/* Error */}
      {audit.status === "error" && (
        <div className="rounded-2xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
          <span className="text-xs text-[var(--color-danger)]">{audit.error}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-[var(--color-foreground-muted)]" />
          {EVENT_TYPES.map((t) => {
            const active = typeFilter === t.key;
            const count = t.key === "all"
              ? (audit.status === "ready" ? audit.events.length : 0)
              : (counts[t.key] ?? 0);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTypeFilter(t.key)}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-carbon-emerald text-white"
                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:border-carbon-emerald"
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className={`text-[10px] ${active ? "opacity-70" : "opacity-60"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={audit.refresh}
          disabled={audit.status === "loading"}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${audit.status === "loading" ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* Events list */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {audit.status === "loading" ? (
          <div className="p-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-carbon-emerald" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList className="w-10 h-10 text-[var(--color-foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-foreground-muted)]">
              {typeFilter === "all"
                ? "Aucun événement enregistré."
                : `Aucun événement de type « ${typeFilter} ».`}
            </p>
            <p className="text-xs text-[var(--color-foreground-subtle)] mt-1">
              Les événements apparaîtront ici après la première synchronisation.
            </p>
          </div>
        ) : (
          <div>
            {filteredEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      {audit.status === "ready" && filteredEvents.length > 0 && (
        <p className="text-xs text-center text-[var(--color-foreground-subtle)]">
          {filteredEvents.length} événement{filteredEvents.length > 1 ? "s" : ""} affiché{filteredEvents.length > 1 ? "s" : ""}
          {typeFilter !== "all" ? ` sur ${audit.events.length} au total` : ""}
        </p>
      )}
    </div>
  );
}
