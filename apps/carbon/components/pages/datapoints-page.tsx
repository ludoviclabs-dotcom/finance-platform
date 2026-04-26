"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Circle,
  XCircle,
  Filter,
  RefreshCw,
  FileText,
  ExternalLink,
  X,
  Loader2,
} from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { getAuthToken } from "@/lib/api";
import type {
  EsrsDatapointDef,
  ExtractedDatapoint,
  Standard,
} from "@/lib/esrs/schema";

type StatusKey = "empty" | "extracted" | "validated" | "rejected";

type ListResponse = {
  version: string;
  definitions: EsrsDatapointDef[];
  state: { cid: string; updatedAt: string; datapoints: Record<string, ExtractedDatapoint> };
};

type ExtractResult = {
  datapointId: string;
  status: "ok" | "skipped" | "error";
  extraction?: ExtractedDatapoint;
  detail?: string;
};

type UploadFileResult = {
  status: "ok" | "error";
  filename: string;
  url?: string;
  mimeType?: string;
  detail?: string;
};

const STATUS_META: Record<StatusKey, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  empty: { label: "Vide", icon: Circle, color: "text-[var(--color-foreground-subtle)]", bg: "bg-[var(--color-foreground-subtle)]/15" },
  extracted: { label: "Extrait", icon: CheckCircle2, color: "text-carbon-emerald-light", bg: "bg-carbon-emerald/15" },
  validated: { label: "Validé", icon: CheckCircle2, color: "text-[var(--color-success)]", bg: "bg-[var(--color-success)]/15" },
  rejected: { label: "Rejeté", icon: XCircle, color: "text-red-400", bg: "bg-red-500/15" },
};

const STANDARDS_FILTER: Array<{ key: "ALL" | Standard; label: string }> = [
  { key: "ALL", label: "Tous" },
  { key: "E1", label: "E1 Climat" },
  { key: "S1", label: "S1 Effectifs" },
  { key: "G1", label: "G1 Gouvernance" },
];

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

function formatValue(d: ExtractedDatapoint | undefined, def: EsrsDatapointDef): string {
  if (!d || d.value === null || d.value === undefined) return "—";
  if (typeof d.value === "number") {
    return `${d.value.toLocaleString("fr-FR")}${d.unit ?? def.unit ? ` ${d.unit ?? def.unit}` : ""}`;
  }
  return String(d.value);
}

export function DatapointsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [standardFilter, setStandardFilter] = useState<"ALL" | Standard>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | StatusKey>("ALL");
  const [extractingIds, setExtractingIds] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [openDrawer, setOpenDrawer] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadFileResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/datapoints/list", { headers: authHeaders() });
      if (!res.ok) {
        throw new Error(`Chargement échoué (${res.status})`);
      }
      const json = (await res.json()) as ListResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo<EsrsDatapointDef[]>(() => {
    if (!data) return [];
    return data.definitions.filter((d) => {
      if (standardFilter !== "ALL" && d.standard !== standardFilter) return false;
      if (statusFilter !== "ALL") {
        const e = data.state.datapoints[d.id];
        const s: StatusKey = e?.status ?? "empty";
        if (s !== statusFilter) return false;
      }
      return true;
    });
  }, [data, standardFilter, statusFilter]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, extracted: 0, validated: 0, rejected: 0 };
    let extracted = 0,
      validated = 0,
      rejected = 0;
    for (const def of data.definitions) {
      const e = data.state.datapoints[def.id];
      if (!e) continue;
      if (e.status === "extracted") extracted++;
      else if (e.status === "validated") validated++;
      else if (e.status === "rejected") rejected++;
    }
    return { total: data.definitions.length, extracted, validated, rejected };
  }, [data]);

  const runExtract = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setExtractingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      setBatchProgress({ done: 0, total: ids.length });
      try {
        const res = await fetch("/api/datapoints/extract", {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ datapointIds: ids }),
        });
        if (!res.ok) {
          const detail = await res.text();
          throw new Error(detail || `Extraction échouée (${res.status})`);
        }
        const json = (await res.json()) as { results: ExtractResult[] };
        setData((prev) => {
          if (!prev) return prev;
          const datapoints = { ...prev.state.datapoints };
          for (const r of json.results) {
            if (r.extraction) datapoints[r.datapointId] = r.extraction;
          }
          return {
            ...prev,
            state: { ...prev.state, datapoints, updatedAt: new Date().toISOString() },
          };
        });
        setBatchProgress({ done: ids.length, total: ids.length });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur extraction");
      } finally {
        setExtractingIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        setTimeout(() => setBatchProgress(null), 2500);
      }
    },
    [],
  );

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploadStatus(`Upload de ${files.length} fichier(s)…`);
      try {
        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append("files", f));
        const upRes = await fetch("/api/rag/upload", {
          method: "POST",
          headers: authHeaders(),
          body: fd,
        });
        if (!upRes.ok && upRes.status !== 207) {
          throw new Error(`Upload échoué (${upRes.status})`);
        }
        const upJson = (await upRes.json()) as { files: UploadFileResult[] };
        setUploadedDocs((prev) => [...prev, ...upJson.files]);
        const ok = upJson.files.filter((f) => f.status === "ok" && f.url);
        if (ok.length === 0) {
          setUploadStatus("Aucun fichier valide.");
          return;
        }
        setUploadStatus(`Ingestion vectorielle de ${ok.length} document(s)…`);
        const ingestRes = await fetch("/api/rag/ingest", {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            documents: ok.map((f) => ({
              blobUrl: f.url!,
              filename: f.filename,
              mimeType: f.mimeType,
            })),
          }),
        });
        if (!ingestRes.ok && ingestRes.status !== 207) {
          throw new Error(`Ingestion échouée (${ingestRes.status})`);
        }
        setUploadStatus(`${ok.length} document(s) ingéré(s) — prêts pour l'extraction.`);
        setTimeout(() => setUploadStatus(null), 4000);
      } catch (err) {
        setUploadStatus(err instanceof Error ? err.message : "Erreur upload");
      }
    },
    [],
  );

  const drawerExtraction = openDrawer && data ? data.state.datapoints[openDrawer] : null;
  const drawerDef = openDrawer && data ? data.definitions.find((d) => d.id === openDrawer) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6 max-w-[1400px] mx-auto"
    >
      <SectionTitle
        title="Datapoints ESRS — Extraction LLM-RAG"
        subtitle={
          data
            ? `Référentiel ${data.version} · ${data.definitions.length} datapoints obligatoires`
            : "Chargement du référentiel…"
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} tone="neutral" />
        <StatCard label="Extraits" value={stats.extracted} tone="emerald" />
        <StatCard label="Validés" value={stats.validated} tone="success" />
        <StatCard label="Rejetés / faible confiance" value={stats.rejected} tone="danger" />
      </div>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-foreground)] flex items-center gap-2">
              <FileText className="w-4 h-4" /> Documents sources
            </h2>
            <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
              PDF, Word ou Excel internes (RH, factures énergie, contrats fournisseurs). 25 Mo max
              par fichier.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald/15 text-carbon-emerald-light text-sm font-semibold hover:bg-carbon-emerald/25 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" /> Importer des documents
            </button>
          </div>
        </div>
        {uploadStatus && (
          <p className="text-xs mt-3 text-[var(--color-foreground-muted)]">{uploadStatus}</p>
        )}
        {uploadedDocs.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm">
            {uploadedDocs.map((d, i) => (
              <li key={`${d.filename}-${i}`} className="flex items-center justify-between gap-3 text-[var(--color-foreground-muted)]">
                <span className="truncate">{d.filename}</span>
                <span className={d.status === "ok" ? "text-carbon-emerald-light text-xs" : "text-red-400 text-xs"}>
                  {d.status === "ok" ? "ok" : d.detail ?? "erreur"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <header className="flex flex-wrap items-center gap-3 justify-between p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-[var(--color-foreground-muted)]" />
            <FilterGroup
              value={standardFilter}
              options={STANDARDS_FILTER}
              onChange={setStandardFilter}
            />
            <FilterGroup
              value={statusFilter}
              options={[
                { key: "ALL", label: "Tous statuts" },
                { key: "empty", label: "Vide" },
                { key: "extracted", label: "Extrait" },
                { key: "validated", label: "Validé" },
                { key: "rejected", label: "Rejeté" },
              ]}
              onChange={setStatusFilter}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
            </button>
            <button
              type="button"
              onClick={() => runExtract(filtered.map((d) => d.id))}
              disabled={extractingIds.size > 0 || filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-emerald text-white text-xs font-semibold hover:bg-carbon-emerald-light disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Extraire ({filtered.length})
            </button>
          </div>
        </header>

        {batchProgress && (
          <div className="px-4 py-2 text-xs text-[var(--color-foreground-muted)] border-b border-[var(--color-border)]">
            Extraction en cours · {batchProgress.done}/{batchProgress.total}
          </div>
        )}

        {loading ? (
          <div className="p-12 flex items-center justify-center text-[var(--color-foreground-muted)] text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement du référentiel…
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[11px] uppercase text-[var(--color-foreground-subtle)]">
                  <th className="text-left px-4 py-2 font-medium">Datapoint</th>
                  <th className="text-left px-4 py-2 font-medium">Standard</th>
                  <th className="text-left px-4 py-2 font-medium">Valeur</th>
                  <th className="text-left px-4 py-2 font-medium">Confiance</th>
                  <th className="text-left px-4 py-2 font-medium">Statut</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((def) => {
                  const ext = data?.state.datapoints[def.id];
                  const status: StatusKey = ext?.status ?? "empty";
                  const meta = STATUS_META[status];
                  const Icon = meta.icon;
                  const isExtracting = extractingIds.has(def.id);
                  return (
                    <tr
                      key={def.id}
                      className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-raised)] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--color-foreground)]">{def.label_fr}</div>
                        <div className="text-[11px] text-[var(--color-foreground-subtle)] mt-0.5">
                          {def.id} {def.mandatory ? "· obligatoire" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-foreground-muted)] text-xs">
                        {def.standard} {def.code}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">
                        {formatValue(ext, def)}
                      </td>
                      <td className="px-4 py-3">
                        {ext ? (
                          <ConfidenceBar value={ext.confidence} />
                        ) : (
                          <span className="text-[var(--color-foreground-subtle)] text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${meta.bg} ${meta.color}`}>
                          <Icon className="w-3 h-3" /> {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {ext && ext.sources.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setOpenDrawer(def.id)}
                              className="text-xs text-[var(--color-foreground-muted)] hover:text-carbon-emerald-light cursor-pointer"
                            >
                              Sources ({ext.sources.length})
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isExtracting}
                            onClick={() => runExtract([def.id])}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)] disabled:opacity-50 cursor-pointer"
                          >
                            {isExtracting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            {ext ? "Re-extraire" : "Extraire"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--color-foreground-muted)]">
                      Aucun datapoint ne correspond à ces filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AnimatePresence>
        {openDrawer && drawerDef && drawerExtraction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end"
            onClick={() => setOpenDrawer(null)}
          >
            <motion.aside
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: "spring", damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full max-w-[480px] bg-[var(--color-surface)] border-l border-[var(--color-border)] overflow-y-auto"
            >
              <header className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                <div>
                  <h3 className="font-semibold text-[var(--color-foreground)]">
                    {drawerDef.label_fr}
                  </h3>
                  <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">
                    {drawerDef.standard} {drawerDef.code} · {drawerExtraction.sources.length} source(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenDrawer(null)}
                  className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>
              <div className="p-4 space-y-4">
                {drawerExtraction.reasoning && (
                  <div>
                    <p className="text-[11px] uppercase text-[var(--color-foreground-subtle)] mb-1">Raisonnement</p>
                    <p className="text-sm text-[var(--color-foreground-muted)] leading-relaxed">
                      {drawerExtraction.reasoning}
                    </p>
                  </div>
                )}
                <div className="space-y-3">
                  {drawerExtraction.sources.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-[var(--color-foreground)] truncate">
                          {s.filename}
                          {s.page ? ` · p.${s.page}` : ""}
                          {s.sheet ? ` · ${s.sheet}` : ""}
                        </span>
                        <a
                          href={s.blobUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-foreground-muted)] hover:text-carbon-emerald-light"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <p className="text-xs text-[var(--color-foreground-muted)] leading-relaxed whitespace-pre-wrap">
                        {s.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "emerald" | "success" | "danger" }) {
  const toneClass = {
    neutral: "text-[var(--color-foreground)]",
    emerald: "text-carbon-emerald-light",
    success: "text-[var(--color-success)]",
    danger: "text-red-400",
  }[tone];
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-foreground-subtle)]">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? "bg-[var(--color-success)]" : value >= 0.5 ? "bg-carbon-emerald" : "bg-[var(--color-warning)]";
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-[var(--color-foreground-muted)] tabular-nums w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

function FilterGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ key: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            value === opt.key
              ? "bg-carbon-emerald/15 text-carbon-emerald-light"
              : "text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
