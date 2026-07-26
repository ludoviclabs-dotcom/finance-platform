"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Cloud,
  Database,
  Factory,
  FileCheck2,
  FileText,
  Filter,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";

import {
  fetchExportPackages,
  fetchReviewStats,
  type ChainVerification,
  type ConsolidatedSnapshot,
  type ExportPackageListItem,
  type ReviewStats,
  verifyFactsChain,
} from "@/lib/api";
import { useConsolidatedSnapshot } from "@/lib/hooks/use-consolidated-snapshot";
import { useKpiProvenance } from "@/lib/hooks/use-kpi-provenance";
import {
  filterProofTwinNodes,
  getProofTwinStatusCounts,
  isProofTwinLive,
  PROOF_TWIN_NODES,
  resolveProofTwinMetric,
  type ProofTwinFilters,
  type ProofTwinNode,
  type ProofTwinScope,
  type ProofTwinStage,
  type ProofTwinStandard,
  type ProofTwinStatus,
} from "@/lib/proof-twin";

type RemoteState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

const SCOPE_FILTERS: Array<{ key: ProofTwinScope | "all"; label: string }> = [
  { key: "all", label: "Tous scopes" },
  { key: "scope1", label: "Scope 1" },
  { key: "scope2", label: "Scope 2" },
  { key: "scope3", label: "Scope 3" },
];

const STANDARD_FILTERS: Array<{ key: ProofTwinStandard | "all"; label: string }> = [
  { key: "all", label: "Tous ESRS" },
  { key: "E1", label: "ESRS E1" },
  { key: "S1", label: "ESRS S1" },
  { key: "G1", label: "ESRS G1" },
];

const STATUS_FILTERS: Array<{ key: ProofTwinStatus | "all"; label: string }> = [
  { key: "all", label: "Toutes preuves" },
  { key: "complete", label: "Preuve complete" },
  { key: "review", label: "A valider" },
  { key: "missing", label: "Donnee manquante" },
];

const STAGES: Array<{ key: ProofTwinStage; label: string; helper: string }> = [
  { key: "sources", label: "Sources", helper: "Fichiers, fournisseurs, systemes" },
  { key: "datapoints", label: "Datapoints", helper: "Scopes, ESRS, valeurs" },
  { key: "controls", label: "Controles", helper: "Coherence et alertes" },
  { key: "review", label: "Validation", helper: "Humain, statut, gel" },
  { key: "export", label: "Export", helper: "ZIP, manifest, /verify" },
];

const SCENE_POSITIONS: Record<
  ProofTwinNode["id"],
  { left: string; top: string; Icon: React.ElementType }
> = {
  site: { left: "43%", top: "43%", Icon: Factory },
  energy: { left: "30%", top: "18%", Icon: Zap },
  suppliers: { left: "8%", top: "55%", Icon: Users },
  transport: { left: "27%", top: "72%", Icon: Truck },
  digital: { left: "68%", top: "18%", Icon: Cloud },
  "esrs-report": { left: "76%", top: "58%", Icon: FileCheck2 },
};

export function ProofTwinPage() {
  const consolidated = useConsolidatedSnapshot();
  const snapshot = consolidated.status === "ready" ? consolidated.data : null;
  const live = isProofTwinLive(snapshot);

  const [filters, setFilters] = useState<ProofTwinFilters>({
    scope: "all",
    standard: "all",
    status: "all",
  });
  const [selectedId, setSelectedId] = useState<ProofTwinNode["id"] | null>(null);
  const [chain, setChain] = useState<RemoteState<ChainVerification>>({
    status: "loading",
  });
  const [reviews, setReviews] = useState<RemoteState<ReviewStats>>({
    status: "loading",
  });
  const [packages, setPackages] = useState<RemoteState<ExportPackageListItem[]>>({
    status: "loading",
  });

  const loadAuditStrip = useCallback(async () => {
    setChain({ status: "loading" });
    setReviews({ status: "loading" });
    setPackages({ status: "loading" });

    const [chainRes, reviewRes, packageRes] = await Promise.allSettled([
      verifyFactsChain(),
      fetchReviewStats(),
      fetchExportPackages({ limit: 1 }),
    ]);

    if (chainRes.status === "fulfilled") {
      setChain({ status: "ready", data: chainRes.value });
    } else {
      setChain({
        status: "error",
        message: chainRes.reason instanceof Error ? chainRes.reason.message : "Indisponible",
      });
    }

    if (reviewRes.status === "fulfilled") {
      setReviews({ status: "ready", data: reviewRes.value });
    } else {
      setReviews({
        status: "error",
        message: reviewRes.reason instanceof Error ? reviewRes.reason.message : "Indisponible",
      });
    }

    if (packageRes.status === "fulfilled") {
      setPackages({ status: "ready", data: packageRes.value.items });
    } else {
      setPackages({
        status: "error",
        message: packageRes.reason instanceof Error ? packageRes.reason.message : "Indisponible",
      });
    }
  }, []);

  useEffect(() => {
    void loadAuditStrip();
  }, [loadAuditStrip]);

  const filteredNodes = useMemo(
    () => filterProofTwinNodes(PROOF_TWIN_NODES, filters),
    [filters],
  );

  useEffect(() => {
    if (selectedId && !filteredNodes.some((node) => node.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredNodes, selectedId]);

  const selectedNode =
    selectedId ? filteredNodes.find((node) => node.id === selectedId) ?? null : null;
  const statusCounts = getProofTwinStatusCounts(PROOF_TWIN_NODES);
  const lastPackage = packages.status === "ready" ? packages.data[0] : undefined;
  const canGeneratePackage = Boolean(lastPackage) || statusCounts.missing === 0;

  return (
    <div className="min-h-full bg-[var(--color-background)] p-6" data-testid="proof-twin-page">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-carbon-emerald">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              ProofTwin Carbon&Co
            </div>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[var(--color-foreground)]">
              Chaine de decision carbone verifiable
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-foreground-muted)]">
              Reliez site, energie, fournisseurs, controles, validation humaine et
              export auditable dans une seule lecture exploitable par DAF, RSE et OTI.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadAuditStrip}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-foreground-muted)] transition-colors hover:text-[var(--color-foreground)]"
              data-testid="proof-refresh"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Rafraichir preuves
            </button>
            <Link
              href={canGeneratePackage ? "/revue" : "/datapoints"}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 ${
                canGeneratePackage ? "bg-carbon-emerald" : "bg-amber-600"
              }`}
              data-testid="proof-primary-cta"
            >
              {canGeneratePackage ? (
                <>
                  <Package className="h-4 w-4" aria-hidden />
                  Generer Evidence Pack
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Corriger les preuves manquantes
                </>
              )}
            </Link>
          </div>
        </header>

        {!live && consolidated.status !== "loading" && (
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            data-testid="proof-demo-banner"
          >
            Donnees de demonstration : aucun snapshot carbone live complet n&apos;est
            disponible. Les valeurs ci-dessous servent de parcours Industrie et ne
            doivent pas etre utilisees comme rapport officiel.
          </div>
        )}

        <AuditStrip
          chain={chain}
          reviews={reviews}
          packages={packages}
          generatedAt={snapshot?.generatedAt ?? null}
          live={live}
        />

        <FilterBar filters={filters} onChange={setFilters} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <ValueChainScene
            nodes={filteredNodes}
            selectedId={selectedNode?.id ?? null}
            snapshot={snapshot}
            onSelect={setSelectedId}
          />
          <EvidenceOverview
            nodes={filteredNodes}
            snapshot={snapshot}
            onSelect={setSelectedId}
          />
        </div>

        <EvidencePipeline
          nodes={filteredNodes}
          selectedId={selectedNode?.id ?? null}
          onSelect={setSelectedId}
        />
      </div>

      {selectedNode && (
        <EvidenceDrawer
          node={selectedNode}
          metric={resolveProofTwinMetric(selectedNode, snapshot)}
          lastPackage={lastPackage}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function AuditStrip({
  chain,
  reviews,
  packages,
  generatedAt,
  live,
}: {
  chain: RemoteState<ChainVerification>;
  reviews: RemoteState<ReviewStats>;
  packages: RemoteState<ExportPackageListItem[]>;
  generatedAt: string | null;
  live: boolean;
}) {
  const lastPackage = packages.status === "ready" ? packages.data[0] : undefined;
  const reviewFrozen =
    reviews.status === "ready" ? (reviews.data.counts.frozen ?? 0) : null;
  const reviewValidated =
    reviews.status === "ready" ? (reviews.data.counts.validated ?? 0) : null;

  return (
    <section
      className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
      data-testid="proof-audit-strip"
    >
      <AuditCard
        label="Integrite chaine"
        value={
          chain.status === "loading"
            ? "Verification..."
            : chain.status === "ready" && chain.data.ok
              ? "Chaine saine"
              : "A verifier"
        }
        detail={
          chain.status === "ready"
            ? `${chain.data.checked} event${chain.data.checked > 1 ? "s" : ""} verifies`
            : chain.status === "error"
              ? chain.message
              : "SHA-256 append-only"
        }
        tone={chain.status === "ready" && chain.data.ok ? "success" : "warning"}
        Icon={chain.status === "loading" ? Loader2 : ShieldCheck}
        spinning={chain.status === "loading"}
      />
      <AuditCard
        label="Fraicheur donnees"
        value={live ? "Snapshot live" : "Mode demo"}
        detail={generatedAt ? `Genere le ${formatDate(generatedAt)}` : "Aucun snapshot consolide"}
        tone={live ? "success" : "warning"}
        Icon={Database}
      />
      <AuditCard
        label="Validation humaine"
        value={
          reviewFrozen !== null || reviewValidated !== null
            ? `${reviewFrozen ?? 0} figes`
            : "Inbox indisponible"
        }
        detail={
          reviewValidated !== null
            ? `${reviewValidated} valides avant export`
            : reviews.status === "error"
              ? reviews.message
              : "Chargement review"
        }
        tone={reviewFrozen && reviewFrozen > 0 ? "success" : "neutral"}
        Icon={FileCheck2}
      />
      <AuditCard
        label="Dernier export"
        value={lastPackage ? shortHash(lastPackage.manifest_hash) : "Aucun package"}
        detail={
          lastPackage
            ? `${lastPackage.event_count} events · ${formatDate(lastPackage.generated_at)}`
            : packages.status === "error"
              ? packages.message
              : "Evidence Pack non genere"
        }
        tone={lastPackage ? "success" : "neutral"}
        Icon={Package}
      />
    </section>
  );
}

function AuditCard({
  label,
  value,
  detail,
  tone,
  Icon,
  spinning = false,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "neutral";
  Icon: React.ElementType;
  spinning?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--color-success)] bg-[var(--color-success)]/10"
      : tone === "warning"
        ? "text-amber-600 bg-amber-50"
        : "text-[var(--color-foreground-muted)] bg-[var(--color-surface-muted)]";

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-foreground-muted)]">
          {label}
        </span>
        <span className={`rounded-lg p-2 ${toneClass}`}>
          <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} aria-hidden />
        </span>
      </div>
      <p className="mt-3 font-display text-lg font-bold text-[var(--color-foreground)]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--color-foreground-muted)]">{detail}</p>
    </div>
  );
}

function FilterBar({
  filters,
  onChange,
}: {
  filters: ProofTwinFilters;
  onChange: (next: ProofTwinFilters) => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-foreground-muted)]">
        <Filter className="h-4 w-4" aria-hidden />
        Filtres audit
      </div>
      <div className="flex flex-wrap gap-3">
        <FilterGroup
          items={SCOPE_FILTERS}
          value={filters.scope}
          testPrefix="proof-filter-scope"
          onSelect={(scope) => onChange({ ...filters, scope })}
        />
        <FilterGroup
          items={STANDARD_FILTERS}
          value={filters.standard}
          testPrefix="proof-filter-standard"
          onSelect={(standard) => onChange({ ...filters, standard })}
        />
        <FilterGroup
          items={STATUS_FILTERS}
          value={filters.status}
          testPrefix="proof-filter-status"
          onSelect={(status) => onChange({ ...filters, status })}
        />
      </div>
    </section>
  );
}

function FilterGroup<T extends string>({
  items,
  value,
  testPrefix,
  onSelect,
}: {
  items: Array<{ key: T; label: string }>;
  value: T;
  testPrefix: string;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === item.key
              ? "bg-carbon-emerald text-white"
              : "border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
          }`}
          data-testid={`${testPrefix}-${item.key}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ValueChainScene({
  nodes,
  selectedId,
  snapshot,
  onSelect,
}: {
  nodes: ProofTwinNode[];
  selectedId: ProofTwinNode["id"] | null;
  snapshot: ConsolidatedSnapshot | null;
  onSelect: (id: ProofTwinNode["id"]) => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--color-foreground)]">
            Carte de chaine de valeur
          </h2>
          <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
            Une vue 2.5D pour naviguer dans les preuves, pas une scene decorative.
          </p>
        </div>
        <span className="rounded-full border border-carbon-emerald/30 bg-carbon-emerald/10 px-3 py-1 text-xs font-semibold text-carbon-emerald">
          Industrie
        </span>
      </div>

      <div className="relative min-h-[380px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[linear-gradient(180deg,var(--color-background),var(--color-surface-muted))]">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          aria-hidden
          preserveAspectRatio="none"
        >
          <path d="M15 64 L44 49 L34 26" className="stroke-[var(--color-border-strong)]" strokeWidth="0.6" fill="none" strokeDasharray="2 2" />
          <path d="M44 49 L76 65" className="stroke-[var(--color-border-strong)]" strokeWidth="0.8" fill="none" />
          <path d="M44 49 L74 27" className="stroke-[var(--color-border-strong)]" strokeWidth="0.6" fill="none" strokeDasharray="2 2" />
          <path d="M32 78 L44 49" className="stroke-[var(--color-border-strong)]" strokeWidth="0.6" fill="none" />
        </svg>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(5,150,105,0.08))]" />
        <div className="absolute bottom-8 left-1/2 h-16 w-80 -translate-x-1/2 rounded-[50%] bg-black/10 blur-2xl" />

        {nodes.map((node) => {
          const pos = SCENE_POSITIONS[node.id];
          const Icon = pos.Icon;
          const metric = resolveProofTwinMetric(node, snapshot);
          const selected = node.id === selectedId;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node.id)}
              className={`absolute min-w-[118px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-3 text-left shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg ${
                selected
                  ? "border-carbon-emerald bg-carbon-emerald text-white"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]"
              }`}
              style={{ left: pos.left, top: pos.top }}
              data-testid={`proof-twin-node-${node.id}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-lg p-2 ${
                    selected ? "bg-white/15 text-white" : "bg-carbon-emerald/10 text-carbon-emerald"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-xs font-bold">{node.shortLabel}</span>
              </div>
              <div className={`mt-2 font-mono text-[11px] ${selected ? "text-white/80" : "text-[var(--color-foreground-muted)]"}`}>
                {formatMetric(metric.value, metric.unit)}
              </div>
              <ProofStatusDot status={node.status} selected={selected} floating />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EvidenceOverview({
  nodes,
  snapshot,
  onSelect,
}: {
  nodes: ProofTwinNode[];
  snapshot: ConsolidatedSnapshot | null;
  onSelect: (id: ProofTwinNode["id"]) => void;
}) {
  const counts = getProofTwinStatusCounts(nodes);

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--color-foreground)]">
            Indice de preuve
          </h2>
          <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
            Les noeuds affiches par les filtres et leur statut de decision.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniCount label="Completes" value={counts.complete} tone="success" />
          <MiniCount label="A valider" value={counts.review} tone="warning" />
          <MiniCount label="Manquantes" value={counts.missing} tone="danger" />
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-foreground-muted)]">
          Aucun noeud ne correspond aux filtres.
        </div>
      ) : (
        <div className="space-y-3">
          {nodes.map((node) => {
            const metric = resolveProofTwinMetric(node, snapshot);
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect(node.id)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-left transition-colors hover:border-carbon-emerald/50"
                data-testid={`proof-overview-${node.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--color-foreground)]">
                        {node.label}
                      </span>
                      <ProofStatusBadge status={node.status} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--color-foreground-muted)]">
                      {node.claim}
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs text-[var(--color-foreground-muted)]">
                    {formatMetric(metric.value, metric.unit)}
                    <div className="mt-1 text-[10px] uppercase tracking-wide">
                      {metric.source === "live" ? "live" : metric.source === "demo" ? "demo" : "n/a"}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EvidencePipeline({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: ProofTwinNode[];
  selectedId: ProofTwinNode["id"] | null;
  onSelect: (id: ProofTwinNode["id"]) => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold text-[var(--color-foreground)]">
          Pipeline de preuve
        </h2>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Sources vers datapoints, controles, validation et export public verifiable.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {STAGES.map((stage, idx) => {
          const stageNodes = nodes.filter((node) => node.stage === stage.key);
          return (
            <div key={stage.key} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-foreground)]">
                    {stage.label}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[var(--color-foreground-muted)]">
                    {stage.helper}
                  </p>
                </div>
                {idx < STAGES.length - 1 && (
                  <ArrowRight className="mt-1 hidden h-4 w-4 text-[var(--color-foreground-subtle)] lg:block" aria-hidden />
                )}
              </div>
              <div className="space-y-2">
                {stageNodes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-[11px] text-[var(--color-foreground-subtle)]">
                    Aucun noeud
                  </div>
                ) : (
                  stageNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onSelect(node.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        node.id === selectedId
                          ? "border-carbon-emerald bg-carbon-emerald/10"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-carbon-emerald/40"
                      }`}
                      data-testid={`proof-pipeline-${node.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--color-foreground)]">
                          {node.shortLabel}
                        </span>
                        <ProofStatusDot status={node.status} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--color-foreground-muted)]">
                        {node.sourceLabel}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EvidenceDrawer({
  node,
  metric,
  lastPackage,
  onClose,
}: {
  node: ProofTwinNode;
  metric: ReturnType<typeof resolveProofTwinMetric>;
  lastPackage?: ExportPackageListItem;
  onClose: () => void;
}) {
  const { trail, loading, error } = useKpiProvenance(node.factCode ?? null, {
    limit: 1,
    enabled: Boolean(node.factCode),
  });
  const latestEvent = trail?.events[0];

  return (
    <aside
      className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[520px] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      role="dialog"
      aria-labelledby="proof-drawer-title"
      data-testid="proof-drawer"
    >
      <header className="border-b border-[var(--color-border)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ProofStatusBadge status={node.status} />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-foreground-muted)]">
                Confiance {node.confidence}
              </span>
            </div>
            <h2 id="proof-drawer-title" className="font-display text-xl font-bold text-[var(--color-foreground)]">
              {node.label}
            </h2>
            <p className="mt-1 font-mono text-xs text-[var(--color-foreground-muted)]">
              {node.factCode ?? "fact_code a creer"} · {formatMetric(metric.value, metric.unit)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
            aria-label="Fermer le panneau ProofTwin"
            data-testid="proof-drawer-close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-4">
          <EvidenceSection title="Ce que je vois" Icon={Factory}>
            <p>{node.claim}</p>
          </EvidenceSection>
          <EvidenceSection title="Pourquoi c'est important" Icon={ShieldCheck}>
            <p>{node.why}</p>
          </EvidenceSection>
          <EvidenceSection title="Preuve" Icon={FileText}>
            <p>{node.sourceLabel}</p>
            <div className="mt-3 rounded-lg bg-[var(--color-background)] p-3">
              {node.factCode ? (
                loading ? (
                  <p className="flex items-center gap-2 text-xs text-[var(--color-foreground-muted)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Chargement du dernier event de provenance...
                  </p>
                ) : error ? (
                  <p className="text-xs text-amber-600">
                    Trail indisponible : {error}
                  </p>
                ) : latestEvent ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--color-foreground-muted)]">
                        Dernier event
                      </span>
                      <span className="font-mono text-[var(--color-foreground)]">
                        {formatDate(latestEvent.computed_at)}
                      </span>
                    </div>
                    <div className="break-all font-mono text-[11px] text-[var(--color-foreground-muted)]">
                      hash_self {latestEvent.hash_self}
                    </div>
                    <div className="truncate font-mono text-[11px] text-[var(--color-foreground-muted)]">
                      source {latestEvent.source_path}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-foreground-muted)]">
                    Aucun event live pour ce fact_code. Le noeud reste en mode
                    demonstration ou a valider.
                  </p>
                )
              ) : (
                <p className="text-xs text-[var(--color-foreground-muted)]">
                  Ce noeud doit encore etre rattache a un fact_code autonome.
                </p>
              )}
            </div>
          </EvidenceSection>
          <EvidenceSection title="Methode" Icon={Database}>
            <p>{node.method}</p>
          </EvidenceSection>
          <EvidenceSection title="Limite connue" Icon={AlertTriangle}>
            <p>{node.limitation}</p>
          </EvidenceSection>
          <EvidenceSection title="Action suivante" Icon={ArrowRight}>
            <p>{node.nextAction}</p>
            <Link
              href={node.route}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-carbon-emerald px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              Ouvrir {node.route}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </EvidenceSection>
        </div>
      </div>

      <footer className="border-t border-[var(--color-border)] p-4">
        <div className="rounded-xl bg-[var(--color-background)] p-3 text-xs text-[var(--color-foreground-muted)]">
          {lastPackage ? (
            <>
              Dernier manifest public :{" "}
              <Link
                href={`/verify/${lastPackage.manifest_hash}`}
                className="font-mono text-carbon-emerald hover:underline"
              >
                {shortHash(lastPackage.manifest_hash)}
              </Link>
            </>
          ) : (
            "Aucun Evidence Pack enregistre pour cette organisation."
          )}
        </div>
      </footer>
    </aside>
  );
}

function EvidenceSection({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-foreground-muted)]">
        <Icon className="h-4 w-4 text-carbon-emerald" aria-hidden />
        {title}
      </h3>
      <div className="text-sm leading-6 text-[var(--color-foreground)]">{children}</div>
    </section>
  );
}

function MiniCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger";
}) {
  const cls =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "warning"
        ? "text-amber-600"
        : "text-[var(--color-danger)]";
  return (
    <div>
      <div className={`font-display text-lg font-extrabold ${cls}`}>{value}</div>
      <div className="text-[10px] text-[var(--color-foreground-muted)]">{label}</div>
    </div>
  );
}

function ProofStatusBadge({ status }: { status: ProofTwinStatus }) {
  const meta = {
    complete: {
      label: "Preuve complete",
      cls: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
      Icon: CheckCircle2,
    },
    review: {
      label: "A valider",
      cls: "bg-amber-50 text-amber-600",
      Icon: CircleDashed,
    },
    missing: {
      label: "Donnee manquante",
      cls: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
      Icon: AlertTriangle,
    },
  }[status];
  const StatusIcon = meta.Icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
      <StatusIcon className="h-3 w-3" aria-hidden />
      {meta.label}
    </span>
  );
}

function ProofStatusDot({
  status,
  selected = false,
  floating = false,
}: {
  status: ProofTwinStatus;
  selected?: boolean;
  floating?: boolean;
}) {
  const cls =
    status === "complete"
      ? "bg-[var(--color-success)]"
      : status === "review"
        ? "bg-amber-500"
        : "bg-[var(--color-danger)]";
  return (
    <span
      className={`${floating ? "absolute right-2 top-2" : "inline-block shrink-0"} h-2.5 w-2.5 rounded-full ${cls} ${
        selected ? "ring-2 ring-white/70" : ""
      }`}
      aria-hidden
    />
  );
}

function formatMetric(value: number | null, unit: string): string {
  if (value === null) return "n/a";
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${unit}`;
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

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}
