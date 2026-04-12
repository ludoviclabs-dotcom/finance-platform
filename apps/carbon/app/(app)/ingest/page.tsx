"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Leaf,
  Sparkles,
  Scale,
  Banknote,
  Trash2,
  Clock,
} from "lucide-react";
import {
  fetchCacheStatus,
  triggerIngest,
  invalidateCache,
  type CacheStatusResponse,
  type CacheDomainStatus,
  type IngestResponse,
  type IngestDomainResult,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Domain config
// ---------------------------------------------------------------------------

type DomainKey = "carbon" | "vsme" | "esg" | "finance";

const DOMAINS: {
  key: DomainKey;
  label: string;
  description: string;
  Icon: React.ElementType;
  color: string;
}[] = [
  {
    key: "carbon",
    label: "Carbone",
    description: "Scopes 1-2-3, énergie, taxonomie, CBAM, SBTi",
    Icon: Leaf,
    color: "text-emerald-500",
  },
  {
    key: "vsme",
    label: "VSME",
    description: "Profil, environnement, social, gouvernance",
    Icon: Sparkles,
    color: "text-cyan-500",
  },
  {
    key: "esg",
    label: "ESG / Matérialité",
    description: "Scores E-S-G, double matérialité, contrôles qualité",
    Icon: Scale,
    color: "text-amber-500",
  },
  {
    key: "finance",
    label: "Finance",
    description: "Climat, SFDR PAI, benchmark sectoriel",
    Icon: Banknote,
    color: "text-violet-500",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAge(seconds?: number): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} j`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type DomainState = "fresh" | "stale" | "missing" | "error";

function domainState(s: CacheDomainStatus | undefined): DomainState {
  if (!s || !s.exists) return "missing";
  if (s.error) return "error";
  if (s.stale) return "stale";
  return "fresh";
}

// ---------------------------------------------------------------------------
// State pill
// ---------------------------------------------------------------------------

function StatePill({ state }: { state: DomainState }) {
  const map: Record<DomainState, { label: string; cls: string; Icon: React.ElementType }> = {
    fresh: {
      label: "À jour",
      cls: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
      Icon: CheckCircle2,
    },
    stale: {
      label: "Périmé",
      cls: "bg-amber-50 text-amber-600",
      Icon: AlertTriangle,
    },
    missing: {
      label: "Absent",
      cls: "bg-[var(--color-border)] text-[var(--color-foreground-muted)]",
      Icon: Database,
    },
    error: {
      label: "Erreur",
      cls: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
      Icon: XCircle,
    },
  };
  const { label, cls, Icon } = map[state];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IngestPage() {
  const [cache, setCache] = useState<CacheStatusResponse | null>(null);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [cacheError, setCacheError] = useState<string | null>(null);

  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResponse | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const [invalidating, setInvalidating] = useState<DomainKey | "all" | null>(null);

  const loadCache = useCallback(async () => {
    setCacheLoading(true);
    setCacheError(null);
    try {
      const data = await fetchCacheStatus();
      setCache(data);
    } catch (e) {
      setCacheError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      setCacheLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCache();
  }, [loadCache]);

  const handleIngest = async () => {
    setIngesting(true);
    setIngestError(null);
    setIngestResult(null);
    try {
      const res = await triggerIngest();
      setIngestResult(res);
      await loadCache();
    } catch (e) {
      setIngestError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      setIngesting(false);
    }
  };

  const handleInvalidate = async (domain?: DomainKey) => {
    setInvalidating(domain ?? "all");
    try {
      await invalidateCache(domain);
      await loadCache();
    } catch (e) {
      setCacheError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      setInvalidating(null);
    }
  };

  const counts = useMemo(() => {
    const base = { fresh: 0, stale: 0, missing: 0, error: 0 };
    if (!cache) return base;
    for (const d of DOMAINS) {
      base[domainState(cache.domains[d.key])] += 1;
    }
    return base;
  }, [cache]);

  const resultByDomain = useMemo(() => {
    const map: Record<string, IngestDomainResult> = {};
    if (ingestResult) {
      for (const r of ingestResult.domains) map[r.domain] = r;
    }
    return map;
  }, [ingestResult]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
          <Database className="w-6 h-6 text-carbon-emerald" />
          Synchronisation des données
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Recalcule les snapshots depuis les workbooks Excel maîtres et rafraîchit le cache.
        </p>
      </div>

      {/* Error banner */}
      {cacheError && (
        <div className="rounded-2xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
          <span className="text-xs text-[var(--color-danger)]">{cacheError}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "À jour", value: counts.fresh, color: "text-[var(--color-success)]", Icon: CheckCircle2 },
          { label: "Périmés", value: counts.stale, color: "text-amber-600", Icon: AlertTriangle },
          { label: "Absents", value: counts.missing, color: "text-[var(--color-foreground-muted)]", Icon: Database },
          { label: "Erreurs", value: counts.error, color: "text-[var(--color-danger)]", Icon: XCircle },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <k.Icon className={`w-4 h-4 ${k.color}`} />
              <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">
                {k.label}
              </span>
            </div>
            <div className={`font-display text-3xl font-extrabold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Hero action */}
      <div className="rounded-2xl border border-carbon-emerald/30 bg-gradient-to-br from-carbon-emerald/10 to-cyan-500/5 p-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-carbon-emerald/20 flex items-center justify-center flex-shrink-0">
          <RefreshCw className={`w-6 h-6 text-carbon-emerald ${ingesting ? "animate-spin" : ""}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-bold text-[var(--color-foreground)] mb-1">
            Recalculer tous les snapshots
          </h2>
          <p className="text-sm text-[var(--color-foreground-muted)] mb-3">
            Relit les 3 workbooks Excel (Carbone, ESG, Finance) depuis le serveur et régénère les 4
            snapshots avec persistance en cache JSON. Les erreurs par domaine n&apos;interrompent pas
            les autres.
          </p>
          {ingestError && (
            <div className="mb-3 flex items-center gap-2 p-2 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{ingestError}</span>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleIngest}
              disabled={ingesting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {ingesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Synchronisation en cours…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Resynchroniser maintenant
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleInvalidate()}
              disabled={ingesting || invalidating !== null}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {invalidating === "all" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Vider tout le cache
            </button>
          </div>
          {ingestResult && (
            <div className="mt-3 text-xs">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                  ingestResult.status === "ok"
                    ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {ingestResult.status === "ok" ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {ingestResult.status === "ok"
                  ? "Synchronisation complète réussie"
                  : "Synchronisation partielle"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Per-domain list */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
            État par domaine
          </h3>
          <button
            type="button"
            onClick={loadCache}
            disabled={cacheLoading}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${cacheLoading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>

        {cacheLoading && !cache ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-carbon-emerald" />
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {DOMAINS.map((d) => {
              const status = cache?.domains[d.key];
              const state = domainState(status);
              const result = resultByDomain[d.key];
              const DomainIcon = d.Icon;
              return (
                <div key={d.key} className="p-5 flex items-center gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-background)] flex items-center justify-center">
                    <DomainIcon className={`w-5 h-5 ${d.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-semibold text-[var(--color-foreground)]">
                        {d.label}
                      </h4>
                      <StatePill state={state} />
                      {result && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            result.status === "ok"
                              ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                              : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                          }`}
                        >
                          {result.status === "ok" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          Dernier run : {result.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-foreground-muted)] mb-1">
                      {d.description}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-[var(--color-foreground-subtle)]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(status?.cachedAt)}
                      </span>
                      <span>Âge : {formatAge(status?.ageSeconds)}</span>
                    </div>
                    {status?.error && (
                      <p className="mt-1 text-[11px] text-[var(--color-danger)]">
                        {status.error}
                      </p>
                    )}
                    {result?.detail && result.status !== "ok" && (
                      <p className="mt-1 text-[11px] text-[var(--color-danger)]">
                        {result.detail}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInvalidate(d.key)}
                    disabled={ingesting || invalidating !== null || state === "missing"}
                    title="Vider le cache de ce domaine"
                    className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-foreground-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {invalidating === d.key ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Vider
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
